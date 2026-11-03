import { type NextRequest, NextResponse } from "next/server";
import { authenticate, clientIp } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { enqueue, listEpisodes, toEpisodeDTO } from "@/lib/episodes";
import { jsonError, readBody, unauthorized } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { wakeWorker } from "@/lib/worker";
import { extractVideoId } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  if (!(await authenticate(req)).ok) return unauthorized();
  const items = await listEpisodes();
  return NextResponse.json(
    { episodes: items.map(toEpisodeDTO) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Ingest endpoint for the Apple Shortcut (Bearer token) and the web UI (session).
 * Accepts JSON `{ "url": "…" }`, a form field `url`, or a plain-text body.
 */
export async function POST(req: NextRequest) {
  const wait = rateLimit(
    `ingest:${clientIp(req)}`,
    getConfig().INGEST_RATE_LIMIT_PER_MINUTE,
    60_000,
  );
  if (wait) return jsonError(429, "Too many requests", { "Retry-After": String(wait) });

  if (!(await authenticate(req)).ok) return unauthorized();

  const body = await readBody(req);
  if (body === null) return jsonError(413, "Body too large");
  const input = parseInput(body, req.headers.get("content-type") ?? "");
  const videoId = input ? extractVideoId(input) : null;
  if (!videoId) return jsonError(400, 'Send a YouTube video URL as JSON {"url": "…"}');

  const { episode, created } = await enqueue(videoId);
  wakeWorker();

  const duplicate = !created && episode.status !== "queued";
  const label = episode.title ? `“${episode.title}”` : "Video";
  const message = created
    ? "Added — converting now."
    : episode.status === "queued"
      ? `${label} is queued for conversion.`
      : episode.status === "processing"
        ? `${label} is already converting.`
        : `${label} is already in your feed.`;

  return NextResponse.json(
    {
      status: created ? "created" : duplicate ? "duplicate" : "requeued",
      message,
      episode: toEpisodeDTO(episode),
    },
    { status: created ? 201 : 200 },
  );
}

function parseInput(body: string, contentType: string): string | null {
  if (contentType.includes("application/json")) {
    try {
      const data: unknown = JSON.parse(body);
      if (typeof data === "string") return data;
      if (data && typeof data === "object") {
        const v = (data as Record<string, unknown>).url ?? (data as Record<string, unknown>).text;
        return typeof v === "string" ? v : null;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(body).get("url");
  }
  return body;
}
