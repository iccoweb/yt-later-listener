"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EditEpisodeDialog } from "@/components/edit-episode-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import type { EpisodeDTO } from "@/lib/types";

type Filter = "all" | "active" | "ready" | "failed";

export function EpisodeList({
  episodes,
  onChanged,
  onDeleted,
  onRefresh,
}: {
  episodes: EpisodeDTO[];
  onChanged: (e: EpisodeDTO) => void;
  onDeleted: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<EpisodeDTO | null>(null);
  const [deleting, setDeleting] = useState<EpisodeDTO | null>(null);

  const counts = useMemo(
    () => ({
      all: episodes.length,
      active: episodes.filter((e) => e.status === "queued" || e.status === "processing").length,
      ready: episodes.filter((e) => e.status === "ready").length,
      failed: episodes.filter((e) => e.status === "failed").length,
    }),
    [episodes],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return episodes.filter((e) => {
      if (filter === "active" && e.status !== "queued" && e.status !== "processing") return false;
      if (filter === "ready" && e.status !== "ready") return false;
      if (filter === "failed" && e.status !== "failed") return false;
      if (!q) return true;
      return [e.title, e.channel, e.id].some((v) => v?.toLowerCase().includes(q));
    });
  }, [episodes, query, filter]);

  async function retry(e: EpisodeDTO) {
    try {
      onChanged((await api.retryEpisode(e.id)).episode);
      toast.success("Queued for another try");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
      void onRefresh();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await api.deleteEpisode(target.id);
      onDeleted(target.id);
      toast.success("Episode deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (episodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-12 text-center">
        <p className="font-medium">No episodes yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a YouTube link above, or set up the Apple Shortcut under “Feed &amp; Shortcut”.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
            aria-label="Search episodes"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", "active", "ready", "failed"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "secondary" : "ghost"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f} <span className="text-muted-foreground tabular-nums">{counts[f]}</span>
            </Button>
          ))}
        </div>
      </div>

      <ul className="divide-y rounded-xl border">
        {visible.map((e) => (
          <li key={e.id} className="flex gap-3 p-3">
            <img
              src={e.thumbnailUrl ?? `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-video w-24 shrink-0 self-start rounded-md bg-muted object-cover sm:w-32"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start gap-2">
                <p className="line-clamp-2 flex-1 text-sm leading-snug font-medium">
                  {e.title ?? <span className="text-muted-foreground">Fetching details…</span>}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label="Episode actions" />}
                  >
                    <MoreVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(e)}>
                      <Pencil /> Edit details
                    </DropdownMenuItem>
                    {e.status === "failed" && (
                      <DropdownMenuItem onClick={() => retry(e)}>
                        <RotateCcw /> Retry
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => window.open(e.sourceUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink /> Open on YouTube
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  e.channel,
                  e.durationSec ? formatDuration(e.durationSec) : null,
                  formatSize(e.fileSize),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <EpisodeStatus episode={e} onRetry={() => retry(e)} />
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">No matching episodes.</li>
        )}
      </ul>

      <EditEpisodeDialog
        episode={editing}
        onClose={() => setEditing(null)}
        onSaved={(e) => {
          onChanged(e);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this episode?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title ?? deleting?.id}” and its MP3 will be removed from your feed. You
              can add the link again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EpisodeStatus({ episode: e, onRetry }: { episode: EpisodeDTO; onRetry: () => void }) {
  switch (e.status) {
    case "ready":
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="text-green-600" /> In feed
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock /> Queued
        </Badge>
      );
    case "processing": {
      const label =
        e.phase === "converting"
          ? "Converting to MP3…"
          : e.phase === "downloading"
            ? `Downloading ${Math.floor(e.progress)}%`
            : "Fetching details…";
      return (
        <div className="space-y-1.5 pt-0.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Loader2 className="size-3 animate-spin" /> {label}
          </p>
          <Progress value={e.phase === "metadata" ? null : e.progress} />
        </div>
      );
    }
    case "failed":
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="gap-1">
              <AlertCircle /> Failed
            </Badge>
            <Button size="xs" variant="outline" onClick={onRetry}>
              <RotateCcw /> Retry
            </Button>
          </div>
          {e.error && (
            <p className="line-clamp-3 text-xs break-words text-destructive">{e.error}</p>
          )}
        </div>
      );
  }
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes?: number) {
  return bytes ? `${(bytes / 1_000_000).toFixed(1)} MB` : null;
}
