const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.join(process.cwd(), '.env');
const envLocalPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) process.env[k] = envConfig[k];
}
if (fs.existsSync(envLocalPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const tables = ['users', 'next_of_kin', 'profiles', 'guards', 'guarantors'];
    for (const t of tables) {
        try {
            const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [t]);
            console.log(`${t} columns:`, JSON.stringify(res.rows.map(r => r.column_name)));
        } catch (e) {
            console.error(`Error ${t}:`, e.message);
        }
    }
    await pool.end();
}
run();
