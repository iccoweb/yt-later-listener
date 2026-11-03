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
  await startSession();
  return NextResponse.json({ ok: true });
}
