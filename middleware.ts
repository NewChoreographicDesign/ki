import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "session";
// "/" is public at the middleware layer because the page itself decides
// where to send an unauthenticated visitor (first-run "/setup" wizard vs.
// "/login") based on whether any user exists yet — middleware can't do that
// DB lookup at the edge, so it must let the request through untouched.
const PUBLIC_PATHS = ["/", "/login", "/setup"];
const BACKEND_ROLES = new Set(["ADMIN", "COORDINATOR"]);

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
    // Document uploads go straight from the browser to Vercel Blob storage.
    "connect-src 'self' https://*.public.blob.vercel-storage.com",
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

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/cron") ||
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
