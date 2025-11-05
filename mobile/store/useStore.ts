/**
 * Zustand State Management Store
 * Global application state for session selection and sync status
 */

import { create } from 'zustand';
import { SessionSelection, SyncStatus } from '../lib/types';

interface AppState {
  // Session selection
  selectedSession: SessionSelection | null;
  setSelectedSession: (session: SessionSelection | null) => void;

  // Sync status
  syncStatus: SyncStatus;
  setSyncStatus: (status: Partial<SyncStatus>) => void;

  // Device ID
  deviceId: string | null;
  setDeviceId: (id: string) => void;

  // Scanner mode (whether actively scanning)
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;

  // Data version tracker - increment this to trigger UI refreshes
  dataVersion: number;
  incrementDataVersion: () => void;

  // Reset store to initial state
  reset: () => void;
}

const initialState = {
  selectedSession: null,
  syncStatus: {
    lastSync: null,
    pendingCount: 0,
    isOnline: false,
    isSyncing: false,
  },
  deviceId: null,
  isScanning: false,
};

/**
 * Main application store
 */
export const useStore = create<AppState>((set) => ({
  ...initialState,

  // Session selection actions
  setSelectedSession: (session) => set({ selectedSession: session }),

  // Sync status actions
  setSyncStatus: (status) =>
    set((state) => ({
      syncStatus: { ...state.syncStatus, ...status },
    })),

  // Device ID actions
  setDeviceId: (id) => set({ deviceId: id }),

  // Scanner mode actions
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  // Reset all state
  reset: () => set(initialState),
}));
