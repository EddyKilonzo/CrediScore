-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "receiptData" JSONB,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "reviewDate" TIMESTAMP(3),
ADD COLUMN     "validationResult" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "flagCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "reviewPattern" JSONB,
ADD COLUMN     "unverifiedReviewCount" INTEGER NOT NULL DEFAULT 0;
