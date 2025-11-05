/**
 * Google Sheets Import API Route
 * Imports student and workshop data from Google Sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { google } from 'googleapis';

interface SheetRow {
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
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract spreadsheet ID from URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid Google Sheets URL' },
        { status: 400 }
      );
    }

    const spreadsheetId = match[1];

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch data from sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:Z', // Get all columns
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return NextResponse.json(
        { error: 'Sheet is empty or has no data' },
        { status: 400 }
      );
    }

    // Parse headers
    const headers = rows[0].map((h) =>
      String(h).trim().toLowerCase().replace(/\s+/g, '_')
    );

    // Parse data rows
    const data: SheetRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = rows[i][index] || '';
      });

      // Validate required fields
      if (row.registration_id && row.student_name && row.supervisor_email) {
        data.push(row);
      }
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in sheet' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Create workshops first
    const workshopNames = new Set<string>();
    data.forEach((row) => {
      if (row.workshop_slot1_name) workshopNames.add(row.workshop_slot1_name);
      if (row.workshop_slot2_name) workshopNames.add(row.workshop_slot2_name);
    });

    const workshops: Record<string, string> = {};
    for (const name of workshopNames) {
      const timeSlot = data.find(
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
            room_location: data.find(
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

    for (const row of data) {
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
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to import from Google Sheets',
      },
      { status: 500 }
    );
  }
}
