import { checkGatewayHealth } from "@/app/lib/openclaw";
import { NextResponse } from "next/server";

export async function GET() {
  const healthy = await checkGatewayHealth();
  return NextResponse.json({ ok: healthy });
}
