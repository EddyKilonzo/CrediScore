import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const sql = neon(process.env.DATABASE_URL);

async function runMigrations() {
  console.log('Running schema migrations...\n');

  const statements = [
    {
      name: 'Add notificationPrefs to User',
      query: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB`,
    },
    {
      name: 'Add businessHours to Business',
      query: `ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "businessHours" JSONB`,
    },
    {
      name: 'Create ResponseTemplate table',
      query: `
        CREATE TABLE IF NOT EXISTS "ResponseTemplate" (
          "id"         TEXT        NOT NULL,
          "businessId" TEXT        NOT NULL,
          "name"       TEXT        NOT NULL,
          "content"    TEXT        NOT NULL,
          "isDefault"  BOOLEAN     NOT NULL DEFAULT false,
          "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ResponseTemplate_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "ResponseTemplate_businessId_fkey"
            FOREIGN KEY ("businessId")
            REFERENCES "Business"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE
        )
      `,
    },
  ];

  let ok = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await sql(stmt.query);
      console.log(`  ✓  ${stmt.name}`);
      ok++;
    } catch (err) {
      if (
        err.message?.includes('already exists') ||
        err.message?.includes('duplicate column')
      ) {
        console.log(`  ~  ${stmt.name} (already exists, skipped)`);
        ok++;
      } else {
        console.error(`  ✗  ${stmt.name}`);
        console.error(`     ${err.message}\n`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
