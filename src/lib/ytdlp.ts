import "server-only";
import { spawn } from "node:child_process";
import { getConfig } from "./config";

export interface VideoMetadata {
  id: string;
  title?: string;
  description?: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  upload_date?: string;
  thumbnail?: string;
  live_status?: string;
}

const PROGRESS_PREFIX = "ytll-progress";

function baseArgs(): string[] {
  const c = getConfig();
  const args = [
    "--ignore-config",
    "--no-playlist",
    "--no-warnings",
    "--js-runtimes",
    c.YTDLP_JS_RUNTIME,
  ];
  if (c.YTDLP_COOKIES_FILE) args.push("--cookies", c.YTDLP_COOKIES_FILE);
  return args;
}

interface RunOptions {
  onLine?: (line: string) => void;
  timeoutMs: number;
}

/** Runs yt-dlp without a shell; the URL always follows `--` so it can't be read as an option. */
function run(args: string[], { onLine, timeoutMs }: RunOptions): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(getConfig().YTDLP_PATH, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: "C.UTF-8",
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    const splitter = () => {
      let pending = "";
      return (chunk: string) => {
        if (!onLine) return;
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        lines.forEach(onLine);
      };
    };
    const outLines = splitter();
    const errLines = splitter();

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      if (stdout.length < 5_000_000) stdout += chunk;
      outLines(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
      errLines(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout });
      const reason = signal === "SIGKILL" ? "timed out" : `exited with code ${code}`;
      reject(new Error(`yt-dlp ${reason}: ${summarizeError(stderr)}`));
    });
  });
}

function summarizeError(stderr: string): string {
  const errors = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("ERROR:"));
  return (errors.at(-1) ?? stderr.trim().split("\n").at(-1) ?? "unknown error").slice(0, 500);
}

const FIELDS = "id,title,description,channel,uploader,duration,upload_date,thumbnail,live_status";

export async function fetchMetadata(url: string): Promise<VideoMetadata> {
  const { stdout } = await run(
    [...baseArgs(), "--skip-download", "--print", `%(.{${FIELDS}})j`, "--", url],
    {
      timeoutMs: 120_000,
    },
  );
  return JSON.parse(stdout.trim().split("\n").at(-1)!) as VideoMetadata;
}

export type DownloadEvent =
  | { type: "progress"; percent: number }
  | { type: "phase"; phase: "converting" };

export async function downloadAudio(
  url: string,
  outputTemplate: string,
  onEvent: (e: DownloadEvent) => void,
): Promise<void> {
  const c = getConfig();
  const args = [
    ...baseArgs(),
    "--newline",
    "--no-mtime",
    "--no-part",
    "--progress-template",
    `download:${PROGRESS_PREFIX} %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s`,
    "-f",
    "bestaudio/best",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    c.AUDIO_QUALITY,
    "--embed-metadata",
    "--embed-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "-o",
    outputTemplate,
    "--",
    url,
  ];
  await run(args, {
    timeoutMs: 2 * 60 * 60 * 1000,
    onLine: (line) => {
      if (line.startsWith(PROGRESS_PREFIX)) {
        const [, done, total, estimate] = line.split(" ").map(Number);
        const size = total || estimate;
        if (done && size)
          onEvent({ type: "progress", percent: Math.min(100, (done / size) * 100) });
      } else if (line.startsWith("[ExtractAudio]")) {
        onEvent({ type: "phase", phase: "converting" });
      }
    },
  });
}

export async function selfUpdate(): Promise<string> {
  const { stdout } = await run(["-U"], { timeoutMs: 120_000 });
  return stdout.trim().split("\n").at(-1) ?? "";
}
