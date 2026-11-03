export type EpisodeStatus = "queued" | "processing" | "ready" | "failed";
export type EpisodePhase = "metadata" | "downloading" | "converting";

export interface EpisodeDoc {
  _id: string; // the YouTube video id; doubles as the dedupe key
  videoId: string;
  sourceUrl: string;
  status: EpisodeStatus;
  phase?: EpisodePhase;
  progress: number; // 0-100
  error?: string;
  attempts: number;
  title?: string;
  description?: string;
  channel?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  uploadedAt?: Date;
  fileSize?: number;
  /** Set when the user edits title/description so reprocessing won't overwrite it. */
  customized?: boolean;
  addedAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SettingsDoc {
  _id: "singleton";
  feedToken: string;
  apiTokenHash?: string;
  apiTokenCreatedAt?: Date;
  feedTitle: string;
  feedDescription: string;
  feedAuthor: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape sent to the browser. */
export interface EpisodeDTO {
  id: string;
  sourceUrl: string;
  status: EpisodeStatus;
  phase?: EpisodePhase;
  progress: number;
  error?: string;
  attempts: number;
  title?: string;
  description?: string;
  channel?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  uploadedAt?: string;
  fileSize?: number;
  addedAt: string;
  completedAt?: string;
}

export interface SettingsDTO {
  feedUrl: string;
  ingestUrl: string;
  feedTitle: string;
  feedDescription: string;
  feedAuthor: string;
  hasApiToken: boolean;
  apiTokenCreatedAt?: string;
}
