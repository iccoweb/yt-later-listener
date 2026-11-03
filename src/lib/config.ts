import "server-only";
import path from "node:path";
import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((v) => v === "true" || v === "1" || v === "yes");

const schema = z.object({
  PUBLIC_URL: z.url({ protocol: /^https?$/ }).transform((v) => v.replace(/\/+$/, "")),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/ytll"),
  DATA_DIR: z.string().min(1).default("./data"),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 14),
  TRUST_PROXY: boolish.default(false),
  COOKIE_SECURE: boolish.optional(),
  MAX_DURATION_MINUTES: z.coerce.number().int().positive().default(240),
  AUDIO_QUALITY: z
    .string()
    .regex(/^(\d{1,3}K|[0-9]|10)$/, "AUDIO_QUALITY must look like 128K or a VBR level 0-10")
    .default("128K"),
  YTDLP_PATH: z.string().min(1).default("yt-dlp"),
  YTDLP_AUTO_UPDATE: boolish.default(false),
  YTDLP_COOKIES_FILE: z.string().optional(),
  YTDLP_JS_RUNTIME: z.string().default("node"),
  WORKER_ENABLED: boolish.default(true),
  INGEST_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  LOGIN_RATE_LIMIT_PER_15_MINUTES: z.coerce.number().int().positive().default(10),
});

export type Config = z.infer<typeof schema> & {
  mediaDir: string;
  tmpDir: string;
  cookieSecure: boolean;
  publicOrigin: string;
};

let cached: Config | undefined;

/** Parsed lazily so `next build` works without runtime secrets. */
export function getConfig(): Config {
  if (cached) return cached;
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${issues.join("\n")}`);
  }
  const c = parsed.data;
  const dataDir = path.resolve(c.DATA_DIR);
  cached = {
    ...c,
    DATA_DIR: dataDir,
    mediaDir: path.join(dataDir, "media"),
    tmpDir: path.join(dataDir, "tmp"),
    cookieSecure: c.COOKIE_SECURE ?? c.PUBLIC_URL.startsWith("https://"),
    publicOrigin: new URL(c.PUBLIC_URL).origin,
  };
  return cached;
}
