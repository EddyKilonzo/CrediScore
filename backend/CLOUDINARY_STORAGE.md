# Cloudinary Storage Configuration

## Overview

CrediScore uses **Cloudinary** as the primary document storage solution for business verification documents, receipt images, and user avatars. This provides a robust, scalable, and cost-effective alternative to AWS S3.

## Configuration

### Environment Variables

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
```

### Docker Setup

Cloudinary credentials are automatically passed to the application container:

```yaml
environment:
  - CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
  - CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
  - CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
```

## Features

### 1. Document Storage
- **Business Documents**: Registration certificates, licenses, permits
- **Receipt Images**: Customer review validation
- **User Avatars**: Profile pictures
- **Organized Folders**: Automatic categorization by type

### 2. Image Processing
- **Automatic Optimization**: WebP conversion, compression
- **Responsive Images**: Multiple sizes (thumbnail, small, medium, large)
- **Transformations**: Resize, crop, quality adjustment
- **CDN Delivery**: Global content delivery network

### 3. Security
- **Signed Uploads**: Secure direct client uploads
- **Access Control**: Private/public asset management
- **API Security**: Secure API key management

## API Endpoints

### Upload Document
```http
POST /cloudinary/upload
Content-Type: multipart/form-data

file: [binary file]
folder: "crediscore/documents"
```

### Upload from URL
```http
POST /cloudinary/upload-url
Content-Type: application/json

{
  "url": "https://example.com/image.jpg",
  "options": {
    "folder": "crediscore/documents"
  }
}
```

### Generate Signed Upload URL
```http
POST /cloudinary/signed-url
Content-Type: application/json

{
  "folder": "crediscore/documents",
  "resourceType": "image",
  "maxFileSize": 10485760
}
```

### Get Responsive URLs
```http
POST /cloudinary/responsive
Content-Type: application/json

{
  "publicId": "crediscore/documents/document_id",
  "baseTransformations": {
    "quality": "auto"
  }
}
```

## Integration with Business Service

### Document Upload Flow
1. **Client Upload**: File uploaded to Cloudinary via signed URL
2. **Database Record**: Document metadata stored in PostgreSQL
3. **Verification**: Document URL used for business verification
4. **Trust Scoring**: Verified documents contribute to business trust score

### Receipt Processing Flow
1. **Receipt Upload**: Customer uploads receipt image to Cloudinary
2. **Text Extraction**: Google Vision API processes Cloudinary URL
3. **Data Parsing**: AI extracts amount, date, merchant info
4. **Review Validation**: Extracted data validates review authenticity

## Folder Structure

```
crediscore/
├── documents/           # Business verification documents
│   ├── registration/    # Registration certificates
│   ├── licenses/        # Business licenses
│   └── permits/         # Permits and approvals
├── receipts/            # Customer receipt images
├── avatars/             # User profile pictures
└── reviews/             # Review-related images
```

## Benefits Over AWS S3

### 1. **Built-in Image Processing**
- Automatic optimization and format conversion
- Responsive image generation
- Advanced transformations

### 2. **CDN Integration**
- Global content delivery
- Automatic caching
- Performance optimization

### 3. **Simplified API**
- Single service for storage and processing
- Rich transformation options
- Easy integration

### 4. **Cost Efficiency**
- Pay-per-use pricing
- No minimum commitments
- Automatic optimization reduces bandwidth

## Migration from AWS S3

### Completed Changes
- ✅ Updated AI service to use Cloudinary URLs
- ✅ Removed AWS S3 configuration from environment
- ✅ Updated Docker configuration
- ✅ Documented Cloudinary integration

### Future Considerations
- AWS S3 configuration kept as commented for potential future use
- Google Vision API used for text extraction from Cloudinary URLs
- Fallback to Tesseract.js for local processing

## Best Practices

### 1. **File Organization**
- Use descriptive folder names
- Include business ID in folder structure
- Tag files for easy management

### 2. **Security**
- Use signed uploads for client-side uploads
- Implement file type validation
- Set appropriate file size limits

### 3. **Performance**
- Use responsive images for different screen sizes
- Implement lazy loading
- Cache transformed images

### 4. **Monitoring**
- Track upload success rates
- Monitor storage usage
- Set up alerts for failures

## Troubleshooting

### Common Issues

1. **Upload Failures**
   - Check API credentials
   - Verify file size limits
   - Ensure proper file format

2. **Image Processing Errors**
   - Verify Cloudinary configuration
   - Check image format support
   - Review transformation parameters

3. **Access Issues**
   - Verify signed URL generation
   - Check folder permissions
   - Ensure proper authentication

### Support Resources
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [NestJS File Upload Guide](https://docs.nestjs.com/techniques/file-upload)
- [Google Vision API Documentation](https://cloud.google.com/vision/docs)
