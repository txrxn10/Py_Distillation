import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/'];
  
  // Protected routes that require authentication
  const protectedRoutes = ['/image', '/video', '/history', '/dashboard', '/edit-brand-guidelines', '/edit-image', '/help', '/try-on'];
  
  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
  
  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

  // If user is not authenticated and trying to access a protected route
  if (!token && isProtectedRoute) {
    console.log(`Redirecting unauthenticated user from ${pathname} to /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is authenticated and trying to access public-only pages
  if (token && (pathname === '/' || pathname === '/login' || pathname === '/register')) {
    console.log(`Redirecting authenticated user from ${pathname} to /image`);
    return NextResponse.redirect(new URL('/image', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};