# Business Onboarding Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS ONBOARDING WORKFLOW                 │
└─────────────────────────────────────────────────────────────────┘

1. BUSINESS REGISTRATION
   ┌─────────────────┐
   │ User Signs Up   │
   │ as Business     │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Fill Basic Info │ ◄── Step 1: Basic Information
   │ - Name          │
   │ - Description   │
   │ - Category      │
   │ - Contact Info  │
   │ - Location      │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Status: PENDING │
   │ Role: BUSINESS_  │
   │ OWNER           │
   └─────────┬───────┘
             │
             ▼

2. DOCUMENT UPLOAD
   ┌─────────────────┐
   │ Upload Required │ ◄── Step 2: Document Upload
   │ Documents       │
   │ - Registration  │
   │ - Tax Cert      │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Status: DOCUMENTS│
   │ _REQUIRED       │
   └─────────┬───────┘
             │
             ▼

3. PAYMENT METHODS
   ┌─────────────────┐
   │ Add Payment     │ ◄── Step 3: Payment Methods
   │ Methods         │
   │ - TILL          │
   │ - PAYBILL       │
   │ - Bank Account  │
   └─────────┬───────┘
             │
             ▼

4. SUBMIT FOR REVIEW
   ┌─────────────────┐
   │ Submit for      │ ◄── Step 4: Review Submission
   │ Admin Review    │
   │ - Validation    │
   │ - Notes         │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Status: UNDER_  │
   │ REVIEW          │
   └─────────┬───────┘
             │
             ▼

5. ADMIN REVIEW
   ┌─────────────────┐
   │ Admin Reviews    │
   │ - Documents      │
   │ - Payment Methods│
   │ - Business Info  │
   └─────────┬───────┘
             │
             ▼
   ┌─────────────────┐
   │ Admin Decision   │
   │                 │
   │ ┌─────────────┐ │
   │ │   APPROVE   │ │ ──► VERIFIED
   │ │             │ │
   │ │   REJECT    │ │ ──► REJECTED
   │ │             │ │
   │ │  SUSPEND    │ │ ──► SUSPENDED
   │ └─────────────┘ │
   └─────────────────┘

STATUS FLOW:
PENDING → DOCUMENTS_REQUIRED → UNDER_REVIEW → VERIFIED
   ↓              ↓                ↓
REJECTED ← ← ← ← ← ← ← ← ← ← ← ← ← ←
   ↓
SUSPENDED

ONBOARDING STEPS:
Step 1: Basic Information (PENDING)
Step 2: Document Upload (DOCUMENTS_REQUIRED)
Step 3: Payment Methods (DOCUMENTS_REQUIRED)
Step 4: Review Submission (UNDER_REVIEW)

REQUIRED DOCUMENTS:
✓ Business Registration Certificate
✓ Tax Certificate
○ Trade License (Optional)
○ Bank Statement (Optional)
○ Utility Bill (Optional)
○ ID Copy (Optional)
○ Proof of Address (Optional)

REQUIRED PAYMENT METHODS:
✓ At least one payment method:
  - TILL number
  - PAYBILL number
  - Bank account

ADMIN ACTIONS:
- Review business information
- Verify uploaded documents
- Check payment methods
- Approve/Reject with reasons
- Add admin notes
- Suspend if needed
