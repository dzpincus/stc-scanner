/**
 * Zustand State Management Store
 * Global application state for session selection and sync status.
 *
 * `selectedSession` and `deviceId` persist across restarts (AsyncStorage). Hydration is
 * started explicitly from the root layout (`useStore.persist.rehydrate()`) so no native
 * module is touched at import time.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event, SessionSelection, SyncStatus } from '../lib/types';

interface AppState {
  // Session selection
  selectedSession: SessionSelection | null;
  setSelectedSession: (session: SessionSelection | null) => void;

  // Active event as last seen on the server
  activeEvent: Event | null;
  setActiveEvent: (event: Event | null) => void;

  // Sync status
  syncStatus: SyncStatus;
  setSyncStatus: (status: Partial<SyncStatus>) => void;

  // Device ID (per-install UUID)
  deviceId: string | null;
  setDeviceId: (id: string) => void;

  // Scanner mode (whether actively scanning)
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;

  // Reset store to initial state
  reset: () => void;
}

const initialState = {
  selectedSession: null,
  activeEvent: null,
  syncStatus: {
    lastSync: null,
    pendingCount: 0,
    failedCount: 0,
    isOnline: false,
    isSyncing: false,
    lastError: null,
  } as SyncStatus,
  deviceId: null,
  isScanning: false,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedSession: (session) => set({ selectedSession: session }),
      setActiveEvent: (event) => set({ activeEvent: event }),
      setSyncStatus: (status) =>
        set((state) => ({
          syncStatus: { ...state.syncStatus, ...status },
        })),
      setDeviceId: (id) => set({ deviceId: id }),
      setIsScanning: (scanning) => set({ isScanning: scanning }),
      reset: () => set(initialState),
    }),
    {
      name: 'stc-scanner-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ selectedSession: state.selectedSession, deviceId: state.deviceId }),
      skipHydration: true,
    }
  )
);
