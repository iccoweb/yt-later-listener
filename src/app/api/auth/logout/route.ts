import { type NextRequest, NextResponse } from "next/server";
import { endSession, sameOrigin } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, "Forbidden");
  await endSession();
  return NextResponse.json({ ok: true });
}
