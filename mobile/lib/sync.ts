/**
 * Sync Logic
 *
 * Local SQLite is the source of truth for this phone's scans until the server confirms them.
 * Upload goes through the `upsert_attendance` RPC (per-row outcome, earliest scan wins), and
 * attendance for the active event is downloaded so every phone sees every room's check-ins.
 *
 * All entry points funnel through `syncNow`, which holds a single in-flight lock so timers,
 * foreground events, reconnects, buttons and post-scan pushes never overlap.
 */

import { Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient } from '@tanstack/react-query';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import * as db from './database';
import { Attendance, Event, Student, Workshop } from './types';
import { useStore } from '../store/useStore';
import appJson from '../app.json';

const APP_VERSION: string = appJson.expo.version;
const META_EVENT_ID = 'event_id';
const PAGE = 1000;
const UPLOAD_BATCH = 100;

// ---------------------------------------------------------------------------
// React Query bridge
// ---------------------------------------------------------------------------

let queryClient: QueryClient | null = null;

export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

const invalidateRosterCache = () => {
  queryClient?.invalidateQueries({ queryKey: ['roster'] });
  queryClient?.invalidateQueries({ queryKey: ['workshop-stats'] });
};

// ---------------------------------------------------------------------------
// Device identity
// ---------------------------------------------------------------------------

/**
 * Stable per-install id. Two phones of the same model used to collide on
 * `${deviceName}-${modelId}`; a persisted UUID cannot.
 */
export const ensureDeviceId = (): string => {
  const existing = useStore.getState().deviceId;
  if (existing && existing.length >= 32) return existing;
  const id = uuidv4();
  useStore.getState().setDeviceId(id);
  return id;
};

export const getDeviceLabel = (): string => Device.deviceName || Device.modelName || 'Unknown device';

export const checkNetworkConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** Download students + workshops for the active event. */
  reference?: boolean;
  /** Download attendance for the active event and merge it locally. */
  attendance?: boolean;
  /** Upload unsynced local attendance and pending deletions. */
  push?: boolean;
  /** True for timer/foreground/reconnect triggers; respects backoff. */
  scheduled?: boolean;
}

export interface SyncSummary {
  ok: boolean;
  skipped?: 'offline' | 'busy' | 'backoff';
  error?: string;
  event?: Event;
  students?: number;
  workshops?: number;
  attendancePulled?: number;
  attendanceChanged?: number;
  uploaded?: number;
  uploadFailed?: number;
  deleted?: number;
  pending: number;
}

const fetchActiveEvent = async (): Promise<Event> => {
  const { data, error } = await getSupabase().from('events').select('*').eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No active event configured on the server');
  return data as Event;
};

