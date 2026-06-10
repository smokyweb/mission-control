import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';

const SCRIPT = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.openclaw', 'workspace', 'provision-server.py'
);

export async function POST(req: NextRequest) {
  const { serverId } = await req.json();
  if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 });

  try {
    const result = spawnSync('python', [SCRIPT, serverId], {
      timeout: 120_000,  // 2 min max
      encoding: 'utf8',
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    const stdout = (result.stdout || '').trim();
    const stderr = (result.stderr || '').trim();

    // Find the JSON output line
    const jsonLine = stdout.split('\n').reverse().find(l => l.startsWith('{'));
    if (!jsonLine) {
      return NextResponse.json({ ok: false, error: 'No JSON output from script', stderr, stdout }, { status: 500 });
    }

    const parsed = JSON.parse(jsonLine);
    return NextResponse.json(parsed);

  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
