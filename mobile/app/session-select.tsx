/**
 * Session Selection Screen
 * Choose which workshop session to scan for
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '../lib/database';
import { Workshop } from '../lib/types';
import { useStore } from '../store/useStore';
import { Colors } from '../constants/colors';

export default function SessionSelectScreen() {
  const router = useRouter();
  const { setSelectedSession, selectedSession } = useStore();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<1 | 2>(1);

  useEffect(() => {
    loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    setIsLoading(true);
    try {
      const allWorkshops = await db.getAllWorkshops();
      setWorkshops(allWorkshops);
    } catch (error) {
      console.error('Failed to load workshops:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorkshop = (workshop: Workshop) => {
    setSelectedSession({
      workshopId: workshop.id,
      workshopName: workshop.workshop_name,
      timeSlot: workshop.time_slot,
      roomLocation: workshop.room_location,
    });
    router.back();
  };

  const filteredWorkshops = workshops.filter((w) => w.time_slot === selectedTimeSlot);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading workshops...</Text>
      </View>
    );
  }

  if (workshops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="event-busy" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Workshops Found</Text>
        <Text style={styles.emptyText}>
          Please sync from Supabase to download workshop data
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Time Slot Selector */}
      <View style={styles.slotSelector}>
        <TouchableOpacity
          style={[styles.slotButton, selectedTimeSlot === 1 && styles.slotButtonActive]}
          onPress={() => setSelectedTimeSlot(1)}
        >
          <Text style={[styles.slotButtonText, selectedTimeSlot === 1 && styles.slotButtonTextActive]}>
            Time Slot 1
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.slotButton, selectedTimeSlot === 2 && styles.slotButtonActive]}
          onPress={() => setSelectedTimeSlot(2)}
        >
          <Text style={[styles.slotButtonText, selectedTimeSlot === 2 && styles.slotButtonTextActive]}>
            Time Slot 2
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workshop List */}
      <ScrollView style={styles.workshopList}>
        {filteredWorkshops.map((workshop) => {
          const isSelected = selectedSession?.workshopId === workshop.id;

          return (
            <TouchableOpacity
              key={workshop.id}
              style={[styles.workshopCard, isSelected && styles.workshopCardSelected]}
              onPress={() => handleSelectWorkshop(workshop)}
            >
              <View style={styles.workshopInfo}>
                <Text style={styles.workshopName}>{workshop.workshop_name}</Text>
                {workshop.room_location && (
                  <View style={styles.workshopDetail}>
                    <MaterialIcons name="place" size={16} color="#666" />
                    <Text style={styles.workshopDetailText}>{workshop.room_location}</Text>
                  </View>
                )}
                {workshop.capacity && (
                  <View style={styles.workshopDetail}>
                    <MaterialIcons name="people" size={16} color="#666" />
                    <Text style={styles.workshopDetailText}>Capacity: {workshop.capacity}</Text>
                  </View>
                )}
              </View>
              {isSelected && (
                <MaterialIcons name="check-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  slotSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  slotButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  slotButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  slotButtonTextActive: {
    color: '#fff',
  },
  workshopList: {
    flex: 1,
  },
  workshopCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workshopCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#fce8e8',
  },
  workshopInfo: {
    flex: 1,
  },
  workshopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  workshopDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  workshopDetailText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
});
