import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const SECRET = 'bc-run-axel-2026';
const SCRIPT = 'C:\\Users\\kevin\\.openclaw\\workspace\\basecamp-review.js';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || req.headers.get('x-run-token');

  if (token !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fire-and-forget: spawn the script but return immediately
  // (Cloudflare has a ~100s timeout; the script can take several minutes)
  const proc = spawn('node', [SCRIPT], {
    cwd: path.dirname(SCRIPT),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let output = '';
  proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
  proc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });

  // Kill after 15 minutes as a safety net
  const timeout = setTimeout(() => { proc.kill(); }, 15 * 60 * 1000);
  proc.on('close', () => { clearTimeout(timeout); });

  // Respond immediately — script runs in background
  return NextResponse.json({ ok: true, started: true, message: 'Basecamp review started. Check #monitoring for results in a few minutes.' });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (token !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // GET returns a simple HTML trigger page
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Run Basecamp Review</title>
  <style>
    body { font-family: sans-serif; background: #0a0a0f; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 16px; padding: 40px 48px; text-align: center; max-width: 480px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #888; margin-bottom: 28px; }
    button { background: #4f46e5; color: #fff; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #4338ca; }
    button:disabled { background: #333; color: #666; cursor: not-allowed; }
    #status { margin-top: 20px; font-size: 14px; color: #aaa; white-space: pre-wrap; text-align: left; max-height: 300px; overflow-y: auto; background: #0f0f1a; padding: 12px; border-radius: 8px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🦇 Basecamp Review</h1>
    <p>Manually trigger the PM report. Updates the Tracking sheet and posts to #monitoring.</p>
    <button id="btn" onclick="runScript()">Run Now</button>
    <div id="status"></div>
  </div>
  <script>
    async function runScript() {
      const btn = document.getElementById('btn');
      const status = document.getElementById('status');
      btn.disabled = true;
      btn.textContent = 'Starting...';
      status.style.display = 'block';
      status.textContent = 'Starting script...';
      try {
        const res = await fetch('?token=${SECRET}', { method: 'POST' });
        const data = await res.json();
        if (data.started) {
          status.textContent = '✅ Script started!\\n\\nIt runs in the background — check #monitoring on Discord for the results in a few minutes.';
          btn.textContent = '✅ Started';
        } else {
          status.textContent = '❌ Error: ' + (data.error || JSON.stringify(data));
          btn.textContent = 'Run Now';
          btn.disabled = false;
        }
      } catch(e) {
        status.textContent = 'Error: ' + e.message;
        btn.textContent = 'Run Now';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
