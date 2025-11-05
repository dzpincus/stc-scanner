# Google Sheets API Setup Guide

Complete walkthrough for setting up Google Sheets integration with the Stage the Change admin dashboard.

## Step 1: Select Google Cloud Project

You have two options:

### Option A: Use Existing Organization Project (Recommended)

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your organization's Google account

2. **Select Your Existing Project**
   - Click the project dropdown at the top
   - Find and select your organization's existing project
   - This keeps everything under your organization's billing and management

### Option B: Create New Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a New Project**
   - Click the project dropdown at the top
   - Click "New Project"
   - Enter project name: `stage-the-change-scanner`
   - (Optional) Select your organization if available
   - Click "Create"
   - Wait for project creation (takes ~30 seconds)
   - Select your new project from the dropdown

## Step 2: Enable Google Sheets API

1. **Navigate to APIs & Services**
   - In the left sidebar, click "APIs & Services" > "Library"
   - Or visit: https://console.cloud.google.com/apis/library

2. **Enable Google Sheets API**
   - Search for "Google Sheets API"
   - Click on "Google Sheets API"
   - Click "Enable"
   - Wait for activation

## Step 3: Create Service Account

1. **Go to Credentials**
   - Click "APIs & Services" > "Credentials"
   - Or visit: https://console.cloud.google.com/apis/credentials

2. **Create Service Account**
   - Click "+ CREATE CREDENTIALS" at the top
   - Select "Service Account"

3. **Service Account Details**
   - Service account name: `stage-the-change-importer`
   - Service account ID: (auto-generated)
   - Description: `Service account for importing student data from Google Sheets`
   - Click "CREATE AND CONTINUE"

4. **Grant Access (Optional)**
   - Skip this step by clicking "CONTINUE"

5. **Grant Users Access (Optional)**
   - Skip this step by clicking "DONE"

## Step 4: Create Service Account Key

1. **Find Your Service Account**
   - You should see your service account listed
   - Click on the service account email (looks like: `stage-the-change-importer@...iam.gserviceaccount.com`)

2. **Create Key**
   - Click the "KEYS" tab
   - Click "ADD KEY" > "Create new key"
   - Select "JSON" format
   - Click "CREATE"
   - A JSON file will download automatically

3. **Important: Save This File**
   - The downloaded file contains your credentials
   - Keep it secure - don't commit to git
   - You'll need it for the next step

## Step 5: Add Credentials to Environment Variables

1. **Open the Downloaded JSON File**
   - It should look something like this:
   ```json
   {
     "type": "service_account",
     "project_id": "stage-the-change-scanner",
     "private_key_id": "abc123...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...",
     "client_email": "stage-the-change-importer@...iam.gserviceaccount.com",
     "client_id": "123456789...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/..."
   }
   ```

2. **Copy Entire JSON Content**
   - Select all content in the JSON file
   - Copy to clipboard

3. **Add to .env.local**
   - Open `admin/.env.local`
   - Add this line (paste your JSON on one line):
   ```env
   GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"stage-the-change-scanner",...}
   ```
   - **Important**: The entire JSON must be on one line, no line breaks

4. **Alternative: Use File Path**
   - Save the JSON file as `google-credentials.json` in the admin directory
   - Add to `.gitignore`:
   ```
   google-credentials.json
   ```
   - Modify the import code to read from file instead

## Step 6: Copy Service Account Email

From the JSON file, copy the `client_email` value. You'll need this to share your Google Sheet.

Example: `stage-the-change-importer@stage-the-change-scanner.iam.gserviceaccount.com`

## Step 7: Prepare Your Google Sheet

1. **Create a New Google Sheet**
   - Go to: https://sheets.google.com
   - Click "Blank" to create new sheet
   - Name it: `Stage the Change - Student Registration`

2. **Share with Service Account**
   - Click the "Share" button (top right)
   - Paste the service account email from Step 6
   - Give "Viewer" permissions (read-only is enough)
   - Uncheck "Notify people"
   - Click "Share"

3. **Format Your Sheet**
   - See next section for data format

---

# Part 2: Data Format

## Required Columns

Your Google Sheet **must** have these columns in the first row (header row):

| Column Name | Required | Description | Example |
|-------------|----------|-------------|---------|
| `registration_id` | ✅ Yes | Unique student ID | ST001 |
| `student_name` | ✅ Yes | Full student name | John Doe |
| `supervisor_email` | ✅ Yes | Supervisor's email | jane.smith@school.com |

## Optional Columns

| Column Name | Required | Description | Example |
|-------------|----------|-------------|---------|
| `supervisor_name` | No | Supervisor's name | Jane Smith |
| `workshop_slot1_name` | No | First workshop name | Intro to Theater |
| `workshop_slot2_name` | No | Second workshop name | Advanced Acting |
| `time_slot` | No | Workshop time slot | 1 or 2 |
| `room_location` | No | Room location | Room 101 |
| `notes` | No | Additional notes | Needs assistance |

## Example Google Sheet

