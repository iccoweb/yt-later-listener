"use client";

import { Headphones, ListMusic, LogOut, Moon, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { AddEpisodeForm } from "@/components/add-episode-form";
import { EpisodeList } from "@/components/episode-list";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import type { EpisodeDTO, SettingsDTO } from "@/lib/types";

const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 20_000;

export function Dashboard({
  initialEpisodes,
  initialSettings,
}: {
  initialEpisodes: EpisodeDTO[];
  initialSettings: SettingsDTO;
}) {
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [settings, setSettings] = useState(initialSettings);
  const { resolvedTheme, setTheme } = useTheme();

  const refresh = useCallback(async () => {
    try {
      setEpisodes((await api.listEpisodes()).episodes);
    } catch {
      // transient; the next poll will retry
    }
  }, []);

  const active = episodes.some((e) => e.status === "queued" || e.status === "processing");

  useEffect(() => {
    const id = setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh();
      },
      active ? ACTIVE_POLL_MS : IDLE_POLL_MS,
    );
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, refresh]);

  const upsert = (episode: EpisodeDTO) =>
    setEpisodes((list) =>
      list.some((e) => e.id === episode.id)
        ? list.map((e) => (e.id === episode.id ? episode : e))
        : [episode, ...list],
    );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-red-600 text-white">
          <Headphones className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{settings.feedTitle}</h1>
          <p className="text-xs text-muted-foreground">
            {episodes.filter((e) => e.status === "ready").length} in feed
            {active && " · converting…"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={async () => {
            await api.logout().catch(() => {});
            window.location.assign("/login");
          }}
        >
          <LogOut />
        </Button>
      </header>

      <Tabs defaultValue="episodes">
        <TabsList className="mb-4 w-full sm:w-fit">
          <TabsTrigger value="episodes">
            <ListMusic /> Episodes
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 /> Feed &amp; Shortcut
          </TabsTrigger>
        </TabsList>

        <TabsContent value="episodes" className="space-y-4">
          <AddEpisodeForm onAdded={upsert} />
          <EpisodeList
            episodes={episodes}
            onChanged={upsert}
            onDeleted={(id) => setEpisodes((list) => list.filter((e) => e.id !== id))}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel settings={settings} onChange={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
