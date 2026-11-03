import { type NextRequest, NextResponse } from "next/server";
import { checkPassword, clientIp, sameOrigin, startSession } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { jsonError, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, "Forbidden");
  const wait = rateLimit(
    `login:${clientIp(req)}`,
    getConfig().LOGIN_RATE_LIMIT_PER_15_MINUTES,
    15 * 60_000,
  );
  if (wait)
    return jsonError(429, `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.`, {
      "Retry-After": String(wait),
    });

  const body = await readBody(req, 2048);
  let password: unknown;
  try {
    password = body ? (JSON.parse(body) as { password?: unknown }).password : undefined;
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (typeof password !== "string" || !checkPassword(password)) {
    return jsonError(401, "Incorrect password");
  }
  if (insecureOriginForSecureCookie(req)) {
    return jsonError(
      400,
      `Password accepted, but this page is plain http:// and the session cookie is HTTPS-only, so your browser would drop it. Open ${getConfig().PUBLIC_URL} instead, or set COOKIE_SECURE=false for LAN-only testing.`,
    );
  }
  await startSession();
  return NextResponse.json({ ok: true });
}

/**
 * Browsers discard `Secure` cookies set from http:// pages (localhost excepted),
 * which would otherwise look like a silent login loop.
 */
function insecureOriginForSecureCookie(req: NextRequest): boolean {
  if (!getConfig().cookieSecure) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}
