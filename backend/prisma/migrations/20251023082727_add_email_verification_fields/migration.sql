/*
  Warnings:

  - Changed the type of `type` on the `Document` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BUSINESS_DOCUMENT', 'BUSINESS_REGISTRATION', 'TAX_CERTIFICATE', 'TRADE_LICENSE', 'BANK_STATEMENT', 'UTILITY_BILL', 'ID_COPY', 'PROOF_OF_ADDRESS', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('PENDING', 'DOCUMENTS_REQUIRED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "BusinessStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "submittedForReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "aiAnalysis" JSONB,
ADD COLUMN     "aiVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "extractedData" JSONB,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "ocrConfidence" INTEGER,
ADD COLUMN     "ocrText" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "DocumentType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationSentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerificationTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "passwordResetSentAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "passwordResetTokenExpiry" TIMESTAMP(3);
