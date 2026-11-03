import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getConfig } from "./config";
import { safeEqual } from "./crypto";
import { SESSION_COOKIE, signSession, verifySessionToken } from "./session";
import { verifyApiToken } from "./settings";

export function checkPassword(candidate: string): boolean {
  return safeEqual(candidate, getConfig().ADMIN_PASSWORD);
}

export async function startSession() {
  const { SESSION_SECRET, SESSION_TTL_HOURS, cookieSecure } = getConfig();
  const token = await signSession(SESSION_SECRET, SESSION_TTL_HOURS);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** For Server Components. */
export async function hasSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, getConfig().SESSION_SECRET);
}

export type AuthResult = { ok: true; via: "session" | "token" } | { ok: false };

/**
 * Route-handler auth. Bearer tokens (Apple Shortcut) are accepted anywhere;
 * cookie sessions must also pass an Origin check on state-changing requests
 * to defend against CSRF.
 */
export async function authenticate(
  req: NextRequest,
  { allowToken = true }: { allowToken?: boolean } = {},
): Promise<AuthResult> {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    if (!allowToken) return { ok: false };
    return (await verifyApiToken(header.slice(7).trim()))
      ? { ok: true, via: "token" }
      : { ok: false };
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token, getConfig().SESSION_SECRET))) return { ok: false };
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req)) return { ok: false };
  return { ok: true, via: "session" };
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POST/PATCH/DELETE; fall back to Fetch Metadata.
    return req.headers.get("sec-fetch-site") === "same-origin";
  }
  const { publicOrigin, TRUST_PROXY } = getConfig();
  if (origin === publicOrigin) return true;
  const host = (TRUST_PROXY && req.headers.get("x-forwarded-host")) || req.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(req: NextRequest): string {
  if (getConfig().TRUST_PROXY) {
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
    const real = req.headers.get("x-real-ip");
    if (real) return real;
  }
  return "direct";
}
