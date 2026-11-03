import "server-only";
import { getConfig } from "./config";
import type { EpisodeDoc, SettingsDoc } from "./types";

export function escapeXml(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Drops code points that are illegal in XML 1.0 (most control characters). */
function stripInvalidXmlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const c = ch.codePointAt(0)!;
    if (
      c === 0x9 ||
      c === 0xa ||
      c === 0xd ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd) ||
      c >= 0x10000
    ) {
      out += ch;
    }
  }
  return out;
}

function tag(name: string, value: string | undefined, attrs = ""): string {
  if (value === undefined || value === "") return "";
  return `<${name}${attrs}>${escapeXml(value)}</${name}>`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Apple Podcasts–compatible RSS 2.0 feed. */
export function buildFeed(settings: SettingsDoc, items: EpisodeDoc[]): string {
  const { PUBLIC_URL } = getConfig();
  const base = `${PUBLIC_URL}/feed/${settings.feedToken}`;
  const feedUrl = `${base}/podcast.xml`;
  const cover = `${PUBLIC_URL}/cover.png`;
  const lastBuild = items[0]?.completedAt ?? settings.updatedAt;

  const entries = items.map((e) => {
    const title = e.title || `YouTube video ${e._id}`;
    const description = [e.description?.trim(), `Original video: ${e.sourceUrl}`]
      .filter(Boolean)
      .join("\n\n");
    return [
      "<item>",
      tag("title", title),
      tag("itunes:title", title),
      tag("description", description),
      tag("itunes:summary", description.slice(0, 4000)),
      tag("itunes:author", e.channel),
      tag("link", e.sourceUrl),
      `<enclosure url="${escapeXml(`${base}/media/${e._id}.mp3`)}" length="${e.fileSize ?? 0}" type="audio/mpeg"/>`,
      tag("guid", `yt:${e._id}`, ' isPermaLink="false"'),
      tag("pubDate", (e.completedAt ?? e.addedAt).toUTCString()),
      e.durationSec ? tag("itunes:duration", String(e.durationSec)) : "",
      e.thumbnailUrl ? `<itunes:image href="${escapeXml(e.thumbnailUrl)}"/>` : "",
      "<itunes:episodeType>full</itunes:episodeType>",
      "<itunes:explicit>false</itunes:explicit>",
      "</item>",
    ].join("");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "<channel>",
    tag("title", settings.feedTitle),
    tag("description", settings.feedDescription),
    tag("itunes:summary", settings.feedDescription),
    tag("itunes:author", settings.feedAuthor),
    tag("link", PUBLIC_URL),
    `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    "<language>en</language>",
    tag("lastBuildDate", lastBuild.toUTCString()),
    `<image><url>${escapeXml(cover)}</url>${tag("title", settings.feedTitle)}${tag("link", PUBLIC_URL)}</image>`,
    `<itunes:image href="${escapeXml(cover)}"/>`,
    '<itunes:category text="Education"/>',
    "<itunes:explicit>false</itunes:explicit>",
    "<itunes:type>episodic</itunes:type>",
    // Private feed: keep it out of the Apple Podcasts directory.
    "<itunes:block>Yes</itunes:block>",
    ...entries,
    "</channel>",
    "</rss>",
  ].join("\n");
}
