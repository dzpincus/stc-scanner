/**
 * QR Scanning Screen
 * Camera-based QR code scanning for student check-in
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as db from '../../lib/database';
import { syncToSupabase } from '../../lib/sync';
import { useStore } from '../../store/useStore';
import { parseQRCode } from '../../utils/qr-parser';
import { Attendance, Student } from '../../lib/types';
import { SyncStatus } from '../../components/SyncStatus';
import { Colors } from '../../constants/colors';

export default function ScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedSession, setSyncStatus, deviceId } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<
    Array<{ student: Student; isCorrect: boolean }>
  >([]);
  const isProcessingRef = React.useRef(false);

  useEffect(() => {
    // Auto-sync every 30 seconds
    const syncInterval = setInterval(async () => {
      if (selectedSession) {
        const result = await syncToSupabase();
        if (result.success) {
          setSyncStatus({ lastSync: new Date().toISOString(), isOnline: true });
        }
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [selectedSession]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    // Prevent multiple simultaneous scans
    if (!isScanning || !selectedSession || isProcessingRef.current) return;

    // Prevent rapid duplicate scans
    if (data === lastScannedCode) return;

    // Immediately disable scanning and mark as processing
    isProcessingRef.current = true;
    setIsScanning(false);
    setLastScannedCode(data);

    try {
      // Parse QR code
      const { isValid, registrationId } = parseQRCode(data);

      if (!isValid || !registrationId) {
        Vibration.vibrate(500);
        Alert.alert('Invalid QR Code', 'This QR code format is not recognized');
        return;
      }

      // Check in the student
      await checkInStudent(registrationId);
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      // Resume scanning after 2 seconds
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsScanning(true);
        setLastScannedCode(null);
      }, 2000);
    }
  };

  const checkInStudent = async (registrationId: string) => {
    try {
      // Find student
      const student = await db.getStudentByRegistrationId(registrationId);

      if (!student) {
        Vibration.vibrate([100, 50, 100]);
        Alert.alert(
          'Student Not Found',
          `No student found with ID: ${registrationId}\n\nMake sure you've synced the student list.`
        );
        return;
      }

      // Check if already checked in
      const existingAttendance = await db.hasStudentCheckedIn(
        student.id,
        selectedSession!.workshopId
      );

      if (existingAttendance) {
        Vibration.vibrate([100, 50, 100]);
        Alert.alert(
          'Already Checked In',
          `${student.student_name} has already been checked in to this workshop.`
        );
        return;
      }

      // Check if student is registered for this workshop
      const isCorrectWorkshop =
        student.workshop_slot1_id === selectedSession!.workshopId ||
        student.workshop_slot2_id === selectedSession!.workshopId;

      // Create attendance record
      const attendance: Attendance = {
        id: uuidv4(),
        student_id: student.id,
        workshop_id: selectedSession!.workshopId,
        scanned_at: new Date().toISOString(),
        scanner_device_id: deviceId,
        is_correct_workshop: isCorrectWorkshop,
        manually_added: false,
        manually_overridden: false,
        checked_out_at: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.createAttendance(attendance);

      // Invalidate roster cache to update UI immediately
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      queryClient.invalidateQueries({ queryKey: ['workshop-stats'] });

      // Update unsynced count
      const unsyncedCount = await db.getUnsyncedCount();
      setSyncStatus({ pendingCount: unsyncedCount });

      // Add to recent check-ins
      setRecentCheckIns((prev) => [
        { student, isCorrect: isCorrectWorkshop },
        ...prev.slice(0, 4),
      ]);

      // Haptic feedback
      Vibration.vibrate(100);

      // Show warning if wrong workshop
      if (!isCorrectWorkshop) {
        const correctWorkshop =
          selectedSession!.timeSlot === 1
            ? await db.getWorkshopById(student.workshop_slot1_id!)
            : await db.getWorkshopById(student.workshop_slot2_id!);

        Alert.alert(
          '⚠️ Wrong Workshop',
          `${student.student_name} is registered for:\n${correctWorkshop?.workshop_name || 'Unknown'}\n\nBut checked in to:\n${selectedSession!.workshopName}`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        // Show success briefly
        Alert.alert(
          '✓ Check-In Successful',
          `${student.student_name}`,
          [{ text: 'OK', style: 'default' }],
          { cancelable: true }
        );
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Vibration.vibrate([100, 50, 100, 50, 100]);
      Alert.alert('Error', 'Failed to check in student. Please try again.');
    }
  };

  // Handle permissions
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialIcons name="camera-alt" size={64} color="#ccc" />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to scan QR codes for attendance tracking.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Check if session is selected
  if (!selectedSession) {
    return (
      <View style={styles.noSessionContainer}>
        <MaterialIcons name="event-busy" size={64} color="#ccc" />
        <Text style={styles.noSessionTitle}>No Workshop Selected</Text>
        <Text style={styles.noSessionText}>
          Please select a workshop session from the Home tab before scanning.
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
      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          {/* Top Info Bar */}
          <View style={styles.topBar}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionName}>{selectedSession.workshopName}</Text>
              <Text style={styles.sessionSlot}>Slot {selectedSession.timeSlot}</Text>
            </View>
            <SyncStatus />
          </View>

          {/* Scanning Frame */}
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.scanHint}>
              {isScanning ? 'Position QR code within frame' : 'Processing...'}
            </Text>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomBar}>
            {/* Recent Check-Ins */}
            {recentCheckIns.length > 0 && (
              <View style={styles.recentList}>
                {recentCheckIns.map((checkIn, index) => (
                  <View key={index} style={styles.recentItem}>
                    <MaterialIcons
                      name={checkIn.isCorrect ? 'check-circle' : 'warning'}
                      size={20}
                      color={checkIn.isCorrect ? '#4CAF50' : '#FFA500'}
                    />
                    <Text style={styles.recentText}>{checkIn.student.student_name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Manual Check-In Button */}
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => router.push('/manual-checkin')}
            >
              <MaterialIcons name="edit" size={20} color="#fff" />
              <Text style={styles.manualButtonText}>Manual Check-In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
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
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sessionSlot: {
    fontSize: 14,
    color: '#ccc',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.primary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scanHint: {
    marginTop: 24,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  recentList: {
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recentText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#fff',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  manualButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
