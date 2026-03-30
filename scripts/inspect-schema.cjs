const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
});

async function inspectSchema() {
    const tables = ['guards'];
    for (const table of tables) {
        try {
            console.log(`--- Schema for ${table} ---`);
            const res = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
            res.rows.forEach(row => {
                console.log(`${row.column_name}: ${row.data_type}`);
            });
        } catch (err) {
            console.error(`Error inspecting ${table}:`, err.message);
        }
    }
    await pool.end();
}

inspectSchema();
