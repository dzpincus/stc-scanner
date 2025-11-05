# Gmail Email Sending Setup

Simple guide to set up Gmail SMTP for sending attendance report emails.

## Overview

The admin dashboard sends attendance reports to supervisors via email using Gmail's SMTP server. This requires:
- A Gmail account (can be personal or Google Workspace)
- 2-Factor Authentication enabled
- An App Password (NOT your regular Gmail password)

**Time required:** 5 minutes

---

## Prerequisites

- Gmail account (the "from" address for emails)
- Admin access to that Gmail account

---

## Step 1: Enable 2-Factor Authentication

Gmail requires 2FA to be enabled before you can create App Passwords.

### If you already have 2FA enabled:
Skip to Step 2.

### If you don't have 2FA:

1. **Go to Google Account Security**
   - Visit: https://myaccount.google.com/security
   - Sign in with your Gmail account

2. **Find 2-Step Verification**
   - Scroll down to "How you sign in to Google"
   - Click "2-Step Verification"

3. **Set up 2-Step Verification**
   - Click "Get Started"
   - Follow the prompts to add your phone number
   - Choose verification method (text message or phone call)
   - Complete the setup

---

## Step 2: Create App Password

App Passwords are special passwords for apps that don't support 2FA directly.

1. **Go to Google Account Security**
   - Visit: https://myaccount.google.com/security
   - Make sure you're signed in

2. **Find App Passwords**
   - Scroll down to "How you sign in to Google"
   - Click "App passwords"
   - You may need to sign in again

   **Note:** If you don't see "App passwords", make sure:
   - 2FA is enabled (Step 1)
   - You're not using a personal account with Advanced Protection
   - You're using a consumer Gmail account or have permission in Google Workspace

3. **Generate New App Password**
   - Click "Select app" dropdown
   - Choose "Mail"
   - Click "Select device" dropdown
   - Choose "Other (Custom name)"
   - Type: `Stage the Change Dashboard`
   - Click "Generate"

4. **Copy the App Password**
   - You'll see a 16-character password like: `abcd efgh ijkl mnop`
   - **Copy this password** - you won't see it again!
   - Remove the spaces: `abcdefghijklmnop`

---

## Step 3: Add Credentials to Environment Variables

1. **Open your environment file**
   ```bash
   cd /home/dylanpincus/code/stc-scanner/admin
   nano .env.local
   ```

2. **Add Gmail credentials**
   ```env
   # Gmail SMTP Configuration
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ```

   **Replace:**
   - `your.email@gmail.com` with your actual Gmail address
   - `abcdefghijklmnop` with your 16-character App Password (no spaces)

3. **Save the file**
   - Press `Ctrl + X`, then `Y`, then `Enter`
   - Or save however you normally edit files

---

## Step 4: Test Email Sending

1. **Make sure you have data imported**
   ```bash
   # Start the dev server if not already running
   cd /home/dylanpincus/code/stc-scanner/admin
   npm run dev
   ```

2. **Go to Email Management**
   - Open http://localhost:3000/emails
   - Select "Time Slot 1" or "Time Slot 2"
   - You should see supervisors listed

3. **Send Test Email**
   - If you want to test without spamming everyone:
     - Temporarily update a student record in Supabase to use YOUR email
     - Then click "Send Emails"
   - Or just click "Send Emails" to send to all supervisors

4. **Check for Success**
   - Should see "Sent X emails successfully"
   - Check the Email History table to confirm
   - Check recipient inbox

---

## Troubleshooting

### "Failed to send emails"

**Check your credentials:**
```bash
# Make sure .env.local has correct values
cat admin/.env.local | grep GMAIL
```

Should show:
```
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your16charpassword
```

**Common issues:**

1. **App Password has spaces**
   - Remove all spaces: `abcd efgh ijkl mnop` → `abcdefghijklmnop`

