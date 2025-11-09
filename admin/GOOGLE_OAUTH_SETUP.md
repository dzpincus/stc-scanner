# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth authentication for the Stage the Change admin dashboard.

## Overview

The admin dashboard now requires authentication with a @stagethechange.org Google account. This provides basic security to prevent unauthorized access to student data.

## Setup Steps

### 1. Google Cloud Console - Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: `attendance-scanner-476020` (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - User Type: **Internal** (if using Google Workspace) or **External**
   - App name: `Stage the Change Admin`
   - User support email: Your email
   - Authorized domains: Add your domain
   - Developer contact: Your email
6. For Application type, select **Web application**
7. Add name: `Stage the Change Admin Dashboard`
8. Add **Authorized redirect URIs**:
   ```
   https://mujydfkvozzoltpmjnay.supabase.co/auth/v1/callback
   ```
   (For local testing, also add: `http://localhost:54321/auth/v1/callback`)
9. Click **CREATE**
10. **Save the Client ID and Client Secret** - you'll need these for Supabase

### 2. Supabase Dashboard - Enable Google OAuth

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to expand
5. Toggle **Enable Sign in with Google** to ON
6. Paste your **Google Client ID** from step 1
7. Paste your **Google Client Secret** from step 1
8. In the **Authorized Client IDs** field (if present), add your Client ID again
9. **Restrict to specific domain** (optional but recommended):
   - In the **Restrict email addresses** field, enter: `stagethechange.org`
   - This will only allow @stagethechange.org accounts
10. Click **Save**

### 3. Test the Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`

3. You should be redirected to `/login`

4. Click **Sign in with Google**

5. Sign in with a @stagethechange.org account

6. After successful authentication, you'll be redirected to the dashboard

### 4. Deploy to Production

When deploying to production:

1. Update the **Authorized redirect URIs** in Google Cloud Console to include your production URL:
   ```
   https://your-production-domain.com/auth/callback
   ```

2. Ensure your production environment has the correct Supabase environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://mujydfkvozzoltpmjnay.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## How It Works

### Authentication Flow

1. User visits any protected route (/, /workshops, etc.)
2. Middleware checks for valid session
3. If no session, user is redirected to `/login`
4. User clicks "Sign in with Google"
5. User is redirected to Google OAuth consent screen
6. After consent, Google redirects to Supabase callback URL
7. Supabase creates session and redirects to `/auth/callback`
8. App validates email domain (@stagethechange.org)
9. If valid, user is redirected to original destination
10. If invalid domain, user is signed out and shown error

### Protected Routes

The following routes require authentication:
- `/` (Dashboard)
- `/workshops/*`
- `/students/*`
- `/emails/*`
- `/import/*`
- `/api/send-emails`
- `/api/import-csv`

### Public Routes

These routes are accessible without authentication:
- `/login` - Login page
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/auth/callback` - OAuth callback handler

### Domain Restriction

Only users with @stagethechange.org email addresses can access the dashboard. This is enforced in two places:

1. **Google OAuth** (`hd` parameter): Restricts which accounts can be selected
2. **Middleware & Auth Helper**: Validates email domain after authentication

If a user tries to sign in with a non-@stagethechange.org account, they will be signed out and shown an error message.

## Troubleshooting

### "Unauthorized" Error

**Problem**: User is signed in with Google but gets redirected to login with "unauthorized" error.

**Solution**: The email domain is not @stagethechange.org. Only @stagethechange.org accounts are allowed.

### Redirect URI Mismatch

**Problem**: Error saying "redirect_uri_mismatch"

**Solution**: Make sure the redirect URI in Google Cloud Console exactly matches:
```
https://mujydfkvozzoltpmjnay.supabase.co/auth/v1/callback
```

### Session Not Persisting

**Problem**: User is logged out on page refresh

**Solution**: Check that cookies are being set correctly. This is handled automatically by Supabase auth, but make sure you're not blocking cookies in your browser.

### Cannot Access API Routes

**Problem**: API routes return 401 Unauthorized

**Solution**: API routes now require authentication. Make sure you're signed in and have a valid session cookie.

## Security Notes

1. **Service Account Email** is separate from OAuth and still works for sending emails
2. **No password storage**: All authentication is handled by Google
3. **Session duration**: Sessions last 7 days by default
4. **Automatic logout**: Users with invalid email domains are automatically signed out
5. **Middleware protection**: All routes except public ones are protected by middleware

## Existing Email Service

Your existing Gmail API service account for sending emails is **completely separate** and **unchanged**:
- Service Account: `attendance-scanner-app@attendance-scanner-476020.iam.gserviceaccount.com`
- Purpose: Sending attendance reports
- Still works exactly as before

## Questions?

If you run into issues:
1. Check the browser console for errors
2. Check Supabase logs in the Dashboard
3. Verify Google Cloud Console credentials are correct
4. Ensure email domain is @stagethechange.org
