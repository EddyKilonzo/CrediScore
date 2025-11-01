# Quick OCR Setup Guide

## Option 1: OCR.space (Easiest - Recommended for now)

1. **Get OCR.space API Key (Free):**
   - Go to: https://ocr.space/ocrapi
   - Sign up for a free account
   - Copy your API key from the dashboard
   - Free tier: 25,000 requests per month

2. **Add to your `.env` file:**
   ```bash
   OCR_API_KEY="your-ocr-space-api-key-here"
   OCR_API_URL="https://api.ocr.space/parse/image"
   ```

3. **Restart your backend server:**
   ```bash
   npm run start:dev
   ```

4. **Verify it works:**
   - The status indicator should change from "Unavailable" to "Ready" or "Limited"
   - You can also test at: `GET http://localhost:3000/api/business/health/ocr`

## Option 2: Google Vision (Requires Service Account)

Google Vision needs service account credentials, not just an API key.

1. **Get Google Cloud Credentials:**
   - Go to: https://console.cloud.google.com/
   - Create/select a project
   - Enable Vision API
   - Create a service account
   - Download the JSON key file
   - Save it in your `backend/` folder (e.g., `google-vision-key.json`)

2. **Add to your `.env` file:**
   ```bash
   GOOGLE_CLOUD_PROJECT_ID="your-project-id"
   GOOGLE_APPLICATION_CREDENTIALS="C:/Users/Admin/Documents/Projects/CrediScore/backend/google-vision-key.json"
   ```

3. **Restart backend server**

## Current Status

✅ **Already Configured:**
- OpenAI API Key (for AI analysis)
- Google Vision API Key (but wrong format - needs service account JSON)

❌ **Missing:**
- OCR_API_KEY (for OCR.space - easiest to set up)
- OR Google Cloud service account credentials

## Recommended Next Step

**Use OCR.space** - it's the fastest to set up:
1. Sign up at https://ocr.space/ocrapi
2. Get your free API key
3. Add `OCR_API_KEY="your-key"` to `.env`
4. Restart server

Once configured, the status indicator will automatically update!

