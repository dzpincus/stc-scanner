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

interface ImportError {
  registration_id?: string;
  workshop_name?: string;
  field: string;
  message: string;
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

    // Parse CSV - use parseCSVLine for headers to handle quoted values
    const rawHeaders = parseCSVLine(lines[0]).map(header => header.trim());
    console.log(`[Import] Raw CSV headers:`, rawHeaders);

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
      const values = parseCSVLine(lines[i]).map(value => value.trim());
      if (values.length === 0) continue;

      const row: any = {};
      rawHeaders.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase();
        const mappedKey = columnMapping[normalizedHeader] || normalizedHeader;
        row[mappedKey] = values[index] || '';
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

    console.log(`[Import] Parsed ${rows.length} valid student rows from CSV`);

    const supabase = createServiceClient();
    const importErrors: ImportError[] = [];

    // Create workshops first - handle same workshop name in multiple slots
    const workshopsToCreate: Array<{ name: string; timeSlot: number; roomLocation?: string }> = [];

    // Track which workshops appear in which slots
    const workshopSlots: Map<string, Set<number>> = new Map();
    console.log(`[Import] Processing ${rows.length} rows for workshop slot tracking`);
    
    rows.forEach((row, index) => {
      console.log(`[Import] Row ${index}: slot1='${row.workshop_slot1_name}' slot2='${row.workshop_slot2_name}'`);
      
      if (row.workshop_slot1_name && row.workshop_slot1_name !== 'No Workshop') {
        console.log(`[Import] Adding workshop '${row.workshop_slot1_name}' to slot 1`);
        if (!workshopSlots.has(row.workshop_slot1_name)) {
          workshopSlots.set(row.workshop_slot1_name, new Set());
        }
        workshopSlots.get(row.workshop_slot1_name)!.add(1);
      }
      if (row.workshop_slot2_name && row.workshop_slot2_name !== 'No Workshop') {
        console.log(`[Import] Adding workshop '${row.workshop_slot2_name}' to slot 2`);
        if (!workshopSlots.has(row.workshop_slot2_name)) {
          workshopSlots.set(row.workshop_slot2_name, new Set());
        }
        workshopSlots.get(row.workshop_slot2_name)!.add(2);
      }
    });

    console.log(`[Import] Workshop slots map:`, Array.from(workshopSlots.entries()).map(([name, slots]) => ({
      name,
      slots: Array.from(slots)
    })));

    // Create workshop records for each slot
    console.log(`[Import] Creating workshop records for ${workshopSlots.size} unique workshops`);
    workshopSlots.forEach((slots, workshopName) => {
      console.log(`[Import] Processing workshop '${workshopName}' for slots: [${Array.from(slots)}]`);
      slots.forEach((timeSlot) => {
        // Get room location from any row that has this workshop in this slot
        const roomLocation = rows.find(
          (r) =>
            (timeSlot === 1 && r.workshop_slot1_name === workshopName) ||
            (timeSlot === 2 && r.workshop_slot2_name === workshopName)
        )?.room_location;

        console.log(`[Import] Adding to workshopsToCreate: '${workshopName}' slot ${timeSlot} room '${roomLocation}'`);
        workshopsToCreate.push({
          name: workshopName,
          timeSlot,
          roomLocation,
        });
      });
    });

    console.log(`[Import] Total workshops to create: ${workshopsToCreate.length}`);

    // Upsert all workshops and map workshop_name+slot to ID
    const workshops: Record<string, string> = {}; // key: "name|slot", value: id
    console.log(`[Import] Starting workshop upserts for ${workshopsToCreate.length} workshops`);
    
