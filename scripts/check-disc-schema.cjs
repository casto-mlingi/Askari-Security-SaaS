const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
    const { rows } = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'disciplinary_records' ORDER BY ordinal_position;
  `);
    console.table(rows);
    // Also get a sample row
    const { rows: sample } = await pool.query('SELECT * FROM disciplinary_records LIMIT 2');
    console.log('Sample rows:', JSON.stringify(sample, null, 2));
    pool.end();
}
main().catch(e => { console.error(e); pool.end(); });
