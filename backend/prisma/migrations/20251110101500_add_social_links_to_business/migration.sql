-- Add socialLinks JSONB column to store business social media handles
ALTER TABLE "Business"
ADD COLUMN "socialLinks" JSONB;

