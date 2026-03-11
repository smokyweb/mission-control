import { invokeTool } from '@/app/lib/openclaw';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionKey: string }> }
) {
  try {
    const { sessionKey } = await params;
    const target = decodeURIComponent(sessionKey);
    await invokeTool('subagents', { action: 'kill', target });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
