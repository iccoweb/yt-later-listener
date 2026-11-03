import { jwtVerify, SignJWT } from "jose";

/** Edge-safe session helpers shared by proxy.ts and the server. */

export const SESSION_COOKIE = "ytll_session";

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(secret: string, ttlHours: number): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(key(secret));
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return payload.sub === "admin";
  } catch {
    return false;
  }
}
