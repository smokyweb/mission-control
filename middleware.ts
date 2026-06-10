import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'batcave_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets, API routes, login page, and portal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/portal/') ||
    pathname === '/batcave-login' ||
    pathname.startsWith('/batcave-login')
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
