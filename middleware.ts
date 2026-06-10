import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'batcave_session';
// Portal users auth is handled by the app itself via servers.json
// This middleware protects non-portal routes with a simple session check

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'batcave-servers-salt-2026').digest('hex');
}

// Super admin credentials (for main batcave access)
const SUPER_ADMINS: Record<string, string> = {
  'kevin@bluestoneapps.com': hashPassword('@@@.Kevin1.@@@'),
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets, API routes, and portal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/portal/') ||
    pathname === '/batcave-login' ||
    pathname.startsWith('/public/')
  ) {
    return NextResponse.next();
  }

  // Check for valid session cookie
  const session = request.cookies.get(COOKIE_NAME);
  if (session?.value === 'authenticated') {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL('/batcave-login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
