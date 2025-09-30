# CrediScore Platform Workflows

## Overview
This document outlines the complete user and business workflows in the CrediScore platform, a business trust and review system.

## User Workflow

### 1. User Registration & Authentication
```
User Registration Flow:
1. User visits signup page
2. Fills registration form (name, email, password, phone)
3. System validates input and checks email uniqueness
4. Password is hashed and user is created with default CUSTOMER role
5. JWT token is generated and returned
6. User is automatically logged in

Authentication Options:
- Local email/password authentication
- Google OAuth integration
- JWT-based session management

Role Management:
- All new users start as CUSTOMER by default
- Users are automatically upgraded to BUSINESS_OWNER when they create their first business
- Only admins can manually assign roles
```

### 2. User Profile Management
```
Profile Management Flow:
1. User accesses profile page
2. Can update: name, phone, avatar
3. System validates changes and updates database
4. Profile changes are reflected immediately

User Statistics Available:
- Total reviews written
- Total businesses owned (for business owners)
- Total fraud reports submitted
- Current reputation score
- Account status and email verification status
```

### 3. User as Customer (Reviewer)
```
Review Creation Workflow:
1. User searches for businesses
2. Selects a business to review
3. Provides rating (1-5 stars) and optional comment
4. System validates:
   - User hasn't already reviewed this business
   - Rating is within valid range
   - Business exists and is active
5. Review is created and linked to user and business
6. User's reputation may be updated based on review quality

Review Management:
- View all reviews written by user
- Edit existing reviews (rating and comment)
- Delete own reviews
- Reviews are displayed on business profiles
```

### 4. User as Fraud Reporter
```
Fraud Reporting Workflow:
1. User identifies suspicious business activity
2. Navigates to fraud reporting form
3. Selects business to report
4. Provides reason and detailed description
5. System validates:
   - User hasn't already reported this business
   - Business exists and is active
6. Report is created with "PENDING" status
7. Admin will review and update status

Report Management:
- View all fraud reports submitted by user
- Track report status (PENDING, UNDER_REVIEW, RESOLVED, DISMISSED)
- Cannot edit or delete reports once submitted
```

### 5. User as Business Owner
```
Business Creation Workflow:
1. User must have BUSINESS_OWNER role
2. Navigates to business creation form
3. Provides business details:
   - Name, description, category
   - Contact information (website, phone, email)
   - Location (address, coordinates)
   - Business category selection
4. System creates business with "unverified" status
5. Business owner can immediately start adding documents and payment methods

Business Management:
- View all owned businesses
- Update business information
- Users are automatically upgraded to BUSINESS_OWNER when they create their first business
- Upload verification documents
- Add payment methods
- View business analytics and trust scores
- Delete businesses (soft delete if has reviews/documents)
```

## Business Workflow

### 1. Business Registration
```
Business Registration Flow:
1. Business owner creates business profile
2. System assigns unique ID and sets initial status
3. Business starts with:
   - isVerified: false
   - isActive: true
   - No trust score initially
4. Business appears in public search but marked as unverified
```

### 2. Business Verification Process
```
Document Upload Workflow:
1. Business owner uploads verification documents
2. Document types include:
   - Registration certificates
   - Business licenses
   - Tax compliance documents
   - Other relevant business documents
3. Documents are stored with "unverified" status
4. Admin reviews and verifies documents
5. Verified documents contribute to trust score

Payment Method Verification:
1. Business owner adds payment methods
2. Types supported:
   - Till numbers
   - Paybill numbers
   - Bank account details
3. Payment methods start as "unverified"
4. Admin verifies payment methods
5. Verified payment methods contribute to trust score
```

### 3. Trust Score Calculation
```
Trust Score Algorithm:
Base Score: 0-100 points

Scoring Factors:
1. Verification Status: +20 points (if business is verified)
2. Reviews: Up to +40 points
   - Average rating × 8 (max 40 points)
   - Based on all active reviews
3. Verified Documents: Up to +20 points
   - 5 points per verified document (max 20 points)
4. Verified Payment Methods: Up to +15 points
   - 3 points per verified payment method (max 15 points)
5. Fraud Reports: Up to -25 points penalty
   - 5 points penalty per resolved fraud report (max 25 points)

Grade Assignment:
- A+: 90-100 points
- A: 80-89 points
- B: 70-79 points
- C: 60-69 points
- D: 50-59 points
- F: 0-49 points

Trust Score Updates:
- Calculated automatically when:
  - New reviews are added
  - Documents are verified/unverified
  - Payment methods are verified/unverified
  - Fraud reports are resolved
- Can be manually recalculated by admin
```

