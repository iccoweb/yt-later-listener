const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const WATCH_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const PATH_PREFIXES = ["shorts", "live", "embed", "v", "e"];

export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

/**
 * Extracts a YouTube video id from a URL or from shared text that contains one
 * (iOS share sheets often send "Title https://youtu.be/…").
 * Only YouTube hosts are accepted so the downloader can never be pointed at
 * arbitrary URLs.
 */
export function extractVideoId(input: string): string | null {
  const text = input.trim().slice(0, 2048);
  if (isVideoId(text)) return text;

  const candidates = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [text];
  for (const candidate of candidates) {
    const id = videoIdFromUrl(candidate);
    if (id) return id;
  }
  return null;
}

function videoIdFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = segments[0];
    return id && isVideoId(id) ? id : null;
  }

  if (!WATCH_HOSTS.has(host)) return null;

  if (segments[0] === "watch") {
    const id = url.searchParams.get("v");
    return id && isVideoId(id) ? id : null;
  }
  if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0]!)) {
    const id = segments[1]!;
    return isVideoId(id) ? id : null;
  }
  return null;
}

export function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
