const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: String(process.env.PGSSL || '').toLowerCase() === 'require'
        ? { rejectUnauthorized: false }
        : undefined
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'amini_db',
      ssl: String(process.env.PGSSL || '').toLowerCase() === 'require'
        ? { rejectUnauthorized: false }
        : undefined
    });

const sql = `
WITH d AS (
  SELECT id FROM (
    SELECT id, TRIM(nida_number) AS n,
           ROW_NUMBER() OVER (PARTITION BY TRIM(nida_number) ORDER BY created_at NULLS FIRST, id) AS rn
    FROM guards
    WHERE nida_number IS NOT NULL AND TRIM(nida_number) <> ''
  ) q WHERE q.rn > 1
)
DELETE FROM guards g USING d WHERE g.id = d.id;
DO $$
BEGIN
  BEGIN
    ALTER TABLE guards ADD CONSTRAINT unique_nida UNIQUE (nida_number);
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Failed to add unique_nida: %', SQLERRM;
  END;
END $$;
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('unique_nida_applied');
    process.exit(0);
  } catch (e) {
    console.error('apply_failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