### 4. Business Analytics
```
Analytics Dashboard for Business Owners:
1. Business Overview:
   - Business name, verification status, active status
   - Trust score grade and numerical score
   - Trust score breakdown by factors

2. Review Analytics:
   - Total number of reviews
   - Average rating
   - Review trends over time

3. Document Analytics:
   - Total documents uploaded
   - Number of verified documents
   - Document verification rate

4. Payment Analytics:
   - Total payment methods added
   - Number of verified payment methods
   - Payment method verification rate

5. Fraud Report Analytics:
   - Total fraud reports received
   - Report status breakdown
```

### 5. Public Business Profile
```
Public Business Display:
1. Business Information:
   - Name, description, category
   - Contact details (website, phone, email)
   - Location and map coordinates
   - Verification badge (if verified)

2. Trust Score Display:
   - Grade (A+, A, B, C, D, F)
   - Numerical score (0-100)
   - Trust score factors breakdown

3. Reviews Section:
   - List of recent reviews (last 10)
   - Average rating
   - Total review count
   - Reviewer information (name, reputation)

4. Business Statistics:
   - Total reviews
   - Total documents
   - Total payment methods
   - Business category information
```

## Admin Workflow

### 1. User Management
```
Admin User Operations:
1. View all users with pagination and filters
2. Search users by name, email, or phone
3. Filter by role (CUSTOMER, BUSINESS_OWNER, ADMIN)
4. Filter by active status
5. Update user roles
6. Toggle user active/inactive status
7. View detailed user information including:
   - Profile details
   - Recent reviews
   - Owned businesses
   - Fraud reports submitted
8. Deactivate users (soft delete)
```

### 2. Business Management
```
Admin Business Operations:
1. View all businesses with pagination and filters
2. Search businesses by name, description, category, location
3. Filter by verification status
4. Filter by active status
5. View detailed business information including:
   - Business details and owner information
   - Trust score and factors
   - All documents and verification status
   - All payment methods and verification status
   - All reviews and reviewer information
   - All fraud reports and status
6. Verify/unverify businesses
7. Toggle business active/inactive status
```

### 3. Fraud Report Management
```
Admin Fraud Report Operations:
1. View all fraud reports with pagination and filters
2. Filter by status (PENDING, UNDER_REVIEW, RESOLVED, DISMISSED)
3. Filter by business
4. Update report status
5. Add admin notes to reports
6. Track report resolution progress
```

### 4. Dashboard Analytics
```
Admin Dashboard Statistics:
1. User Statistics:
   - Total users, active users, inactive users
   - Users by role (customers, business owners, admins)
   - New users this month
   - Users with verified email

2. Business Statistics:
   - Total businesses, verified businesses
   - Pending verification count
   - Active/inactive businesses
   - New businesses this month
   - Businesses with trust scores

3. Fraud Report Statistics:
   - Total reports, pending reports
   - Under review, resolved, dismissed reports
   - Reports this month
```

## Integration Points

### 1. Cloudinary Integration
```
File Upload Workflow:
1. User uploads document/image
2. File is sent to Cloudinary service
3. Cloudinary processes and stores file
4. URL is returned and stored in database
5. File is accessible via CDN
```

### 2. Email Integration
```
Email Workflow:
1. User registration confirmation
2. Password reset emails
3. Business verification notifications
4. Fraud report status updates
5. Trust score change notifications
```

### 3. Authentication Integration
```
Security Workflow:
1. JWT token-based authentication
2. Role-based access control (RBAC)
3. Protected routes with guards
4. OAuth integration (Google)
5. Session management
```

## Data Flow Summary

```
User Journey:
Registration → Profile Setup → Business Search → Review/Fraud Report → Business Creation (if owner) → Document Upload → Verification → Trust Score → Analytics

Business Journey:
Creation → Document Upload → Payment Method Addition → Admin Verification → Trust Score Calculation → Public Display → Review Collection → Score Updates

Admin Journey:
Dashboard Overview → User Management → Business Verification → Fraud Report Resolution → Analytics Monitoring
```

This workflow ensures a comprehensive trust and review system that benefits all stakeholders while maintaining data integrity and user experience.
