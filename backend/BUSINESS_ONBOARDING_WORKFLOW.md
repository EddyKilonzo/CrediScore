# 🏢 Business Onboarding Workflow Documentation

## Overview

This document outlines the comprehensive business onboarding workflow for CrediScore, designed to ensure proper verification and trust-building for businesses on the platform.

## Workflow Stages

### 1. **Business Registration** (`PENDING` status)
- **Step**: 1 - Basic Information
- **Description**: Business owner creates initial business profile
- **Required Fields**:
  - Business name
  - Description
  - Category
  - Contact information (phone, email, website)
  - Location
- **Auto-actions**:
  - User role upgraded to `BUSINESS_OWNER`
  - Status set to `PENDING`
  - Onboarding step set to 1

### 2. **Document Upload** (`DOCUMENTS_REQUIRED` status)
- **Step**: 2 - Document Verification
- **Description**: Upload required business documents
- **Required Documents**:
  - Business Registration Certificate
  - Tax Certificate
- **Optional Documents**:
  - Trade License
  - Bank Statement
  - Utility Bill
  - ID Copy
  - Proof of Address
- **Features**:
  - Cloudinary integration for file storage
  - Document type validation
  - File size and type restrictions
  - Admin verification system

### 3. **Payment Methods** (`DOCUMENTS_REQUIRED` status)
- **Step**: 3 - Payment Information
- **Description**: Add business payment methods
- **Required**: At least one payment method
- **Supported Types**:
  - TILL number
  - PAYBILL number
  - Bank account
- **Features**:
  - Payment method verification
  - Admin approval system

### 4. **Review Submission** (`UNDER_REVIEW` status)
- **Step**: 4 - Admin Review
- **Description**: Submit business for admin review
- **Prerequisites**:
  - All required documents uploaded
  - At least one payment method added
- **Features**:
  - Validation checks before submission
  - Optional notes for admin review
  - Status change to `UNDER_REVIEW`

### 5. **Admin Review** (Admin Panel)
- **Description**: Admin reviews and approves/rejects business
- **Admin Actions**:
  - Review business information
  - Verify uploaded documents
  - Check payment methods
  - Approve or reject with reasons
- **Possible Outcomes**:
  - `VERIFIED`: Business approved and active
  - `REJECTED`: Business rejected with reason
  - `SUSPENDED`: Business temporarily suspended

## Database Schema Changes

### Business Model Enhancements
```prisma
model Business {
  // ... existing fields
  status        BusinessStatus @default(PENDING)
  onboardingStep Int        @default(1)
  submittedForReview Boolean @default(false)
  reviewedAt    DateTime?
  reviewedBy    String?
  reviewNotes   String?
  rejectionReason String?
}

enum BusinessStatus {
  PENDING
  DOCUMENTS_REQUIRED
  UNDER_REVIEW
  VERIFIED
  REJECTED
  SUSPENDED
}
```

### Document Model Enhancements
```prisma
model Document {
  // ... existing fields
  type        DocumentType
  name        String?
  size        Int?
  mimeType    String?
  verifiedAt  DateTime?
  verifiedBy  String?
  verificationNotes String?
}

enum DocumentType {
  BUSINESS_REGISTRATION
  TAX_CERTIFICATE
  TRADE_LICENSE
  BANK_STATEMENT
  UTILITY_BILL
  ID_COPY
  PROOF_OF_ADDRESS
  OTHER
}
```

## API Endpoints

### Business Owner Endpoints

#### Get Onboarding Status
```
GET /business/:id/onboarding-status
```
Returns current onboarding progress and status.

#### Update Onboarding Step
```
PATCH /business/:id/onboarding-step
Body: { step: number }
```

#### Submit for Review
```
POST /business/:id/submit-for-review
Body: { notes?: string }
```

#### Upload Document
```
POST /business/:id/documents
Body: {
  type: DocumentType,
  url: string,
  name?: string,
  size?: number,
  mimeType?: string
}
```

