import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Exchange code for session (Supabase will automatically use the code verifier from cookies)
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        new URL('/login?error=auth_failed', request.url)
      );
    }

    // Get the user after successful exchange
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user email is from @stagethechange.org domain
    if (user && !user.email?.endsWith('@stagethechange.org')) {
      // Unauthorized domain - sign out and redirect to login
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', request.url)
      );
    }

    // Redirect to destination
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // No code present, redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}
