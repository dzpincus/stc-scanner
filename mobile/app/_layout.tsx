/**
 * Root Layout
 * Sets up the navigation structure and initializes the database
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as db from '../lib/database';
import { setQueryClient } from '../lib/sync';

// Create a client for React Query
const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    // Initialize the database and sync on app startup
    const initApp = async () => {
      try {
        await db.initDatabase();
        console.log('Database initialized successfully');

        // Pass query client to sync module for cache invalidation
        setQueryClient(queryClient);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initApp();
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
