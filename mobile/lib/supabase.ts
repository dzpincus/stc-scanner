/**
 * Supabase Client Configuration
 * Anon-key client with a request timeout. Realtime is used only as a "something changed"
 * nudge by lib/syncScheduler.ts; all data flows through lib/sync.ts.
 *
 * IMPORTANT: Uses lazy initialization to prevent native module access
 * before React Native bridge is ready (critical for production builds)
 */

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

/** Requests that hang on bad cell service must fail fast so the sync loop keeps moving. */
export const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const upstream = init?.signal;
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener('abort', () => controller.abort());
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// Lazy-initialized Supabase client instance
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 * Uses lazy initialization to prevent AsyncStorage access before RN bridge is ready
 *
 * @returns Supabase client configured with AsyncStorage for session persistence
 */
export const getSupabase = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchWithTimeout },
    });
  }
  return supabaseClient;
};

/**
 * Legacy export for backward compatibility
 * NOTE: Accessing this triggers immediate initialization
 * @deprecated Use getSupabase() instead for better control
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});
