import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { deleteEpisode, getEpisode, toEpisodeDTO, updateEpisode } from "@/lib/episodes";
import { jsonError, readBody, unauthorized } from "@/lib/http";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(20_000).optional(),
  })
  .strict();

export async function GET(req: NextRequest, ctx: RouteContext<"/api/episodes/[id]">) {
  if (!(await authenticate(req)).ok) return unauthorized();
  const episode = await getEpisode((await ctx.params).id);
  if (!episode) return jsonError(404, "Not found");
  return NextResponse.json({ episode: toEpisodeDTO(episode) });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/episodes/[id]">) {
  if (!(await authenticate(req, { allowToken: false })).ok) return unauthorized();
  const body = await readBody(req, 64 * 1024);
  if (body === null) return jsonError(413, "Body too large");
  let parsed;
  try {
    parsed = patchSchema.safeParse(JSON.parse(body));
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid input");

  const episode = await updateEpisode((await ctx.params).id, parsed.data);
  if (!episode) return jsonError(404, "Not found");
  return NextResponse.json({ episode: toEpisodeDTO(episode) });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/episodes/[id]">) {
  if (!(await authenticate(req, { allowToken: false })).ok) return unauthorized();
  const deleted = await deleteEpisode((await ctx.params).id);
  if (!deleted) return jsonError(404, "Not found");
  return new NextResponse(null, { status: 204 });
}
