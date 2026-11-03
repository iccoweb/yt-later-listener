"use client";

import { ClipboardPaste, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { EpisodeDTO } from "@/lib/types";

export function AddEpisodeForm({ onAdded }: { onAdded: (e: EpisodeDTO) => void }) {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(value: string) {
    if (!value.trim()) return;
    setPending(true);
    try {
      const res = await api.addEpisode(value);
      onAdded(res.episode);
      if (res.status === "duplicate") toast.info(res.message);
      else toast.success(res.message);
      setUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that link");
    } finally {
      setPending(false);
    }
  }

  async function pasteAndAdd() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      await submit(text);
    } catch {
      toast.error("Clipboard access was blocked. Paste the link into the field instead.");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(url);
      }}
      className="flex gap-2"
    >
      <Input
        type="url"
        inputMode="url"
        placeholder="Paste a YouTube link…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="h-10 flex-1"
        aria-label="YouTube URL"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />
      {url ? (
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          <span className="hidden sm:inline">Add</span>
        </Button>
      ) : (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="h-10"
          onClick={pasteAndAdd}
          disabled={pending}
        >
          <ClipboardPaste />
          <span className="hidden sm:inline">Paste</span>
        </Button>
      )}
    </form>
  );
}
