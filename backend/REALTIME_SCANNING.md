# Real-Time Document Scanning

## Overview

CrediScore now supports **real-time document scanning** during the upload process. When users upload images, the system automatically analyzes and extracts information from documents in real-time, providing immediate feedback and structured data.

## Features

### 1. **Automatic Document Type Detection**
- **Receipts**: Detects payment receipts, invoices, and transaction records
- **Business Documents**: Identifies certificates, licenses, permits, and registrations
- **Mixed Documents**: Handles documents with multiple purposes
- **Confidence Scoring**: Provides confidence levels for document classification

### 2. **Real-Time Text Extraction**
- **Google Vision API**: Primary OCR engine for high accuracy
- **Tesseract.js**: Fallback for local processing
- **Cloudinary Integration**: Processes images stored in Cloudinary

### 3. **Structured Data Extraction**
- **Receipt Data**: Amount, date, merchant, payment method
- **Business Document Data**: Registration numbers, issue dates, expiry dates
- **Metadata**: Text length, word count, scan timestamp

## API Endpoints

### 1. Upload with Real-Time Scanning

```http
POST /cloudinary/upload
Content-Type: multipart/form-data

file: [binary file]
folder: "crediscore/documents"
scanDocument: true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicId": "crediscore/documents/abc123",
    "url": "https://res.cloudinary.com/...",
    "width": 1920,
    "height": 1080,
    "format": "jpg",
    "size": 245760,
    "createdAt": "2024-01-15T10:30:00Z",
    "scanResult": {
      "documentType": "receipt",
      "extractedText": "STORE NAME\nReceipt #12345\nDate: 2024-01-15\nTotal: $25.99",
      "confidence": 85.5,
      "metadata": {
        "textLength": 89,
        "wordCount": 12,
        "scanTimestamp": "2024-01-15T10:30:05Z"
      },
      "isReceipt": true,
      "receiptData": {
        "merchantName": "STORE NAME",
        "receiptNumber": "12345",
        "date": "2024-01-15",
        "total": 25.99,
        "currency": "USD"
      },
      "isBusinessDocument": false,
      "businessDocumentData": null
    }
  }
}
```

### 2. Upload from URL with Scanning

```http
POST /cloudinary/upload-url
Content-Type: application/json

{
  "url": "https://example.com/document.jpg",
  "options": {
    "folder": "crediscore/documents",
    "scanDocument": true
  }
}
```

### 3. Scan Existing Document

```http
POST /cloudinary/scan/:publicId
Content-Type: application/json

{
  "resourceType": "image"
}
```

## Document Type Detection

### Receipt Indicators
- Keywords: receipt, invoice, payment, total, amount, date, time
- Patterns: cash, card, change, subtotal, tax, tip, thank you
- Technical: pos, terminal, transaction, ref, receipt no

### Business Document Indicators
- Keywords: certificate, license, permit, registration, incorporation
- Entities: business, company, ltd, inc, corp, llc, partnership
- Numbers: registration number, license number, permit number
- Authority: issued by, authorized, valid until, expires, renewal

### Confidence Scoring
- **High (80-95%)**: Strong indicators present, clear document type
- **Medium (50-79%)**: Some indicators, mixed or unclear type
- **Low (0-49%)**: Few indicators, unknown document type

## Data Extraction

### Receipt Data Structure
```json
{
  "merchantName": "Store Name",
  "receiptNumber": "12345",
  "date": "2024-01-15",
  "time": "14:30:00",
  "total": 25.99,
  "currency": "USD",
  "paymentMethod": "card",
  "items": [
    {
      "name": "Product Name",
      "price": 25.99,
      "quantity": 1
    }
  ],
  "tax": 2.08,
  "subtotal": 23.91
}
```

### Business Document Data Structure
```json
{
  "documentType": "business_license",
  "businessName": "ABC Company Ltd",
  "registrationNumber": "REG123456",
  "licenseNumber": "LIC789012",
  "issueDate": "2023-01-15",
  "expiryDate": "2025-01-15",
  "issuingAuthority": "Business Registration Office",
  "businessAddress": "123 Main St, City, State"
}
```

