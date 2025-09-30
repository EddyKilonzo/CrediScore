# Cloudinary Media Storage

This module provides comprehensive media storage and management capabilities using Cloudinary.

## Features

- File upload (single and multiple)
- URL-based uploads
- File deletion
- Image transformations
- Responsive image generation
- Signed upload URLs for direct client uploads
- File information retrieval

## Configuration

Add the following environment variables to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Usage

### Service Usage

```typescript
import { CloudinaryService } from './shared/cloudinary/cloudinary.service';

@Injectable()
export class YourService {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  async uploadFile(file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadFile(file, {
      folder: 'your-folder',
      tags: ['tag1', 'tag2'],
    });
    return result;
  }
}
```

### API Endpoints

#### Upload File
```http
POST /cloudinary/upload
Content-Type: multipart/form-data

file: [file]
folder: "optional-folder"
tags: ["tag1", "tag2"]
```

#### Upload from URL
```http
POST /cloudinary/upload-url
Content-Type: application/json

{
  "url": "https://example.com/image.jpg",
  "options": {
    "folder": "optional-folder",
    "tags": ["tag1", "tag2"]
  }
}
```

#### Get File Info
```http
GET /cloudinary/info/:publicId
Content-Type: application/json

{
  "resourceType": "image" // optional, defaults to "image"
}
```

#### Delete File
```http
DELETE /cloudinary/:publicId
Content-Type: application/json

{
  "resourceType": "image" // optional, defaults to "image"
}
```

#### Generate Signed Upload URL
```http
POST /cloudinary/signed-url
Content-Type: application/json

{
  "folder": "optional-folder",
  "resourceType": "image",
  "maxFileSize": 10485760 // 10MB in bytes
}
```

#### Get Transformed URL
```http
POST /cloudinary/transform
Content-Type: application/json

{
  "publicId": "your-public-id",
  "transformations": {
    "width": 300,
    "height": 300,
    "crop": "fill",
    "quality": "auto"
  },
  "resourceType": "image"
}
```

#### Get Responsive URLs
```http
POST /cloudinary/responsive
Content-Type: application/json

{
  "publicId": "your-public-id",
  "baseTransformations": {
    "quality": "auto",
    "format": "webp"
  }
}
```

## Service Methods

### `uploadFile(file, options)`
Upload a file to Cloudinary.

**Parameters:**
- `file`: Express.Multer.File
- `options`: CloudinaryUploadOptions

**Returns:** Promise<UploadApiResponse>

### `uploadFromUrl(url, options)`
Upload a file from a URL.

**Parameters:**
- `url`: string
- `options`: CloudinaryUploadOptions

**Returns:** Promise<UploadApiResponse>

### `deleteFile(publicId, resourceType)`
Delete a file from Cloudinary.

**Parameters:**
- `publicId`: string
- `resourceType`: string (default: 'image')

**Returns:** Promise<void>

### `getFileInfo(publicId, resourceType)`
Get file information.

**Parameters:**
- `publicId`: string
- `resourceType`: string (default: 'image')

**Returns:** Promise<any>

### `generateSignedUploadUrl(folder, resourceType, maxFileSize)`
Generate a signed upload URL for direct client uploads.

**Parameters:**
- `folder`: string (default: 'crediscore')
- `resourceType`: string (default: 'image')
- `maxFileSize`: number (default: 10MB)

**Returns:** Object with uploadUrl, signature, and timestamp

### `getTransformedUrl(publicId, transformations, resourceType)`
Get a transformed image URL.

**Parameters:**
- `publicId`: string
- `transformations`: any
- `resourceType`: string (default: 'image')

**Returns:** string

### `getResponsiveImageUrls(publicId, baseTransformations)`
Generate responsive image URLs.

**Parameters:**
- `publicId`: string
- `baseTransformations`: any

**Returns:** Object with thumbnail, small, medium, large, and original URLs

## Error Handling

The service includes comprehensive error handling and logging. All methods throw appropriate errors that can be caught and handled by your application.

## Security

- All uploads are validated
- File size limits can be configured
- Signed URLs provide secure direct uploads
- Resource type validation prevents unauthorized uploads
