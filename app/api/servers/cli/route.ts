import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';

const SCRIPT = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.openclaw', 'workspace', 'ssh-exec.py'
);

export async function POST(req: NextRequest) {
  const { serverId, command } = await req.json();
  if (!serverId || !command) return NextResponse.json({ ok: false, error: 'serverId and command required' }, { status: 400 });

  // Basic safety — block obviously dangerous commands
  const blocked = ['rm -rf /', 'mkfs', ':(){:|:&};:', 'dd if=/dev/zero'];
  if (blocked.some(b => command.includes(b))) {
    return NextResponse.json({ ok: false, error: 'Command blocked for safety' }, { status: 400 });
  }

  const result = spawnSync('python', [SCRIPT, serverId, command], {
    timeout: 35_000,
    encoding: 'utf8',
  });

  if (result.error) return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });

  const stdout = (result.stdout || '').trim();
  const jsonLine = stdout.split('\n').reverse().find((l: string) => l.startsWith('{'));
  if (!jsonLine) return NextResponse.json({ ok: false, error: 'No output', raw: stdout }, { status: 500 });

  try { return NextResponse.json(JSON.parse(jsonLine)); }
  catch { return NextResponse.json({ ok: false, error: 'Parse error', raw: jsonLine }, { status: 500 }); }
}
