import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Optimistic redirect between the login page and the app. Every API route and
 * page still verifies the session itself; this only saves a round trip.
 */
export async function proxy(req: NextRequest) {
  const authed = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
  const { pathname } = req.nextUrl;
  if (pathname === "/login" && authed) return NextResponse.redirect(new URL("/", req.url));
  if (pathname !== "/login" && !authed) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
