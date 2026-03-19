import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import ws from 'ws';

config(); // load .env

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, 'neon_schema.sql'), 'utf-8');

// Split into individual statements by semicolons (skip comment-only lines)
const statements = schemaSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.replace(/--[^\n]*/g, '').trim().startsWith('\n\n'));

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const client = await pool.connect();

console.log(`Pushing schema — ${statements.length} statements…\n`);

let ok = 0, skipped = 0, failed = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i].replace(/^(\s*--[^\n]*\n)*/g, '').trim();
  if (!stmt) { skipped++; continue; }
  const preview = stmt.replace(/\n\s*/g, ' ').slice(0, 70);
  try {
    await client.query(stmt);
    console.log(`  ✓  ${preview}`);
    ok++;
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log(`  ~  ${preview} (already exists)`);
      skipped++;
    } else {
      console.error(`  ✗  ${preview}`);
      console.error(`     ${err.message}\n`);
      failed++;
    }
  }
}

client.release();
await pool.end();

console.log(`\nDone: ${ok} created, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) process.exit(1);
