-- AlterTable
ALTER TABLE "FraudReport"
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "evidenceMetadata" JSONB,
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "slaDueAt" TIMESTAMP(3),
ADD COLUMN "auditLog" JSONB,
ADD COLUMN "lastActionAt" TIMESTAMP(3);

-- Index to speed dedupe checks for active cases
CREATE INDEX "FraudReport_businessId_dedupeKey_status_idx"
ON "FraudReport"("businessId", "dedupeKey", "status");
