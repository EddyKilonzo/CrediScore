import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const sql = neon(process.env.DATABASE_URL);

console.log('Adding mpesaCode and mpesaVerified columns to Review table...');

try {
  await sql`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "mpesaCode" TEXT`;
  console.log('  ✓  mpesaCode column added');
} catch (err) {
  console.error('  ✗  mpesaCode:', err.message);
}

try {
  await sql`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "mpesaVerified" BOOLEAN NOT NULL DEFAULT false`;
  console.log('  ✓  mpesaVerified column added');
} catch (err) {
  console.error('  ✗  mpesaVerified:', err.message);
}

console.log('\nDone.');
