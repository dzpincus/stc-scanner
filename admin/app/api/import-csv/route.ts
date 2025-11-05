/**
 * CSV Import API Route
 * Imports student and workshop data from CSV files
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

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
      const timeSlot = rows.find(
        (r) =>
          r.workshop_slot1_name === name || r.workshop_slot2_name === name
      )?.time_slot;

      const { data: existing } = await supabase
        .from('workshops')
        .select('id')
        .eq('workshop_name', name)
        .single();

      if (existing) {
        workshops[name] = existing.id;
      } else {
        const { data: created } = await supabase
          .from('workshops')
          .insert({
            workshop_name: name,
            time_slot: timeSlot ? parseInt(timeSlot) : 1,
            room_location: rows.find(
              (r) =>
                r.workshop_slot1_name === name || r.workshop_slot2_name === name
            )?.room_location,
          })
          .select('id')
          .single();

        if (created) {
          workshops[name] = created.id;
        }
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
