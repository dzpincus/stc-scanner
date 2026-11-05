/**
 * Root Layout
 * Sets up the navigation structure and initializes the database
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as db from '../lib/database';
import { setQueryClient } from '../lib/sync';
import { startSyncScheduler } from '../lib/syncScheduler';
import { useStore } from '../store/useStore';

// Create a client for React Query
const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    let stopScheduler: (() => void) | null = null;
    let cancelled = false;

    // Initialize the database, restore persisted state, then start background sync
    const initApp = async () => {
      try {
        await db.initDatabase();
        console.log('Database initialized successfully');

        // Pass query client to sync module for cache invalidation
        setQueryClient(queryClient);

        // Restore selected workshop + device id (AsyncStorage) before any sync runs
        await useStore.persist.rehydrate();

        if (!cancelled) stopScheduler = startSyncScheduler();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initApp();
    return () => {
      cancelled = true;
      stopScheduler?.();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="session-select"
          options={{
            title: 'Select Workshop',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="manual-checkin"
          options={{
            title: 'Manual Check-In',
            presentation: 'modal',
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
