import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const { Pool } = pg;

dotenv.config();
try {
    const p = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        console.log('Loaded .env.local');
    } else {
        console.log('.env.local not found, using .env');
    }
} catch (e) {
    console.log('Error loading .env.local:', e.message);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
    console.log('Connecting to:', process.env.PGHOST || 'localhost');
    try {
        const client = await pool.connect();
        console.log('Successfully connected to the database!');

        console.log('\nListing tables:');
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        if (res.rows.length === 0) {
            console.log('No tables found in the public schema.');
        } else {
            res.rows.forEach(row => console.log(`- ${row.table_name}`));
        }

        client.release();
    } catch (err) {
        console.error('Connection error:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.hint) console.error('Hint:', err.hint);
    } finally {
        await pool.end();
    }
}

testConnection();