2. **Using regular Gmail password instead of App Password**
   - Must use the 16-character App Password, not your login password

3. **2FA not enabled**
   - Go back to Step 1 and enable 2FA first

4. **Wrong Gmail address**
   - Must be the same account you created the App Password for

### "Authentication failed" in logs

- Double-check the App Password is correct
- Regenerate a new App Password if needed
- Make sure you're using the Gmail account that created the App Password

### "Less secure apps" error

- This shouldn't happen with App Passwords
- If you see this, make sure you're using an App Password, not your regular password

### Email goes to spam

This is normal for the first few emails. To improve deliverability:

1. **Send from a Google Workspace account** instead of personal Gmail
2. **Add SPF/DKIM records** if using custom domain
3. **Ask recipients to whitelist** your email address
4. **Keep emails professional** - no spam triggers in content

### Rate limiting

Gmail has sending limits:
- **Personal Gmail:** 500 emails/day
- **Google Workspace:** 2,000 emails/day

For events with 200-300 students and ~50 supervisors, you're well within limits.

---

## Google Workspace vs Personal Gmail

### Personal Gmail (Free)
- ✅ Easy to set up
- ✅ No cost
- ✅ Works for small events
- ⚠️ May go to spam more often
- ⚠️ "From" address is personal

### Google Workspace (Paid)
- ✅ Professional "From" address (e.g., noreply@stagethechange.org)
- ✅ Better deliverability
- ✅ Higher sending limits
- ✅ Better for official communications
- ❌ Requires subscription (~$6/user/month)

**Recommendation:** Start with personal Gmail for testing, upgrade to Google Workspace for production if needed.

---

## Alternative: Use Organization's Google Workspace

If your organization already has Google Workspace:

1. **Create a service account** (like `noreply@yourorg.org` or `events@yourorg.org`)
2. **Enable 2FA** on that account
3. **Generate App Password** for that account
4. **Use those credentials** in `.env.local`

Benefits:
- Professional sender address
- Centralized email management
- Better trust/deliverability
- Compliance with org policies

---

## Security Best Practices

1. **Never commit credentials to git**
   - `.env.local` is in `.gitignore`
   - Keep it that way!

2. **Rotate App Passwords periodically**
   - Delete old ones in Google Account settings
   - Generate new ones
   - Update `.env.local`

3. **Use separate App Password for each app**
   - Don't reuse the same password
   - Makes revocation easier

4. **Restrict access to .env.local**
   ```bash
   chmod 600 admin/.env.local
   ```

5. **Use environment variables in production**
   - In Vercel/deployment platform
   - Never hardcode in source code

---

## Email Template Customization

The email template is in `admin/app/api/send-emails/route.ts`

To customize:

1. **Open the file**
   ```bash
   nano admin/app/api/send-emails/route.ts
   ```

2. **Find the `generateEmailHTML()` function** (around line 123)

3. **Edit the HTML**
   - Change colors
   - Modify layout
   - Add your logo
   - Update messaging

4. **Test thoroughly**
   - Send test emails to yourself
   - Check on desktop and mobile
   - Verify all email clients render correctly

---

## Summary

**What you need:**
1. Gmail account
2. 2FA enabled
3. 16-character App Password
4. Two environment variables set

**Total cost:** $0 (unless using Google Workspace)

**Setup time:** 5 minutes

**Maintenance:** Minimal (rotate password occasionally)

---

## Complete .env.local Example

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gmail SMTP Configuration (for sending emails)
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop

# Google Sheets API (optional, for importing data)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

---

## Quick Reference

**Gmail Account Security:** https://myaccount.google.com/security

**App Passwords:** https://myaccount.google.com/apppasswords

**SMTP Settings (already configured in code):**
- Host: `smtp.gmail.com`
- Port: `587`
- Secure: `false` (uses STARTTLS)
- Auth: App Password

**Need help?** Check the browser console and server terminal for detailed error messages.
