import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { isDeviceRestrictionEnabled, verifyDeviceToken, DEVICE_TOKEN_COOKIE } from "@/lib/device-auth";

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

  function next() {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  function redirect(url: URL) {
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  function json(body: unknown, status: number) {
    const response = NextResponse.json(body, { status });
    response.headers.set("Content-Security-Policy", csp);
    return response;
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
      valid = true;
      role = typeof payload.role === "string" ? payload.role : null;
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
