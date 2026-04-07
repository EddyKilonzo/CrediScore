-- Add missing notification preference column expected by Prisma schema.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
