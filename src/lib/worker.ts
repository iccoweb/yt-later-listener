import "server-only";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config";
import { episodes } from "./db";
import { mediaPath } from "./episodes";
import type { EpisodeDoc } from "./types";
import { downloadAudio, fetchMetadata, selfUpdate } from "./ytdlp";

const POLL_MS = 5_000;
const UPDATE_EVERY_MS = 24 * 60 * 60 * 1000;
const STALE_JOB_MS = 3 * 60 * 60 * 1000;

const state = globalThis as unknown as {
  __ytllWorker?: { running: boolean; wake: () => void };
};

/** Nudges the worker so new jobs start without waiting for the next poll. */
export function wakeWorker() {
  state.__ytllWorker?.wake();
}

export function startWorker() {
  if (state.__ytllWorker) return;
  let wake: () => void = () => {};
  state.__ytllWorker = { running: true, wake: () => wake() };

  const sleep = () =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, POLL_MS);
      wake = () => {
        clearTimeout(t);
        resolve();
      };
    });

  void (async () => {
    const c = getConfig();
    await mkdir(c.mediaDir, { recursive: true });
    await mkdir(c.tmpDir, { recursive: true });
    await recover();
    if (c.YTDLP_AUTO_UPDATE) scheduleSelfUpdate();
    console.log("[worker] started");

    while (state.__ytllWorker?.running) {
      try {
        const job = await claimNext();
        if (job) {
          await processJob(job);
          continue;
        }
      } catch (err) {
        console.error("[worker] loop error", err);
      }
      await sleep();
    }
  })();
}

/** Jobs left "processing" by a crash or restart go back in the queue. */
async function recover() {
  const col = await episodes();
  const { modifiedCount } = await col.updateMany(
    { status: "processing" },
    { $set: { status: "queued", progress: 0, updatedAt: new Date() }, $unset: { phase: "" } },
  );
  if (modifiedCount) console.log(`[worker] re-queued ${modifiedCount} interrupted job(s)`);
  const tmp = getConfig().tmpDir;
  for (const entry of await readdir(tmp))
    await rm(path.join(tmp, entry), { recursive: true, force: true });
}

async function claimNext(): Promise<EpisodeDoc | null> {
  const col = await episodes();
  const now = new Date();
  return col.findOneAndUpdate(
    {
      $or: [
        { status: "queued" },
        { status: "processing", startedAt: { $lt: new Date(now.getTime() - STALE_JOB_MS) } },
      ],
    },
    {
      $set: {
        status: "processing",
        phase: "metadata",
        progress: 0,
        startedAt: now,
        updatedAt: now,
      },
      $inc: { attempts: 1 },
      $unset: { error: "" },
    },
    { sort: { addedAt: 1 }, returnDocument: "after" },
  );
}

async function processJob(job: EpisodeDoc) {
  const col = await episodes();
  const c = getConfig();
  const id = job._id;
  const update = (fields: Partial<EpisodeDoc>) =>
    col.updateOne(
      { _id: id, status: "processing" },
      { $set: { ...fields, updatedAt: new Date() } },
    );

  const workDir = path.join(c.tmpDir, id);
  try {
    console.log(`[worker] ${id}: fetching metadata`);
    const meta = await fetchMetadata(job.sourceUrl);
    if (meta.live_status === "is_live" || meta.live_status === "is_upcoming") {
      throw new Error("Live and upcoming streams can't be converted until they've finished.");
    }
    if (meta.duration && meta.duration > c.MAX_DURATION_MINUTES * 60) {
      throw new Error(
        `Video is ${Math.round(meta.duration / 60)} min; the limit is ${c.MAX_DURATION_MINUTES} min (MAX_DURATION_MINUTES).`,
      );
    }

    const fresh = await col.findOne({ _id: id }, { projection: { customized: 1 } });
    await update({
      phase: "downloading",
      ...(fresh?.customized
        ? {}
        : { title: meta.title?.slice(0, 500), description: meta.description?.slice(0, 20_000) }),
      channel: meta.channel ?? meta.uploader,
      durationSec: meta.duration ? Math.round(meta.duration) : undefined,
      uploadedAt: parseUploadDate(meta.upload_date),
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });

    await mkdir(workDir, { recursive: true });
    let lastWrite = 0;
    let lastPercent = -1;
    await downloadAudio(job.sourceUrl, path.join(workDir, `${id}.%(ext)s`), (e) => {
      const now = Date.now();
      if (e.type === "phase") {
        void update({ phase: "converting", progress: 100 });
      } else if (now - lastWrite > 1000 && Math.floor(e.percent) !== lastPercent) {
        lastWrite = now;
        lastPercent = Math.floor(e.percent);
        void update({ progress: Math.round(e.percent * 10) / 10 });
      }
    });

    const produced = path.join(workDir, `${id}.mp3`);
    const target = mediaPath(id);
    await rename(produced, target);
    const { size } = await stat(target);
    const now = new Date();
    await col.updateOne(
      { _id: id },
      {
        $set: { status: "ready", progress: 100, fileSize: size, completedAt: now, updatedAt: now },
        $unset: { phase: "", error: "" },
      },
    );
    console.log(`[worker] ${id}: ready (${(size / 1e6).toFixed(1)} MB)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ${id}: failed: ${message}`);
    await col.updateOne(
      { _id: id },
      {
        $set: { status: "failed", error: message.slice(0, 1000), updatedAt: new Date() },
        $unset: { phase: "" },
      },
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function parseUploadDate(value?: string): Date | undefined {
  const m = value?.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : undefined;
}

function scheduleSelfUpdate() {
  const runUpdate = async () => {
    try {
      console.log(`[worker] yt-dlp update: ${await selfUpdate()}`);
    } catch (err) {
      console.warn("[worker] yt-dlp self-update failed", err instanceof Error ? err.message : err);
    }
  };
  void runUpdate();
  setInterval(runUpdate, UPDATE_EVERY_MS).unref();
}
