import { invokeTool } from "@/app/lib/openclaw";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { tool, args } = await req.json();
    const result = await invokeTool(tool, args ?? {});
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
