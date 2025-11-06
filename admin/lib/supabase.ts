/**
 * Supabase Client Configuration
 * Client-side and server-side Supabase clients with auth support
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create browser client for client components
 * Safe to use in client-side code
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Create service role client for API routes
 * Has elevated permissions - use with caution
 * Note: For server components, use functions from @/lib/supabase-server
 */
export function createServiceClient() {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}