const fetchAll = async <T,>(table: string, eventId: string): Promise<T[]> => {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from(table)
      .select('*')
      .eq('event_id', eventId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
};

/**
 * Local tables hold one event at a time. Switching events purges them, but never while
 * unsynced scans exist (they would be lost).
 */
const ensureLocalEvent = async (event: Event): Promise<void> => {
  const localEventId = await db.getMeta(META_EVENT_ID);
  if (localEventId === event.id) return;
  if (localEventId) {
    const pending = await db.getUnsyncedCount();
    if (pending > 0) {
      throw new Error(
        `This phone still has ${pending} unsynced scan(s) from a previous event. Upload them before switching to ${event.name}.`
      );
    }
    await db.clearAllData();
    useStore.getState().setSelectedSession(null);
  }
  await db.setMeta(META_EVENT_ID, event.id);
};

const pullReference = async (event: Event): Promise<{ students: number; workshops: number }> => {
  await ensureLocalEvent(event);
  const [students, workshops] = await Promise.all([
    fetchAll<Student>('students', event.id),
    fetchAll<Workshop>('workshops', event.id),
  ]);
  await db.replaceReferenceData(students, workshops);
  reconcileSelectedSession(workshops);
  return { students: students.length, workshops: workshops.length };
};

/**
 * The selected workshop is persisted across restarts. If an admin deleted it, clear it and
 * tell the user; if it was renamed or moved rooms, refresh the copy we display.
 * Compared against the server list, not SQLite: a deleted workshop that still has local
 * attendance rows survives locally until those rows upload.
 */
const reconcileSelectedSession = (workshops: Workshop[]): void => {
  const { selectedSession, setSelectedSession } = useStore.getState();
  if (!selectedSession) return;
  const live = workshops.find((w) => w.id === selectedSession.workshopId);
  if (!live) {
    setSelectedSession(null);
    Alert.alert(
      'Workshop Removed',
      `"${selectedSession.workshopName}" no longer exists on the server. Select a workshop again before scanning.`
    );
    return;
  }
  if (
    live.workshop_name !== selectedSession.workshopName ||
    live.room_location !== selectedSession.roomLocation ||
    live.time_slot !== selectedSession.timeSlot
  ) {
    setSelectedSession({
      workshopId: live.id,
      workshopName: live.workshop_name,
      timeSlot: live.time_slot,
      roomLocation: live.room_location,
    });
  }
};

const pullAttendance = async (event: Event): Promise<{ pulled: number; changed: number }> => {
  const remote = await fetchAll<Attendance>('attendance', event.id);
  const changed = await db.mergeRemoteAttendance(remote);
  const removed = await db.removeAttendanceNotIn(new Set(remote.map((a) => a.id)));
  return { pulled: remote.length, changed: changed + removed };
};

interface RpcRow {
  id: string;
  status: db.UpsertStatus;
  server_id: string | null;
  detail: string | null;
}

const pushDeletions = async (): Promise<{ deleted: number; error?: string }> => {
  const pending = await db.getPendingDeletions();
  if (pending.length === 0) return { deleted: 0 };
  const ids: string[] = [];
  const queueIds: string[] = [];
  for (const d of pending) {
    try {
      ids.push(JSON.parse(d.recordData).id);
      queueIds.push(d.id);
    } catch {
      queueIds.push(d.id); // unparseable: drop it
    }
  }
  let deleted = 0;
  if (ids.length > 0) {
    // Security-definer RPC: phones have no direct DELETE on attendance under RLS.
    const { data, error } = await getSupabase().rpc('delete_attendance', { ids });
    if (error) return { deleted: 0, error: `Delete failed: ${error.message}` };
    deleted = typeof data === 'number' ? data : ids.length;
  }
  await db.clearSyncQueueItems(queueIds);
  return { deleted };
};

const pushAttendance = async (): Promise<{ uploaded: number; failed: number; error?: string }> => {
  const unsynced = await db.getUnsyncedAttendance();
  let uploaded = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (let i = 0; i < unsynced.length; i += UPLOAD_BATCH) {
    const batch = unsynced.slice(i, i + UPLOAD_BATCH);
    // Explicit field mapping: SQLite integers -> booleans, and never send local-only columns.
    const rows = batch.map((a) => ({
      id: a.id,
      student_id: a.student_id,
      workshop_id: a.workshop_id,
      scanned_at: a.scanned_at,
      scanner_device_id: a.scanner_device_id,
      is_correct_workshop: Boolean(a.is_correct_workshop),
      manually_added: Boolean(a.manually_added),
      manually_overridden: Boolean(a.manually_overridden),
      checked_out_at: a.checked_out_at,
      notes: a.notes,
      created_at: a.created_at,
    }));

    const { data, error } = await getSupabase().rpc('upsert_attendance', { rows });
    if (error) {
      // Whole batch failed (network, auth, RLS). Record it on each row and keep going.
      await db.applyUploadResults(batch.map((a) => ({ id: a.id, status: 'error' as const, detail: error.message })));
      failed += batch.length;
      firstError = firstError || error.message;
      continue;
    }

    const results = (data || []) as RpcRow[];
    await db.applyUploadResults(results.map((r) => ({ id: r.id, status: r.status, detail: r.detail })));
    for (const r of results) {
      if (r.status === 'error') {
        failed++;
        firstError = firstError || r.detail || 'row rejected';
      } else {
        uploaded++;
      }
    }
  }
  return { uploaded, failed, error: firstError };
};

const heartbeat = async (event: Event | null, pending: number, lastError: string | null): Promise<void> => {
  const deviceId = ensureDeviceId();
  const { selectedSession } = useStore.getState();
  const { error } = await getSupabase().from('devices').upsert(
    {
      device_id: deviceId,
      label: getDeviceLabel(),
      platform: Platform.OS,
      app_version: APP_VERSION,
      event_id: event?.id ?? null,
      selected_workshop_id: selectedSession?.workshopId ?? null,
      last_seen_at: new Date().toISOString(),
      last_sync_at: lastError ? undefined : new Date().toISOString(),
      unsynced_count: pending,
      last_error: lastError,
    },
    { onConflict: 'device_id' }
  );
  if (error) console.warn('Heartbeat failed:', error.message);
};

// ---------------------------------------------------------------------------
// Orchestrator with lock + backoff
// ---------------------------------------------------------------------------

let inFlight: Promise<SyncSummary> | null = null;
let rerunRequested: SyncOptions | null = null;
let consecutiveFailures = 0;
let backoffUntil = 0;

const BACKOFF_BASE_MS = 20000;
const BACKOFF_MAX_MS = 2 * 60 * 1000; // event day: never wait longer than this between retries

const mergeOptions = (a: SyncOptions, b: SyncOptions): SyncOptions => ({
  reference: !!(a.reference || b.reference),
  attendance: !!(a.attendance || b.attendance),
  push: !!(a.push || b.push),
  scheduled: !!(a.scheduled && b.scheduled),
});

const refreshStatus = async (patch: Partial<ReturnType<typeof useStore.getState>['syncStatus']>) => {
  const [pending, failedCount] = await Promise.all([db.getUnsyncedCount(), db.getFailedUploadCount()]);
  useStore.getState().setSyncStatus({ pendingCount: pending, failedCount, ...patch });
  return pending;
};

const runSync = async (opts: SyncOptions): Promise<SyncSummary> => {
  const store = useStore.getState();
  const online = await checkNetworkConnection();
  if (!online) {
    const pending = await refreshStatus({ isOnline: false });
    return { ok: false, skipped: 'offline', pending };
  }

  store.setSyncStatus({ isSyncing: true, isOnline: true });
  const summary: SyncSummary = { ok: true, pending: 0 };
  const errors: string[] = [];

  let event: Event | null = null;
  try {
    event = await fetchActiveEvent();
    summary.event = event;
    store.setActiveEvent(event);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (event && opts.reference) {
    try {
      const r = await pullReference(event);
      summary.students = r.students;
      summary.workshops = r.workshops;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (opts.push) {
    const d = await pushDeletions();
    summary.deleted = d.deleted;
    if (d.error) errors.push(d.error);
    const u = await pushAttendance();
    summary.uploaded = u.uploaded;
    summary.uploadFailed = u.failed;
    if (u.error) errors.push(u.error);
  }

  if (event && opts.attendance) {
    try {
      const r = await pullAttendance(event);
      summary.attendancePulled = r.pulled;
      summary.attendanceChanged = r.changed;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  invalidateRosterCache();

  summary.ok = errors.length === 0;
  summary.error = errors[0];
  const pending = await refreshStatus({
    isSyncing: false,
    isOnline: true,
    lastError: summary.error ?? null,
    ...(summary.ok ? { lastSync: new Date().toISOString() } : {}),
  });
  summary.pending = pending;

  if (summary.ok) {
    consecutiveFailures = 0;
    backoffUntil = 0;
  } else {
    consecutiveFailures++;
    backoffUntil = Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1), BACKOFF_MAX_MS);
  }

  try {
    await heartbeat(event, pending, summary.error ?? null);
  } catch (e) {
    console.warn('Heartbeat threw:', e);
  }

  return summary;
};

/**
 * Run a sync. Concurrent calls coalesce: a call made while one is running merges its options
 * into a single follow-up run, so a scan during an upload still gets pushed right after.
 */
export const syncNow = async (opts: SyncOptions = { push: true }): Promise<SyncSummary> => {
  if (opts.scheduled && Date.now() < backoffUntil) {
    return { ok: false, skipped: 'backoff', pending: useStore.getState().syncStatus.pendingCount };
  }
  if (inFlight) {
    rerunRequested = rerunRequested ? mergeOptions(rerunRequested, opts) : opts;
    return inFlight;
  }

  inFlight = (async () => {
    try {
      return await runSync(opts);
    } catch (e) {
      // Should not happen (pieces catch their own errors), but never leave the lock held.
      const message = e instanceof Error ? e.message : String(e);
      const pending = await refreshStatus({ isSyncing: false, lastError: message });
      return { ok: false, error: message, pending };
    } finally {
      inFlight = null;
      if (rerunRequested) {
        const next = rerunRequested;
        rerunRequested = null;
        setTimeout(() => void syncNow(next), 250);
      }
    }
  })();
  return inFlight;
};

/** Convenience wrappers used by screens. */
export const fullSync = () => syncNow({ reference: true, attendance: true, push: true });
export const downloadOnly = () => syncNow({ reference: true, attendance: true });
export const uploadOnly = () => syncNow({ push: true });

/** Fire-and-forget push after a scan; debounced so a burst of scans becomes one request. */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
export const requestPush = () => {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncNow({ push: true });
  }, 750);
};

export const isSyncInFlight = () => inFlight !== null;
