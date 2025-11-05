/**
 * Home/Setup Screen
 * Initial sync and device configuration
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '../../lib/database';
import { syncFromSupabase, syncToSupabase, getDeviceId, performFullSync } from '../../lib/sync';
import { useStore } from '../../store/useStore';
import { SyncStatus } from '../../components/SyncStatus';
import { Colors } from '../../constants/colors';

export default function HomeScreen() {
  const router = useRouter();
  const { selectedSession, setSelectedSession, setSyncStatus, deviceId, setDeviceId } = useStore();
  const [stats, setStats] = useState({
    studentCount: 0,
    workshopCount: 0,
    attendanceCount: 0,
    unsyncedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    // Get device ID
    const id = await getDeviceId();
    setDeviceId(id);

    // Load database stats
    await loadStats();
  };

  const loadStats = async () => {
    const dbStats = await db.getDatabaseStats();
    setStats(dbStats);
    setSyncStatus({ pendingCount: dbStats.unsyncedCount });
  };

  const handleSyncFromSupabase = async () => {
    setIsLoading(true);
    setSyncStatus({ isSyncing: true });

    try {
      const result = await syncFromSupabase();

      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Downloaded:\n• ${result.studentsCount} students\n• ${result.workshopsCount} workshops`
        );
        await loadStats();
        setSyncStatus({
          lastSync: new Date().toISOString(),
          isOnline: true,
        });
      } else {
        Alert.alert('Sync Failed', result.error || 'Unable to sync from Supabase');
        setSyncStatus({ isOnline: false });
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during sync');
      console.error('Sync error:', error);
    } finally {
      setIsLoading(false);
      setSyncStatus({ isSyncing: false });
    }
  };

  const handleSyncToSupabase = async () => {
    setIsLoading(true);
    setSyncStatus({ isSyncing: true });

    try {
      const result = await syncToSupabase();

      if (result.success) {
        if (result.syncedCount === 0) {
          Alert.alert('Up to Date', 'No attendance records to sync');
        } else {
          Alert.alert('Sync Complete', `Uploaded ${result.syncedCount} attendance records`);
        }
        await loadStats();
        setSyncStatus({
          lastSync: new Date().toISOString(),
          isOnline: true,
        });
      } else {
        Alert.alert('Sync Failed', result.error || 'Unable to sync to Supabase');
        setSyncStatus({ isOnline: false });
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during sync');
      console.error('Sync error:', error);
    } finally {
      setIsLoading(false);
      setSyncStatus({ isSyncing: false });
    }
  };

  const handleFullSync = async () => {
    setIsLoading(true);
    setSyncStatus({ isSyncing: true });

    try {
      const { uploadResult, downloadResult } = await performFullSync();

      const messages = [];
      if (uploadResult.success && uploadResult.syncedCount! > 0) {
        messages.push(`Uploaded ${uploadResult.syncedCount} attendance records`);
      }
      if (downloadResult.success) {
        messages.push(`Downloaded ${downloadResult.studentsCount} students`);
        messages.push(`Downloaded ${downloadResult.workshopsCount} workshops`);
      }

      if (messages.length > 0) {
        Alert.alert('Full Sync Complete', messages.join('\n'));
      } else {
        Alert.alert('Already Synced', 'Everything is up to date');
      }

      await loadStats();
      setSyncStatus({
        lastSync: new Date().toISOString(),
        isOnline: true,
      });
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during sync');
      console.error('Sync error:', error);
    } finally {
      setIsLoading(false);
      setSyncStatus({ isSyncing: false });
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all local data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await db.clearAllData();
            setSelectedSession(null);
            await loadStats();
            Alert.alert('Success', 'All local data cleared');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image
            source={require('../../assets/stc-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Attendance Scanner</Text>
        </View>
        <SyncStatus />
      </View>

      {deviceId && (
        <View style={styles.deviceInfo}>
          <MaterialIcons name="phone-android" size={16} color="#666" />
          <Text style={styles.deviceText}>Device: {deviceId}</Text>
        </View>
      )}

      {/* Current Session */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Session</Text>
        {selectedSession ? (
          <View style={styles.sessionCard}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionName}>{selectedSession.workshopName}</Text>
              <Text style={styles.sessionDetails}>
                Slot {selectedSession.timeSlot} • {selectedSession.roomLocation || 'No room assigned'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => router.push('/session-select')}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.selectSessionButton}
            onPress={() => router.push('/session-select')}
          >
            <MaterialIcons name="add-circle-outline" size={24} color={Colors.primary} />
            <Text style={styles.selectSessionText}>Select Workshop Session</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Database Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Database Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.studentCount}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.workshopCount}</Text>
            <Text style={styles.statLabel}>Workshops</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.attendanceCount}</Text>
            <Text style={styles.statLabel}>Check-Ins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, stats.unsyncedCount > 0 && styles.statWarning]}>
              {stats.unsyncedCount}
            </Text>
            <Text style={styles.statLabel}>Unsynced</Text>
          </View>
        </View>
      </View>

      {/* Sync Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Actions</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleFullSync}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="sync" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Full Sync</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSyncFromSupabase}
          disabled={isLoading}
        >
          <MaterialIcons name="cloud-download" size={20} color={Colors.primary} />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Download Data
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSyncToSupabase}
          disabled={isLoading}
        >
          <MaterialIcons name="cloud-upload" size={20} color={Colors.primary} />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Upload Attendance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearData}
          disabled={isLoading}
        >
          <MaterialIcons name="delete-forever" size={20} color="#f44336" />
          <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
            Clear All Data
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Ready to scan? Select a workshop session and go to the Scan tab.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryDark,
  },
  headerContent: {
    marginBottom: 12,
    alignItems: 'center',
  },
  logo: {
    width: 240,
    height: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
  },
  deviceText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sessionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fce8e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sessionDetails: {
    fontSize: 14,
    color: '#666',
  },
  changeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  changeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  selectSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.backgroundGray,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  selectSessionText: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: '50%',
    padding: 16,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statWarning: {
    color: Colors.warning,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textLight,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: Colors.primary,
  },
  dangerButton: {
    borderColor: Colors.error,
  },
  dangerButtonText: {
    color: Colors.error,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
