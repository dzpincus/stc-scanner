/**
 * Active event context for client components.
 * Every page reads `event.id` from here and scopes its queries with `.eq('event_id', event.id)`.
 * `locked` = event mode (doors open): destructive admin actions are hidden/refused.
 */

'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { getActiveEvent } from '@/lib/event';
import type { Event } from '@/lib/types';

interface ActiveEventContextValue {
  event: Event | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setLocked: (locked: boolean) => Promise<boolean>;
}

const ActiveEventContext = createContext<ActiveEventContextValue>({
  event: null,
  loading: true,
  refresh: async () => {},
  setLocked: async () => false,
});

export function ActiveEventProvider({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getActiveEvent(createClient());
    setEvent(next);
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
      return true;
    },
    [event]
  );

  return (
    <ActiveEventContext.Provider value={{ event, loading, refresh, setLocked }}>{children}</ActiveEventContext.Provider>
  );
}

export function useActiveEvent() {
  return useContext(ActiveEventContext);
}
