/**
 * Sync Status Component
 * Displays connection status and sync progress
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import { formatRelativeTime } from '../utils/date-utils';
import { Colors } from '../constants/colors';

export const SyncStatus: React.FC = () => {
  const { syncStatus } = useStore();

  const getStatusColor = () => {
    if (syncStatus.isSyncing) return Colors.syncing;
    if (!syncStatus.isOnline) return Colors.offline;
    if (syncStatus.pendingCount > 0) return Colors.syncing;
    return Colors.online;
  };

  const getStatusIcon = () => {
    if (syncStatus.isSyncing) return null; // Show spinner instead
    if (!syncStatus.isOnline) return 'cloud-off';
    if (syncStatus.pendingCount > 0) return 'cloud-queue';
    return 'cloud-done';
  };

  const getStatusText = () => {
    if (syncStatus.isSyncing) return 'Syncing...';
    if (!syncStatus.isOnline) return 'Offline';
    if (syncStatus.pendingCount > 0) {
      return `${syncStatus.pendingCount} pending`;
    }
    if (syncStatus.lastSync) {
      return `Synced ${formatRelativeTime(syncStatus.lastSync)}`;
    }
    return 'Not synced';
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: statusColor }]} />
      {syncStatus.isSyncing ? (
        <ActivityIndicator size="small" color={statusColor} style={styles.icon} />
      ) : (
        statusIcon && (
          <MaterialIcons name={statusIcon as any} size={16} color={statusColor} style={styles.icon} />
        )
      )}
      <Text style={[styles.text, { color: statusColor }]}>{getStatusText()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
