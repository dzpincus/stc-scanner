/**
 * CSV Import API Route
 * Imports student and workshop data from CSV files
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server';

interface CsvRow {
  registration_id: string;
  student_name: string;
  supervisor_name?: string;
  supervisor_email: string;
  workshop_slot1_name?: string;
  workshop_slot2_name?: string;
  time_slot?: string;
  room_location?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    // Parse CSV
    const rawHeaders = lines[0].split(',').map((h) => h.trim());

    // Map column names to standardized keys
    const columnMapping: Record<string, string> = {
      'registrant id': 'registration_id',
      'registration_id': 'registration_id',
      'name (last name)': 'last_name',
      'name (first name)': 'first_name',
      'student_name': 'student_name',
      'breakout session i': 'workshop_slot1_name',
      'breakout session ii': 'workshop_slot2_name',
      'workshop_slot1_name': 'workshop_slot1_name',
      'workshop_slot2_name': 'workshop_slot2_name',
      'contact last name': 'supervisor_last_name',
      'contact first name': 'supervisor_first_name',
      'contact email': 'supervisor_email',
      'supervisor_email': 'supervisor_email',
      'supervisor_name': 'supervisor_name',
      'school/organization name': 'school',
      'notes': 'notes',
      'time_slot': 'time_slot',
      'room_location': 'room_location'
    };

    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: any = {};
      rawHeaders.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase();
        const mappedKey = columnMapping[normalizedHeader] || normalizedHeader;
        row[mappedKey] = values[index]?.trim() || '';
      });

      // Combine first and last name if needed
      if (row.first_name && row.last_name) {
        row.student_name = `${row.first_name} ${row.last_name}`;
      }

      // Combine supervisor first and last name if needed
      if (row.supervisor_first_name && row.supervisor_last_name) {
        row.supervisor_name = `${row.supervisor_first_name} ${row.supervisor_last_name}`;
      }

      // Ensure we have required fields
      if (row.registration_id && (row.student_name || (row.first_name && row.last_name)) && row.supervisor_email) {
        rows.push(row);
      }
    }

    const supabase = createServiceClient();

    // Create workshops first
    const workshopNames = new Set<string>();
    rows.forEach((row) => {
      if (row.workshop_slot1_name) workshopNames.add(row.workshop_slot1_name);
      if (row.workshop_slot2_name) workshopNames.add(row.workshop_slot2_name);
    });

    const workshops: Record<string, string> = {};
    for (const name of workshopNames) {
      // Determine time slot based on which slot this workshop appears in
      // Check multiple rows to be more robust
      let timeSlot = 1; // default
      for (const row of rows) {
        if (row.workshop_slot1_name === name) {
          timeSlot = 1;
          break;
        } else if (row.workshop_slot2_name === name) {
          timeSlot = 2;
          break;
        }
      }

      // Get room location from any row that has this workshop
      const roomLocation = rows.find(
        (r) =>
          r.workshop_slot1_name === name || r.workshop_slot2_name === name
      )?.room_location;

      // Use upsert to handle idempotency - update if exists, insert if new
      const { data: workshop, error: workshopError } = await supabase
        .from('workshops')
        .upsert(
          {
            workshop_name: name,
            time_slot: timeSlot,
            room_location: roomLocation || null,
          },
          {
            onConflict: 'workshop_name,time_slot',
            ignoreDuplicates: false, // Update existing records
          }
        )
        .select('id')
        .single();

      if (workshop && !workshopError) {
        workshops[name] = workshop.id;
      } else if (workshopError) {
        console.error('Error upserting workshop:', workshopError);
      }
    }

    // Insert students
    let imported = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const { error } = await supabase.from('students').upsert(
          {
            registration_id: row.registration_id,
            student_name: row.student_name,
            supervisor_name: row.supervisor_name || null,
            supervisor_email: row.supervisor_email,
            workshop_slot1_id: row.workshop_slot1_name
              ? workshops[row.workshop_slot1_name] || null
              : null,
            workshop_slot2_id: row.workshop_slot2_name
              ? workshops[row.workshop_slot2_name] || null
              : null,
            notes: row.notes || null,
          },
          {
            onConflict: 'registration_id',
          }
        );

        if (error) {
          console.error('Error inserting student:', error);
          errors++;
        } else {
          imported++;
        }
      } catch (error) {
        console.error('Error processing row:', error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      students: imported,
      workshops: workshopNames.size,
      errors,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import CSV' },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
