/**
 * Manual Check-In Modal
 * Manually add students when QR code scanning isn't possible
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '../lib/database';
import { requestPush } from '../lib/sync';
import { Student, Attendance } from '../lib/types';
import { useStore } from '../store/useStore';
import { Colors } from '../constants/colors';

export default function ManualCheckInScreen() {
  const router = useRouter();
  const { selectedSession, deviceId, setSyncStatus } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [selectedSession]);

  useEffect(() => {
    filterStudents();
  }, [searchQuery, allStudents]);

  const loadStudents = async () => {
    if (!selectedSession) {
      setIsLoading(false);
      return;
    }

    try {
      // Get students registered for this workshop
      const students = await db.getStudentsByWorkshop(selectedSession.workshopId);
      setAllStudents(students);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterStudents = () => {
    if (!searchQuery.trim()) {
      setFilteredStudents([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allStudents.filter(
      (s) =>
        s.student_name.toLowerCase().includes(query) ||
        s.registration_id.toLowerCase().includes(query) ||
        (s.supervisor_name && s.supervisor_name.toLowerCase().includes(query))
    );

    setFilteredStudents(filtered);
  };

  const handleCheckIn = async (student: Student) => {
    if (!selectedSession) return;

    setIsCheckingIn(true);

    try {
      // Check if already checked in
      const hasCheckedIn = await db.hasStudentCheckedIn(
        student.id,
        selectedSession.workshopId
      );

      if (hasCheckedIn) {
        Alert.alert(
          'Already Checked In',
          `${student.student_name} has already been checked in to this workshop.`
        );
        setIsCheckingIn(false);
        return;
      }

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Check-In Error',
        `Failed to check in student.\n\nError: ${errorMessage}`,
        [{ text: 'OK' }]
      );
      setIsCheckingIn(false);
    }
  };

  const performCheckIn = async (student: Student, isCorrectWorkshop: boolean) => {
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
        notes: 'Manually checked in',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.createAttendance(attendance);

      // Update unsynced count, then push in the background
      const unsyncedCount = await db.getUnsyncedCount();
      setSyncStatus({ pendingCount: unsyncedCount });
      requestPush();

      Alert.alert(
        'Success',
        `${student.student_name} has been checked in.`,
        [
          {
            text: 'Done',
            onPress: () => {
              setSearchQuery('');
              router.back();
            },
          },
          {
            text: 'Check In Another',
            onPress: () => setSearchQuery(''),
          },
        ]
      );
    } catch (error) {
      console.error('Perform check-in error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Save Error',
        `Failed to save attendance record.\n\nError: ${errorMessage}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <TouchableOpacity
      style={styles.studentCard}
      onPress={() => handleCheckIn(item)}
      disabled={isCheckingIn}
    >
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.student_name}</Text>
        <Text style={styles.studentId}>{item.registration_id}</Text>
        {item.supervisor_name && (
          <Text style={styles.studentSupervisor}>Supervisor: {item.supervisor_name}</Text>
        )}
      </View>
      <MaterialIcons name="add-circle-outline" size={24} color="Colors.primary" />
    </TouchableOpacity>
  );

  if (!selectedSession) {
    return (
      <View style={styles.container}>
        <View style={styles.noSessionContainer}>
          <MaterialIcons name="event-busy" size={64} color="#ccc" />
          <Text style={styles.noSessionTitle}>No Workshop Selected</Text>
          <Text style={styles.noSessionText}>
            Please select a workshop session before manually checking in students.
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="Colors.primary" />
        <Text style={styles.loadingText}>Loading students...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Manual Check-In</Text>
        <Text style={styles.subtitle}>{selectedSession.workshopName}</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, ID, or supervisor..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="clear" size={24} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Student List */}
      {searchQuery.trim().length === 0 ? (
        <View style={styles.instructionsContainer}>
          <MaterialIcons name="info-outline" size={48} color="Colors.primary" />
          <Text style={styles.instructionsTitle}>Start typing to search</Text>
          <Text style={styles.instructionsText}>
            Enter student name, registration ID, or supervisor name to find students.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          renderItem={renderStudent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No students found matching "{searchQuery}"</Text>
            </View>
          }
        />
      )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  noSessionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  closeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  header: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
