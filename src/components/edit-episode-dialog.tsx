"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { EpisodeDTO } from "@/lib/types";

export function EditEpisodeDialog({
  episode,
  onClose,
  onSaved,
}: {
  episode: EpisodeDTO | null;
  onClose: () => void;
  onSaved: (e: EpisodeDTO) => void;
}) {
  return (
    <Dialog open={!!episode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {episode && (
          <EditForm key={episode.id} episode={episode} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  episode,
  onClose,
  onSaved,
}: {
  episode: EpisodeDTO;
  onClose: () => void;
  onSaved: (e: EpisodeDTO) => void;
}) {
  const [title, setTitle] = useState(episode.title ?? "");
  const [description, setDescription] = useState(episode.description ?? "");
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api.updateEpisode(episode.id, { title, description });
      onSaved(res.episode);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit episode</DialogTitle>
        <DialogDescription>
          Changes show up in Apple Podcasts on its next refresh.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="ep-title">Title</Label>
        <Input
          id="ep-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ep-desc">Description</Label>
        <Textarea
          id="ep-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={20_000}
          rows={8}
          className="max-h-[40vh]"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
