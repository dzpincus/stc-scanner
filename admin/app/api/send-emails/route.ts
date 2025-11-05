/**
 * Email Sending API Route
 * Sends attendance reports to supervisors
 * Supports multiple email providers: Gmail, SendGrid, AWS SES, Generic SMTP
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import nodemailer from 'nodemailer';

interface EmailRecipient {
  supervisor_email: string;
  supervisor_name: string | null;
  students: Array<{
    student_name: string;
    registration_id: string;
    workshop_name: string | null;
    attended: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { timeSlot } = await request.json();

    if (!timeSlot || (timeSlot !== 1 && timeSlot !== 2)) {
      return NextResponse.json(
        { error: 'Invalid time slot' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Load all data
    const [{ data: students }, { data: workshops }, { data: attendance }] =
      await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('workshops').select('*').eq('time_slot', timeSlot),
        supabase.from('attendance').select('*'),
      ]);

    if (!students || !workshops || !attendance) {
      return NextResponse.json(
        { error: 'Failed to load data' },
        { status: 500 }
      );
    }

    // Group students by supervisor email
    const supervisorMap = new Map<string, EmailRecipient>();

    students.forEach((student) => {
      const email = student.supervisor_email;
      if (!email) return;

      const workshopId =
        timeSlot === 1 ? student.workshop_slot1_id : student.workshop_slot2_id;
      if (!workshopId) return;

      const workshop = workshops.find((w) => w.id === workshopId);
      const attended = attendance.some(
        (a) => a.student_id === student.id && a.workshop_id === workshopId
      );

      if (!supervisorMap.has(email)) {
        supervisorMap.set(email, {
          supervisor_email: email,
          supervisor_name: student.supervisor_name,
          students: [],
        });
      }

      supervisorMap.get(email)!.students.push({
        student_name: student.student_name,
        registration_id: student.registration_id,
        workshop_name: workshop?.workshop_name || null,
        attended,
      });
    });

    // Configure email transporter
    // Supports both Gmail API (Google Workspace) and SMTP
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'; // 'gmail-api' or 'smtp'

    let transporter;

    if (emailProvider === 'gmail-api') {
      // Google Workspace Gmail API with Service Account
      const { google } = await import('googleapis');

      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
      });

      // Create OAuth2 client with domain-wide delegation
      const oauth2Client = await auth.getClient();
      const accessToken = await oauth2Client.getAccessToken();

      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.EMAIL_FROM_ADDRESS, // e.g., noreply@stagethechange.org
          accessToken: accessToken.token,
        },
      });
    } else {
      // SMTP (fallback for testing or other providers)
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }

    // Send emails
    let sent = 0;
    let failed = 0;

    for (const [email, data] of supervisorMap.entries()) {
      try {
        const html = generateEmailHTML(data, timeSlot);

        const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || process.env.GMAIL_USER;
        const fromName = process.env.EMAIL_FROM_NAME || 'Stage the Change';
        const bccAddress = process.env.EMAIL_BCC_ADDRESS || 'registration@stagethechange.org';

        await transporter.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: email,
          bcc: bccAddress,
          subject: `Workshop Attendance Report - Time Slot ${timeSlot}`,
          html,
        });

        // Log success
        await supabase.from('email_log').insert({
          supervisor_email: email,
          time_slot: timeSlot,
          sent_at: new Date().toISOString(),
          student_count: data.students.length,
          email_status: 'sent',
        });

        sent++;
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);

        // Log failure
        await supabase.from('email_log').insert({
          supervisor_email: email,
          time_slot: timeSlot,
          sent_at: new Date().toISOString(),
          student_count: data.students.length,
          email_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: supervisorMap.size,
    });
  } catch (error) {
    console.error('Error sending emails:', error);
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    );
  }
}

function generateEmailHTML(data: EmailRecipient, timeSlot: number): string {
  const studentRows = data.students
    .map(
      (student) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${student.student_name}</strong><br/>
        <span style="color: #6b7280; font-size: 14px;">${student.registration_id}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${student.workshop_name || 'Not assigned'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${
          student.attended
            ? '<span style="color: #10b981; font-weight: 600;">✓ Present</span>'
            : '<span style="color: #6b7280;">✗ Absent</span>'
        }
      </td>
    </tr>
  `
    )
    .join('');

  const attendedCount = data.students.filter((s) => s.attended).length;
  const totalCount = data.students.length;
  const attendanceRate =
    totalCount > 0 ? ((attendedCount / totalCount) * 100).toFixed(1) : '0';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workshop Attendance Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background-color: #b02527; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
        Stage the Change
      </h1>
      <p style="margin: 8px 0 0; color: #ffffff; opacity: 0.9; font-size: 16px;">
        Workshop Attendance Report
      </p>
    </div>

    <!-- Content -->
    <div style="background-color: #ffffff; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
        Hello ${data.supervisor_name || 'Supervisor'},
      </p>

      <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
        Here is the attendance report for your students in <strong>Time Slot ${timeSlot}</strong>:
      </p>

      <!-- Stats -->
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 32px; font-weight: bold; color: #b02527;">${totalCount}</div>
            <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Total Students</div>
          </div>
          <div>
            <div style="font-size: 32px; font-weight: bold; color: #10b981;">${attendedCount}</div>
            <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Present</div>
          </div>
          <div>
            <div style="font-size: 32px; font-weight: bold; color: #b02527;">${attendanceRate}%</div>
            <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Attendance</div>
          </div>
        </div>
      </div>

      <!-- Student Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">
              Student
            </th>
            <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">
              Workshop
            </th>
            <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>

      <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px;">
        If you have any questions about this report, please contact Stage the Change.
      </p>

      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Thank you for your participation!
      </p>
    </div>

    <!-- Footer -->
    <div style="margin-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">
        This is an automated email from Stage the Change. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
