import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { isDeviceRestrictionEnabled, verifyDeviceToken, DEVICE_TOKEN_COOKIE } from "@/lib/device-auth";
import { IDLE_TIMEOUT_MS, SESSION_DURATION_SECONDS } from "@/lib/session-policy";

const COOKIE_NAME = "session";
// "/" is public at the middleware layer because the page itself decides
// where to send an unauthenticated visitor (first-run "/setup" wizard vs.
// "/login") based on whether any user exists yet — middleware can't do that
// DB lookup at the edge, so it must let the request through untouched.
const PUBLIC_PATHS = ["/", "/login", "/setup"];
const BACKEND_ROLES = new Set(["ADMIN"]);
// Always reachable regardless of device restriction: the unlock page/API
// themselves (or nobody could ever unlock a new device), and cron (Vercel's
// scheduler has no device cookie and is separately authenticated via
// CRON_SECRET).
const DEVICE_CHECK_EXEMPT_PREFIXES = ["/apparaat", "/api/device", "/api/cron"];

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

// A per-request nonce lets script-src stay locked to 'self' while still
// allowing Next.js's own inline hydration/streaming scripts to run — Next
// automatically applies this same nonce to the scripts it injects once it
// sees it in the response's CSP header. Without a nonce, a static
// script-src blocks those scripts: the server-rendered HTML still paints,
// but React never hydrates and the page goes blank shortly after.
function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    // Uploads (protocollen) go through our own server (same-origin) rather
    // than a direct browser-to-storage request, so 'self' covers it.
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Set only once a valid, non-idle session's lastActivity claim has been
  // refreshed below — attached to whichever response variant actually gets
  // returned, so the sliding idle window advances on every authenticated
  // request, not just ones that reach next().
  let refreshedToken: string | null = null;

  function withSessionCookie(response: NextResponse) {
    if (refreshedToken) {
      response.cookies.set(COOKIE_NAME, refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DURATION_SECONDS,
      });
    }
    return response;
  }

  function next() {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return withSessionCookie(response);
  }

  function redirect(url: URL) {
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    return withSessionCookie(response);
  }

  function json(body: unknown, status: number) {
    const response = NextResponse.json(body, { status });
    response.headers.set("Content-Security-Policy", csp);
    return withSessionCookie(response);
  }

  // Device restriction (Backend/env-configured, see lib/device-auth.ts):
  // gates the ENTIRE app, including /login and /setup, behind a one-time
  // per-device passcode unlock at /apparaat. Deliberately env-var-gated
  // (DEVICE_RESTRICTION_ENABLED/DEVICE_PASSCODE), not an in-app toggle —
  // an in-app toggle for something that can block the whole app (including
  // the settings page you'd use to undo it) is a lockout waiting to happen,
  // which is exactly what happened with the IP-based network restriction
  // this replaces. Recovery here only ever requires Vercel dashboard access
  // (flip the env var, redeploy), same as JWT_SECRET/CRON_SECRET issues.
  const deviceExempt = DEVICE_CHECK_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  if (!deviceExempt && isDeviceRestrictionEnabled()) {
    const deviceToken = request.cookies.get(DEVICE_TOKEN_COOKIE)?.value;
    if (!(await verifyDeviceToken(deviceToken))) {
      if (pathname.startsWith("/api")) {
        return json({ error: "Dit apparaat is niet vrijgegeven" }, 403);
      }
      const unlockUrl = new URL("/apparaat", request.url);
      unlockUrl.searchParams.set("next", pathname);
      return redirect(unlockUrl);
    }
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/device") ||
    pathname.startsWith("/apparaat") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secretKey = getSecretKey();
  let role: string | null = null;
  let valid = false;

  if (token && secretKey) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      // A token from before this deploy has no lastActivity claim at all —
      // treat that as "just active" rather than "infinitely stale", so
      // rollout doesn't instantly log out every session already in use.
      const lastActivity = typeof payload.lastActivity === "number" ? payload.lastActivity : Date.now();
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        // Reuse the existing invalid-token path below (redirect/401) — an
        // idle-expired session should look exactly like a signed-out one.
        valid = false;
      } else {
        valid = true;
        role = typeof payload.role === "string" ? payload.role : null;
        const name = typeof payload.name === "string" ? payload.name : "";
        // Sliding window: refresh lastActivity on every active request, but
        // keep the ORIGINAL iat/exp so this can only ever narrow the session
        // lifetime (idle-out sooner) rather than extend the 12h absolute cap
        // an active user would otherwise ride indefinitely.
        refreshedToken = await new SignJWT({ name, role, lastActivity: Date.now() })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(String(payload.sub))
          .setIssuedAt(new Date((payload.iat as number) * 1000))
          .setExpirationTime(new Date((payload.exp as number) * 1000))
          .sign(secretKey);
      }
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    if (pathname.startsWith("/api")) {
      return json({ error: "Niet ingelogd" }, 401);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirect(loginUrl);
  }

  if (pathname.startsWith("/backend") && !(role && BACKEND_ROLES.has(role))) {
    return redirect(new URL("/dashboard", request.url));
  }
  if (pathname.startsWith("/api/backend") && !(role && BACKEND_ROLES.has(role))) {
    return json({ error: "Geen toegang" }, 403);
  }

  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
