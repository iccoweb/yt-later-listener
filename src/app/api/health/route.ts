import { connection, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    await (await getDb()).command({ ping: 1 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
