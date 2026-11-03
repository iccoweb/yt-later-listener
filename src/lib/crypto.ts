import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function sha256Hex(value: string): string {
  return sha256(value).toString("hex");
}

/** Constant-time string comparison (hashing first equalises lengths). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}
