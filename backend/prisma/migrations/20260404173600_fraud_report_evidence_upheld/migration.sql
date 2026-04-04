-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'UPHELD';

-- AlterTable
ALTER TABLE "FraudReport" ADD COLUMN "evidenceSummary" TEXT,
ADD COLUMN "evidenceLinks" JSONB,
ADD COLUMN "adminNotes" TEXT;
