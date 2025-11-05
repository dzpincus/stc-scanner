# Google Workspace Email Setup with Service Account

Professional email setup for sending attendance reports using Google Workspace and Gmail API with domain-wide delegation.

## Why Google Workspace?

✅ **Organization-controlled** - No dependency on individual accounts
✅ **Configurable sender** - Use any email like `noreply@stagethechange.org`
✅ **Centralized management** - One service account for all email
✅ **Professional appearance** - Custom domain email address
✅ **Higher limits** - 2,000 emails/day vs 500 for personal Gmail
✅ **Audit trail** - All emails tracked in organization

---

## Prerequisites

- ✅ Google Workspace account (formerly G Suite)
- ✅ Super Admin access to Google Workspace
- ✅ Access to Google Cloud Console
- ✅ Domain verified in Google Workspace

**Time required:** 15-20 minutes

---

## Part 1: Google Cloud Setup

### Step 1: Select Your Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google Workspace admin account

2. **Select your existing organization project**
   - Click the project dropdown at the top
   - Find and select your organization's project
   - This keeps everything centralized

### Step 2: Enable Gmail API

1. **Navigate to APIs & Services**
   - In the left sidebar: "APIs & Services" > "Library"
   - Or visit: https://console.cloud.google.com/apis/library

2. **Enable Gmail API**
   - Search for "Gmail API"
   - Click on "Gmail API"
   - Click "Enable"
   - Wait for activation (~30 seconds)

### Step 3: Create Service Account

1. **Go to Credentials**
   - Click "APIs & Services" > "Credentials"
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Create Service Account**
   - Click "+ CREATE CREDENTIALS" at the top
   - Select "Service Account"

3. **Service Account Details**
   - **Service account name:** `stage-the-change-email`
   - **Service account ID:** (auto-generated)
   - **Description:** `Service account for sending attendance report emails via Gmail API`
   - Click "CREATE AND CONTINUE"

4. **Grant Access (Skip)**
   - Click "CONTINUE"

5. **Grant Users Access (Skip)**
   - Click "DONE"

### Step 4: Enable Domain-Wide Delegation

This is the key step that allows the service account to send emails on behalf of users.

1. **Find Your Service Account**
   - You should see your service account listed
   - Click on the service account email
   - It looks like: `stage-the-change-email@your-project.iam.gserviceaccount.com`

2. **Enable Domain-Wide Delegation**
   - Click the "DETAILS" tab (if not already there)
   - Scroll down to "Domain-wide delegation"
   - Click "SHOW DOMAIN-WIDE DELEGATION"
   - Check the box: "Enable Google Workspace Domain-wide Delegation"
   - Click "SAVE"

3. **Note the Client ID**
   - You'll see a "Client ID" (numeric, like `123456789012345678901`)
   - **Copy this** - you'll need it in the next part

### Step 5: Generate JSON Key

1. **Go to KEYS tab**
   - Click the "KEYS" tab at the top
   - Click "ADD KEY" > "Create new key"

2. **Select JSON format**
   - Choose "JSON"
   - Click "CREATE"

3. **Save the JSON file**
   - A JSON file will download automatically
   - **Keep it secure!** This is your credential file
   - Name it something like `stage-the-change-service-account.json`

---

## Part 2: Google Workspace Admin Console Setup

Now you need to authorize the service account to send emails on behalf of users.

### Step 6: Add API Scopes in Admin Console

1. **Go to Google Workspace Admin Console**
   - Visit: https://admin.google.com/
   - Sign in with your Super Admin account

2. **Navigate to Security Settings**
   - In the left sidebar: "Security"
   - Click "Access and data control"
   - Click "API controls"

3. **Manage Domain-Wide Delegation**
   - Scroll down to "Domain-wide delegation"
   - Click "MANAGE DOMAIN WIDE DELEGATION"

4. **Add New API Client**
   - Click "Add new"
   - You'll see a form with two fields

5. **Enter Client ID**
   - **Client ID:** Paste the numeric Client ID from Step 4.3
   - **OAuth Scopes:** Enter exactly this (one line, comma-separated):
   ```
   https://www.googleapis.com/auth/gmail.send
   ```

6. **Authorize**
   - Click "Authorize"
   - You should see the client ID appear in the list

