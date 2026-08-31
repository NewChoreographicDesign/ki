import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getRequestIp, ipMatchesAny } from "@/lib/ip-match";

const COOKIE_NAME = "session";
const BYPASS_COOKIE_NAME = "network_bypass";
const BYPASS_COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours
// "/" is public at the middleware layer because the page itself decides
// where to send an unauthenticated visitor (first-run "/setup" wizard vs.
// "/login") based on whether any user exists yet — middleware can't do that
// DB lookup at the edge, so it must let the request through untouched.
const PUBLIC_PATHS = ["/", "/login", "/setup"];
const BACKEND_ROLES = new Set(["ADMIN"]);
// Never subject to network restriction: Vercel Cron calls these with a
// bearer-token secret, not from the office network, and the internal
// network-policy endpoint must stay reachable so the check below doesn't
// deadlock on itself.
const NETWORK_CHECK_EXEMPT_PREFIXES = ["/api/cron", "/api/internal/network-policy"];

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
    // Uploads (documents/protocols) go through our own server (same-origin)
    // rather than a direct browser-to-Vercel-Blob request — see
    // app/api/documents/upload/route.ts for why — so 'self' covers it.
    // Opening an uploaded file is a plain link navigation, not fetch/XHR,
    // so *.public.blob.vercel-storage.com doesn't need to be listed here.
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Asks /api/internal/network-policy (Node.js runtime, has DB access) whether
 * network restriction is on and, if so, whether this request's IP is in the
 * allowed list. Fails OPEN on any error (unreachable, non-200, bad JSON) —
 * this is a defense-in-depth mitigation, not the app's actual legal basis
 * for processing client data, so an outage of this one check must not take
 * the whole app down for every legitimate user.
 */
async function isNetworkAllowed(request: NextRequest): Promise<boolean> {
  try {
    const res = await fetch(new URL("/api/internal/network-policy", request.url));
    if (!res.ok) return true;
    const policy = (await res.json()) as { enabled: boolean; allowedIps: string[] };
    if (!policy.enabled) return true;
    return ipMatchesAny(getRequestIp(request.headers), policy.allowedIps);
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Emergency unlock: visiting any URL with ?bypass=<NETWORK_BYPASS_SECRET>
  // grants a 24h bypass cookie regardless of network restriction. Without
  // this, an admin who enables network restriction while off-network (or
  // whose office IP later changes) would be permanently locked out of their
  // own app with no way back in — see README before turning this feature on.
  const bypassSecret = process.env.NETWORK_BYPASS_SECRET;
  const bypassParam = searchParams.get("bypass");
  const grantingBypass = Boolean(bypassSecret && bypassParam && bypassParam === bypassSecret);
  const hasBypassCookie = request.cookies.get(BYPASS_COOKIE_NAME)?.value === "1";

  function applyExtras(response: NextResponse) {
    response.headers.set("Content-Security-Policy", csp);
    if (grantingBypass) {
      response.cookies.set(BYPASS_COOKIE_NAME, "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: BYPASS_COOKIE_MAX_AGE,
      });
    }
    return response;
  }

  function next() {
    return applyExtras(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  function redirect(url: URL) {
    return applyExtras(NextResponse.redirect(url));
  }

  function json(body: unknown, status: number) {
    return applyExtras(NextResponse.json(body, { status }));
  }

  const networkExempt = NETWORK_CHECK_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  if (!networkExempt && !grantingBypass && !hasBypassCookie) {
    const allowed = await isNetworkAllowed(request);
    if (!allowed) {
      if (pathname.startsWith("/api")) {
        return json({ error: "Dit netwerk heeft geen toegang tot deze app" }, 403);
      }
      return applyExtras(
        new NextResponse(
          "<!doctype html><html lang=\"nl\"><meta charset=\"utf-8\">" +
            "<title>Geen toegang</title>" +
            "<body style=\"font-family:system-ui;padding:3rem;text-align:center;color:#334\">" +
            "<h1>Geen toegang vanaf dit netwerk</h1>" +
            "<p>Deze app is alleen bereikbaar vanaf het netwerk van de organisatie.</p>" +
            "</body></html>",
          { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
        )
      );
    }
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/internal") ||
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
