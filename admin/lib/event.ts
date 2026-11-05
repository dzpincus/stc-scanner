/**
 * Active event lookup. Every students/workshops/attendance query in the admin must be
 * scoped to the active event; previous years stay in the same tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event } from './types';

export async function getActiveEvent(supabase: SupabaseClient): Promise<Event | null> {
  const { data, error } = await supabase.from('events').select('*').eq('is_active', true).maybeSingle();
  if (error) {
    console.error('Failed to load active event:', error);
    return null;
  }
  return (data as Event) || null;
}
