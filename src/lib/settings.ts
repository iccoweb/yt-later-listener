import "server-only";
import { getConfig } from "./config";
import { randomToken, safeEqual, sha256Hex } from "./crypto";
import { settingsCollection } from "./db";
import type { SettingsDoc, SettingsDTO } from "./types";

const ID = "singleton" as const;

export async function getSettings(): Promise<SettingsDoc> {
  const col = await settingsCollection();
  const now = new Date();
  // Upsert so concurrent first requests converge on one generated feed token.
  const doc = await col.findOneAndUpdate(
    { _id: ID },
    {
      $setOnInsert: {
        feedToken: randomToken(),
        feedTitle: "Later Listener",
        feedDescription: "YouTube videos saved for listening later.",
        feedAuthor: "Later Listener",
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return doc!;
}

export async function updateFeedMeta(
  meta: Pick<SettingsDoc, "feedTitle" | "feedDescription" | "feedAuthor">,
) {
  await getSettings();
  const col = await settingsCollection();
  await col.updateOne({ _id: ID }, { $set: { ...meta, updatedAt: new Date() } });
}

export async function rotateFeedToken(): Promise<string> {
  await getSettings();
  const token = randomToken();
  const col = await settingsCollection();
  await col.updateOne({ _id: ID }, { $set: { feedToken: token, updatedAt: new Date() } });
  return token;
}

/** Returns the new plaintext token; only its hash is stored. */
export async function rotateApiToken(): Promise<string> {
  await getSettings();
  const token = `ytll_${randomToken()}`;
  const col = await settingsCollection();
  const now = new Date();
  await col.updateOne(
    { _id: ID },
    { $set: { apiTokenHash: sha256Hex(token), apiTokenCreatedAt: now, updatedAt: now } },
  );
  return token;
}

export async function verifyApiToken(token: string): Promise<boolean> {
  if (!token.startsWith("ytll_") || token.length > 200) return false;
  const { apiTokenHash } = await getSettings();
  return !!apiTokenHash && safeEqual(sha256Hex(token), apiTokenHash);
}

export async function verifyFeedToken(token: string): Promise<boolean> {
  if (token.length > 200) return false;
  const { feedToken } = await getSettings();
  return safeEqual(token, feedToken);
}

export function feedUrlFor(token: string): string {
  return `${getConfig().PUBLIC_URL}/feed/${token}/podcast.xml`;
}

export function toSettingsDTO(s: SettingsDoc): SettingsDTO {
  return {
    feedUrl: feedUrlFor(s.feedToken),
    ingestUrl: `${getConfig().PUBLIC_URL}/api/episodes`,
    feedTitle: s.feedTitle,
    feedDescription: s.feedDescription,
    feedAuthor: s.feedAuthor,
    hasApiToken: !!s.apiTokenHash,
    apiTokenCreatedAt: s.apiTokenCreatedAt?.toISOString(),
  };
}
