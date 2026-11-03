import { type NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { jsonError, readBody, unauthorized } from "@/lib/http";
import { getSettings, rotateApiToken, rotateFeedToken, toSettingsDTO } from "@/lib/settings";

export async function POST(req: NextRequest) {
  if (!(await authenticate(req, { allowToken: false })).ok) return unauthorized();
  const body = await readBody(req, 1024);
  let target: unknown;
  try {
    target = body ? (JSON.parse(body) as { target?: unknown }).target : undefined;
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (target === "api") {
    const apiToken = await rotateApiToken();
    return NextResponse.json(
      { apiToken, settings: toSettingsDTO(await getSettings()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (target === "feed") {
    await rotateFeedToken();
    return NextResponse.json({ settings: toSettingsDTO(await getSettings()) });
  }
  return jsonError(400, 'target must be "api" or "feed"');
}