**Important:** This tells Google Workspace that this service account is allowed to send emails.

---

## Part 3: Configure Your Application

### Step 7: Add Environment Variables

1. **Open the downloaded JSON file**
   - Find the JSON file from Step 5
   - Open it in a text editor

2. **Copy the entire JSON content**
   - Select all and copy

3. **Edit .env.local**
   ```bash
   cd /home/dylanpincus/code/stc-scanner/admin
   nano .env.local
   ```

4. **Add configuration**
   ```env
   # Email Provider
   EMAIL_PROVIDER=gmail-api

   # Sender Configuration
   EMAIL_FROM_ADDRESS=registration@stagethechange.org
   EMAIL_FROM_NAME=Stage the Change Workshops

   # BCC Configuration (all emails will BCC this address)
   EMAIL_BCC_ADDRESS=registration@stagethechange.org

   # Google Service Account (paste your JSON on ONE line)
   GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
   ```

5. **Important notes:**
   - The entire JSON must be on ONE line
   - `registration@stagethechange.org` must exist in your Google Workspace
   - This address will be used as both FROM and BCC
   - All supervisors will receive emails FROM this address
   - You'll also receive BCC copies for record-keeping

---

## Part 4: Create the Sender Email Address

The service account will send emails "as" this address.

### Option A: Create a User Account (Recommended)

1. **In Google Workspace Admin Console**
   - Go to: https://admin.google.com/
   - Click "Users"

