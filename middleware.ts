import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'batcave_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // On missions.batmanbluestone.com - Cloudflare handles auth, no custom login needed
  if (host.includes('missions.batmanbluestone.com') || host.includes('batmanbluestone.com')) {
    return NextResponse.next();
  }

  // On batcave.bluesapps.com - use custom login
  // Always allow static assets, API routes, login page, and portal routes
  // Allow static assets (images, icons, etc.)
  const isStaticAsset = /\.(jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(pathname);

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/uploads/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/portal/') ||
    pathname === '/batcave-login' ||
    pathname.startsWith('/batcave-login') ||
    pathname.startsWith('/(auth)') ||
    isStaticAsset
  ) {
    return NextResponse.next();
  }

  // Check for valid session cookie
  const session = request.cookies.get(COOKIE_NAME);
  if (session?.value === 'authenticated') {
    return NextResponse.next();
  }

  // Also allow /servers pages directly (they connect to internal APIs)
  if (pathname.startsWith('/servers') || pathname.startsWith('/tasks') || pathname.startsWith('/team')) {
    return NextResponse.next();
  }

  // Redirect to login (only on bluesapps.com)
  const loginUrl = new URL('/batcave-login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Exclude _next/static, _next/image, favicon.ico, and all static file extensions
  matcher: ['/((?!_next/static|_next/image|favicon\.ico|.*\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)$).*)'],
};
