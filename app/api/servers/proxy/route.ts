/**
 * Reverse proxy for OpenClaw webchat iframes.
 * Strips X-Frame-Options and frame-ancestors CSP so the page can be embedded.
 * 
 * Usage: /api/servers/proxy?server=skywork1&path=/
 */
import { NextRequest, NextResponse } from 'next/server';

const WEBCHAT_BASES: Record<string, string> = {
  skywork1: 'https://skywork1.batmanbluestone.com',
  skywork2: 'https://skywork2.batmanbluestone.com',
  staxyl:   'https://staxyl.batmanbluestone.com',
  stonyx:   'https://stonyx.batmanbluestone.com',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const server = searchParams.get('server');
  const urlPath = searchParams.get('path') || '/';

  if (!server || !WEBCHAT_BASES[server]) {
    return new NextResponse('Unknown server', { status: 400 });
  }

  const base = WEBCHAT_BASES[server];
  const targetUrl = base + urlPath + (searchParams.toString().replace(`server=${server}`, '').replace(`path=${encodeURIComponent(urlPath)}`, '').replace(/^&+|&+$/g, '') ? '?' + searchParams.toString().replace(`server=${server}&`, '').replace(`&path=${encodeURIComponent(urlPath)}`, '') : '');

  try {
    const upstream = await fetch(base + urlPath, {
      headers: {
        'User-Agent': 'BatCave-Proxy/1.0',
        'Accept': req.headers.get('accept') || '*/*',
        'Accept-Language': req.headers.get('accept-language') || 'en-US,en;q=0.9',
      },
    });

    const contentType = upstream.headers.get('content-type') || 'text/html';
    let body = await upstream.text();

    // Rewrite absolute URLs to go through the proxy
    if (contentType.includes('text/html')) {
      body = body
        .replace(/(href|src|action)="(\/[^"]*?)"/g, `$1="/api/servers/proxy?server=${server}&path=$2"`)
        .replace(/(href|src|action)='(\/[^']*?)'/g, `$1='/api/servers/proxy?server=${server}&path=$2'`);
    }

    // Build response with frame-blocking headers stripped
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    // Explicitly allow framing — do NOT forward X-Frame-Options or restrictive CSP
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *");

    // Forward safe headers
    for (const h of ['cache-control', 'etag', 'last-modified']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    return new NextResponse(body, { status: upstream.status, headers });
  } catch (e: unknown) {
    return new NextResponse(`Proxy error: ${e instanceof Error ? e.message : String(e)}`, { status: 502 });
  }
}
