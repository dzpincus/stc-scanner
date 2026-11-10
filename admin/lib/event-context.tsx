/**
 * Active event context for client components.
 * Every page reads `event.id` from here and scopes its queries with `.eq('event_id', event.id)`.
 * `locked` = event mode (doors open): destructive admin actions are hidden/refused.
 * `events` lists every event the admin may switch to; `switchEvent` calls the
 * `set_active_event` RPC, which the dashboard and every phone follow.
 */

'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Event } from '@/lib/types';

interface ActiveEventContextValue {
  event: Event | null;
  events: Event[];
  loading: boolean;
  refresh: () => Promise<void>;
  setLocked: (locked: boolean) => Promise<boolean>;
  /** Resolves to an error message, or null on success. */
  switchEvent: (slug: string) => Promise<string | null>;
}

const ActiveEventContext = createContext<ActiveEventContextValue>({
  event: null,
  events: [],
  loading: true,
  refresh: async () => {},
  setLocked: async () => false,
  switchEvent: async () => 'Not ready',
});

export function ActiveEventProvider({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Admins can read every event (RLS); the active one is derived from the list.
    const { data, error } = await createClient().from('events').select('*').order('slug');
    if (error) console.error('Failed to load events:', error);
    const list = (data || []) as Event[];
    setEvents(list);
    setEvent(list.find((e) => e.is_active) || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const setLocked = useCallback(
    async (locked: boolean) => {
      if (!event) return false;
      const { data, error } = await createClient()
        .from('events')
        .update({ locked })
        .eq('id', event.id)
        .select('*')
        .maybeSingle();
      if (error || !data) {
        console.error('Failed to update event lock:', error);
        return false;
      }
      setEvent(data as Event);
      setEvents((list) => list.map((e) => (e.id === data.id ? (data as Event) : e)));
      return true;
    },
    [event]
  );

  const switchEvent = useCallback(
    async (slug: string) => {
      const { error } = await createClient().rpc('set_active_event', { p_slug: slug });
      if (error) {
        console.error('Failed to switch event:', error);
        return error.message;
      }
      await refresh();
      return null;
    },
    [refresh]
  );

  return (
    <ActiveEventContext.Provider value={{ event, events, loading, refresh, setLocked, switchEvent }}>
      {children}
    </ActiveEventContext.Provider>
  );
}

export function useActiveEvent() {
  return useContext(ActiveEventContext);
}
