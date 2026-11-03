import { type NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { retry, toEpisodeDTO } from "@/lib/episodes";
import { jsonError, unauthorized } from "@/lib/http";
import { wakeWorker } from "@/lib/worker";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/episodes/[id]/retry">) {
  if (!(await authenticate(req, { allowToken: false })).ok) return unauthorized();
  const episode = await retry((await ctx.params).id);
  if (!episode) return jsonError(409, "Only failed episodes can be retried");
  wakeWorker();
  return NextResponse.json({ episode: toEpisodeDTO(episode) });
}
