import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { jsonError, readBody, unauthorized } from "@/lib/http";
import { getSettings, toSettingsDTO, updateFeedMeta } from "@/lib/settings";

const patchSchema = z
  .object({
    feedTitle: z.string().trim().min(1).max(200),
    feedDescription: z.string().trim().max(4000),
    feedAuthor: z.string().trim().min(1).max(200),
  })
  .strict();

export async function GET(req: NextRequest) {
  if (!(await authenticate(req, { allowToken: false })).ok) return unauthorized();
  return NextResponse.json(
    { settings: toSettingsDTO(await getSettings()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: NextRequest) {
  if (!(await authenticate(req, { allowToken: false })).ok) return unauthorized();
  const body = await readBody(req, 16 * 1024);
  if (body === null) return jsonError(413, "Body too large");
  let parsed;
  try {
    parsed = patchSchema.safeParse(JSON.parse(body));
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  await updateFeedMeta(parsed.data);
  return NextResponse.json({ settings: toSettingsDTO(await getSettings()) });
}
