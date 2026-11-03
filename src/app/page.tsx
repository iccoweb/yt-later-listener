import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { hasSession } from "@/lib/auth";
import { listEpisodes, toEpisodeDTO } from "@/lib/episodes";
import { getSettings, toSettingsDTO } from "@/lib/settings";

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthedDashboard />
    </Suspense>
  );
}

async function AuthedDashboard() {
  if (!(await hasSession())) redirect("/login");
  const [episodes, settings] = await Promise.all([listEpisodes(), getSettings()]);
  return (
    <Dashboard
      initialEpisodes={episodes.map(toEpisodeDTO)}
      initialSettings={toSettingsDTO(settings)}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