## Integration Workflow

### 1. **Upload Process**
```
User Uploads Image
    ↓
Cloudinary Storage
    ↓
Real-Time Scanning Triggered
    ↓
Google Vision API Text Extraction
    ↓
Document Type Analysis
    ↓
Structured Data Extraction
    ↓
Response with Scan Results
```

### 2. **Business Document Verification**
```
Document Uploaded
    ↓
Real-Time Scan
    ↓
Business Data Extracted
    ↓
Database Record Created
    ↓
Verification Status Updated
    ↓
Trust Score Recalculated
```

### 3. **Receipt Validation**
```
Receipt Uploaded
    ↓
Real-Time Scan
    ↓
Receipt Data Extracted
    ↓
Review Validation
    ↓
Credibility Score Updated
    ↓
Fraud Detection Analysis
```

## Performance Considerations

### 1. **Response Time**
- **Target**: < 5 seconds for complete scan
- **Optimization**: Parallel processing where possible
- **Fallback**: Graceful degradation if scanning fails

### 2. **Cost Management**
- **Google Vision API**: Pay-per-request pricing
- **OpenAI API**: Token-based pricing for data extraction
- **Caching**: Store results to avoid re-scanning

### 3. **Error Handling**
- **Network Issues**: Retry with exponential backoff
- **API Limits**: Queue requests and rate limiting
- **Invalid Images**: Graceful error responses

## Configuration

### Environment Variables
```env
# Google Vision API
GOOGLE_VISION_API_KEY="your-google-vision-api-key"

# OpenAI API
OPENAI_API_KEY="your-openai-api-key"
OPENAI_BASE_URL="https://api.openai.com/v1"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
```

### Module Dependencies
```typescript
// CloudinaryModule imports AiModule for scanning
@Module({
  imports: [ConfigModule, AiModule],
  controllers: [CloudinaryController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
```

## Usage Examples

### Frontend Integration
```javascript
// Upload with real-time scanning
const formData = new FormData();
formData.append('file', file);
formData.append('folder', 'crediscore/documents');
formData.append('scanDocument', 'true');

const response = await fetch('/cloudinary/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();

if (result.success && result.data.scanResult) {
  const scanResult = result.data.scanResult;
  
  if (scanResult.isReceipt) {
    console.log('Receipt detected:', scanResult.receiptData);
  } else if (scanResult.isBusinessDocument) {
    console.log('Business document detected:', scanResult.businessDocumentData);
  }
}
```

### Backend Service Integration
```typescript
// Business service with real-time scanning
async uploadDocumentWithScan(
  userId: string,
  businessId: string,
  file: Express.Multer.File,
) {
  // Upload to Cloudinary with scanning
  const uploadResult = await this.cloudinaryService.uploadFile(file, {
    folder: 'crediscore/documents',
    scanDocument: true,
  });

  // Create database record with scan results
  const document = await this.prisma.document.create({
    data: {
      url: uploadResult.url,
      type: uploadResult.scanResult?.documentType || 'unknown',
      businessId,
      // Store scan results in metadata
      metadata: uploadResult.scanResult,
    },
  });

  return document;
}
```

## Benefits

### 1. **Immediate Feedback**
- Users see scan results instantly
- No need to wait for background processing
- Real-time validation and error detection

### 2. **Enhanced User Experience**
- Automatic document classification
- Structured data extraction
- Confidence scoring for transparency

### 3. **Improved Data Quality**
- Consistent data extraction
- Reduced manual data entry
- Better validation and verification

### 4. **Operational Efficiency**
- Faster document processing
- Reduced manual review time
- Automated workflow integration

## Troubleshooting

### Common Issues

1. **Scanning Timeout**
   - Check API rate limits
   - Verify network connectivity
   - Review image quality and size

2. **Low Confidence Scores**
   - Ensure clear, high-quality images
   - Check document orientation
   - Verify text is readable

3. **API Errors**
   - Check API key configuration
   - Monitor usage quotas
   - Review error logs

### Support Resources
- [Google Vision API Documentation](https://cloud.google.com/vision/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
