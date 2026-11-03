import "server-only";
import { NextResponse } from "next/server";

export function jsonError(status: number, error: string, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

export const unauthorized = () =>
  jsonError(401, "Unauthorized", { "WWW-Authenticate": 'Bearer realm="yt-later-listener"' });

export const notFound = () => new NextResponse("Not found", { status: 404 });

/** Reads at most `maxBytes` of the body so oversized payloads can't exhaust memory. */
export async function readBody(req: Request, maxBytes = 8 * 1024): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
