"use client";

import { Check, Copy, KeyRound, Loader2, Podcast, RefreshCw, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { SettingsDTO } from "@/lib/types";

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: SettingsDTO;
  onChange: (s: SettingsDTO) => void;
}) {
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"api" | "feed" | null>(null);
  const [rotating, setRotating] = useState(false);

  async function rotate(target: "api" | "feed") {
    setConfirm(null);
    setRotating(true);
    try {
      const res = await api.rotate(target);
      onChange(res.settings);
      if (res.apiToken) setApiToken(res.apiToken);
      toast.success(target === "api" ? "New API token created" : "New feed URL created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Podcast className="size-4" /> Podcast feed
          </CardTitle>
          <CardDescription>
            In Apple Podcasts: Library → ⋯ → <em>Follow a Show by URL</em>, then paste this. Anyone
            with the URL can listen, so keep it private.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyField value={settings.feedUrl} label="Feed URL" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirm("feed")}
            disabled={rotating}
          >
            <RefreshCw /> Generate new feed URL
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4" /> Apple Shortcut
          </CardTitle>
          <CardDescription>
            Lets the share sheet send videos here. The token is shown only once, so save it straight
            into the Shortcut.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyField value={settings.ingestUrl} label="Endpoint (POST)" />

          {apiToken ? (
            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <CopyField value={apiToken} label="API token — copy it now" mono />
              <p className="text-xs text-muted-foreground">
                You won&apos;t see this again. Generating a new token disconnects the old one.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={settings.hasApiToken ? "outline" : "default"}
                onClick={() => (settings.hasApiToken ? setConfirm("api") : rotate("api"))}
                disabled={rotating}
              >
                {rotating ? <Loader2 className="animate-spin" /> : <KeyRound />}
                {settings.hasApiToken ? "Replace API token" : "Create API token"}
              </Button>
              {settings.apiTokenCreatedAt && (
                <span className="text-xs text-muted-foreground">
                  Current token created {new Date(settings.apiTokenCreatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Shortcuts app → <strong>+</strong> → name it “Listen Later”. In its settings (ⓘ) turn
              on <em>Show in Share Sheet</em> and accept <em>URLs</em> and <em>Text</em>.
            </li>
            <li>
              Add <strong>Get Contents of URL</strong> with the endpoint above. Set Method to{" "}
              <strong>POST</strong> and Request Body to <strong>JSON</strong>, with key{" "}
              <code>url</code> and value <em>Shortcut Input</em>.
            </li>
            <li>
              Under Headers add <code>Authorization</code> = <code>Bearer &lt;your token&gt;</code>.
            </li>
            <li>
              Add <strong>Get Dictionary Value</strong> for key <code>message</code>, then{" "}
              <strong>Show Notification</strong> with it.
            </li>
          </ol>
        </CardContent>
      </Card>

      <FeedDetailsForm settings={settings} onChange={onChange} />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "feed" ? "Generate a new feed URL?" : "Replace the API token?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "feed"
                ? "The current URL stops working right away. You'll need to re-add the show in Apple Podcasts with the new URL."
                : "The current token stops working right away. Update your Shortcut with the new one."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirm && rotate(confirm)}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FeedDetailsForm({
  settings,
  onChange,
}: {
  settings: SettingsDTO;
  onChange: (s: SettingsDTO) => void;
}) {
  const [form, setForm] = useState({
    feedTitle: settings.feedTitle,
    feedAuthor: settings.feedAuthor,
    feedDescription: settings.feedDescription,
  });
  const [pending, setPending] = useState(false);
  const dirty =
    form.feedTitle !== settings.feedTitle ||
    form.feedAuthor !== settings.feedAuthor ||
    form.feedDescription !== settings.feedDescription;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      onChange((await api.updateSettings(form)).settings);
      toast.success("Feed details saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Show details</CardTitle>
        <CardDescription>How the show appears in your podcast app.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="feed-title">Title</Label>
              <Input
                id="feed-title"
                value={form.feedTitle}
                maxLength={200}
                required
                onChange={(e) => setForm({ ...form, feedTitle: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feed-author">Author</Label>
              <Input
                id="feed-author"
                value={form.feedAuthor}
                maxLength={200}
                required
                onChange={(e) => setForm({ ...form, feedAuthor: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feed-desc">Description</Label>
            <Textarea
              id="feed-desc"
              value={form.feedDescription}
              maxLength={4000}
              rows={3}
              onChange={(e) => setForm({ ...form, feedDescription: e.target.value })}
            />
          </div>
          <div>
            <Button type="submit" disabled={!dirty || pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CopyField({ value, label, mono }: { value: string; label: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const id = `copy-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className={mono ? "font-mono text-xs" : "text-xs"}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Copy failed. Select the text and copy it manually.");
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}
