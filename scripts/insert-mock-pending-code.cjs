const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    try {
        const res = await pool.query(`
      INSERT INTO disciplinary_codes (code, description, points, is_ai_generated, is_approved)
      VALUES (
        'AI_LATE_SLEEP_01', 
        'AI generated policy based on historic multiple guard sleep incidents.', 
        25, 
        true, 
        false
      )
      ON CONFLICT (code) DO NOTHING
      RETURNING *;
    `);
        console.log("Inserted mock pending code:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

main();
