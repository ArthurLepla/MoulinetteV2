import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value;

  // Allow requests to /login, /api/* (for login proxy and other api calls), and static assets
  if (
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/api/') || // Allows API calls
    request.nextUrl.pathname.startsWith('/_next/static/') ||
    request.nextUrl.pathname.startsWith('/_next/image/') ||
    request.nextUrl.pathname.includes('.ico') || // Favicon and other icons
    request.nextUrl.pathname.includes('.svg') || // SVG assets
    request.nextUrl.pathname.includes('.png') || // PNG assets
    request.nextUrl.pathname.includes('.jpg') || // JPG assets
    request.nextUrl.pathname.includes('.jpeg') // JPEG assets
  ) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    // If already on a page that requires auth and no token, redirect
    // Avoid redirect loop if trying to access root and not authenticated
    if (request.nextUrl.pathname !== '/' || request.nextUrl.search !== '') {
        loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Apply the guard to all routes except specific Next.js internals and public assets.
export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)$).*)',
  ],
}; 