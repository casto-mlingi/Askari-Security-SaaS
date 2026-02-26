const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
});

async function inspectSchema() {
    const tables = ['users'];
    for (const table of tables) {
        try {
            const res = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
            console.log(JSON.stringify(res.rows.map(row => row.column_name)));
        } catch (err) {
            console.error(`Error inspecting ${table}:`, err.message);
        }
    }
    await pool.end();
}

inspectSchema();
