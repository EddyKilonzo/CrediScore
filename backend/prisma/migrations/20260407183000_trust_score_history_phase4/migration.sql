-- CreateTable
CREATE TABLE "TrustScoreHistory" (
    "id" TEXT NOT NULL,
    "trustScoreId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "changeDelta" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" INTEGER,
    "factors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustScoreHistory_businessId_createdAt_idx" ON "TrustScoreHistory"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TrustScoreHistory_trustScoreId_createdAt_idx" ON "TrustScoreHistory"("trustScoreId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "TrustScoreHistory" ADD CONSTRAINT "TrustScoreHistory_trustScoreId_fkey" FOREIGN KEY ("trustScoreId") REFERENCES "TrustScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
