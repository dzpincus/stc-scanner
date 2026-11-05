/**
 * Roster View Screen
 * View all students registered for the selected workshop
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '../../store/useStore';
import { SyncStatus } from '../../components/SyncStatus';
import { Colors } from '../../constants/colors';
import { useRosterData, useWorkshopStats, useInvalidateRoster, StudentWithAttendance } from '../../hooks/useRosterData';
import * as db from '../../lib/database';
import { requestPush } from '../../lib/sync';
import { formatTime } from '../../utils/date-utils';
import { Attendance } from '../../lib/types';

export default function RosterScreen() {
  const router = useRouter();
  const { selectedSession, deviceId, setSyncStatus } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'present' | 'absent'>('all');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Use React Query for data fetching
  const { data: students = [], isLoading, refetch, isRefetching } = useRosterData(
    selectedSession?.workshopId || null
  );
  const { data: stats } = useWorkshopStats(selectedSession?.workshopId || null);
  const invalidateRoster = useInvalidateRoster();

  // Filter students based on search and filter mode
  const filteredStudents = useMemo(() => {
    let filtered = students;

    // Apply attendance filter
    if (filterMode === 'present') {
      filtered = filtered.filter((s) => s.hasAttended);
    } else if (filterMode === 'absent') {
      filtered = filtered.filter((s) => !s.hasAttended);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.student_name.toLowerCase().includes(query) ||
          s.registration_id.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [students, searchQuery, filterMode]);

  const handleCheckIn = async (student: StudentWithAttendance) => {
    if (!selectedSession || student.hasAttended) return;

    setIsCheckingIn(true);

    try {
      // Check if student is registered for this workshop
      const isCorrectWorkshop =
        student.workshop_slot1_id === selectedSession.workshopId ||
        student.workshop_slot2_id === selectedSession.workshopId;

      // Confirm if wrong workshop
      if (!isCorrectWorkshop) {
        Alert.alert(
          'Wrong Workshop',
          `${student.student_name} is not registered for ${selectedSession.workshopName}.\n\nCheck them in anyway?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsCheckingIn(false),
            },
            {
              text: 'Check In',
              onPress: () => performCheckIn(student, isCorrectWorkshop),
            },
          ],
          { cancelable: false }
        );
        return;
      }

      await performCheckIn(student, isCorrectWorkshop);
    } catch (error) {
      console.error('Manual check-in error:', error);
      Alert.alert('Error', 'Failed to check in student. Please try again.');
      setIsCheckingIn(false);
    }
  };

  const performCheckIn = async (student: StudentWithAttendance, isCorrectWorkshop: boolean) => {
    try {
      // Create attendance record
      const attendance: Attendance = {
        id: uuidv4(),
        student_id: student.id,
        workshop_id: selectedSession!.workshopId,
        scanned_at: new Date().toISOString(),
        scanner_device_id: deviceId,
        is_correct_workshop: isCorrectWorkshop,
        manually_added: true,
        manually_overridden: false,
        checked_out_at: null,
        notes: 'Manually checked in from roster',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.createAttendance(attendance);

      // Update unsynced count, then push in the background
      const unsyncedCount = await db.getUnsyncedCount();
      setSyncStatus({ pendingCount: unsyncedCount });
      requestPush();

      // Invalidate React Query cache to refresh the roster
      await invalidateRoster();

      Alert.alert('Success', `${student.student_name} has been checked in.`);
    } catch (error) {
      console.error('Perform check-in error:', error);
      Alert.alert('Error', 'Failed to save attendance record.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const showAttendanceInfo = (student: StudentWithAttendance) => {
    const a = student.attendance;
    if (!a) return;
    const mine = a.scanner_device_id === deviceId;
    Alert.alert(
      'Already Checked In',
      `${student.student_name}\nChecked in at ${formatTime(a.scanned_at)}${
        mine ? ' on this phone' : ' on another device'
      }${a.manually_added ? ' (manual)' : ''}.\n\nPress and hold to remove this check-in.`
    );
  };

  const handleDeleteAttendance = async (student: StudentWithAttendance) => {
    if (!student.attendance) return;

    Alert.alert(
      'Remove Check-In?',
      `${student.student_name} will be marked absent for ${selectedSession?.workshopName}. This is recorded in the audit log and affects every device.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.deleteAttendance(student.attendance!.id);
              await invalidateRoster();
              requestPush();
              Alert.alert('Removed', `${student.student_name} has been marked as absent.`);
            } catch (error) {
              console.error('Error deleting attendance:', error);
              Alert.alert('Error', 'Failed to delete attendance record');
            }
          },
        },
      ]
    );
  };

  const renderStudent = ({ item }: { item: StudentWithAttendance }) => (
    <TouchableOpacity
      style={styles.studentCard}
      onPress={() => (item.hasAttended ? showAttendanceInfo(item) : handleCheckIn(item))}
      onLongPress={() => (item.hasAttended ? handleDeleteAttendance(item) : undefined)}
      delayLongPress={600}
      disabled={isCheckingIn}
    >
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.student_name}</Text>
        <Text style={styles.studentId}>{item.registration_id}</Text>
        {item.supervisor_name && (
          <Text style={styles.studentSupervisor}>Supervisor: {item.supervisor_name}</Text>
        )}
        {item.attendance && !item.attendance.is_correct_workshop && (
          <View style={styles.wrongWorkshopContainer}>
            <MaterialIcons name="warning" size={16} color="#FFA500" />
            <Text style={styles.wrongWorkshopText}>Wrong workshop</Text>
          </View>
        )}
      </View>
      <View style={styles.studentStatus}>
        {item.hasAttended ? (
          <>
            <MaterialIcons name="check-circle" size={24} color={Colors.success} />
            <Text style={[styles.statusText, styles.statusPresent]}>
              {item.attendance?.synced === 0 ? 'Present · pending' : 'Present'}
            </Text>
            <Text style={styles.statusHint}>hold to remove</Text>
          </>
        ) : (
          <>
            <MaterialIcons name="add-circle-outline" size={24} color={Colors.primary} />
            <Text style={[styles.statusText, styles.statusAbsent]}>Tap to check in</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!selectedSession) {
    return (
      <View style={styles.noSessionContainer}>
        <MaterialIcons name="event-busy" size={64} color="#ccc" />
        <Text style={styles.noSessionTitle}>No Workshop Selected</Text>
        <Text style={styles.noSessionText}>
          Please select a workshop session from the Home tab to view the roster.
        </Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => router.push('/session-select')}
        >
          <Text style={styles.selectButtonText}>Select Workshop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Stats */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.workshopName}>{selectedSession.workshopName}</Text>
            <Text style={styles.workshopSlot}>Time Slot {selectedSession.timeSlot}</Text>
          </View>
          <SyncStatus />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.present || 0}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, styles.statAbsent]}>{stats?.absent || 0}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats?.percentage || 0}%</Text>
            <Text style={styles.statLabel}>Rate</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="clear" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'all' && styles.filterTabActive]}
          onPress={() => setFilterMode('all')}
        >
          <Text style={[styles.filterTabText, filterMode === 'all' && styles.filterTabTextActive]}>
            All ({stats?.total || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'present' && styles.filterTabActive]}
          onPress={() => setFilterMode('present')}
        >
          <Text
            style={[styles.filterTabText, filterMode === 'present' && styles.filterTabTextActive]}
          >
            Present ({stats?.present || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'absent' && styles.filterTabActive]}
          onPress={() => setFilterMode('absent')}
        >
          <Text
            style={[styles.filterTabText, filterMode === 'absent' && styles.filterTabTextActive]}
          >
            Absent ({stats?.absent || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Student List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {students.length === 0
                ? 'No students registered for this workshop'
                : 'No students match your search'}
            </Text>
          </View>
        }
      />

      {/* Check-in Loading Overlay */}
      {isCheckingIn && (
        <View style={styles.checkingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.checkingText}>Checking in...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  noSessionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  noSessionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noSessionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  selectButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  header: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  workshopName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  workshopSlot: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statAbsent: {
    color: '#FFA500',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  studentSupervisor: {
    fontSize: 12,
    color: '#999',
  },
  wrongWorkshopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  wrongWorkshopText: {
    fontSize: 12,
    color: '#FFA500',
    fontWeight: '500',
    marginLeft: 4,
  },
  studentStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  statusPresent: {
    color: Colors.success,
  },
  statusHint: {
    fontSize: 10,
    color: '#bbb',
    marginTop: 2,
  },
  statusAbsent: {
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  checkingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
