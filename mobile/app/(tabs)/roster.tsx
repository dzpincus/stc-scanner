/**
 * Roster View Screen
 * View all students registered for the selected workshop
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as db from '../../lib/database';
import { Student, Attendance } from '../../lib/types';
import { useStore } from '../../store/useStore';
import { SyncStatus } from '../../components/SyncStatus';
import { Colors } from '../../constants/colors';

type StudentWithAttendance = Student & {
  hasAttended: boolean;
  attendance: Attendance | null;
};

export default function RosterScreen() {
  const router = useRouter();
  const { selectedSession } = useStore();
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithAttendance[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'present' | 'absent'>('all');

  useEffect(() => {
    loadRoster();
  }, [selectedSession]);

  useEffect(() => {
    filterStudents();
  }, [students, searchQuery, filterMode]);

  const loadRoster = async () => {
    if (!selectedSession) {
      setStudents([]);
      return;
    }

    try {
      // Get all students registered for this workshop
      const registeredStudents = await db.getStudentsByWorkshop(selectedSession.workshopId);

      // Get attendance records
      const attendanceRecords = await db.getAttendanceByWorkshop(selectedSession.workshopId);

      // Create a map of student ID to attendance
      const attendanceMap = new Map<string, Attendance>();
      attendanceRecords.forEach((a) => {
        attendanceMap.set(a.student_id, a);
      });

      // Combine student data with attendance
      const studentsWithAttendance: StudentWithAttendance[] = registeredStudents.map(
        (student) => {
          const attendance = attendanceMap.get(student.id) || null;
          return {
            ...student,
            hasAttended: attendance !== null,
            attendance,
          };
        }
      );

      setStudents(studentsWithAttendance);
    } catch (error) {
      console.error('Failed to load roster:', error);
    }
  };

  const filterStudents = () => {
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

    setFilteredStudents(filtered);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadRoster();
    setIsRefreshing(false);
  }, [selectedSession]);

  const getStats = () => {
    const total = students.length;
    const present = students.filter((s) => s.hasAttended).length;
    const absent = total - present;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, percentage };
  };

  const handleDeleteAttendance = async (student: StudentWithAttendance) => {
    if (!student.attendance) return;

    const confirmed = confirm(
      `Remove attendance record for ${student.student_name}? This will mark them as absent.`
    );
    if (!confirmed) return;

    try {
      await db.deleteAttendance(student.attendance.id);
      await loadRoster();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      alert('Failed to delete attendance record');
    }
  };

  const renderStudent = ({ item }: { item: StudentWithAttendance }) => (
    <TouchableOpacity
      style={styles.studentCard}
      onLongPress={() => item.hasAttended && handleDeleteAttendance(item)}
      delayLongPress={800}
    >
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.student_name}</Text>
        <Text style={styles.studentId}>{item.registration_id}</Text>
        {item.supervisor_name && (
          <Text style={styles.studentSupervisor}>Supervisor: {item.supervisor_name}</Text>
        )}
      </View>
      <View style={styles.studentStatus}>
        {item.hasAttended ? (
          <>
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.statusText}>Present</Text>
            {item.attendance && !item.attendance.is_correct_workshop && (
              <MaterialIcons name="warning" size={20} color="#FFA500" />
            )}
          </>
        ) : (
          <>
            <MaterialIcons name="radio-button-unchecked" size={24} color="#999" />
            <Text style={[styles.statusText, styles.statusAbsent]}>Absent</Text>
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

  const stats = getStats();

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
            <Text style={styles.statValue}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, styles.statAbsent]}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.percentage}%</Text>
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
            All ({stats.total})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'present' && styles.filterTabActive]}
          onPress={() => setFilterMode('present')}
        >
          <Text
            style={[styles.filterTabText, filterMode === 'present' && styles.filterTabTextActive]}
          >
            Present ({stats.present})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterMode === 'absent' && styles.filterTabActive]}
          onPress={() => setFilterMode('absent')}
        >
          <Text
            style={[styles.filterTabText, filterMode === 'absent' && styles.filterTabTextActive]}
          >
            Absent ({stats.absent})
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
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
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
  studentStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4CAF50',
    marginTop: 4,
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
});