    for (const ws of workshopsToCreate) {
      try {
        console.log(`[Import] Upserting workshop: '${ws.name}' time_slot=${ws.timeSlot} room='${ws.roomLocation}'`);
        
        const { data: workshop, error: workshopError } = await supabase
          .from('workshops')
          .upsert(
            {
              workshop_name: ws.name,
              time_slot: ws.timeSlot,
              room_location: ws.roomLocation || null,
            },
            {
              onConflict: 'workshop_name,time_slot',
              ignoreDuplicates: false, // Update existing records
            }
          )
          .select('id')
          .single();

        if (workshop && !workshopError) {
          // Store with composite key to differentiate slots
          const compositeKey = `${ws.name}|${ws.timeSlot}`;
          workshops[compositeKey] = workshop.id;
          console.log(`[Import] Successfully upserted workshop '${ws.name}' slot ${ws.timeSlot} -> ID: ${workshop.id}, key: ${compositeKey}`);
        } else if (workshopError) {
          console.error(`[Import] Error upserting workshop '${ws.name}' slot ${ws.timeSlot}:`, workshopError);
          importErrors.push({
            workshop_name: ws.name,
            field: `time_slot_${ws.timeSlot}`,
            message: workshopError.message || 'Failed to upsert workshop',
          });
        }
      } catch (error) {
        console.error(`[Import] Exception processing workshop '${ws.name}' slot ${ws.timeSlot}:`, error);
        importErrors.push({
          workshop_name: ws.name,
          field: `time_slot_${ws.timeSlot}`,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`[Import] Workshop mapping complete. Total mappings:`, Object.keys(workshops).length);
    console.log(`[Import] Workshop ID mappings:`, workshops);

    // Prepare students for batch upsert
    console.log(`[Import] Preparing ${rows.length} students for upsert`);
    const studentsToUpsert = rows.map((row, index) => {
      const slot1Key = row.workshop_slot1_name && row.workshop_slot1_name !== 'No Workshop' 
        ? `${row.workshop_slot1_name}|1` 
        : null;
      const slot2Key = row.workshop_slot2_name && row.workshop_slot2_name !== 'No Workshop' 
        ? `${row.workshop_slot2_name}|2` 
        : null;
      
      const slot1Id = slot1Key ? workshops[slot1Key] || null : null;
      const slot2Id = slot2Key ? workshops[slot2Key] || null : null;
      
      console.log(`[Import] Student ${index} (${row.registration_id}): slot1='${row.workshop_slot1_name}' -> key='${slot1Key}' -> id='${slot1Id}', slot2='${row.workshop_slot2_name}' -> key='${slot2Key}' -> id='${slot2Id}'`);
      
      return {
        registration_id: row.registration_id,
        student_name: row.student_name,
        supervisor_name: row.supervisor_name || null,
        supervisor_email: row.supervisor_email,
        workshop_slot1_id: slot1Id,
        workshop_slot2_id: slot2Id,
        notes: row.notes || null,
      };
    });

    // Batch upsert all students at once (more efficient than sequential)
    let imported = 0;
    if (studentsToUpsert.length > 0) {
      try {
        console.log(`[Import] Upserting ${studentsToUpsert.length} students`);
        const { error: batchError, data: upsertedData } = await supabase
          .from('students')
          .upsert(studentsToUpsert, {
            onConflict: 'registration_id',
          })
          .select('registration_id');

        if (batchError) {
          importErrors.push({
            field: 'students',
            message: `Batch import failed: ${batchError.message}`,
          });
          console.error('Error batch upserting students:', batchError);
        } else {
          imported = upsertedData?.length || studentsToUpsert.length;
          console.log(`[Import] Upsert returned ${upsertedData?.length} records`);
        }
      } catch (error) {
        importErrors.push({
          field: 'students',
          message: error instanceof Error ? error.message : 'Unknown batch error',
        });
        console.error('Error in student batch upsert:', error);
      }
    }

    // Validate workshop slot assignments
    const validationErrors = await validateWorkshopSlots(supabase, studentsToUpsert);
    importErrors.push(...validationErrors);

    return NextResponse.json({
      success: importErrors.length === 0,
      students: imported,
      workshops: workshopsToCreate.length,
      errors: importErrors.length,
      errorDetails: importErrors.length > 0 ? importErrors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import CSV' },
      { status: 500 }
    );
  }
}

// Validate that workshop IDs reference the correct time slots
interface Workshop {
  id: string;
  workshop_name: string;
  time_slot: number;
}

async function validateWorkshopSlots(
  supabase: any,
  students: Array<{
    registration_id: string;
    workshop_slot1_id: string | null;
    workshop_slot2_id: string | null;
  }>
): Promise<ImportError[]> {
  const errors: ImportError[] = [];

  try {
    // Get all workshop IDs that are being assigned
    const workshopIds = new Set<string>();
    students.forEach((s) => {
      if (s.workshop_slot1_id) workshopIds.add(s.workshop_slot1_id);
      if (s.workshop_slot2_id) workshopIds.add(s.workshop_slot2_id);
    });

    if (workshopIds.size === 0) return errors;

    // Fetch workshop details
    const { data: workshops, error: fetchError } = await supabase
      .from('workshops')
      .select('id, workshop_name, time_slot')
      .in('id', Array.from(workshopIds));

    if (fetchError) {
      console.error('Error fetching workshops for validation:', fetchError);
      return errors;
    }

    const workshopMap = new Map<string, Workshop>(
      (workshops || []).map((w: Workshop) => [w.id, w])
    );

    // Validate each student's workshop assignments
    students.forEach((student) => {
      if (student.workshop_slot1_id) {
        const ws = workshopMap.get(student.workshop_slot1_id);
        if (ws && ws.time_slot !== 1) {
          errors.push({
            registration_id: student.registration_id,
            field: 'workshop_slot1_id',
            message: `Workshop "${ws.workshop_name}" is in time_slot ${ws.time_slot}, not slot 1`,
          });
        }
      }

      if (student.workshop_slot2_id) {
        const ws = workshopMap.get(student.workshop_slot2_id);
        if (ws && ws.time_slot !== 2) {
          errors.push({
            registration_id: student.registration_id,
            field: 'workshop_slot2_id',
            message: `Workshop "${ws.workshop_name}" is in time_slot ${ws.time_slot}, not slot 2`,
          });
        }
      }
    });
  } catch (error) {
    console.error('Error validating workshop slots:', error);
  }

  return errors;
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