#### Add Payment Method
```
POST /business/:id/payment-methods
Body: {
  type: 'TILL' | 'PAYBILL' | 'BANK',
  number: string
}
```

### Admin Endpoints

#### Get Pending Businesses
```
GET /admin/businesses/pending-review
Query: { page?, limit? }
```

#### Update Business Status
```
PATCH /admin/businesses/:id/status
Body: {
  status: BusinessStatus,
  reviewNotes?: string,
  rejectionReason?: string
}
```

#### Verify Document
```
PATCH /admin/documents/:id/verify
Body: {
  verified: boolean,
  notes?: string
}
```

#### Get Business Onboarding Details
```
GET /admin/businesses/:id/onboarding-details
```

## Workflow States

### Business Status Flow
```
PENDING → DOCUMENTS_REQUIRED → UNDER_REVIEW → VERIFIED
   ↓              ↓                ↓
REJECTED ← ← ← ← ← ← ← ← ← ← ← ← ← ←
   ↓
SUSPENDED
```

### Onboarding Steps
1. **Step 1**: Basic Information
2. **Step 2**: Document Upload
3. **Step 3**: Payment Methods
4. **Step 4**: Review Submission

## Frontend Implementation Plan

### Business Owner Interface
1. **Onboarding Dashboard**
   - Progress indicator
   - Current step display
   - Action buttons for next steps

2. **Step 1: Business Information Form**
   - Business details form
   - Category selection
   - Location input with map integration

3. **Step 2: Document Upload**
   - Drag-and-drop file upload
   - Document type selection
   - Upload progress indicators
   - Document preview and management

4. **Step 3: Payment Methods**
   - Payment method forms
   - Validation and verification status
   - Add/remove payment methods

5. **Step 4: Review Submission**
   - Summary of all information
   - Final review before submission
   - Submit for admin review

### Admin Interface
1. **Pending Businesses Dashboard**
   - List of businesses awaiting review
   - Filtering and search capabilities
   - Priority indicators

2. **Business Review Interface**
   - Complete business information display
   - Document viewer with verification controls
   - Payment method verification
   - Approval/rejection actions

3. **Document Verification**
   - Document preview and download
   - Verification status controls
   - Admin notes system

## Security Considerations

1. **File Upload Security**
   - File type validation
   - Size limits
   - Virus scanning (future enhancement)
   - Secure Cloudinary integration

2. **Access Control**
   - Business owners can only manage their own businesses
   - Admins have full access to all businesses
   - Role-based permissions

3. **Data Privacy**
   - Sensitive documents stored securely
   - Admin access logging
   - Audit trail for all changes

## Future Enhancements

1. **Automated Document Verification**
   - OCR for document text extraction
   - AI-powered document validation
   - Automated fraud detection

2. **Notification System**
   - Email notifications for status changes
   - SMS notifications for urgent updates
   - In-app notification system

3. **Analytics Dashboard**
   - Onboarding completion rates
   - Average review times
   - Rejection reason analytics

4. **Mobile App Integration**
   - Mobile document capture
   - Push notifications
   - Offline capability

## Testing Strategy

1. **Unit Tests**
   - Service method testing
   - DTO validation testing
   - Database operation testing

2. **Integration Tests**
   - API endpoint testing
   - File upload testing
   - Admin workflow testing

3. **End-to-End Tests**
   - Complete onboarding flow
   - Admin approval process
   - Error handling scenarios

## Deployment Checklist

1. **Database Migration**
   - Run Prisma migration
   - Verify schema changes
   - Test data integrity

2. **Environment Variables**
   - Cloudinary configuration
   - File upload limits
   - Admin email settings

3. **Monitoring**
   - File upload monitoring
   - Admin action logging
   - Performance metrics

This comprehensive workflow ensures a smooth, secure, and efficient business onboarding process that builds trust and maintains platform integrity.
