# Prisma Schema Documentation

## 📊 Database Models Overview

This document details the Prisma schema structure for the Business Trust & Review Platform.

## 🏗️ Model Architecture

### Core Entity Relationships

```
User (1) ──→ (N) Review
User (1) ──→ (N) Business (as owner)
User (1) ──→ (N) FraudReport (as reporter)

Business (1) ──→ (N) Review
Business (1) ──→ (N) Document
Business (1) ──→ (N) Payment
Business (1) ──→ (1) TrustScore
Business (1) ──→ (N) FraudReport
```

## 📋 Model Details

### 1. User Model
**Purpose**: Manages customer and business owner accounts

```prisma
model User {
  id          String     @id @default(uuid())
  name        String
  email       String     @unique
  password    String
  phone       String?    @unique
  role        UserRole   @default(CUSTOMER)
  isActive    Boolean    @default(true)
  reviews     Review[]
  businesses  Business[] // For owners
  fraudReports FraudReport[]
  reputation  Int        @default(0) // Reviewer credibility score
  lastLoginAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

**Key Fields:**
- `role`: CUSTOMER, BUSINESS_OWNER, ADMIN
- `reputation`: Reviewer credibility score (0-100)
- `isActive`: Account status management
- `lastLoginAt`: Activity tracking

**Relationships:**
- One-to-Many with Reviews
- One-to-Many with Businesses (as owner)
- One-to-Many with FraudReports (as reporter)

### 2. Business Model
**Purpose**: Stores business profile information and verification status

```prisma
model Business {
  id            String      @id @default(uuid())
  name          String
  description   String?
  category      String?
  website       String?
  phone         String?
  email         String?
  owner         User?       @relation(fields: [ownerId], references: [id])
  ownerId       String?
  location      String?     // Address
  latitude      Float?      // Google Maps
  longitude     Float?
  isVerified    Boolean     @default(false)
  isActive      Boolean     @default(true)
  documents     Document[]
  reviews       Review[]
  payments      Payment[]
  trustScore    TrustScore?
  fraudReports  FraudReport[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}
```

**Key Fields:**
- `location`, `latitude`, `longitude`: Google Maps integration
- `isVerified`: Overall verification status
- `category`: Business classification
- `website`, `phone`, `email`: Contact information

**Relationships:**
- Many-to-One with User (owner)
- One-to-Many with Reviews
- One-to-Many with Documents
- One-to-Many with Payments
- One-to-One with TrustScore
- One-to-Many with FraudReports

### 3. Review Model
**Purpose**: Customer reviews and ratings for businesses

```prisma
model Review {
  id          String    @id @default(uuid())
  rating      Int       // 1–5
  comment     String?
  user        User      @relation(fields: [userId], references: [id])
  userId      String
  business    Business  @relation(fields: [businessId], references: [id])
  businessId  String
  credibility Int       @default(0) // AI/manual scoring of review
  isVerified  Boolean   @default(false)
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Key Fields:**
- `rating`: 1-5 star rating system
- `comment`: Detailed feedback
- `credibility`: AI-powered authenticity score
- `isVerified`: Manual/AI verification status
- `isActive`: Moderation control

**Relationships:**
- Many-to-One with User (reviewer)
- Many-to-One with Business

### 4. Document Model
**Purpose**: Business verification documents and certificates

```prisma
model Document {
  id          String    @id @default(uuid())
  url         String    // File storage link
  type        String    // e.g. Registration certificate
  verified    Boolean   @default(false)
  business    Business  @relation(fields: [businessId], references: [id])
  businessId  String
  uploadedAt  DateTime  @default(now())
}
```

**Key Fields:**
- `url`: File storage location
- `type`: Document classification
- `verified`: Manual verification status
- `uploadedAt`: Upload timestamp

**Relationships:**
- Many-to-One with Business

### 5. Payment Model
**Purpose**: Payment method verification (Till/Paybill numbers)

```prisma
model Payment {
  id          String    @id @default(uuid())
  type        PaymentType
  number      String    // Till or Paybill number
  verified    Boolean   @default(false)
  business    Business  @relation(fields: [businessId], references: [id])
  businessId  String
  addedAt     DateTime  @default(now())
}
```

**Key Fields:**
- `type`: TILL, PAYBILL, BANK
- `number`: Payment identifier
- `verified`: Verification status
- `addedAt`: Addition timestamp

**Relationships:**
- Many-to-One with Business

### 6. TrustScore Model
**Purpose**: AI-powered trust scoring system

```prisma
model TrustScore {
  id          String    @id @default(uuid())
  grade       String    // A+, A, B, C, D, F
  score       Int       // Numeric 0–100
  business    Business  @relation(fields: [businessId], references: [id])
  businessId  String    @unique
  factors     Json?     // Store scoring factors breakdown
  updatedAt   DateTime  @updatedAt
}
```

**Key Fields:**
- `grade`: A+ to F grading system
- `score`: 0-100 numeric score
- `factors`: JSON breakdown of scoring components
- `businessId`: Unique business association

**Relationships:**
- One-to-One with Business

### 7. FraudReport Model
**Purpose**: Community-driven fraud reporting system

```prisma
model FraudReport {
  id          String    @id @default(uuid())
  reporter    User      @relation(fields: [reporterId], references: [id])
  reporterId  String
  business    Business  @relation(fields: [businessId], references: [id])
  businessId  String
  reason      String    // Fraud reason
  description String?
  status      ReportStatus @default(PENDING)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Key Fields:**
- `reason`: Fraud classification
- `description`: Detailed report
- `status`: PENDING, UNDER_REVIEW, RESOLVED, DISMISSED
- `reporterId`: User who filed report
- `businessId`: Reported business

**Relationships:**
- Many-to-One with User (reporter)
- Many-to-One with Business

### 8. BusinessCategory Model
**Purpose**: Business categorization system

```prisma
model BusinessCategory {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  businesses  Business[]
  createdAt   DateTime  @default(now())
}
```

**Key Fields:**
- `name`: Unique category name
- `description`: Category details
- `businesses`: Associated businesses

**Relationships:**
- One-to-Many with Business

## 🔗 Relationship Summary

### One-to-Many Relationships
- User → Reviews
- User → Businesses (as owner)
- User → FraudReports (as reporter)
- Business → Reviews
- Business → Documents
- Business → Payments
- Business → FraudReports
- BusinessCategory → Businesses

### One-to-One Relationships
- Business → TrustScore

### Many-to-One Relationships
- Review → User (reviewer)
- Review → Business
- Document → Business
- Payment → Business
- TrustScore → Business
- FraudReport → User (reporter)
- FraudReport → Business

## 📊 Enums

### UserRole
```prisma
enum UserRole {
  CUSTOMER
  BUSINESS_OWNER
  ADMIN
}
```

### PaymentType
```prisma
enum PaymentType {
  TILL
  PAYBILL
  BANK
}
```

### ReportStatus
```prisma
enum ReportStatus {
  PENDING
  UNDER_REVIEW
  RESOLVED
  DISMISSED
}
```

## 🎯 Trust Score Calculation

### Scoring Factors (MVP)
- **Verified Documents**: 30% weight
- **Verified Payment Details**: 20% weight
- **Number of Reviews & Average Rating**: 30% weight
- **Review Credibility**: 20% weight

### Grade Mapping
- **A+**: 90-100 points
- **A**: 80-89 points
- **B**: 70-79 points
- **C**: 60-69 points
- **D**: 50-59 points
- **F**: 0-49 points

## 🚀 Database Operations

### Common Queries

#### Get Business with Reviews and Trust Score
```prisma
const business = await prisma.business.findUnique({
  where: { id: businessId },
  include: {
    reviews: {
      where: { isActive: true },
      include: { user: true }
    },
    trustScore: true,
    documents: { where: { verified: true } },
    payments: { where: { verified: true } }
  }
});
```

#### Get User Reviews with Business Info
```prisma
const userReviews = await prisma.review.findMany({
  where: { userId: userId },
  include: {
    business: {
      include: { trustScore: true }
    }
  }
});
```

#### Calculate Trust Score
```prisma
const trustFactors = {
  verifiedDocuments: business.documents.filter(d => d.verified).length,
  verifiedPayments: business.payments.filter(p => p.verified).length,
  reviewCount: business.reviews.filter(r => r.isActive).length,
  averageRating: business.reviews.filter(r => r.isActive).reduce((sum, r) => sum + r.rating, 0) / business.reviews.length,
  reviewCredibility: business.reviews.filter(r => r.isActive).reduce((sum, r) => sum + r.credibility, 0) / business.reviews.length
};
```

## 🔧 Schema Maintenance

### Adding New Fields
1. Update the model in `schema.prisma`
2. Run `npx prisma db push` for development
3. Create migration with `npx prisma migrate dev` for production

### Indexing Strategy
```sql
-- Performance indexes
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_business_name ON "Business"(name);
CREATE INDEX idx_review_business_rating ON "Review"("businessId", rating);
CREATE INDEX idx_trustscore_grade ON "TrustScore"(grade);
```

### Data Validation
- Email format validation
- Phone number format validation
- Rating range validation (1-5)
- Trust score range validation (0-100)

## 📈 Performance Considerations

### Query Optimization
- Use `select` to limit returned fields
- Use `include` for related data
- Implement pagination for large datasets
- Use database indexes for frequently queried fields

### Scalability
- Consider database sharding for large user bases
- Implement caching for frequently accessed data
- Use connection pooling for database connections

---

**Schema Version**: 1.0.0  
**Last Updated**: 2024  
**Prisma Version**: 5.7.1
