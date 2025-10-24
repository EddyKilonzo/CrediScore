# OCR and AI Service Configuration Guide

## Required Environment Variables

To enable OCR and AI document validation, you need to set up the following environment variables:

### 1. OCR Services (Choose one or both)

#### Option A: Google Vision API (Recommended)
```bash
GOOGLE_CLOUD_PROJECT_ID="your-google-cloud-project-id"
GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
```

**How to get Google Vision API credentials:**
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable the Vision API
4. Create a service account
5. Download the service account key JSON file
6. Set GOOGLE_APPLICATION_CREDENTIALS to the path of the JSON file
7. Free tier includes 1,000 requests per month

#### Option B: OCR.space API (Alternative)
```bash
OCR_API_KEY="your-ocr-space-api-key-here"
OCR_API_URL="https://api.ocr.space/parse/image"
```

**How to get OCR API key:**
1. Go to https://ocr.space/ocrapi
2. Sign up for a free account
3. Get your API key from the dashboard
4. Free tier includes 25,000 requests per month

### 2. OpenAI Service
```bash
OPENAI_API_KEY="your-openai-api-key-here"
```

**How to get OpenAI API key:**
1. Go to https://platform.openai.com/
2. Sign up for an account
3. Go to API Keys section
4. Create a new API key
5. Add credits to your account (pay-as-you-go)

### 3. Cloudinary Service (for file storage)
```bash
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
```

**How to get Cloudinary credentials:**
1. Go to https://cloudinary.com/
2. Sign up for a free account
3. Get credentials from the dashboard
4. Free tier includes 25GB storage and 25GB bandwidth

## Testing the Services

### Health Check Endpoint
You can test if the services are properly configured by calling:
```
GET /business/health/ocr
```

This will return:
- `status: "healthy"` - All services configured
- `status: "warning"` - OCR configured but OpenAI missing (fallback mode)
- `status: "error"` - OCR not configured

### Document Processing Flow
1. User uploads document via `/business/:id/documents`
2. Document is stored in Cloudinary
3. OCR service extracts text from the document
4. AI service analyzes the document content
5. Document authenticity is verified
6. Results are stored in the database

## Fallback Mode
If OpenAI API is not configured, the system will use pattern matching fallback for document analysis. This provides basic validation but with lower accuracy.

## Troubleshooting

### Common Issues:
1. **OCR API Key Missing**: Check OCR_API_KEY environment variable
2. **OpenAI API Key Missing**: Check OPENAI_API_KEY environment variable
3. **Network Issues**: Ensure server can reach external APIs
4. **File Upload Issues**: Check Cloudinary configuration

### Logs to Check:
- OCR service initialization logs
- Document processing logs
- API response logs

## Google Vision API Benefits

### Why Use Google Vision?
- **Higher Accuracy**: Better text recognition for complex documents
- **Better Layout Handling**: Superior understanding of document structure
- **Language Detection**: Automatic language detection
- **Document Type Detection**: Built-in document classification
- **Reliability**: Google's robust infrastructure

### OCR Service Priority
The system uses the following priority order:
1. **Google Vision API** (if configured) - Primary choice
2. **OCR.space API** (if configured) - Fallback option
3. **Pattern Matching** (if no OCR services available) - Last resort

### Additional Health Check Endpoints

#### Google Vision Specific Health Check
```
GET /business/health/google-vision
```

This will return:
- `status: "healthy"` - Google Vision properly configured
- `status: "error"` - Google Vision not configured

#### Overall OCR Health Check (Updated)
```
GET /business/health/ocr
```

This will return:
- `status: "healthy"` - At least one OCR service + AI configured
- `status: "warning"` - OCR configured but OpenAI missing (fallback mode)
- `status: "error"` - No OCR services configured