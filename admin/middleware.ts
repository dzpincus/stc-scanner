import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from './lib/supabase-server';

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/privacy', '/terms', '/auth/callback'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Allow public routes without user check
  if (isPublicRoute) {
    // Still refresh the session to keep cookies fresh
    await supabase.auth.getUser();
    return response;
  }

  // getUser() validates the JWT against Supabase Auth; getSession() only trusts the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if not signed in
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user email is from @stagethechange.org domain
  const userEmail = user.email;
  if (!userEmail?.endsWith('@stagethechange.org')) {
    // User is authenticated but not authorized
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'unauthorized');

    // Sign out the unauthorized user
    await supabase.auth.signOut();

    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated and authorized
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
