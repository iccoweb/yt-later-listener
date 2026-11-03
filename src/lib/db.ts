import "server-only";
import { type Db, MongoClient } from "mongodb";
import { getConfig } from "./config";
import type { EpisodeDoc, SettingsDoc } from "./types";

const globalForMongo = globalThis as unknown as {
  __ytllMongo?: { client: MongoClient; ready: Promise<Db> };
};

async function init(client: MongoClient): Promise<Db> {
  await client.connect();
  const db = client.db();
  await db.collection<EpisodeDoc>("episodes").createIndexes([
    { key: { videoId: 1 }, name: "videoId_unique", unique: true },
    { key: { status: 1, addedAt: 1 }, name: "status_addedAt" },
    { key: { addedAt: -1 }, name: "addedAt_desc" },
  ]);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForMongo.__ytllMongo) {
    const client = new MongoClient(getConfig().MONGODB_URI, {
      appName: "yt-later-listener",
      serverSelectionTimeoutMS: 10_000,
    });
    const ready = init(client).catch((err) => {
      globalForMongo.__ytllMongo = undefined;
      throw err;
    });
    globalForMongo.__ytllMongo = { client, ready };
  }
  return globalForMongo.__ytllMongo.ready;
}

export async function episodes() {
  return (await getDb()).collection<EpisodeDoc>("episodes");
}

export async function settingsCollection() {
  return (await getDb()).collection<SettingsDoc>("settings");
}
