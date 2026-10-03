import { NextResponse, type NextRequest } from "next/server";

// Maintenance mode ("Coming Soon" gate).
//
// - MAINTENANCE_MODE=true          → every page is rewritten to /maintenance
//                                    and every API route answers 503.
// - MAINTENANCE_BYPASS_SECRET=...  → open any URL with ?preview=<secret> once
//                                    to get a bypass cookie on that browser;
//                                    ?preview=off removes it.
//
// To launch: set MAINTENANCE_MODE=false (or remove it) and redeploy.

const BYPASS_COOKIE = "ritmo_preview";
const BYPASS_PARAM = "preview";
const MAINTENANCE_PATH = "/maintenance";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const enabled = process.env.MAINTENANCE_MODE === "true";
  const secret = process.env.MAINTENANCE_BYPASS_SECRET;

  if (!enabled) {
    // Nothing to hide; don't leave the placeholder page reachable.
    if (pathname === MAINTENANCE_PATH) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // ?preview=<secret> sets the bypass cookie, ?preview=off clears it. Either
  // way, redirect to the same URL without the param so the secret doesn't
  // linger in the address bar / history.
  const previewParam = searchParams.get(BYPASS_PARAM);
  if (previewParam !== null) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete(BYPASS_PARAM);
    const res = NextResponse.redirect(clean);
    if (previewParam === "off") {
      res.cookies.delete(BYPASS_COOKIE);
    } else if (secret && previewParam === secret) {
      res.cookies.set(BYPASS_COOKIE, secret, {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      });
    }
    return res;
  }

  const bypassed = !!secret && req.cookies.get(BYPASS_COOKIE)?.value === secret;
  if (bypassed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Ritmo is under construction. Please check back soon." },
      { status: 503, headers: { "Retry-After": "86400" } }
    );
  }

  if (pathname === MAINTENANCE_PATH) return NextResponse.next();

  return NextResponse.rewrite(new URL(MAINTENANCE_PATH, req.url));
}

export const config = {
  // Everything except Next's build assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
