import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { readyEpisodes } from "@/lib/episodes";
import { buildFeed } from "@/lib/feed";
import { notFound } from "@/lib/http";
import { getSettings, verifyFeedToken } from "@/lib/settings";

export async function GET(req: NextRequest, ctx: RouteContext<"/feed/[token]/podcast.xml">) {
  const { token } = await ctx.params;
  // 404 rather than 401 so a wrong token reveals nothing.
  if (!(await verifyFeedToken(token))) return notFound();

  const xml = buildFeed(await getSettings(), await readyEpisodes());
  const etag = `"${createHash("sha1").update(xml).digest("base64url")}"`;
  const headers = {
    "Content-Type": "application/rss+xml; charset=utf-8",
    "Cache-Control": "private, no-cache",
    ETag: etag,
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return new Response(xml, { headers });
}
