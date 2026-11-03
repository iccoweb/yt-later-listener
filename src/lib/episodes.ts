import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config";
import { episodes } from "./db";
import type { EpisodeDoc, EpisodeDTO } from "./types";
import { canonicalWatchUrl, isVideoId } from "./youtube";

export function mediaPath(videoId: string): string {
  if (!isVideoId(videoId)) throw new Error("Invalid video id");
  return path.join(getConfig().mediaDir, `${videoId}.mp3`);
}

export function toEpisodeDTO(e: EpisodeDoc): EpisodeDTO {
  return {
    id: e._id,
    sourceUrl: e.sourceUrl,
    status: e.status,
    phase: e.phase,
    progress: e.progress,
    error: e.error,
    attempts: e.attempts,
    title: e.title,
    description: e.description,
    channel: e.channel,
    thumbnailUrl: e.thumbnailUrl,
    durationSec: e.durationSec,
    uploadedAt: e.uploadedAt?.toISOString(),
    fileSize: e.fileSize,
    addedAt: e.addedAt.toISOString(),
    completedAt: e.completedAt?.toISOString(),
  };
}

/**
 * Inserts the video if unseen. A duplicate of a failed episode is re-queued;
 * any other duplicate is returned untouched.
 */
export async function enqueue(videoId: string): Promise<{ episode: EpisodeDoc; created: boolean }> {
  const col = await episodes();
  const now = new Date();
  const res = await col.findOneAndUpdate(
    { _id: videoId },
    {
      $setOnInsert: {
        videoId,
        sourceUrl: canonicalWatchUrl(videoId),
        status: "queued",
        progress: 0,
        attempts: 0,
        addedAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true },
  );
  const created = !res.lastErrorObject?.updatedExisting;
  let episode = res.value!;
  if (!created && episode.status === "failed") {
    episode = (await retry(videoId)) ?? episode;
  }
  return { episode, created };
}

export async function listEpisodes(): Promise<EpisodeDoc[]> {
  const col = await episodes();
  return col.find({}).sort({ addedAt: -1 }).limit(1000).toArray();
}

export async function getEpisode(id: string): Promise<EpisodeDoc | null> {
  if (!isVideoId(id)) return null;
  return (await episodes()).findOne({ _id: id });
}

export async function updateEpisode(
  id: string,
  patch: { title?: string; description?: string },
): Promise<EpisodeDoc | null> {
  if (!isVideoId(id)) return null;
  return (await episodes()).findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, customized: true, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function retry(id: string): Promise<EpisodeDoc | null> {
  if (!isVideoId(id)) return null;
  return (await episodes()).findOneAndUpdate(
    { _id: id, status: "failed" },
    {
      $set: { status: "queued", progress: 0, updatedAt: new Date() },
      $unset: { error: "", phase: "" },
    },
    { returnDocument: "after" },
  );
}

export async function deleteEpisode(id: string): Promise<boolean> {
  if (!isVideoId(id)) return false;
  const res = await (await episodes()).deleteOne({ _id: id });
  await rm(mediaPath(id), { force: true });
  return res.deletedCount === 1;
}

export async function readyEpisodes(limit = 500): Promise<EpisodeDoc[]> {
  return (await episodes()).find({ status: "ready" }).sort({ addedAt: -1 }).limit(limit).toArray();
}