2. **Add New User**
   - Click "Add new user"
   - **First name:** Stage the Change
   - **Last name:** Registration
   - **Primary email:** `registration@stagethechange.org`
   - Set a password (you'll need to check BCC copies)
   - Click "ADD NEW USER"

3. **Configure the account**
   - Assign a license (needed to receive BCC copies)
   - This account will send AND receive all attendance emails

### Option B: Use an Email Alias

1. **Create an alias for an existing user**
   - Go to an existing user
   - Click "User information" > "Email aliases"
   - Add alias: `noreply@stagethechange.org`

### Option C: Use a Google Group

1. **Create a group**
   - In Admin Console: "Groups"
   - Create group: `noreply@stagethechange.org`
   - Add your admin as a member

**Note:** The email address in `EMAIL_FROM_ADDRESS` must exist in your Google Workspace domain.

---

## Part 5: Test the Setup

### Step 8: Test Email Sending

1. **Start your development server**
   ```bash
   cd /home/dylanpincus/code/stc-scanner/admin
   npm run dev
   ```

2. **Import sample data** (if not already done)
   - Go to http://localhost:3000/import
   - Upload `sample-data.csv`

3. **Temporarily update a student email to yours**
   - Go to Supabase Dashboard
   - Table Editor > students
   - Edit one student's `supervisor_email` to your email
   - This way you receive the test email

4. **Send test email**
   - Go to http://localhost:3000/emails
   - Select "Time Slot 1"
   - Click "Send Emails"

5. **Check results**
   - Should see "Sent X emails successfully"
   - Check your inbox
   - Email should show from: `Stage the Change Workshops <registration@stagethechange.org>`
   - Check `registration@stagethechange.org` inbox - should also receive BCC copy

---

## Troubleshooting

### "Failed to send emails"

**Check the browser console and terminal output for detailed errors.**

### "Error: invalid_grant"

**Cause:** Service account not authorized in Admin Console

**Fix:**
1. Verify Client ID in Admin Console matches the one in JSON
2. Verify OAuth scope is exactly: `https://www.googleapis.com/auth/gmail.send`
3. Wait 5-10 minutes for propagation
4. Try again

### "Error: Requested entity was not found"

**Cause:** Email address doesn't exist in Google Workspace

**Fix:**
1. Verify `EMAIL_FROM_ADDRESS` exists as a user, alias, or group
2. Double-check spelling matches exactly
3. Ensure domain is correct

### "Error: Delegation denied"

**Cause:** Domain-wide delegation not enabled

**Fix:**
1. Go back to Step 4 in Google Cloud Console
2. Ensure "Enable Google Workspace Domain-wide Delegation" is checked
3. Save and wait a few minutes

### "Error: insufficient permissions"

**Cause:** Missing Gmail API scope in Admin Console

**Fix:**
1. Go to Admin Console > Security > API controls
2. Check Domain-wide delegation list
3. Verify scope includes `https://www.googleapis.com/auth/gmail.send`
4. Re-authorize if needed

### Emails not sending but no error

**Check:**
1. Verify Gmail API is enabled in Cloud Console
2. Check Supabase email_log table for error messages
3. Check browser console for JavaScript errors
4. Restart dev server: `npm run dev`

---

## Security Best Practices

### 1. Protect the JSON Key File

```bash
# Add to .gitignore
echo "stage-the-change-service-account.json" >> .gitignore

# Set restrictive permissions
chmod 600 stage-the-change-service-account.json
```

### 2. Limit Service Account Permissions

Only grant the exact scope needed:
- ✅ `https://www.googleapis.com/auth/gmail.send` (send only)
- ❌ Don't add `gmail.readonly` or `gmail.modify`

### 3. Regular Audits

- Review service accounts quarterly
- Rotate keys annually
- Remove unused service accounts

### 4. Monitor Usage

- Check email_log table regularly
- Set up alerts for failures
- Monitor Cloud Console usage

---

## Configuration Summary

**Required environment variables:**
```env
EMAIL_PROVIDER=gmail-api
EMAIL_FROM_ADDRESS=noreply@stagethechange.org
EMAIL_FROM_NAME=Stage the Change Workshops
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**Google Cloud Setup:**
- ✅ Gmail API enabled
- ✅ Service account created
- ✅ Domain-wide delegation enabled
- ✅ JSON key downloaded

**Google Workspace Setup:**
- ✅ API client authorized with scope
- ✅ Sender email address created
- ✅ Super Admin configured delegation

---

## Comparing Options

### Gmail API (This Guide) ✅
- ✅ Organization-controlled
- ✅ Professional sender address
- ✅ No individual account dependency
- ✅ Centralized management
- ✅ Higher sending limits
- ⚠️ Requires Google Workspace (paid)
- ⚠️ More complex setup

### SMTP with App Password
- ✅ Simple setup
- ✅ Works with free Gmail
- ✅ No Google Cloud required
- ❌ Tied to individual account
- ❌ Personal email as sender
- ❌ Lower sending limits
- ❌ Less professional

**Recommendation:** Use Gmail API for production, SMTP for testing.

---

## Testing vs Production

### Development (.env.local)
```env
EMAIL_PROVIDER=gmail-api
EMAIL_FROM_ADDRESS=noreply@stagethechange.org
GOOGLE_SERVICE_ACCOUNT_KEY={...}
```

### Production (Vercel Environment Variables)
Same variables, but set in Vercel dashboard:
- Navigate to your project
- Settings > Environment Variables
- Add each variable
- Deploy

---

## Email Limits

**Google Workspace sending limits:**
- Business Starter/Standard: 2,000 emails/day
- Business Plus/Enterprise: 10,000 emails/day

**For your use case:**
- 200-300 students
- ~50 supervisors
- Well within limits ✅

---

## Next Steps

1. ✅ Complete this setup
2. ✅ Test with sample data
3. ✅ Verify emails are received
4. ✅ Check email formatting
5. ✅ Import real student data
6. ✅ Send real attendance reports

---

## Support

**Documentation:**
- Google Workspace Admin Help: https://support.google.com/a
- Gmail API Documentation: https://developers.google.com/gmail/api
- Domain-wide Delegation: https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority

**Common Issues:**
- Check Cloud Console > IAM & Admin > Service Accounts
- Check Admin Console > Security > API controls
- Review application logs in terminal
- Check Supabase email_log table

---

## Complete Example

**.env.local**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Email (Google Workspace)
EMAIL_PROVIDER=gmail-api
EMAIL_FROM_ADDRESS=noreply@stagethechange.org
EMAIL_FROM_NAME=Stage the Change Workshops
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"stage-the-change-123456","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n","client_email":"stage-the-change-email@stage-the-change-123456.iam.gserviceaccount.com","client_id":"123456789012345678901","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/stage-the-change-email%40stage-the-change-123456.iam.gserviceaccount.com"}
```

Ready to send professional emails from your organization! 📧
