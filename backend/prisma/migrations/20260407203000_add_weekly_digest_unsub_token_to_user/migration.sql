-- Add weekly digest unsubscribe token column expected by Prisma schema.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "weeklyDigestUnsubToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_weeklyDigestUnsubToken_key"
ON "User"("weeklyDigestUnsubToken");
