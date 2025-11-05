/**
 * Sync Logic
 * Handles bidirectional synchronization between local SQLite and Supabase
 */

import { supabase } from './supabase';
import * as db from './database';
import { Student, Workshop, Attendance } from './types';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';

/**
 * Result type for sync operations
 */
export interface SyncResult {
  success: boolean;
  studentsCount?: number;
  workshopsCount?: number;
  syncedCount?: number;
  error?: string;
}

/**
 * Check if device has internet connectivity
 */
export const checkNetworkConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected || false;
};

/**
 * Get a unique device identifier
 */
export const getDeviceId = async (): Promise<string> => {
  const deviceName = await Device.deviceName;
  const deviceId = Device.modelId || 'unknown';
  return `${deviceName}-${deviceId}`.replace(/\s/g, '-');
};

/**
 * Sync data FROM Supabase TO local SQLite
 * Downloads students and workshops from Supabase and stores them locally
 */
export const syncFromSupabase = async (): Promise<SyncResult> => {
  try {
    // Check network connectivity
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      return {
        success: false,
        studentsCount: 0,
        workshopsCount: 0,
        error: 'No network connection',
      };
    }

    // Fetch students from Supabase
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*');

    if (studentsError) {
      throw studentsError;
    }

    // Fetch workshops from Supabase
    const { data: workshops, error: workshopsError } = await supabase
      .from('workshops')
      .select('*');

    if (workshopsError) {
      throw workshopsError;
    }

    // Bulk insert students into local database
    if (students && students.length > 0) {
      await db.bulkInsertStudents(students as Student[]);
    }

    // Bulk insert workshops into local database
    if (workshops && workshops.length > 0) {
      await db.bulkInsertWorkshops(workshops as Workshop[]);
    }

    return {
      success: true,
      studentsCount: students?.length || 0,
      workshopsCount: workshops?.length || 0,
    };
  } catch (error) {
    console.error('Sync from Supabase error:', error);
    return {
      success: false,
      studentsCount: 0,
      workshopsCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Sync data FROM local SQLite TO Supabase
 * Uploads unsynced attendance records to Supabase
 */
export const syncToSupabase = async (): Promise<SyncResult> => {
  try {
    // Check network connectivity
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      return {
        success: false,
        syncedCount: 0,
        error: 'No network connection',
      };
    }

    // Get all unsynced attendance records
    const unsyncedAttendance = await db.getUnsyncedAttendance();

    if (unsyncedAttendance.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Convert SQLite boolean integers to actual booleans for Supabase
    const attendanceToSync = unsyncedAttendance.map((a) => ({
      ...a,
      is_correct_workshop: Boolean(a.is_correct_workshop),
      manually_added: Boolean(a.manually_added),
      manually_overridden: Boolean(a.manually_overridden),
    }));

    // Upsert attendance records to Supabase
    const { error } = await supabase.from('attendance').upsert(attendanceToSync, {
      onConflict: 'id',
    });

    if (error) {
      throw error;
    }

    // Mark records as synced in local database
    await db.markAttendanceSynced(unsyncedAttendance.map((a) => a.id));

    return {
      success: true,
      syncedCount: unsyncedAttendance.length,
    };
  } catch (error) {
    console.error('Sync to Supabase error:', error);
    return {
      success: false,
      syncedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Perform a full bidirectional sync
 * First syncs TO Supabase (uploads attendance), then FROM Supabase (downloads data)
 */
export const performFullSync = async (): Promise<{
  uploadResult: SyncResult;
  downloadResult: SyncResult;
}> => {
  // First, upload any unsynced attendance
  const uploadResult = await syncToSupabase();

  // Then, download latest students and workshops
  const downloadResult = await syncFromSupabase();

  return {
    uploadResult,
    downloadResult,
  };
};

/**
 * Subscribe to real-time updates for attendance table
 * Useful for seeing updates from other scanner devices in real-time
 */
export const subscribeToAttendanceUpdates = (
  callback: (payload: any) => void
) => {
  const channel = supabase
    .channel('attendance-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance',
      },
      callback
    )
    .subscribe();

  return channel;
};

/**
 * Unsubscribe from real-time updates
 */
export const unsubscribeFromUpdates = async (channel: any) => {
  await supabase.removeChannel(channel);
};
