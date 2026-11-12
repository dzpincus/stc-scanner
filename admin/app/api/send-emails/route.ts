/**
 * Email Sending API Route
 * Sends attendance reports to supervisors
 * Supports multiple email providers: Gmail, SendGrid, AWS SES, Generic SMTP
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server';
import nodemailer from 'nodemailer';
import { getActiveEvent } from '@/lib/event';
import { expectedStudents } from '@/lib/stats';

const ADMIN_DOMAIN = '@stagethechange.org';

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface EmailRecipient {
  supervisor_email: string;
  supervisor_name: string | null;
  students: Array<{
    student_name: string;
    registration_id: string;
    workshop_name: string | null;
    attended: boolean;
    wrong_workshop_name?: string | null;
  }>;
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

    const body = await request.json();
    const timeSlot = body?.timeSlot;
    const resend = body?.resend === true;

    if (!timeSlot || (timeSlot !== 1 && timeSlot !== 2)) {
      return NextResponse.json(
        { error: 'Invalid time slot' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const event = await getActiveEvent(supabase);
    if (!event) {
      return NextResponse.json({ error: 'No active event configured' }, { status: 500 });
    }
    // Test dataset: [TEST] subject, BCC only the admin who clicked Send, and never deliver
    // outside the org even if real supervisor addresses were imported into the test event.
    const isTest = event.is_test === true;

    // Load all data for the active event
    const [{ data: students }, { data: workshops }, { data: attendance }] =
      await Promise.all([
        supabase.from('students').select('*').eq('event_id', event.id),
        supabase.from('workshops').select('*').eq('event_id', event.id),
        supabase.from('attendance').select('*').eq('event_id', event.id),
      ]);

    if (!students || !workshops || !attendance) {
      return NextResponse.json(
        { error: 'Failed to load data' },
        { status: 500 }
      );
    }

    // Group students by supervisor email
    const supervisorMap = new Map<string, EmailRecipient>();

    // Students reported not attending (and never scanned) are left out of the report.
    expectedStudents(students, attendance).forEach((student) => {
      const email = student.supervisor_email;
      if (!email) return;

      const workshopId =
        timeSlot === 1 ? student.workshop_slot1_id : student.workshop_slot2_id;
      if (!workshopId) return;

      const workshop = workshops.find((w) => w.id === workshopId);

      // Check if student attended their registered workshop
      const registeredAttendance = attendance.find(
        (a) =>
          a.student_id === student.id &&
          a.workshop_id === workshopId
      );

      // Wrong-workshop scan in the selected slot (same rule as the Emails page preview).
      // Filter by slot here: a student can have a wrong scan in each slot.
      const wrongWorkshop = workshops.find(
        (w) =>
          w.time_slot === timeSlot &&
          attendance.some((a) => a.student_id === student.id && a.workshop_id === w.id && !a.is_correct_workshop)
      );
      const wrongWorkshopName = wrongWorkshop?.workshop_name ?? null;

      // Present if scanned at the registered workshop or at any workshop in this slot.
      const attended = !!registeredAttendance || !!wrongWorkshop;

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
        wrong_workshop_name: wrongWorkshopName,
      });
    });

    // Sort students alphabetically by name within each supervisor
    for (const supervisor of supervisorMap.values()) {
      supervisor.students.sort((a, b) =>
        a.student_name.localeCompare(b.student_name)
      );
    }

    // Supervisors already emailed for this slot are skipped unless the admin asked to resend.
    const { data: sentLogs } = await supabase
      .from('email_log')
      .select('supervisor_email')
      .eq('event_id', event.id)
      .eq('time_slot', timeSlot)
      .eq('email_status', 'sent');
    const alreadySent = new Set((sentLogs || []).map((l) => l.supervisor_email));

    // Configure email transporter
    // Supports both Gmail API (Google Workspace) and SMTP
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp'; // 'gmail-api' or 'smtp'

    let transporter;

    if (emailProvider === 'gmail-api') {
      // Google Workspace Gmail API with Service Account
      const { google } = await import('googleapis');

      let credentials;
      try {
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
          throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
        }
        credentials = JSON.parse(serviceAccountKey);
      } catch (parseError) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', parseError);
        throw new Error(
          `Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }

      // Get the user to impersonate (required for domain-wide delegation)
      const impersonateEmail = process.env.EMAIL_FROM_ADDRESS;

      if (!impersonateEmail) {
        throw new Error('EMAIL_FROM_ADDRESS must be set when using gmail-api provider');
      }

      // Create JWT client with subject for domain-wide delegation
      const jwtClient = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/gmail.send'],
        impersonateEmail // The user to impersonate
      );

      // Authorize the client
      await jwtClient.authorize();

      // Get Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: jwtClient });

      // Create custom transporter that uses Gmail API
      transporter = {
        sendMail: async (mailOptions: any) => {
          const message = [
            `From: ${mailOptions.from}`,
            `To: ${mailOptions.to}`,
            mailOptions.bcc ? `Bcc: ${mailOptions.bcc}` : '',
            `Subject: ${mailOptions.subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            mailOptions.html,
          ].filter(Boolean).join('\r\n');

          const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encodedMessage,
            },
          });
        },
      };
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
    let skipped = 0;

    for (const [email, data] of supervisorMap.entries()) {
      if (!resend && alreadySent.has(email)) {
        skipped++;
        continue;
      }
      try {
        // Test event: only org addresses, plus the sending admin's own mailbox name at another
        // provider (same local part, +tags allowed) so outside-domain delivery can be tested.
        const baseLocal = (addr: string) => addr.toLowerCase().split('@')[0].split('+')[0];
        const ownOutside = !!user.email && baseLocal(email) === baseLocal(user.email);
        if (isTest && !email.toLowerCase().endsWith(ADMIN_DOMAIN) && !ownOutside) {
          throw new Error(`Test event: refused to email ${email} (outside ${ADMIN_DOMAIN})`);
        }

        const html = generateEmailHTML(data, timeSlot);

        const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || process.env.GMAIL_USER;
        const fromName = process.env.EMAIL_FROM_NAME || 'Stage the Change';
        const bccAddress = isTest ? user.email : process.env.EMAIL_BCC_ADDRESS || 'registration@stagethechange.org';

        await transporter.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: email,
          bcc: bccAddress,
          subject: `${isTest ? '[TEST] ' : ''}Workshop Attendance Report - Time Slot ${timeSlot}`,
          html,
        });

        // Log success
        await supabase.from('email_log').insert({
          event_id: event.id,
          supervisor_email: email,
          time_slot: timeSlot,
          sent_at: new Date().toISOString(),
          student_count: data.students.length,
          email_status: 'sent',
        });

        sent++;
      } catch (error) {
        console.error('Email send failed:', error instanceof Error ? error.message : error);

        // Log failure
        await supabase.from('email_log').insert({
          event_id: event.id,
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

    console.log(`[Emails] event=${event.slug} test=${isTest} slot=${timeSlot} sent=${sent} failed=${failed} skipped=${skipped} resend=${resend}`);

    return NextResponse.json({
      success: true,
      sent,
      failed,
      skipped,
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
        <strong>${escapeHtml(student.student_name)}</strong><br/>
        <span style="color: #6b7280; font-size: 14px;">${escapeHtml(student.registration_id)}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${escapeHtml(student.workshop_name || 'Not assigned')}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${
          student.attended
            ? `<span style="color: #10b981; font-weight: 600;">✓ Present</span>${student.wrong_workshop_name ? `<br/><span style="color: #ea580c; font-weight: 600; font-size: 13px;">⚠️ (Wrong: ${escapeHtml(student.wrong_workshop_name)})</span>` : ''}`
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
        Hello ${escapeHtml(data.supervisor_name || 'Supervisor')},
      </p>

      <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
        Here is the attendance report for your students in <strong>Time Slot ${timeSlot}</strong>:
      </p>

      <!-- Stats -->
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 33.33%; text-align: center; padding: 10px;">
              <div style="font-size: 32px; font-weight: bold; color: #b02527;">${totalCount}</div>
              <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Total Students</div>
            </td>
            <td style="width: 33.33%; text-align: center; padding: 10px;">
              <div style="font-size: 32px; font-weight: bold; color: #10b981;">${attendedCount}</div>
              <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Present</div>
            </td>
            <td style="width: 33.33%; text-align: center; padding: 10px;">
              <div style="font-size: 32px; font-weight: bold; color: #b02527;">${attendanceRate}%</div>
              <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">Attendance</div>
            </td>
          </tr>
        </table>
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
