import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getEpisode, mediaPath } from "@/lib/episodes";
import { notFound } from "@/lib/http";
import { verifyFeedToken } from "@/lib/settings";

type Ctx = RouteContext<"/feed/[token]/media/[file]">;

/** Streams an episode with HTTP Range support, which Apple Podcasts requires. */
async function serve(req: NextRequest, ctx: Ctx, headOnly: boolean) {
  const { token, file } = await ctx.params;
  if (!(await verifyFeedToken(token))) return notFound();

  const match = /^([A-Za-z0-9_-]{11})\.mp3$/.exec(file);
  if (!match) return notFound();
  const episode = await getEpisode(match[1]!);
  if (episode?.status !== "ready") return notFound();

  const filePath = mediaPath(episode._id);
  let size: number;
  let mtime: Date;
  try {
    ({ size, mtime } = await stat(filePath));
  } catch {
    return notFound();
  }

  const etag = `"${size.toString(36)}-${mtime.getTime().toString(36)}"`;
  const headers = new Headers({
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Last-Modified": mtime.toUTCString(),
    ETag: etag,
    "Content-Disposition": `inline; filename="${episode._id}.mp3"`,
    "X-Robots-Tag": "noindex, nofollow",
  });

  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const ifRange = req.headers.get("if-range");

  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range && (!ifRange || ifRange === etag)) {
    ({ start, end } = range);
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));

  if (headOnly || size === 0) return new Response(null, { status, headers });
  const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers });
}

function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null; // ignore multi-range / malformed
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

export function GET(req: NextRequest, ctx: Ctx) {
  return serve(req, ctx, false);
}

export function HEAD(req: NextRequest, ctx: Ctx) {
  return serve(req, ctx, true);
}