```
registration_id | student_name    | supervisor_name | supervisor_email         | workshop_slot1_name | workshop_slot2_name | time_slot | room_location
----------------|-----------------|-----------------|--------------------------|---------------------|---------------------|-----------|---------------
ST001           | John Doe        | Jane Smith      | jane.smith@school.com    | Intro to Theater    | Advanced Acting     | 1         | Room 101
ST002           | Mary Johnson    | Bob Wilson      | bob.wilson@school.com    | Stage Design        | Costume Design      | 1         | Room 102
ST003           | Alex Chen       | Sarah Davis     | sarah.davis@school.com   | Lighting Tech       | Sound Engineering   | 2         | Room 201
ST004           | Emma Williams   | Jane Smith      | jane.smith@school.com    | Intro to Theater    | Stage Design        | 1         | Room 101
ST005           | Michael Brown   | Bob Wilson      | bob.wilson@school.com    | Advanced Acting     | Directing           | 2         | Room 103
```

## Data Entry Tips

1. **Registration IDs**
   - Must be unique for each student
   - Use a consistent format (e.g., ST001, ST002, ST003)
   - No duplicates allowed

2. **Student Names**
   - Full names preferred
   - Will appear on attendance reports

3. **Supervisor Email**
   - Must be valid email addresses
   - Students with same email will be grouped together
   - This email receives attendance reports

4. **Workshop Names**
   - Will be matched to create/find workshops
   - Must match exactly for same workshop
   - Case-sensitive

5. **Time Slots**
   - Use `1` or `2` only
   - Indicates when the workshop occurs
   - Slot 1 and Slot 2 happen at different times

---

# Part 3: Import Process

## Option A: Import from Google Sheets

1. **Open the Sheet**
   - Open your Google Sheet in browser

2. **Copy the URL**
   - Copy the entire URL from browser
   - Should look like: `https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit`

3. **Import in Dashboard**
   - Go to admin dashboard: http://localhost:3000/import
   - Paste URL in "Google Sheet URL" field
   - Click "Import from Google Sheets"
   - Wait for success message

## Option B: Export and Upload CSV

1. **Export from Google Sheets**
   - In your Google Sheet: File > Download > Comma-separated values (.csv)
   - Save the file

2. **Upload in Dashboard**
   - Go to admin dashboard: http://localhost:3000/import
   - Click "Choose File" under CSV Upload
   - Select your downloaded CSV
   - Click "Import CSV"

---

# Troubleshooting

## "Failed to import from Google Sheets"

**Possible causes:**

1. **Service Account not shared**
   - Make sure you shared the sheet with service account email
   - Check the "Share" settings in Google Sheets

2. **Invalid JSON in environment variable**
   - Ensure entire JSON is on one line
   - No line breaks or extra spaces
   - Properly escaped quotes

3. **API not enabled**
   - Verify Google Sheets API is enabled in Cloud Console
   - May need to wait a few minutes after enabling

4. **Invalid spreadsheet URL**
   - URL must be from Google Sheets
   - Must include the spreadsheet ID
   - Sheet must be accessible

## "No valid rows found in sheet"

**Possible causes:**

1. **Missing required columns**
   - Check that header row has: `registration_id`, `student_name`, `supervisor_email`
   - Column names must match exactly (case-sensitive, with underscores)

2. **Empty sheet**
   - Must have at least one data row (plus header)

3. **Header row not first**
   - Headers must be in row 1

## Testing Your Setup

1. **Create a test sheet** with 2-3 sample students
2. **Share with service account**
3. **Try importing** using the dashboard
4. **Check database** to verify data imported correctly
5. **View on dashboard** home page

---

# Sample Data Template

Want to test quickly? Copy this into a new Google Sheet:

```
registration_id,student_name,supervisor_name,supervisor_email,workshop_slot1_name,workshop_slot2_name,time_slot,room_location
ST001,Alice Anderson,Ms. Johnson,mjohnson@school.com,Introduction to Theater,Advanced Acting,1,Theater Room A
ST002,Bob Baker,Mr. Smith,rsmith@school.com,Stage Design,Costume Design,1,Art Studio
ST003,Carol Chen,Ms. Johnson,mjohnson@school.com,Introduction to Theater,Stage Design,1,Theater Room A
ST004,David Davis,Ms. Williams,kwilliams@school.com,Lighting Technology,Sound Engineering,2,Tech Lab
ST005,Emma Evans,Mr. Smith,rsmith@school.com,Advanced Acting,Directing Fundamentals,2,Theater Room B
ST006,Frank Foster,Ms. Williams,kwilliams@school.com,Sound Engineering,Lighting Technology,2,Tech Lab
ST007,Grace Green,Ms. Johnson,mjohnson@school.com,Costume Design,Makeup Artistry,1,Art Studio
ST008,Henry Hill,Mr. Smith,rsmith@school.com,Directing Fundamentals,Script Writing,2,Classroom 101
```

Paste this into row 1, column A of a new Google Sheet, and it will automatically format into columns.

---

# Security Best Practices

1. **Never commit credentials to git**
   - Add `.env.local` to `.gitignore`
   - Add `google-credentials.json` to `.gitignore`

2. **Limit service account permissions**
   - Only give "Viewer" access to sheets
   - Don't make sheets publicly editable

3. **Rotate keys if compromised**
   - Can delete and create new keys in Cloud Console
   - Update environment variables

4. **Use separate projects for dev/prod**
   - Create different service accounts for each environment

---

Need help? Check the main README.md or review the Supabase logs for detailed error messages.
