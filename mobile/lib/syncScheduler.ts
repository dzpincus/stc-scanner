/**
 * Sync Scheduler
 *
 * Mounted once at the root layout so sync keeps running on every tab, not only while the
 * Scan screen is open. Triggers: 20s timer (push when there is anything pending; every sixth
 * tick also pulls attendance), app returning to foreground, network reconnect, and a
 * realtime nudge whenever any attendance row changes on the server (so a second phone in
 * the room sees a scan within seconds; the 2-minute pull remains the fallback).
 * Backoff after failures is handled inside `syncNow`.
 */

import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as db from './database';
import { getSupabase } from './supabase';
import { ensureDeviceId, syncNow } from './sync';
import { useStore } from '../store/useStore';

const TICK_MS = 20000;
const PULL_EVERY_TICKS = 6; // 2 minutes
const REALTIME_DEBOUNCE_MS = 4000; // a burst of scans across rooms becomes one pull

let stop: (() => void) | null = null;
let channel: RealtimeChannel | null = null;
let channelEventId: string | null = null;
let realtimeTimer: ReturnType<typeof setTimeout> | null = null;

/** (Re)subscribe to attendance changes for the current active event. No-op when unchanged. */
const ensureRealtime = () => {
  const event = useStore.getState().activeEvent;
  if (!event || event.id === channelEventId) return;
  if (channel) {
    void getSupabase().removeChannel(channel);
    channel = null;
  }
  channelEventId = event.id;
  channel = getSupabase()
    .channel(`attendance-${event.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance', filter: `event_id=eq.${event.id}` },
      () => {
        if (realtimeTimer) clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
          realtimeTimer = null;
          void syncNow({ attendance: true, scheduled: true });
        }, REALTIME_DEBOUNCE_MS);
      }
    )
    .subscribe();
};

export const startSyncScheduler = (): (() => void) => {
  if (stop) return stop;

  ensureDeviceId();
  let tick = 0;
  let wasConnected: boolean | null = null;
  let appState: AppStateStatus = AppState.currentState;

  const interval = setInterval(async () => {
    tick++;
    if (appState !== 'active') return;
    ensureRealtime();
    const pullTick = tick % PULL_EVERY_TICKS === 0;
    const pending = await db.getUnsyncedCount();
    if (pending === 0 && !pullTick) return;
    void syncNow({ push: pending > 0, attendance: pullTick, scheduled: true });
  }, TICK_MS);

  const appSub = AppState.addEventListener('change', (next) => {
    const cameToForeground = appState !== 'active' && next === 'active';
    appState = next;
    if (cameToForeground) void syncNow({ push: true, attendance: true, scheduled: true });
  });

  const netSub = NetInfo.addEventListener((state) => {
    const connected = !!state.isConnected;
    useStore.getState().setSyncStatus({ isOnline: connected });
    const reconnected = wasConnected === false && connected;
    wasConnected = connected;
    if (reconnected) void syncNow({ push: true, scheduled: false });
  });

  // Startup: refresh reference data, pull everyone's attendance, flush anything pending,
  // then open the realtime channel for the event we just learned about.
  setTimeout(() => {
    void syncNow({ reference: true, attendance: true, push: true, scheduled: true }).then(ensureRealtime);
  }, 1500);

  stop = () => {
    clearInterval(interval);
    appSub.remove();
    netSub();
    if (realtimeTimer) clearTimeout(realtimeTimer);
    if (channel) {
      void getSupabase().removeChannel(channel);
      channel = null;
      channelEventId = null;
    }
    stop = null;
  };
  return stop;
};
