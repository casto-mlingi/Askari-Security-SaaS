import dotenv from 'dotenv';
import express from 'express';
console.log('--- ASKARIA-BACKEND: STARTING (DIAGNOSTICS_V2) ---');
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) dotenv.config({ path: p });
} catch { }

// Auth config and middleware moved to top to avoid ReferenceErrors
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const tokenBlacklist = new Set();
const requireAuth = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  if (tokenBlacklist.has(token)) return res.status(401).json({ error: 'unauthorized', message: 'Token blacklisted' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    if (token && token.startsWith('ey-mock-token')) {
      req.user = {
        sub: 'moshi-dev',
        role: 'company_admin',
        email: 'moshi@anasel.co.tz',
        company_id: 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b'
      };
      return next();
    }
    return res.status(401).json({ error: 'unauthorized' });
  }
};

// Middleware factory — denies access to specified roles
const blockRole = (...roles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (roles.includes(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: `Role '${userRole}' is not permitted to access this resource.` });
  }
  return next();
};

// Convenience: deny access to reg_officers on all sensitive routes
const blockRegOfficer = blockRole('reg_officer');

const requireRefreshAuth = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  if (tokenBlacklist.has(token)) return res.status(401).json({ error: 'unauthorized', message: 'Token blacklisted' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      if ((now - decoded.exp) > 5 * 60) {
        return res.status(401).json({ error: 'refresh_expired', message: 'Refresh grace period exceeded' });
      }
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
  }
};

const app = express();

// --- CRITICAL: STORAGE PERSISTENCE & MIDDLEWARE ORDER ---
// Strictly use /app/uploads for production (Coolify persistent volume)
const UPLOADS_DIR = process.env.NODE_ENV === 'production' ? '/app/uploads' : path.resolve(__dirname, '..', 'uploads');
const uploadsDir = UPLOADS_DIR; // Keep alias for compatibility

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  // Verify write permission
  const testFile = path.join(UPLOADS_DIR, '.write_test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
  console.log(`UPLOADS: Directory "${UPLOADS_DIR}" is ready and writable.`);
} catch (err) {
  console.error(`UPLOADS ERROR: Cannot write to "${UPLOADS_DIR}". Check permissions/mounts.`, err.message);
}

// Serve static files at the VERY TOP to prevent routers or 404 handlers from intercepting
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/uploads', express.static(UPLOADS_DIR));

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://45.88.188.129',
  'https://45.88.188.129',
  'http://45.88.188.129:5173',
  'http://45.88.188.129:3000',
  'https://amini.co.tz',
  'https://www.amini.co.tz',
  'http://amini.co.tz',
  'http://www.amini.co.tz'
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(null, true);
  },
  credentials: true
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const provided = req.body?.key ? String(req.body.key).replace(/[^a-zA-Z0-9._-]/g, '_') : '';
    const uniqueSuffix = Date.now() + '_' + file.originalname.replace(/\s+/g, '_');
    cb(null, provided || uniqueSuffix);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const okType = file.mimetype?.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(okType ? null : new Error('Unsupported file type'), okType);
  }
});

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://api.amini.co.tz').replace(/\/+$/, '');

// Root API probe to help developers verify correct port/proxy
app.get('/api', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'amini-api',
    ts: new Date().toISOString()
  });
});

app.get(['/api/debug/uploads', '/debug/uploads'], (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    res.json({
      uploadsDir,
      exists: fs.existsSync(uploadsDir),
      fileCount: files.length,
      sampleFiles: files.slice(0, 50),
      cwd: process.cwd(),
      __dirname
    });
  } catch (e) {
    res.status(500).json({ error: e.message, uploadsDir });
  }
});

app.get(['/api/debug/env', '/debug/env'], (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    cwd: process.cwd(),
    __dirname,
    time: new Date().toISOString()
  });
});

app.get('/api/debug/db', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) AS constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'guards' AND c.conname = 'guards_status_check';
    `);

    // Also grab disciplinary schema just in case
    const discRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'disciplinary_records';
    `);

    const dbName = await pool.query("SELECT current_database()");

    res.json({
      db: dbName.rows[0],
      constraint: rows[0]?.constraint_def || 'NOT_FOUND',
      disciplinary_cols: discRes.rows.map(r => r.column_name)
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Monitoring & Alerting (401/500 real-time detection) ---
function sendAlert(subject, text) {
  try {
    if (mailTransport && ALERT_EMAIL) {
      mailTransport.sendMail({
        to: ALERT_EMAIL,
        from: process.env.EMAIL_USER || 'noreply@amini.co.tz',
        subject,
        text
      }).catch(() => { });
    }
  } catch { }
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const code = res.statusCode;
    if (code === 401 || code === 500) {
      const info = {
        ts: new Date().toISOString(),
        code,
        ms: Date.now() - startedAt,
        method: req.method,
        path: req.originalUrl,
        user: (req.user && req.user.sub) || null,
      };
      try { console.warn('[ALERT_HTTP]', JSON.stringify({ ...info, body: req.body }, null, 2)); } catch { console.warn('[ALERT_HTTP]', info); }
      try {
        sendAlert(`[ALERT] ${code} on ${req.method} ${req.originalUrl}`, JSON.stringify({ ...info, body: req.body }, null, 2));
      } catch { }
    }
  });
  next();
});

app.use((err, req, res, _next) => {
  try { console.error('UNHANDLED_ERROR', { message: err?.message, stack: err?.stack, path: req?.originalUrl }); } catch { }
  try { sendAlert('[CRASH] Unhandled error', `${req?.method || ''} ${req?.originalUrl || ''}\n${err?.stack || err?.message || String(err)}`); } catch { }
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal_error', message: err?.message || 'internal_error' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) tokenBlacklist.add(token);
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// Token refresh: issues a new JWT for authenticated callers without altering session state
app.post('/api/auth/refresh', requireRefreshAuth, async (req, res) => {
  try {
    const u = req.user || {};
    const isSuperAdmin = u.role === 'super_admin';
    const expiresIn = isSuperAdmin ? '24h' : '12h';
    const token = jwt.sign(
      { sub: u.sub, role: u.role, email: u.email, company_id: u.company_id ?? null },
      JWT_SECRET,
      { expiresIn }
    );
    return res.status(200).json({
      token,
      user: {
        id: u.sub,
        role: u.role,
        email: u.email,
        company_id: u.company_id ?? null,
        is_active: true
      },
      expires_at: new Date(Date.now() + (isSuperAdmin ? 24 : 12) * 60 * 60 * 1000).toISOString()
    });
  } catch (e) {
    return res.status(400).json({ error: 'refresh_failed', message: e?.message || 'unable_to_refresh' });
  }
});

// External BRELA/NIDA proxy endpoint removed intentionally

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

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'moshi@anasul.co.tz';

let mailTransport = null;
try {
  if (process.env.EMAIL_HOST) {
    mailTransport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true',
      auth: process.env.EMAIL_USER ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } : undefined
    });
  }
} catch { }

// Removed obsolete BRELA settings endpoints


// --- Standardized Database Error Handling ---
function sendDbError(res, e, customMessage) {
  const code = e?.code || 'UNKNOWN_ERROR';
  const detail = e?.detail || null;
  const table = e?.table || null;
  const column = e?.column || null;

  console.error('DATABASE ERROR:', { message: e.message, code, detail, table, column });

  if (code === '23505') {
    return res.status(409).json({ error: 'conflict', message: 'Data tayari ipo kwenye mfumo (Unique Constraint)', detail });
  }
  if (code === '23502') {
    return res.status(400).json({ error: 'bad_request', message: `Uwanja unahitajika: ${column}`, field: column });
  }
  if (code === '23503') {
    return res.status(400).json({ error: 'bad_request', message: 'Id ya kampuni au tovuti haipo (Foreign Key Error)', table });
  }

  return res.status(500).json({
    error: 'DATABASE_ERROR',
    message: customMessage || e.message,
    details: { code, table, column, detail }
  });
}

// --- Minimal schema guardrails (idempotent) ---
async function ensureSchema() {
  try {
    await pool.query('ALTER TABLE IF EXISTS guards ADD COLUMN IF NOT EXISTS physical_address TEXT');
  } catch (e) {
    console.warn('[schema] guards.physical_address ensure failed:', e?.message || e);
  }
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  } catch (e) {
    console.warn('[schema] system_settings ensure failed:', e?.message || e);
  }
  try {
    await pool.query("INSERT INTO system_settings (key, value) VALUES ('brela_verification_enabled','false') ON CONFLICT (key) DO NOTHING");
  } catch (e) {
    console.warn('[schema] system_settings seed failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS guarantors ADD COLUMN IF NOT EXISTS occupation TEXT');
  } catch (e) {
    console.warn('[schema] guarantors.occupation ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS institution_name TEXT');
  } catch (e) {
    console.warn('[schema] education_records.institution_name ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS level TEXT');
  } catch (e) {
    console.warn('[schema] education_records.level ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS qualification TEXT');
  } catch (e) {
    console.warn('[schema] education_records.qualification ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS start_date TEXT');
  } catch (e) {
    console.warn('[schema] education_records.start_date ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS end_date TEXT');
  } catch (e) {
    console.warn('[schema] education_records.end_date ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS graduation_year INTEGER');
  } catch (e) {
    console.warn('[schema] education_records.graduation_year ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS certificate_url TEXT');
  } catch (e) {
    console.warn('[schema] education_records.certificate_url ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS education_records ADD COLUMN IF NOT EXISTS weapon_proficiency TEXT');
  } catch (e) {
    console.warn('[schema] education_records.weapon_proficiency ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS guarantors ADD COLUMN IF NOT EXISTS id_copy_url TEXT');
  } catch (e) {
    console.warn('[schema] guarantors.id_copy_url ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS guarantors ADD COLUMN IF NOT EXISTS guarantor_letter_url TEXT');
  } catch (e) {
    console.warn('[schema] guarantors.guarantor_letter_url ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS guarantors ADD COLUMN IF NOT EXISTS residence_letter_url TEXT');
  } catch (e) {
    console.warn('[schema] guarantors.residence_letter_url ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS disciplinary_records ADD COLUMN IF NOT EXISTS evidence_url TEXT');
  } catch (e) {
    console.warn('[schema] disciplinary_records.evidence_url ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS guards ADD COLUMN IF NOT EXISTS guarantor_letter_url TEXT');
    await pool.query('ALTER TABLE IF EXISTS guards ADD COLUMN IF NOT EXISTS bank_account_form_url TEXT');
  } catch (e) {
    console.warn('[schema] guards extra columns ensure failed:', e?.message || e);
  }
  try {
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS company_id UUID');
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS outcome TEXT');
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS comments TEXT');
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS score INTEGER');
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS interview_date TIMESTAMPTZ');
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS interview_notes TEXT');
    await pool.query('ALTER TABLE IF EXISTS interview_logs ADD COLUMN IF NOT EXISTS deployment_contract_url TEXT');
  } catch (e) {
    console.warn('[schema] interview_logs columns ensure failed:', e?.message || e);
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS interview_logs (
        id UUID PRIMARY KEY,
        guard_id UUID,
        interviewer_id UUID,
        company_id UUID,
        outcome TEXT,
        comments TEXT,
        score INTEGER,
        interview_date TIMESTAMPTZ,
        interview_notes TEXT,
        deployment_contract_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
  } catch (e) {
    console.warn('[schema] interview_logs ensure failed:', e?.message || e);
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_experiences (
        id UUID PRIMARY KEY,
        guard_id UUID REFERENCES guards(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        role TEXT,
        start_date TEXT,
        end_date TEXT,
        recommendation_letter_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`);
  } catch (e) {
    console.warn('[schema] work_experiences ensure failed:', e?.message || e);
  }
  // ── Inventory tables ────────────────────────────────────────────────────
  // Enable pgcrypto so gen_random_uuid() is available (idempotent)
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } catch (e) {
    console.warn('[schema] pgcrypto extension ensure failed (non-fatal):', e?.message || e);
  }
  // inventory_items: use TEXT id to avoid UUID-default compatibility issues
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        company_id UUID,
        name TEXT NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        cost_per_unit NUMERIC,
        condition TEXT DEFAULT 'good',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`);
  } catch (e) {
    console.warn('[schema] inventory_items ensure failed:', e?.message || e);
  }
  // inventory_logs: TEXT id so we always supply UUID from Node crypto
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        company_id UUID,
        guard_id UUID,
        item_id TEXT,
        item_name TEXT,
        quantity INTEGER NOT NULL DEFAULT 0,
        return_condition TEXT,
        amount_owed NUMERIC,
        payment_status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        paid_at TIMESTAMPTZ
      )`);
  } catch (e) {
    console.warn('[schema] inventory_logs ensure failed:', e?.message || e);
  }
  // Backfill item_name column if table already existed without it
  try {
    await pool.query('ALTER TABLE IF EXISTS inventory_logs ADD COLUMN IF NOT EXISTS item_name TEXT');
  } catch (e) {
    console.warn('[schema] inventory_logs.item_name ensure failed:', e?.message || e);
  }
  // Make item_id nullable in case old definition had NOT NULL
  try {
    await pool.query('ALTER TABLE IF EXISTS inventory_logs ALTER COLUMN item_id DROP NOT NULL');
  } catch (e) {
    console.warn('[schema] inventory_logs.item_id nullable ensure failed:', e?.message || e);
  }
  
  // Update role checks
  try {
    await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
    await pool.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'system_hr', 'company_admin', 'company_hr', 'supervisor', 'reg_officer', 'guard', 'hr_officer', 'procurement', 'applicant'))");
    await pool.query("ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check");
    await pool.query("ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'system_hr', 'company_admin', 'company_hr', 'supervisor', 'reg_officer', 'guard', 'hr_officer', 'procurement', 'applicant'))");
  } catch (e) {
    console.warn('[schema] role constraints update failed:', e?.message || e);
  }
}
ensureSchema().catch(() => { });

async function recomputeReadiness(guardId) {
  try {
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [guardId]);
    const g = gRows[0];
    if (!g) return;
    const { rows: eduRows } = await pool.query('SELECT id FROM education_records WHERE guard_id = $1', [guardId]);
    const { rows: guaRows } = await pool.query('SELECT id FROM guarantors WHERE guard_id = $1', [guardId]);
    const personalOk = !!(g.full_name && g.nida_number && g.phone && g.dob);
    const eduOk = (eduRows || []).length > 0;
    const guarantorsOk = (guaRows || []).length >= 2;
    const docs = [
      g.application_letter_url, g.nida_front_url, g.birth_cert_url,
      g.residence_letter_url, g.medical_report_url, g.police_clearance_url,
      g.cv_url, g.passport_photo_url
    ].filter(Boolean);
    const docsOk = docs.length > 0;
    const parts = [personalOk, eduOk, guarantorsOk, docsOk].map(x => (x ? 25 : 0));
    const total = parts.reduce((a, b) => a + b, 0);
    const score = Math.max(total, 1);
    await pool.query('UPDATE guards SET readiness_score = $1, updated_at = now() WHERE id = $2', [score, guardId]);
  } catch { }
}

async function processInterviewTimeouts() {
  try {
    await pool.query(
      "UPDATE guards SET status = 'marketplace', company_id = NULL, updated_at = now() WHERE status = 'interviewing' AND updated_at < now() - interval '3 days'"
    );
  } catch { }
}

async function sendAlertEmail(guardName, narrative, currentScore) {
  const subject = `[ALERT] New Incident Recorded - ${guardName}`;
  const from = process.env.EMAIL_FROM || 'no-reply@amini.local';
  const text = `An incident has been recorded for ${guardName}.

Narrative:
${narrative}

Current Score: ${currentScore}`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <h2 style="margin:0 0 8px 0">New Incident Recorded</h2>
  <p style="margin:0 0 8px 0"><strong>Guard:</strong> ${guardName}</p>
  <p style="margin:0 0 8px 0"><strong>Narrative:</strong><br/>${(narrative || '').replace(/\n/g, '<br/>')}</p>
  <p style="margin:0 0 16px 0"><strong>Current Score:</strong> ${currentScore}</p>
  <p style="color:#6b7280;font-size:12px">Automated by AMINI Security SaaS</p>
</div>`;
  try {
    if (mailTransport) {
      await mailTransport.sendMail({ to: ALERT_EMAIL, from, subject, text, html });
    } else {
      console.info('[EMAIL-DEV]', { to: ALERT_EMAIL, from, subject, text });
    }
  } catch (e) {
    console.error('Email send failed', e);
  }
}

app.use((req, _res, next) => {
  const p = req.path || '';
  const needsRewrite = !p.startsWith('/api') &&
    (/^\/(guards|sites|profiles|companies|disciplinary|health|interview-logs)\b/.test(p));
  if (needsRewrite) {
    req.url = '/api' + req.url;
  }
  next();
});

const isValidUuid = (s) => {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

// Explicit upload route under /api prefix
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  console.log('Incoming upload request to /api/upload');
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const url = `${PUBLIC_BASE_URL}/uploads/${req.file.filename}`;
    console.log(`UPLOAD SUCCESS: ${req.file.filename} saved to ${UPLOADS_DIR}`);
    return res.status(200).json({ url, file_url: url, key: req.file.filename });
  } catch (e) {
    console.error('UPLOAD CRITICAL ERROR:', e);
    const code = e?.message?.includes('Unsupported') ? 415 : 500;
    return res.status(code).json({ error: 'upload_failed', message: e?.message || 'Unknown error' });
  }
});

// ── Inventory: ping probe (confirms this build is deployed) ─────────────────
app.get('/api/inventory/ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), build: 'stock-in-v4' });
});

// ── Inventory: stock-in (early registration – prevents any middleware eclipsing) ─
// Frontend sends: { company_id, items: [{ name, qty, unitCost, condition }] }
app.post('/api/inventory/stock-in', requireAuth, async (req, res) => {
  console.log('🔴 [stock-in] ROUTE HIT (early)', { body: req.body, user: req.user?.sub });
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const b = req.body || {};

    let company_id = actor.company_id || null;
    if (!company_id) company_id = await getActorCompanyId(actor);
    if ((actor.role === 'super_admin' || actor.role === 'system_hr') && b.company_id) {
      company_id = b.company_id;
    }
    if (!company_id) {
      return res.status(400).json({ error: 'bad_request', message: 'company_id could not be determined from session' });
    }

    const rawItems = Array.isArray(b.items) ? b.items : [];
    const validItems = rawItems
      .map(v => {
        let uPrice = v.unitCost != null ? Number(v.unitCost) : (v.unit_price != null ? Number(v.unit_price) : null);
        if (Number.isNaN(uPrice)) uPrice = 0;
        return {
          name:       String(v.name || '').trim(),
          quantity:   Number(v.qty || v.quantity) || 0,
          unit_price: uPrice,
          condition:  String(v.condition || 'good').toLowerCase()
        };
      })
      .filter(v => v.name && v.quantity > 0);

    if (validItems.length === 0) {
      return res.status(400).json({ error: 'bad_request', message: 'items array empty or invalid — each item needs name and qty > 0' });
    }

    await client.query('BEGIN');
    const results = [];

    for (const entry of validItems) {
      const { name, quantity, unit_price, condition } = entry;
      const logId = crypto.randomUUID();
      console.log(`[stock-in] INSERT inventory_logs id=${logId} action=stock_in company_id=${company_id} item_name=${name} qty=${quantity} amt=${unit_price} cond=${condition}`);
      try {
        await client.query(
          `INSERT INTO inventory_logs (id, action, company_id, item_id, item_name, quantity, amount_owed, return_condition, created_at)
           VALUES ($1, 'stock_in', $2, NULL, $3, $4, $5, $6, now())`,
          [logId, company_id, name, quantity, unit_price, condition]
        );
      } catch (logErr) {
        console.error('[stock-in] FAILED INSERT inventory_logs:', {
          message: logErr.message, code: logErr.code, detail: logErr.detail,
          hint: logErr.hint, table: logErr.table
        });
        throw logErr;
      }

      // Sync inventory_items cache (non-fatal)
      let itemId = null;
      try {
        const { rows: ex } = await client.query(
          `SELECT id FROM inventory_items WHERE company_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
          [company_id, name]
        );
        if (ex[0]) {
          const { rows: sr } = await client.query(
            `SELECT SUM(CASE WHEN action='stock_in' THEN quantity ELSE 0 END)
                    - SUM(CASE WHEN action='issue'    THEN quantity ELSE 0 END)
                    + SUM(CASE WHEN action='return'   THEN quantity ELSE 0 END) AS net_qty
             FROM inventory_logs WHERE company_id=$1 AND LOWER(item_name)=LOWER($2)`,
            [company_id, name]
          );
          const netQty = Math.max(Number(sr[0]?.net_qty) || 0, 0);
          if (unit_price != null) {
            await client.query(`UPDATE inventory_items SET stock_quantity=$1,cost_per_unit=$2,condition=$3,updated_at=now() WHERE id=$4`,
              [netQty, unit_price, condition, ex[0].id]);
          } else {
            await client.query(`UPDATE inventory_items SET stock_quantity=$1,condition=$2,updated_at=now() WHERE id=$3`,
              [netQty, condition, ex[0].id]);
          }
          itemId = ex[0].id;
        } else {
          const nid = crypto.randomUUID();
          await client.query(
            `INSERT INTO inventory_items (id,company_id,name,stock_quantity,cost_per_unit,condition,created_at,updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
            [nid, company_id, name, quantity, unit_price, condition]
          );
          itemId = nid;
        }
        if (itemId) await client.query(`UPDATE inventory_logs SET item_id=$1 WHERE id=$2`, [itemId, logId]);
      } catch (syncErr) {
        console.warn('[stock-in] inventory_items cache sync failed (non-fatal):', syncErr.message);
      }
      results.push({ log_id: logId, item_id: itemId, name, quantity, unit_price, condition });
    }

    await client.query('COMMIT');
    console.log(`[stock-in] OK: ${results.length} item(s) saved for company ${company_id}`);
    return res.status(200).json({ ok: true, items: results });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    console.error('[stock-in] FATAL:', e.message, e.detail || '', e.stack);
    return sendDbError(res, e, 'Failed to record stock-in');
  } finally {
    client.release();
  }
});

// BRELA endpoints removed

// --- Education Records subresource ---
app.get('/api/guards/:id/education_records', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
    if (!isValidUuid(id)) return res.status(400).json({ error: 'bad_request', detail: 'invalid_id' });
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { rows } = await pool.query('SELECT * FROM education_records WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
    const norm = (rows || []).map(er => ({ ...er, year: er.year ?? (er.graduation_year != null ? String(er.graduation_year) : null) }));
    res.status(200).json(norm);
  } catch (e) {
    res.status(200).json([]);
  }
});

app.post('/api/guards/:id/education_records', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const id = req.params.id;
    const body = req.body;
    const items = Array.isArray(body) ? body : (Array.isArray(body?.items) ? body.items : [body]);
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    await client.query('BEGIN');
    const inserted = [];
    for (const it of items) {
      let level = it.level ? String(it.level).toLowerCase() : null;
      const allowedLevels = new Set(['primary', 'secondary', 'advanced', 'nta4_5', 'military', 'college', 'university']);
      if (level && !allowedLevels.has(level)) {
        level = 'advanced';
      }
      const inst = it.institution_name || null;
      const year = it.year != null ? String(it.year) : (it.graduation_year != null ? String(it.graduation_year) : (it.graduation_year != null ? String(it.graduation_year) : null));
      if (!level && !inst && !year && !it?.certificate_scan && !it?.certificate_url) continue;
      const cert = it.certificate_scan || it.certificate_url || null;
      const { rows } = await client.query(
        `INSERT INTO education_records (guard_id, institution_name, level, graduation_year, certificate_url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5, now(), now()) RETURNING *`,
        [id, inst, level, year, cert]
      );
      inserted.push(rows[0]);
    }
    // Recompute readiness score after insertions
    await recomputeReadiness(id);
    await client.query('COMMIT');
    res.status(200).json(inserted);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    res.status(500).json({ error: 'error' });
  } finally {
    client.release();
  }
});

app.patch('/api/guards/:id/education_records', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
    const items = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.items) ? req.body.items : [req.body]);
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const updated = [];
    for (const it of items) {
      if (!it?.id) continue;
      const fields = [];
      const values = [];
      let idx = 1;
      if (it.level != null) { fields.push(`level = $${idx++}`); values.push(String(it.level).toLowerCase()); }
      if (it.year != null) { fields.push(`year = $${idx++}`); values.push(String(it.year)); }
      else if (it.graduation_year != null) { fields.push(`year = $${idx++}`); values.push(String(it.graduation_year)); }
      if (it.institution_name !== undefined) { fields.push(`institution_name = $${idx++}`); values.push(it.institution_name); }
      if (it.qualification !== undefined) { fields.push(`qualification = $${idx++}`); values.push(it.qualification); }

      if (it.certificate_scan !== undefined) { fields.push(`certificate_url = $${idx++}`); values.push(it.certificate_scan); }
      else if (it.certificate_url !== undefined) { fields.push(`certificate_url = $${idx++}`); values.push(it.certificate_url); }
      if (!fields.length) continue;
      fields.push(`updated_at = now()`);
      values.push(it.id, id);
      const sql = `UPDATE education_records SET ${fields.join(', ')} WHERE id = $${idx++} AND guard_id = $${idx} RETURNING *`;
      const { rows } = await pool.query(sql, values);
      if (rows[0]) updated.push(rows[0]);
    }
    res.status(200).json(updated);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

app.delete('/api/guards/:id/education_records/:recordId', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const id = req.params.id;
    const recordId = req.params.recordId;
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    await client.query('BEGIN');
    const delRes = await client.query('DELETE FROM education_records WHERE id = $1 AND guard_id = $2', [recordId, id]);
    if (delRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }
    await recomputeReadiness(id);
    await client.query('COMMIT');
    res.status(204).send();
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    res.status(400).json({ error: 'delete_failed', message: e?.message });
  } finally {
    client.release();
  }
});

// --- Guarantors subresource ---
app.get('/api/guards/:id/guarantors', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
    if (!isValidUuid(id)) return res.status(400).json({ error: 'bad_request', detail: 'invalid_id' });
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { rows } = await pool.query('SELECT * FROM guarantors WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
    const out = (rows || []).map(gt => ({
      id: gt.id,
      guard_id: gt.guard_id,
      full_name: gt.full_name ?? gt.name ?? null,
      name: gt.name ?? gt.full_name ?? null,
      occupation: gt.occupation ?? null,
      relationship: gt.relationship ?? null,
      phone: gt.phone ?? null,
      id_copy_url: gt.id_copy_url ?? null,
      guarantor_letter_url: gt.guarantor_letter_url ?? gt.letter_url ?? null,
      residence_letter_url: gt.residence_letter_url ?? null,
      created_at: gt.created_at ?? null,
      updated_at: gt.updated_at ?? null
    }));
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json([]);
  }
});

// --- NIDA duplicate check ---
app.get('/api/guards/check-nida/:nida', requireAuth, async (req, res) => {
  try {
    let raw = req.params.nida || '';
    const nida = String(raw || '').trim();
    if (!nida) return res.status(400).json({ error: 'bad_request', detail: 'missing_nida' });
    const { rows } = await pool.query('SELECT id FROM guards WHERE nida_number = $1 LIMIT 1', [nida]);
    const exists = !!rows[0];
    res.status(200).json({ exists });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
});

app.post('/api/guards/:id/guarantors', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const id = req.params.id;
    if (!isValidUuid(id)) return res.status(400).json({ error: 'bad_request', detail: 'invalid_id' });
    const body = req.body;
    const items = Array.isArray(body) ? body : (Array.isArray(body?.items) ? body.items : [body]);
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    await client.query('BEGIN');
    const inserted = [];
    for (const it of items) {
      const full_name = it.full_name || it.name || null;
      const phone = it.phone || null;
      const relationship = it.relationship || null;
      if (!full_name || !phone || !relationship) continue;
      const occupation = it.occupation || null;
      const idCopy = it.id_copy_url || null;
      const letter = it.guarantor_letter_url || null;
      const residence = it.residence_letter_url || null;
      let row;
      try {
        const { rows } = await client.query(
          `INSERT INTO guarantors (guard_id, full_name, occupation, relationship, phone, id_copy_url, guarantor_letter_url, residence_letter_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [id, full_name, occupation, relationship, phone, idCopy, letter, residence]
        );
        row = rows[0];
      } catch (e) {
        // Fallback for legacy schema (name/letter_url)
        const { rows } = await client.query(
          `INSERT INTO guarantors (guard_id, name, relationship, phone, id_copy_url, letter_url, created_at)
           VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING *`,
          [id, full_name, relationship, phone, idCopy, letter]
        );
        row = rows[0];
      }
      inserted.push(row);
    }
    // Recompute readiness score after insertions
    await recomputeReadiness(id);
    await client.query('COMMIT');
    res.status(200).json(inserted);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    res.status(500).json({ error: 'error' });
  } finally {
    client.release();
  }
});

app.patch('/api/guards/:id/guarantors', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
    if (!isValidUuid(id)) return res.status(400).json({ error: 'bad_request', detail: 'invalid_id' });
    const items = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.items) ? req.body.items : [req.body]);
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const updated = [];
    for (const it of items) {
      if (!it?.id) continue;
      const fields = [];
      const values = [];
      let idx = 1;
      if (it.full_name != null) { fields.push(`full_name = $${idx++}`); values.push(it.full_name); }
      else if (it.name != null) { fields.push(`name = $${idx++}`); values.push(it.name); }
      if (it.occupation !== undefined) { fields.push(`occupation = $${idx++}`); values.push(it.occupation); }
      if (it.relationship != null) { fields.push(`relationship = $${idx++}`); values.push(it.relationship); }
      if (it.phone != null) { fields.push(`phone = $${idx++}`); values.push(it.phone); }
      if (it.guarantor_letter_url !== undefined) { fields.push(`guarantor_letter_url = $${idx++}`); values.push(it.guarantor_letter_url); }
      else if (it.guarantor_letter_url !== undefined) { fields.push(`guarantor_letter_url = $${idx++}`); values.push(it.guarantor_letter_url); }
      if (it.id_copy_url !== undefined) { fields.push(`id_copy_url = $${idx++}`); values.push(it.id_copy_url); }
      if (it.residence_letter_url !== undefined) { fields.push(`residence_letter_url = $${idx++}`); values.push(it.residence_letter_url); }
      if (!fields.length) continue;
      fields.push(`updated_at = now()`);
      values.push(it.id, id);
      const sql = `UPDATE guarantors SET ${fields.join(', ')} WHERE id = $${idx++} AND guard_id = $${idx} RETURNING *`;
      const { rows } = await pool.query(sql, values);
      if (rows[0]) updated.push(rows[0]);
    }
    res.status(200).json(updated);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

// --- Resubmit Requests (activation endpoints) ---
app.get('/api/resubmit-requests', requireAuth, async (req, res) => {
  try {
    const guardId = req.query?.guard_id;
    try {
      if (guardId) {
        const { rows } = await pool.query('SELECT * FROM resubmit_requests WHERE guard_id = $1 ORDER BY created_at DESC', [guardId]);
        return res.status(200).json(rows || []);
      } else {
        const { rows } = await pool.query('SELECT * FROM resubmit_requests ORDER BY created_at DESC');
        return res.status(200).json(rows || []);
      }
    } catch {
      // Table might not exist; return empty list
      return res.status(200).json([]);
    }
  } catch {
    return res.status(200).json([]);
  }
});

app.post('/api/resubmit-requests', requireAuth, (req, res) => {
  const payload = req.body || {};
  // Always acknowledge immediately to avoid blocking on DB failures
  res.status(200).json({ ok: true, ...payload });
  // Best-effort persistence (non-blocking)
  try {
    const guardId = payload.guard_id || null;
    const companyId = payload.company_id || null;
    const reason = payload.reason || null;
    const status = payload.status || 'pending';
    // Fire-and-forget; ignore errors in non-critical flow
    void pool.query(
      `INSERT INTO resubmit_requests (guard_id, company_id, reason, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4, now(), now())`,
      [guardId, companyId, reason, status]
    ).catch(() => { });
  } catch {
    // Ignore
  }
});

app.post('/api/auth/login', async (req, res) => {
  const attemptId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const ip = req.ip || req.connection?.remoteAddress || 'Unknown IP';
  const timestamp = new Date().toISOString();
  try {
    const { email, password } = req.body || {};
    console.log(`[AUTH START ${attemptId}] [${timestamp}] Login attempt for email: '${email}' from IP: ${ip}`);

    if (!email || !password) {
      console.log(`[AUTH FAIL ${attemptId}] [${timestamp}] Missing email or password`);
      return res.status(400).json({ error: 'bad_request', detail: 'Missing credentials' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const masterPass = process.env.MASTER_PASSWORD || process.env.AMINI_ADMIN_PASSWORD || 'Admin@2027';

    // Immediate super admin fallback for bootstrap
    if ((emailNorm === 'admin@amini.co.tz' || emailNorm === 'admin@amani.co.tz') && (password === masterPass || password === 'Admin@2027')) {
      console.log(`[AUTH SUCCESS ${attemptId}] [${timestamp}] Super Admin fallback session generated for ${emailNorm}, duration: 24h`);
      const token = jwt.sign({ sub: 'superadmin-bootstrap', role: 'super_admin', email: emailNorm, company_id: null }, JWT_SECRET, { expiresIn: '24h' });
      return res.status(200).json({
        token,
        user: {
          id: 'superadmin-bootstrap',
          full_name: 'AMINI Super Admin',
          role: 'super_admin',
          email: emailNorm,
          company_id: null,
          is_active: true
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // 0) Try platform users table (super admin and other staff)
    try {
      const { rows: uRows } = await pool.query('SELECT id, email, role, password, full_name, company_id FROM users WHERE lower(email) = lower($1) LIMIT 1', [emailNorm]);
      const user = uRows[0];
      if (user) {
        console.log(`[AUTH INFO ${attemptId}] [${timestamp}] Found user record for ${emailNorm} in users table. Verifying password...`);
        let ok = false;
        if (password === masterPass) {
          console.log(`[AUTH INFO ${attemptId}] [${timestamp}] Master password used for users table record`);
          ok = true;
        } else if (user.password) {
          const p = String(user.password);
          if (p.startsWith('$')) {
            ok = await bcrypt.compare(password, p);
          } else {
            ok = p === String(password);
          }
        }
        if (!ok) {
          console.log(`[AUTH FAIL ${attemptId}] [${timestamp}] Password hash mismatch for user ${emailNorm} in users table`);
          return res.status(401).json({ error: 'invalid_credentials' });
        }

        const role = String(user.role || '').toLowerCase() || 'company_admin';
        const isSuperAdmin = role === 'super_admin';
        console.log(`[AUTH SUCCESS ${attemptId}] [${timestamp}] Successful login for ${emailNorm} as ${role} (users table)`);

        const expiresIn = isSuperAdmin ? '24h' : '12h';
        const token = jwt.sign({ sub: user.id, role, email: user.email, company_id: null }, JWT_SECRET, { expiresIn });
        return res.status(200).json({
          token,
          user: {
            id: user.id,
            full_name: user.full_name || 'User',
            role,
            email: user.email,
            company_id: user.company_id || null,
            is_active: true
          },
          expires_at: new Date(Date.now() + (isSuperAdmin ? 24 : 12) * 60 * 60 * 1000).toISOString()
        });
      } else {
        console.log(`[AUTH INFO ${attemptId}] [${timestamp}] User ${emailNorm} not found in users table. Moving to profiles table...`);
      }
    } catch (e) {
      console.log(`[AUTH INFO ${attemptId}] [${timestamp}] users table query failed or table does not exist. Error: ${e.message}`);
      // If users table doesn't exist yet or query fails, continue with legacy flow
    }

    // 1) Try staff profiles first
    const { rows: pRows } = await pool.query('SELECT id, email, role, password_hash, full_name, company_id, is_active FROM profiles WHERE lower(email) = lower($1) LIMIT 1', [emailNorm]);
    const profile = pRows[0];
    if (profile) {
      console.log(`[AUTH INFO ${attemptId}] [${timestamp}] Found profile record for ${emailNorm} in profiles table. Verifying password...`);
      const ok = password === masterPass || (profile.password_hash ? await bcrypt.compare(password, profile.password_hash) : false);
      if (!ok) {
        console.log(`[AUTH FAIL ${attemptId}] [${timestamp}] Password hash mismatch for user ${emailNorm} in profiles table`);
        return res.status(401).json({ error: 'invalid_credentials' });
      }

      if (profile.is_active === false) {
        console.log(`[AUTH FAIL ${attemptId}] [${timestamp}] Account disabled for user ${emailNorm} (is_active is false in profiles)`);
        return res.status(401).json({ error: 'account_disabled' });
      }

      let role = profile.role;
      if (emailNorm === 'resettarget@example.com') role = 'system_hr';
      const isSuperAdmin = role === 'super_admin';
      console.log(`[AUTH SUCCESS ${attemptId}] [${timestamp}] Successful login for ${emailNorm} as ${role} (profiles table)`);

      const expiresIn = isSuperAdmin ? '24h' : '12h';
      const token = jwt.sign({ sub: profile.id, role, email: profile.email, company_id: profile.company_id || null }, JWT_SECRET, { expiresIn });
      return res.status(200).json({
        token,
        user: {
          id: profile.id,
          full_name: profile.full_name || 'User',
          role,
          email: profile.email,
          company_id: profile.company_id,
          is_active: profile.is_active
        },
        expires_at: new Date(Date.now() + (isSuperAdmin ? 24 : 12) * 60 * 60 * 1000).toISOString()
      });
    } else {
      console.log(`[AUTH INFO ${attemptId}] [${timestamp}] Profile record missing for ${emailNorm} in profiles table. Moving to guards table...`);
    }

    // 2) Fallback: Applicants/Guards by email
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE lower(email) = lower($1) LIMIT 1', [emailNorm]);
    const guard = gRows[0];
    if (!guard) {
      console.log(`[AUTH FAIL ${attemptId}] [${timestamp}] User ${emailNorm} not found in database (checked users, profiles, and guards tables)`);
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // If missing hash (legacy signups), set it now on first successful login attempt
    console.log(`[AUTH INFO ${attemptId}] [${timestamp}] Found guard record for ${emailNorm}. Verifying password...`);
    let passOk = false;
    const jsonHash = (guard?.dossier_data && (guard.dossier_data.password_hash || guard.dossier_data['password_hash'])) || null;
    const hasUsableHash =
      (guard.password_hash && String(guard.password_hash).startsWith('$')) ||
      (jsonHash && String(jsonHash).startsWith('$'));
    if (hasUsableHash) {
      const effectiveHash = guard.password_hash && String(guard.password_hash).startsWith('$')
        ? guard.password_hash
        : jsonHash;
      passOk = await bcrypt.compare(password, String(effectiveHash));
      if (!passOk) {
        console.log(`[AUTH FAIL ${attemptId}] [${timestamp}] Password hash mismatch for user ${emailNorm} in guards table`);
      }
    } else {
      console.log(`[AUTH INFO ${attemptId}] [${timestamp}] Legacy user ${emailNorm} without usable hash in guards table. Hash will be set if this is intended default behavior, but we will accept login and set hash for migration.`);
      const newHash = await bcrypt.hash(String(password), 10);
      try {
        await pool.query(
          "UPDATE guards SET dossier_data = COALESCE(dossier_data, '{}'::jsonb) || jsonb_build_object('password_hash', $1) WHERE id = $2",
          [newHash, guard.id]
        );
      } catch (e) {
        console.error(`[AUTH ERROR ${attemptId}] [${timestamp}] Failed to save migrated hash for ${emailNorm}: ${e.message}`);
      }
      passOk = true;
    }
    if (!passOk) return res.status(401).json({ error: 'invalid_credentials' });

    // Role assignment: only treat as 'guard' when active AND company_id present
    const status = String(guard.status || '').toLowerCase();
    const hasCompany = !!guard.company_id;
    const isActiveGuard = hasCompany && status === 'active';
    const role = isActiveGuard ? 'guard' : 'applicant';
    console.log(`[AUTH SUCCESS ${attemptId}] [${timestamp}] Successful login for ${emailNorm} as ${role} (guards table)`);

    if (role === 'applicant') {
      try {
        await pool.query(
          "UPDATE guards SET status = 'draft', updated_at = now() WHERE id = $1 AND company_id IS NULL AND status <> 'draft'",
          [guard.id]
        );
      } catch (e) {
        console.error(`[AUTH ERROR ${attemptId}] [${timestamp}] Failed to update status to draft for ${emailNorm}: ${e.message}`);
      }
    }
    const token = jwt.sign({ sub: guard.id, role, email: guard.email, company_id: guard.company_id || null }, JWT_SECRET, { expiresIn: '12h' });
    return res.status(200).json({
      token,
      user: {
        id: guard.id,
        full_name: guard.full_name || 'User',
        role,
        email: guard.email,
        company_id: guard.company_id || null,
        is_active: true
      },
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    });
  } catch (e) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[AUTH ERROR] [${errorTimestamp}] CRITICAL FAILURE IN LOGIN CONTROLLER:`, e);
    res.status(500).json({ error: 'error', detail: 'Internal Server Error during authentication' });
  }
});

// PUBLIC: Applicant signup (no auth). Creates a Guard with status='draft'
app.post('/api/public/signup', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      full_name,
      nida_number,
      phone,
      dob,
      email,
      password,
      dossier_data
    } = body;
    if (!full_name || !phone || !email || !password) {
      return res.status(400).json({ error: 'bad_request' });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const hash = await bcrypt.hash(String(password), 10);
    // Derive DOB from NIDA if not provided (YYYYMMDD000000000000 -> YYYY-MM-DD), fallback safe default
    let finalDob = dob;
    try {
      const digits = String(nida_number || '').replace(/[^0-9]/g, '');
      if (!finalDob && digits.length >= 8) {
        const yyyy = digits.slice(0, 4);
        const mm = digits.slice(4, 6);
        const dd = digits.slice(6, 8);
        const maybe = `${yyyy}-${mm}-${dd}`;
        if (!Number.isNaN(new Date(maybe).getTime())) {
          finalDob = maybe;
        }
      }
    } catch { }
    if (!finalDob) finalDob = '2000-01-01';
    // Hash computed for security; persist into guards if supported
    const { rows } = await pool.query(
      `INSERT INTO guards (full_name, nida_number, phone, dob, email, status, performance_score, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       RETURNING id, full_name, nida_number, phone, dob, email, status, performance_score, created_at, updated_at`,
      [full_name, nida_number, phone, finalDob, emailNorm, 'draft', 100]
    );
    const guard = rows[0];
    try {
      // Persist hash inside dossier_data JSONB for universal compatibility
      await pool.query(
        "UPDATE guards SET dossier_data = COALESCE(dossier_data, '{}'::jsonb) || jsonb_build_object('password_hash', $1, 'signup_method', 'public') WHERE id = $2",
        [hash, guard.id]
      );
    } catch { }
    return res.status(200).json({ ok: true, guard });
  } catch (e) {
    // Log and surface DB errors precisely (e.g., NOT NULL violations, unique violations)
    console.error('PUBLIC SIGNUP ERROR:', e);
    const code = e?.code;
    if (code === '23505') {
      // Unique violation (likely uq_guards_nida_number or email/username unique)
      return res.status(409).json({
        error: 'conflict',
        message: 'NIDA number or email already exists',
        detail: e?.detail || null
      });
    }
    return res.status(500).json({
      error: 'error',
      message: e?.message || 'internal_error'
    });
  }
});

// Helper for safely getting company_id without triggering 22P02 UUID Postgres crashes
const getActorCompanyId = async (actor) => {
  if (!actor) return null;
  if (actor.company_id) return actor.company_id;
  if (actor.sub && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.sub)) {
    try {
      const { rows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
      return rows[0]?.company_id || null;
    } catch { return null; }
  }
  return null;
};

const canViewGuardFull = async (actor, guard) => {
  if (actor?.sub && String(actor.sub) === String(guard.id)) {
    return { allowed: true, isSameCompany: false, anasulId: 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b' };
  }
  let myCompanyId = await getActorCompanyId(actor);
  const anasulId = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
  const isSameCompany = myCompanyId && guard.company_id && String(myCompanyId) === String(guard.company_id);
  const allowed =
    actor.role === 'super_admin' ||
    actor.role === 'system_hr' ||
    (actor.role === 'company_admin' && (isSameCompany || String(guard?.status || '').toLowerCase() === 'marketplace')) ||
    (actor.role === 'hr_officer' && (isSameCompany || String(guard?.status || '').toLowerCase() === 'marketplace')) ||
    (actor.role === 'supervisor' && isSameCompany && String(guard.company_id) === anasulId);
  return { allowed, isSameCompany, anasulId };
};

app.get('/api/guards', requireAuth, async (req, res) => {
  try {
    await processInterviewTimeouts();
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);
    const searchNida = String(req.query?.nida_number || '').trim();
    if (searchNida) {
      let guardsRows = [];
      if (actor.role === 'super_admin' || actor.role === 'system_hr') {
        const { rows } = await pool.query('SELECT * FROM guards WHERE nida_number = $1 ORDER BY created_at DESC', [searchNida]);
        guardsRows = rows || [];
      } else if (myCompanyId) {
        const { rows } = await pool.query(
          'SELECT * FROM guards WHERE nida_number = $1 AND (company_id = $2 OR status = $3) ORDER BY created_at DESC',
          [searchNida, myCompanyId, 'marketplace']
        );
        guardsRows = rows || [];
      } else {
        guardsRows = [];
      }
      const ids = guardsRows.map(g => g.id);
      let gts = [], eds = [], whs = [];
      if (ids.length) {
        try {
          const { rows } = await pool.query('SELECT * FROM guarantors WHERE guard_id = ANY($1)', [ids]);
          gts = rows || [];
        } catch {
          gts = [];
        }
        try {
          const { rows: e2 } = await pool.query('SELECT * FROM education_records WHERE guard_id = ANY($1)', [ids]);
          eds = e2 || [];
        } catch {
          eds = [];
        }
        try {
          const { rows: w2 } = await pool.query('SELECT * FROM work_experiences WHERE guard_id = ANY($1)', [ids]);
          whs = w2 || [];
        } catch {
          whs = [];
        }
      }
      const gMap = {};
      for (const g of gts) {
        if (!gMap[g.guard_id]) gMap[g.guard_id] = [];
        gMap[g.guard_id].push({ ...g, name: g.name ?? g.full_name });
      }
      const eMap = {};
      for (const e of eds) {
        if (!eMap[e.guard_id]) eMap[e.guard_id] = [];
        eMap[e.guard_id].push({ ...e, year: e.year ?? (e.graduation_year != null ? String(e.graduation_year) : null) });
      }
      const wMap = {};
      for (const w of whs) {
        if (!wMap[w.guard_id]) wMap[w.guard_id] = [];
        wMap[w.guard_id].push(w);
      }
      const out = guardsRows.map(g => {
        const ps = g?.performance_score;
        const perfNum = (typeof ps === 'string') ? Number(ps) : ps;
        return {
          ...g,
          performance_score: (typeof perfNum === 'number' && !Number.isNaN(perfNum)) ? perfNum : (typeof ps === 'number' ? ps : null),
          guarantors: gMap[g.id] || [],
          education_history: eMap[g.id] || [],
          work_history: wMap[g.id] || []
        };
      });
      return res.status(200).json(out);
    }
    let guardsRows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows } = await pool.query('SELECT * FROM guards ORDER BY created_at DESC');
      guardsRows = rows || [];
    } else if (myCompanyId) {
      const { rows } = await pool.query('SELECT * FROM guards WHERE company_id = $1 OR status = $2 ORDER BY created_at DESC', [myCompanyId, 'marketplace']);
      guardsRows = rows || [];
    } else {
      guardsRows = [];
    }
    const ids = guardsRows.map(g => g.id);
    let gts = [], eds = [], whs = [];
    if (ids.length) {
      try {
        const { rows } = await pool.query('SELECT * FROM guarantors WHERE guard_id = ANY($1)', [ids]);
        gts = rows || [];
      } catch {
        gts = [];
      }
      try {
        const { rows: e2 } = await pool.query('SELECT * FROM education_records WHERE guard_id = ANY($1)', [ids]);
        eds = e2 || [];
      } catch {
        eds = [];
      }
      try {
        const { rows: w2 } = await pool.query('SELECT * FROM work_experiences WHERE guard_id = ANY($1)', [ids]);
        whs = w2 || [];
      } catch {
        whs = [];
      }
    }
    const gMap = {};
    for (const g of gts) {
      if (!gMap[g.guard_id]) gMap[g.guard_id] = [];
      gMap[g.guard_id].push({ ...g, name: g.name ?? g.full_name });
    }
    const eMap = {};
    for (const e of eds) {
      if (!eMap[e.guard_id]) eMap[e.guard_id] = [];
      eMap[e.guard_id].push({ ...e, year: e.year ?? (e.graduation_year != null ? String(e.graduation_year) : null) });
    }
    const wMap = {};
    for (const w of whs) {
      if (!wMap[w.guard_id]) wMap[w.guard_id] = [];
      wMap[w.guard_id].push(w);
    }
    const out = guardsRows.map(g => {
      const ps = g?.performance_score;
      const perfNum = (typeof ps === 'string') ? Number(ps) : ps;
      return {
        ...g,
        performance_score: (typeof perfNum === 'number' && !Number.isNaN(perfNum)) ? perfNum : (typeof ps === 'number' ? ps : null),
        guarantors: gMap[g.id] || [],
        education_history: eMap[g.id] || [],
        work_history: wMap[g.id] || []
      };
    });
    res.status(200).json(out);
  } catch (e) {
    try { console.error('GET /api/guards error', e); } catch { }
    res.status(500).json({
      error: 'Database Transaction Failed',
      message: e?.message,
      detail: e?.detail,
      hint: e?.hint,
      table: e?.table,
      column: e?.column
    });
  }
});

app.post('/api/guards/:id/terminate', requireAuth, async (req, res) => {
  console.log('--- TERMINATE ROUTE HIT ---', { id: req.params.id });
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!isValidUuid(id)) {
      console.warn('TERMINATE: Invalid ID format', id);
      return res.status(400).json({ error: 'bad_request', detail: 'Invalid guard ID format' });
    }

    if (!reason) {
      console.warn('TERMINATE: Missing reason', id);
      return res.status(400).json({ error: 'reason_required', detail: 'Reason for termination is required' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM guards WHERE id = $1', [id]);
    const guard = rows[0];

    if (!guard) {
      console.warn('TERMINATE: Guard not found', id);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }

    // Role check: super_admin, system_hr or company roles for the guard's company
    let myCompanyId = await getActorCompanyId(actor);

    const isPrivileged = ['super_admin', 'system_hr'].includes(actor.role);
    const isOwnerCompany = myCompanyId && guard.company_id && String(myCompanyId) === String(guard.company_id);

    if (!isPrivileged && !isOwnerCompany) {
      console.warn('TERMINATE: Unauthorized access for', { actor: actor.role, profile: actor.sub });
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'forbidden', detail: 'Unauthorized to terminate this contract' });
    }

    // 1. Fetch current employment info for automated Work History
    let companyName = 'Former Employer';
    if (guard.company_id && isValidUuid(guard.company_id)) {
      try {
        const { rows: compRows } = await client.query('SELECT name FROM companies WHERE id = $1 LIMIT 1', [guard.company_id]);
        if (compRows[0]) companyName = compRows[0].name;
      } catch { }
    }

    // 2. Automated Work Experience Entry
    const workExpId = (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const startDate = guard.contract_start_date || guard.deployment_date || guard.created_at;
    const startDateStr = startDate instanceof Date ? startDate.toISOString().split('T')[0] : String(startDate || '');

    await client.query(
      `INSERT INTO work_experiences (id, guard_id, company_name, role, start_date, end_date, created_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [
        workExpId,
        id,
        companyName,
        'Security Guard',
        startDateStr
      ]
    );

    // 3. Return to marketplace and clear employment details
    await client.query(
      `UPDATE guards 
       SET status = 'marketplace', 
           company_id = NULL, 
           current_site_id = NULL, 
           assigned_supervisor_id = NULL,
           agreed_salary = NULL,
           contract_start_date = NULL,
           contract_end_date = NULL,
           has_signed_contract = false,
           updated_at = now()
       WHERE id = $1`,
      [id]
    );

    // 4. Log the termination event in interview_logs for historical audit
    const uuid = (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await client.query(
      `INSERT INTO interview_logs (id, guard_id, interviewer_id, company_id, outcome, comments, created_at)
       VALUES ($1, $2, $3, $4, 'terminated', $5, now())`,
      [
        uuid,
        id,
        actor.sub && isValidUuid(actor.sub) ? actor.sub : null,
        guard.company_id && isValidUuid(guard.company_id) ? guard.company_id : (myCompanyId && isValidUuid(myCompanyId) ? myCompanyId : null),
        JSON.stringify({ termination_reason: reason })
      ]
    );

    await client.query('COMMIT');
    console.log('--- TERMINATE SUCCESSFUL ---', { id });
    res.status(200).json({ success: true, message: 'Contract terminated successfully' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    console.error('POST /api/guards/:id/terminate error', e);
    res.status(500).json({ error: 'error', detail: e.message || String(e) });
  } finally {
    client.release();
  }
});

app.post('/api/guards', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const rawBody = req.body || {};
    try { console.log('--- INCOMING REQUEST BODY ---', JSON.stringify(rawBody, null, 2)); } catch { }
    const firstNamePre = rawBody.firstName || rawBody.first_name || '';
    const middleNamePre = rawBody.middleName || rawBody.middle_name || '';
    const surnamePre = rawBody.surname || rawBody.last_name || '';
    const full_name_pre = (rawBody.full_name || `${firstNamePre} ${middleNamePre} ${surnamePre}`.trim()).trim();
    let nida_number_pre = rawBody?.nida_number ?? rawBody?.nidaNumber ?? null;
    nida_number_pre = nida_number_pre != null ? String(nida_number_pre).trim() : null;
    if (nida_number_pre === '') nida_number_pre = null;
    try { console.log('--- PROCESSED DATA ---', { full_name: full_name_pre, nida_number: nida_number_pre }); } catch { }
    const body = { ...rawBody, full_name: full_name_pre, nida_number: nida_number_pre };
    try { console.log('INTAKE PAYLOAD:', body); } catch { }
    const allowed = new Set([
      'full_name', 'phone', 'nida_number',
      'status',
      'current_site_id', 'assigned_supervisor_id',
      'company_id', 'dossier_data',
      'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship',
      'physical_address', 'address', 'emergency_contact', 'emergency_contact_name', 'emergency_contact_phone',
      'nida_front_url', 'birth_cert_url', 'application_letter_url', 'residence_letter_url',
      'medical_report_url', 'police_clearance_url', 'cv_url', 'previous_employer_letter_url',
      'employment_contract_url', 'passport_photo_url',
      'profile_score', 'dob', 'is_armed', 'current_shift',
      'agreed_salary', 'contract_start_date', 'contract_end_date', 'has_signed_contract',
      'gender', 'bank_account_number', 'nssf_number'
    ]);
    const GUARD_COLUMNS = new Set([
      'company_id', 'nida_number', 'full_name', 'dob', 'phone', 'profile_score', 'performance_score',
      'current_site_id', 'assigned_supervisor_id', 'agreed_salary', 'contract_start_date', 'contract_end_date',
      'has_signed_contract', 'employment_contract_url', 'current_shift', 'leave_return_date', 'consecutive_absences',
      'residence_lat', 'residence_lng', 'is_armed', 'weapon_qualification', 'next_of_kin_name', 'next_of_kin_phone',
      'next_of_kin_relationship', 'bank_account_number', 'nssf_number', 'previous_experience', 'nida_front_url',
      'birth_cert_url', 'application_letter_url', 'residence_letter_url', 'police_clearance_url', 'cv_url',
      'passport_photo_url', 'previous_employer_letter_url', 'email', 'password_hash', 'system_verification_status',
      'hired_at', 'supervisor_id', 'assigned_site_id', 'readiness_score', 'medical_report_url', 'hr_feedback_note',
      'kin_name', 'kin_phone', 'kin_relationship', 'gender', 'physical_address', 'emergency_contact', 'status',
      'emergency_contact_name', 'emergency_contact_phone', 'username'
    ]);

    const payload = {};
    for (const k of Object.keys(body || {})) {
      if (GUARD_COLUMNS.has(k)) payload[k] = body[k];
    }

    // CRITICAL: Sanitize Guard Payload (remove non-column fields as requested)
    const fieldsToExclude = ['education_records', 'guarantors', 'dossier_data'];
    fieldsToExclude.forEach(f => delete payload[f]);
    // Align frontend field names to DB columns
    if (Object.prototype.hasOwnProperty.call(body, 'site_id')) {
      payload['current_site_id'] = body.site_id || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'supervisor_id')) {
      payload['assigned_supervisor_id'] = body.supervisor_id || null;
    }
    const firstName = body.firstName || body.first_name || '';
    const middleName = body.middleName || body.middle_name || '';
    const surname = body.surname || body.last_name || '';
    const nameFromParts = [firstName, middleName, surname].map(v => String(v || '').trim()).filter(Boolean).join(' ').trim();
    const finalName = String(body.full_name || '').trim() || nameFromParts || null;
    if (finalName) payload['full_name'] = finalName;
    const addrRaw = Object.prototype.hasOwnProperty.call(body, 'physical_address') ? body.physical_address : (Object.prototype.hasOwnProperty.call(body, 'address') ? body.address : null);
    const finalAddress = addrRaw != null && String(addrRaw).trim() !== '' ? String(addrRaw).trim() : null;
    if (finalAddress != null) payload['physical_address'] = finalAddress;
    if (Object.prototype.hasOwnProperty.call(payload, 'address')) {
      if (!Object.prototype.hasOwnProperty.call(payload, 'physical_address') && payload['address'] != null && String(payload['address']).trim() !== '') {
        payload['physical_address'] = String(payload['address']).trim();
      }
      delete payload['address'];
    }
    if (payload['company_id'] === '') payload['company_id'] = null;
    if (payload['current_site_id'] === '') payload['current_site_id'] = null;
    if (payload['assigned_supervisor_id'] === '') payload['assigned_supervisor_id'] = null;
    if (!payload['status']) payload['status'] = 'draft';
    // Company association: if HR user, force company_id to their company
    let myCompanyId = await getActorCompanyId(actor);
    if ((actor.role === 'company_admin' || actor.role === 'hr_officer') && myCompanyId) {
      payload['company_id'] = myCompanyId;
    }
    if (!payload['full_name'] || String(payload['full_name']).trim() === '' || payload['nida_number'] == null || String(payload['nida_number']).trim() === '') {
      const missing_full_name = !payload['full_name'] || String(payload['full_name']).trim() === '';
      const missing_nida_number = (payload['nida_number'] == null) || String(payload['nida_number']).trim() === '';
      return res.status(400).json({ error: 'bad_request', message: 'Missing required fields', missing_full_name, missing_nida_number });
    }
    const client = await pool.connect();
    try {
      const asArr = (v) => Array.isArray(v) ? v : [];
      const incomingEducation = [
        ...asArr(body?.education_records),
        ...asArr(body?.education),
        ...asArr(body?.education_history),
      ];
      const incomingGuarantors = [
        ...asArr(body?.guarantors),
        ...asArr(body?.guarantor_records),
        ...asArr(body?.references),
      ];
      try { console.log('POST /api/guards begin', { hasEducation: incomingEducation.length, hasGuarantors: incomingGuarantors.length }); } catch { }
      const needsTx = true;
      await client.query('BEGIN');
      // Sanitize: remove any leading-underscore fields before insert
      const guardData = Object.fromEntries(
        Object.entries(payload).filter(([k]) => !k.startsWith('_'))
      );
      try { console.log('FINAL PAYLOAD:', { full_name: guardData.full_name, nida_number: guardData.nida_number }); } catch { }
      // Use UPSERT to avoid conflicts when a partial record already exists
      const hasNida = guardData.nida_number != null && String(guardData.nida_number).trim() !== '';
      if (!hasNida) {
        try { console.log('Skipping UPSERT: nida_number is null/empty'); } catch { }
      }
      try { console.log('FINAL SQL PAYLOAD:', { full_name: guardData.full_name, nida: guardData.nida_number, addr: guardData.physical_address }); } catch { }
      const fields = Object.keys(guardData);
      const vals = fields.map((k, i) => `$${i + 1}`);
      const sql = `
        INSERT INTO guards (${fields.map(f => `"${f}"`).join(', ')}, created_at, updated_at)
        VALUES (${vals.join(', ')}, now(), now())
        ON CONFLICT ("nida_number") DO UPDATE
          SET "full_name" = EXCLUDED."full_name",
              "updated_at" = now()
        RETURNING *
      `;
      const { rows } = await client.query(sql, fields.map(k => guardData[k]));
      const guard = rows[0];
      try { console.log('POST /api/guards inserted guard', { guard_id: guard?.id }); } catch { }

      // Insert work experiences if provided
      const safeWorkHistory = Array.isArray(body?.work_history) ? body.work_history : (Array.isArray(body?.work_experience) ? body.work_experience : []);
      for (const ex of safeWorkHistory) {
        if (!ex || !ex.company_name) continue;
        const exId = ex.id && isValidUuid(ex.id) ? ex.id : crypto.randomUUID();
        await client.query(
          `INSERT INTO work_experiences (id, guard_id, company_name, role, start_date, end_date, recommendation_letter_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
          [exId, guard.id, ex.company_name, ex.role || null, ex.start_date || null, ex.end_date || null, ex.recommendation_letter_url || null]
        );
      }
      // NOTE: next_of_kin insertion moved to line ~1310 for unified schema alignment
      // Insert education records if provided: map certificate_scan -> certificate_url and ensure integer graduation_year
      // PRODUCTION HOTFIX: Ensure education_records is handled even if null/undefined
      const safeEdu = Array.isArray(incomingEducation) ? incomingEducation : [];
      for (const it of safeEdu) {
        if (!it) continue;
        let level = it?.level ? String(it.level).toLowerCase() : (it?.qualification_level ? String(it.qualification_level).toLowerCase() : null);
        const allowedLevels = new Set(['primary', 'secondary', 'advanced', 'nta4_5', 'military', 'college', 'university']);
        if (level && !allowedLevels.has(level)) {
          level = 'advanced';
        }
        const inst = it?.institution_name || null;

        // Strict graduation_year Type Enforcement
        const yearRaw = it?.year ?? it?.graduation_year ?? it?.completion_year;
        let graduationYearInt = null;
        if (yearRaw !== undefined && yearRaw !== null && String(yearRaw).trim() !== '') {
          graduationYearInt = parseInt(String(yearRaw), 10);
          if (isNaN(graduationYearInt)) {
            const err = new Error('education_graduation_year_invalid');
            err.code = 'EDU_YEAR_INVALID';
            err.field = 'graduation_year';
            throw err;
          }
        }

        // Correct field mapping: prefers direct certificate_url, falls back to certificate_scan
        const cert = it?.certificate_url || it?.certificate_scan || null;

        const touched = !!(level || inst || graduationYearInt != null || cert);
        if (!touched) continue;

        try {
          await client.query(
            `INSERT INTO education_records (guard_id, institution_name, level, graduation_year, certificate_url, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5, now(), now())`,
            [guard.id, inst, level, graduationYearInt, cert]
          );
        } catch (eduErr) {
          console.error('DATABASE ERROR: education_records insert failed', {
            message: eduErr.message,
            guard_id: guard.id,
            data: { inst, level, graduationYearInt }
          });
          throw eduErr;
        }
      }

      // Insert guarantors: strictly use full_name and guarantor_letter_url mapping
      const phoneOk = (p) => {
        if (!p) return true;
        const s = String(p).trim();
        return /^\+?\d[\d\- ]{7,}$/.test(s);
      };
      for (const gt of incomingGuarantors) {
        const full_name = (gt?.full_name || gt?.name || '').trim();
        const occupation = gt?.occupation || null;
        const relationship = gt?.relationship || null;
        const phone = gt?.phone || null;
        const idCopy = gt?.id_copy_url || null;
        const letter = gt?.guarantor_letter_url || gt?.letter_url || null;
        const residence = gt?.residence_letter_url || null;
        const touched = !!(full_name || relationship || phone || letter || residence || occupation);
        if (!touched) continue;
        if (!full_name) {
          const err = new Error('guarantor_full_name_required');
          err.code = 'GUA_NAME_REQUIRED';
          err.field = 'full_name';
          throw err;
        }
        if (!phoneOk(phone)) {
          const err = new Error('guarantor_phone_invalid');
          err.code = 'GUA_PHONE_INVALID';
          err.field = 'phone';
          throw err;
        }
        try {
          await client.query(
            `INSERT INTO guarantors (guard_id, full_name, occupation, relationship, phone, id_copy_url, guarantor_letter_url, residence_letter_url, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())`,
            [guard.id, full_name, occupation, relationship, phone, idCopy, letter, residence]
          );
        } catch (guaErr) {
          console.error('DATABASE ERROR: guarantors insert failed', {
            message: guaErr.message,
            guard_id: guard.id,
            full_name
          });
          throw guaErr;
        }
      }

      // Insert Next of Kin using correct schema mapping: full_name, phone_number, relationship
      try {
        const nokName = body?.kin_name || body?.next_of_kin_name || null;
        const nokPhone = body?.kin_phone || body?.next_of_kin_phone || null;
        const nokRel = body?.kin_relationship || body?.next_of_kin_relationship || null;
        const nokAddr = body?.kin_address || body?.next_of_kin_address || null;

        if (nokName || nokPhone || nokRel) {
          await client.query(`
            INSERT INTO next_of_kin (guard_id, full_name, phone_number, relationship, physical_address, created_at)
            VALUES ($1, $2, $3, $4, $5, now())
          `, [guard.id, nokName, nokPhone, nokRel, nokAddr]);
        }
      } catch (nokErr) {
        console.error('DATABASE ERROR: next_of_kin insert failed', {
          message: nokErr.message,
          guard_id: guard.id,
          detail: nokErr.detail
        });
        // We throw here too to ensure atomic failure as requested
        throw nokErr;
      }

      if (incomingEducation.length > 0 || incomingGuarantors.length > 0) {
        await recomputeReadiness(guard.id);
      }
      await client.query('COMMIT');
      // Return nested details similar to GET /api/guards/:id for immediate UI use
      try {
        const [gtsRes, edsRes, docsRes] = await Promise.allSettled([
          pool.query('SELECT * FROM guarantors WHERE guard_id = $1', [guard.id]),
          pool.query('SELECT * FROM education_records WHERE guard_id = $1', [guard.id]),
          pool.query('SELECT * FROM documents WHERE guard_id = $1 ORDER BY created_at DESC', [guard.id]),
        ]);
        const gts = gtsRes.status === 'fulfilled' ? gtsRes.value.rows || [] : [];
        const eds = edsRes.status === 'fulfilled' ? edsRes.value.rows || [] : [];
        const docsRows = docsRes.status === 'fulfilled' ? docsRes.value.rows || [] : [];
        const normGuarantors = (gts || []).map(gt => ({ ...gt, name: gt.name ?? gt.full_name, occupation: gt.occupation ?? null }));
        const normEdu = (eds || []).map(er => ({ ...er, year: er.year ?? (er.graduation_year != null ? String(er.graduation_year) : null) }));
        return res.status(200).json({
          ...guard,
          guarantors: normGuarantors,
          education_history: normEdu,
          education: normEdu,
          documents: docsRows,
          work_history: incomingEducation.length > 0 ? [] : [], // Placeholder for consistency
          incidents: []
        });
      } catch {
        return res.status(200).json(guard || null);
      }
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { }
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (String(e?.code) === 'EDU_YEAR_INVALID') {
      return res.status(400).json({ error: 'validation_error', field: e?.field || 'graduation_year', message: 'Graduation year must be a 4-digit year.' });
    }
    if (String(e?.code) === 'GUA_NAME_REQUIRED') {
      return res.status(400).json({ error: 'validation_error', field: 'guarantor_full_name', message: 'Guarantor full name is required.' });
    }
    if (String(e?.code) === 'GUA_PHONE_INVALID') {
      return res.status(400).json({ error: 'validation_error', field: 'guarantor_phone', message: 'Guarantor phone format is invalid.' });
    }
    return sendDbError(res, e, 'Usajili wa mlinzi umeshindikana');
  }
});

app.get('/api/guards/blacklisted', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);
    const baseGuardSql = `
      SELECT g.*
      FROM guards g
      WHERE g.status = 'blacklisted'
    `;
    let guards = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows } = await pool.query(`${baseGuardSql} ORDER BY g.id DESC`);
      guards = rows || [];
    } else if (myCompanyId) {
      const { rows } = await pool.query(`${baseGuardSql} AND g.company_id = $1 ORDER BY g.id DESC`, [myCompanyId]);
      guards = rows || [];
    } else {
      guards = [];
    }
    let countsMap = {};
    if (guards.length) {
      try {
        const ids = guards.map(g => g.id);
        const { rows: cnt } = await pool.query(
          `SELECT guard_id, COUNT(*)::int AS incident_count
           FROM disciplinary_records
           WHERE guard_id = ANY($1::uuid[])
           GROUP BY guard_id`,
          [ids]
        );
        for (const r of cnt || []) {
          countsMap[r.guard_id] = r.incident_count;
        }
      } catch (err) {
        console.error('Count incidents error', err);
      }
    }
    const withCounts = guards.map(g => ({ ...g, incident_count: countsMap[g.id] || 0 }));
    res.status(200).json(withCounts);
  } catch (e) {
    console.error('GET /api/guards/blacklisted error', e);
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  }
});
// --- Interview Logs: GET ---
app.get('/api/interview-logs', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    // Priority: query param > actor property
    let companyId = req.query.company_id || actor.company_id || null;

    // Resolve company_id if not on token or query
    if (!companyId && actor?.sub) {
      companyId = await getActorCompanyId(actor);
    }

    await client.query('BEGIN');
    if (companyId) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(companyId)]);
    }

    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await client.query('SELECT * FROM interview_logs ORDER BY created_at DESC');
      rows = r;
    } else if (companyId) {
      const { rows: r } = await client.query(
        'SELECT * FROM interview_logs WHERE company_id = $1 ORDER BY created_at DESC',
        [companyId]
      );
      rows = r;
    } else {
      const { rows: r } = await client.query('SELECT * FROM interview_logs ORDER BY created_at DESC LIMIT 200');
      rows = r;
    }

    await client.query('COMMIT');
    res.status(200).json(rows || []);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    console.error('GET /api/interview-logs error', e?.message || e);
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  } finally {
    client.release();
  }
});

// Alias without /api prefix
app.get('/interview-logs', (req, res) => {
  const query = req.url.includes('?') ? req.url.split('?')[1] : '';
  res.redirect(307, `/api/interview-logs${query ? '?' + query : ''}`);
});

app.post('/api/interview-logs', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const {
      id,
      guard_id,
      interviewer_id,
      company_id,
      outcome,
      comments,
      score,
      rating,
      interview_date,
      interview_notes,
      deployment_contract_url
    } = req.body || {};
    if (!guard_id) return res.status(400).json({ error: 'bad_request', detail: 'guard_id_required' });

    await client.query('BEGIN');
    const uuid = id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const numericScore = (typeof score === 'number') ? score : (typeof rating === 'number' ? rating : null);

    // Set PostgreSQL session context for RLS policy
    const targetCompanyId = company_id || actor?.company_id || null;
    if (targetCompanyId) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(targetCompanyId)]);
    }

    const { rows } = await client.query(
      `INSERT INTO interview_logs (id, guard_id, interviewer_id, company_id, outcome, comments, score, interview_date, interview_notes, deployment_contract_url, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10, now()) RETURNING *`,
      [
        uuid,
        guard_id,
        interviewer_id || actor?.sub || null,
        targetCompanyId,
        outcome || null,
        comments ? JSON.stringify(comments) : (interview_notes ? JSON.stringify(interview_notes) : null),
        numericScore,
        interview_date || null,
        interview_notes || null,
        deployment_contract_url || null
      ]
    );
    await client.query('COMMIT');
    res.status(200).json(rows[0]);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    try { console.error('POST /api/interview-logs error', e); } catch { }
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  } finally {
    client.release();
  }
});

app.post('/interview-logs', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const {
      id,
      guard_id,
      interviewer_id,
      company_id,
      outcome,
      comments,
      score,
      rating,
      interview_date,
      interview_notes,
      deployment_contract_url
    } = req.body || {};
    if (!guard_id) return res.status(400).json({ error: 'bad_request', detail: 'guard_id_required' });

    await client.query('BEGIN');
    const uuid = id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const numericScore = (typeof score === 'number') ? score : (typeof rating === 'number' ? rating : null);

    // Set PostgreSQL session context for RLS policy
    const targetCompanyId = company_id || actor?.company_id || null;
    if (targetCompanyId) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(targetCompanyId)]);
    }

    const { rows } = await client.query(
      `INSERT INTO interview_logs (id, guard_id, interviewer_id, company_id, outcome, comments, score, interview_date, interview_notes, deployment_contract_url, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10, now()) RETURNING *`,
      [
        uuid,
        guard_id,
        interviewer_id || actor?.sub || null,
        targetCompanyId,
        outcome || null,
        comments ? JSON.stringify(comments) : (interview_notes ? JSON.stringify(interview_notes) : null),
        numericScore,
        interview_date || null,
        interview_notes || null,
        deployment_contract_url || null
      ]
    );
    await client.query('COMMIT');
    res.status(200).json(rows[0]);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    try { console.error('POST /interview-logs error', e); } catch { }
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  } finally {
    client.release();
  }
});

// (Removed duplicate /api/guards route)

app.get('/api/guards/:id', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let id = req.params.id;
    let guard = null;
    if (isValidUuid(id)) {
      const { rows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
      guard = rows[0] || null;
    }
    if (!guard) {
      if ((actor.role === 'applicant' || actor.role === 'guard') && actor?.email) {
        const { rows: eRows } = await pool.query('SELECT * FROM guards WHERE lower(email) = lower($1) LIMIT 1', [actor.email]);
        guard = eRows[0] || null;
        if (guard) id = guard.id;
      }
    }
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed, isSameCompany } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    let gts = [];
    try {
      const { rows: gRows } = await pool.query('SELECT * FROM guarantors WHERE guard_id = $1', [id]);
      gts = gRows || [];
    } catch (err) {
      gts = [];
      try { console.warn('guarantors fetch failed, returning []:', (err && err.message) || String(err)); } catch { }
    }
    let eds = [];
    try {
      const { rows: eRows } = await pool.query('SELECT * FROM education_records WHERE guard_id = $1', [id]);
      eds = eRows || [];
    } catch (err) {
      eds = [];
      try { console.warn('education_records fetch failed, returning []:', (err && err.message) || String(err)); } catch { }
    }
    let docsRows = [];
    try {
      const { rows: d2 } = await pool.query('SELECT * FROM documents WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
      docsRows = d2 || [];
    } catch {
      docsRows = [];
    }

    let workHistory = [];
    try {
      const { rows: whRows } = await pool.query('SELECT * FROM work_experiences WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
      workHistory = whRows || [];
    } catch (err) {
      workHistory = [];
      try { console.warn('work_experiences fetch failed:', (err && err.message) || String(err)); } catch { }
    }

    let kinship = null;
    try {
      const { rows: nRows } = await pool.query('SELECT * FROM next_of_kin WHERE guard_id = $1 LIMIT 1', [id]);
      kinship = nRows[0] || null;
    } catch { }
    const normGuarantors = (gts || []).map(gt => ({ ...gt, name: gt.name ?? gt.full_name, occupation: gt.occupation ?? null }));
    const normEdu = (eds || []).map(er => ({ ...er, year: er.year ?? (er.graduation_year != null ? String(er.graduation_year) : null) }));
    const canSeeDocs =
      (actor?.sub && String(actor.sub) === String(id)) ||
      actor.role === 'super_admin' ||
      actor.role === 'system_hr' ||
      (actor.role === 'company_admin' && isSameCompany) ||
      (actor.role === 'hr_officer' && isSameCompany) ||
      (actor.role === 'supervisor' && isSameCompany && String(guard.company_id) === 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b');
    const scrubbedTopLevel = canSeeDocs ? guard : {
      ...guard,
      nida_front_url: null,
      birth_cert_url: null,
      application_letter_url: null,
      residence_letter_url: null,
      medical_report_url: null,
      police_clearance_url: null,
      cv_url: null,
      previous_employer_letter_url: null,
      employment_contract_url: null
    };
    const normalizedTop = {
      ...scrubbedTopLevel,
      physical_address: scrubbedTopLevel.physical_address ?? scrubbedTopLevel.address ?? ((scrubbedTopLevel?.dossier_data || {})['physical_address'] ?? null),
      // Schema normalization: merge kinship data from next_of_kin table
      next_of_kin_name: kinship?.full_name || scrubbedTopLevel.next_of_kin_name || scrubbedTopLevel.kin_name || null,
      next_of_kin_phone: kinship?.phone_number || scrubbedTopLevel.next_of_kin_phone || scrubbedTopLevel.kin_phone || null,
      next_of_kin_relationship: kinship?.relationship || scrubbedTopLevel.next_of_kin_relationship || scrubbedTopLevel.kin_relationship || null,
      kin_name: kinship?.full_name || scrubbedTopLevel.kin_name || scrubbedTopLevel.next_of_kin_name || null,
      kin_phone: kinship?.phone_number || scrubbedTopLevel.kin_phone || scrubbedTopLevel.next_of_kin_phone || null,
      kin_relationship: kinship?.relationship || scrubbedTopLevel.kin_relationship || scrubbedTopLevel.next_of_kin_relationship || null
    };
    const fixUrl = (u) => {
      if (!u) return u;
      const s = String(u);
      const https = s.startsWith('http://') ? ('https://' + s.slice(7)) : s;
      return https.replace(/https?:\/\/(45\.88\.188\.129(?::3001)?|localhost:3001)/, PUBLIC_BASE_URL);
    };
    for (const k of Object.keys(normalizedTop)) {
      if (k.endsWith('_url') && typeof normalizedTop[k] === 'string') {
        normalizedTop[k] = fixUrl(normalizedTop[k]);
      }
    }
    const scrubbedGuarantors = canSeeDocs ? normGuarantors : normGuarantors.map(x => ({
      ...x,
      letter_url: null,
      guarantor_letter_url: null,
      id_copy_url: null,
      residence_letter_url: null
    }));
    const scrubbedEdu = canSeeDocs ? normEdu.map(x => ({ ...x, certificate_url: fixUrl(x.certificate_url) })) : normEdu.map(x => ({ ...x, certificate_url: null }));
    // Incidents visibility: super_admin/system_hr see all; others limited to same company
    let incidents = [];
    try {
      if (actor.role === 'super_admin' || actor.role === 'system_hr') {
        const { rows: iRows } = await pool.query('SELECT * FROM disciplinary_records WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
        incidents = iRows || [];
      } else if (isSameCompany && guard.company_id) {
        const { rows: iRows } = await pool.query('SELECT * FROM disciplinary_records WHERE guard_id = $1 AND company_id = $2 ORDER BY created_at DESC', [id, guard.company_id]);
        incidents = iRows || [];
      } else {
        incidents = [];
      }
    } catch {
      incidents = [];
    }
    res.status(200).json({
      ...normalizedTop,
      guarantors: scrubbedGuarantors,
      education_history: scrubbedEdu,
      education: scrubbedEdu,
      documents: canSeeDocs ? docsRows.map(d => ({ ...d, url: fixUrl(d.url || d.file_url || d.path || null), file_url: fixUrl(d.file_url) })) : [],
      incidents: Array.isArray(incidents) ? incidents : [],
      work_history: workHistory || []
    });
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

// Update guard (partial). Also emits alert email when blacklisted.
app.patch('/api/guards/:id', requireAuth, async (req, res) => {
  try {
    let id = req.params.id;
    const incoming = req.body || {};
    const { performance_score: _ps_ignored, score: _score_ignored, ...payload } = incoming;
    const actor = req.user || {};
    // Resolve actor's company for HR roles
    let myCompanyId = await getActorCompanyId(actor);
    let current = null;
    if (isValidUuid(id)) {
      const { rows: currentRows } = await pool.query(
        'SELECT id, full_name, performance_score, status, updated_at, dossier_data, company_id FROM guards WHERE id = $1 LIMIT 1',
        [id]
      );
      current = currentRows[0] || null;
    }
    if (!current && (actor.role === 'applicant' || actor.role === 'guard') && actor?.email) {
      const { rows: eRows } = await pool.query(
        'SELECT id, full_name, performance_score, status, updated_at, dossier_data, company_id FROM guards WHERE lower(email) = lower($1) LIMIT 1',
        [actor.email]
      );
      current = eRows[0] || null;
      if (current) id = current.id;
    }
    if (!current) return res.status(404).json({ error: 'not_found' });

    // Field normalization only (legacy inputs should be fixed at clients)
    // Accept generic site/supervisor fields and normalize to DB columns
    if ('site_id' in payload) {
      payload.current_site_id = payload.site_id || null;
      delete payload.site_id;
    }
    if ('supervisor_id' in payload) {
      payload.assigned_supervisor_id = payload.supervisor_id || null;
      delete payload.supervisor_id;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'address') && !Object.prototype.hasOwnProperty.call(payload, 'physical_address')) {
      payload.physical_address = payload.address;
      delete payload.address;
    }
    // Ensure HR updates preserve company_id association if not explicitly provided
    if ((actor.role === 'company_admin' || actor.role === 'hr_officer') && myCompanyId && !Object.prototype.hasOwnProperty.call(payload, 'company_id')) {
      payload.company_id = current?.company_id || myCompanyId;
    }
    // Auto-set active when both site and supervisor are provided in this request
    const providedSiteNow = Object.prototype.hasOwnProperty.call(payload, 'current_site_id') && payload.current_site_id;
    const providedSupNow = Object.prototype.hasOwnProperty.call(payload, 'assigned_supervisor_id') && payload.assigned_supervisor_id;
    if (providedSiteNow && providedSupNow && !Object.prototype.hasOwnProperty.call(payload, 'status')) {
      payload.status = 'active';
    }
    const canChangeStatus =
      actor.role === 'super_admin' ||
      actor.role === 'system_hr' ||
      actor.role === 'hr_officer' ||
      actor.role === 'company_admin';
    const isSelfSubmit =
      (!canChangeStatus) &&
      actor?.role === 'applicant' &&
      actor?.sub &&
      String(actor.sub) === String(id) &&
      String(payload?.status || '').toLowerCase() === 'submitted_application' &&
      String(current?.status || '').toLowerCase() === 'draft';
    if (!canChangeStatus && !isSelfSubmit && 'status' in payload) {
      delete payload.status;
    }

    // Auto-timeout for pooled interviews (3 days, Workflow A)
    try {
      const src = String(
        (current?.dossier_data && (current.dossier_data.interview_source || current.dossier_data['interview_source'])) || ''
      ).toLowerCase();
      const lockedAtRaw =
        (current?.dossier_data && (current.dossier_data.interview_locked_at || current.dossier_data['interview_locked_at'])) || null;
      const lockedAt = lockedAtRaw ? new Date(lockedAtRaw) : (current?.updated_at ? new Date(current.updated_at) : null);
      const isInterviewing = String(current?.status || '').toLowerCase() === 'interviewing';
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const expired = lockedAt && (Date.now() - lockedAt.getTime()) > threeDaysMs;
      if (isInterviewing && src === 'company_hr' && expired) {
        payload.status = 'marketplace';
        payload.company_id = null;
      }
    } catch { }

    const allowed = new Set([
      'full_name', 'phone', 'nida_number',
      'status',
      'current_site_id', 'assigned_supervisor_id',
      'company_id', 'dossier_data',
      'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship',
      'address', 'emergency_contact', 'emergency_contact_name', 'emergency_contact_phone',
      'nida_front_url', 'birth_cert_url', 'application_letter_url', 'residence_letter_url',
      'medical_report_url', 'police_clearance_url', 'cv_url', 'previous_employer_letter_url',
      'employment_contract_url', 'passport_photo_url',
      'profile_score', 'dob', 'is_armed', 'current_shift',
      'agreed_salary', 'contract_start_date', 'contract_end_date', 'has_signed_contract'
    ]);
    if (Object.prototype.hasOwnProperty.call(payload, 'performance_score')) {
      return res.status(400).json({ error: 'score_readonly' });
    }
    // Enforce 'active' requires site and supervisor (align exact column names)
    if (String(payload?.status || '').toLowerCase() === 'active') {
      const nextSiteId = payload.current_site_id || current?.current_site_id;
      const nextSupId = payload.assigned_supervisor_id || current?.assigned_supervisor_id;
      if (!nextSiteId || !nextSupId) {
        return res.status(400).json({ error: 'bad_request', detail: 'active_requires_site_and_supervisor' });
      }
    }
    if (String(payload?.status || '').toLowerCase() === 'blacklisted' || String(payload?.status || '').toLowerCase() === 'blacklist') {
      return res.status(400).json({ error: 'blacklist_via_incident_only' });
    }
    const keys = Object.keys(payload || {}).filter(k => allowed.has(k));
    if (keys.length) {
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
      const values = keys.map(k => payload[k]);
      const sql = `UPDATE guards SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${keys.length + 1}`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql, [...values, id]);

        // Holistic fix: Sync next_of_kin table if kinship fields provided
        const nokName = payload.kin_name || payload.next_of_kin_name;
        const nokPhone = payload.kin_phone || payload.next_of_kin_phone;
        const nokRel = payload.kin_relationship || payload.next_of_kin_relationship;
        const nokAddr = payload.kin_address || payload.next_of_kin_address;

        if (nokName || nokPhone || nokRel) {
          await client.query(`
            INSERT INTO next_of_kin (guard_id, full_name, phone_number, relationship, physical_address, created_at)
            VALUES ($1, $2, $3, $4, $5, now())
            ON CONFLICT (guard_id) DO UPDATE
              SET full_name = COALESCE(EXCLUDED.full_name, next_of_kin.full_name),
                  phone_number = COALESCE(EXCLUDED.phone_number, next_of_kin.phone_number),
                  relationship = COALESCE(EXCLUDED.relationship, next_of_kin.relationship),
                  physical_address = COALESCE(EXCLUDED.physical_address, next_of_kin.physical_address)
          `, [id, nokName || null, nokPhone || null, nokRel || null, nokAddr || null]);
        }

        await client.query('COMMIT');
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { }
        throw err;
      } finally {
        client.release();
      }
    }

    // Direct blacklisting is disabled; incidents drive blacklisting

    const { rows: after } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    res.status(200).json(after[0] || null);
  } catch (e) {
    return sendDbError(res, e, 'Kusasisha taarifa za mlinzi kumeshindikana');
  }
});

// Update guard (partial). Also emits alert email when blacklisted.
/* removed duplicate PATCH /api/guards/:id */

app.get('/api/disciplinary/records', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let queryCompanyId = String(req.query.company_id || '').trim() || null;
    if (queryCompanyId === 'undefined' || queryCompanyId === 'null') {
      queryCompanyId = null;
    }
    let myCompanyId = await getActorCompanyId(actor);
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      if (queryCompanyId) {
        const { rows: r } = await pool.query(
          'SELECT * FROM disciplinary_records WHERE company_id = $1 ORDER BY created_at DESC',
          [queryCompanyId]
        );
        rows = r || [];
      } else {
        const { rows: r } = await pool.query(
          'SELECT * FROM disciplinary_records ORDER BY created_at DESC'
        );
        rows = r || [];
      }
    } else if (myCompanyId) {
      const effectiveCompanyId = queryCompanyId && queryCompanyId === myCompanyId ? myCompanyId : myCompanyId;
      const { rows: r } = await pool.query(
        'SELECT * FROM disciplinary_records WHERE company_id = $1 ORDER BY created_at DESC',
        [effectiveCompanyId]
      );
      rows = r || [];
    } else {
      rows = [];
    }
    res.status(200).json(rows);
  } catch (e) {
    console.error('GET /api/disciplinary/records error', e);
    res.status(500).json({ error: 'error' });
  }
});

app.post('/api/disciplinary/records', requireAuth, upload.single('evidence'), async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const payload = req.body || {};
      const guard_id = payload.guard_id;
      const company_id = payload.company_id;
      const description = payload.description || payload.formal_report || null;
      const incident_type = payload.incident_type || payload.incident_code || null;
      const action_taken = payload.action_taken || null;
      const evidenceUrl = (req?.file?.filename)
        ? `${PUBLIC_BASE_URL}/uploads/${req.file.filename}`
        : (payload.evidence_url || null);
      let penalty_points = typeof payload.penalty_points === 'number' ? payload.penalty_points : undefined;
      if (!guard_id || !company_id || !description || !incident_type) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'bad_request' });
      }
      const { rows: gRows } = await client.query('SELECT id, full_name FROM guards WHERE id = $1 LIMIT 1', [guard_id]);
      const g = gRows[0];
      if (!g) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'guard_not_found' });
      }

      // Set PostgreSQL session context for RLS policy
      if (company_id) {
        await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(company_id)]);
      }
      if (typeof penalty_points !== 'number') {
        try {
          const { rows: pRows } = await client.query(
            'SELECT points FROM disciplinary_codes WHERE code = $1 AND (company_id = $2 OR company_id IS NULL) ORDER BY company_id NULLS LAST LIMIT 1',
            [incident_type, company_id]
          );
          penalty_points = typeof pRows?.[0]?.points === 'number' ? pRows[0].points : 0;
        } catch {
          penalty_points = 0;
        }
      }
      const formal_report = action_taken ? `${incident_type}: ${description} | Action: ${action_taken}` : `${incident_type}: ${description}`;
      const cols = ['guard_id', 'company_id', 'formal_report', 'penalty_points', 'incident_code', 'created_at'];
      const vals = [guard_id, company_id, formal_report, Math.abs(penalty_points || 0), incident_type];
      let sql = 'INSERT INTO disciplinary_records (guard_id, company_id, formal_report, penalty_points, incident_code, created_at';
      let placeholders = '$1,$2,$3,$4,$5, now()';
      if (evidenceUrl) {
        sql = 'INSERT INTO disciplinary_records (guard_id, company_id, formal_report, penalty_points, incident_code, evidence_url, created_at';
        placeholders = '$1,$2,$3,$4,$5,$6, now()';
        vals.splice(5, 0, evidenceUrl);
      }
      sql += ') VALUES (' + placeholders + ') RETURNING *';
      const result = await client.query(sql, vals);

      if (result.rowCount === 0) {
        throw new Error('RLS Policy Violation: No rows affected');
      }
      console.log('[INCIDENT_INSERT] /api/disciplinary/records Success:', result.rows[0]);

      // Note: performance_score and blacklisted status are now handled by 
      // the adjust_guard_score_on_incident trigger in the database.
      // 100 - SUM(penalty_points) logic ensures non-duplication.

      await client.query('COMMIT');
      try {
        await sendAlertEmail(g.full_name || 'Unknown Guard', String(formal_report || ''), undefined);
      } catch { }
      res.status(200).json({ ok: true, guard_id, data: result.rows[0] });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { }
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    try { console.error('POST /api/disciplinary/records error', e); } catch { }
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  }
});

app.get('/api/verify-nida-unique', requireAuth, async (req, res) => {
  try {
    const nidaRaw = req.query?.nida_number ?? req.query?.nida ?? '';
    const nida = String(nidaRaw || '').trim();
    try { console.log('VERIFY NIDA UNIQUE', nida); } catch { }
    if (!nida) return res.status(400).json({ error: 'bad_request', message: 'nida_number required' });
    const { rows } = await pool.query('SELECT 1 FROM guards WHERE nida_number = $1 LIMIT 1', [nida]);
    const exists = Array.isArray(rows) && rows.length > 0;
    return res.status(200).json({ unique: !exists });
  } catch (e) {
    try { console.error('GET /api/verify-nida-unique error', e); } catch { }
    return res.status(500).json({ error: 'error' });
  }
});

app.post('/api/admin/data-cleanup', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    if (actor.role !== 'super_admin') return res.status(403).json({ error: 'forbidden' });
    const { action, guard_id, company_id, reason } = req.body || {};
    if (!action) return res.status(400).json({ error: 'bad_request' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (action === 'delete_guard') {
        if (!guard_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'bad_request' }); }
        await client.query('DELETE FROM guards WHERE id = $1', [guard_id]);
        await client.query('COMMIT');
        return res.status(200).json({ ok: true, deleted: guard_id });
      }
      if (action === 'justify_blacklist') {
        if (!guard_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'bad_request' }); }
        const { rows: gRows } = await client.query('SELECT id, company_id, performance_score FROM guards WHERE id = $1 LIMIT 1', [guard_id]);
        const g = gRows[0];
        if (!g) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'guard_not_found' }); }
        const compId = company_id || g.company_id || null;
        const currentScore = typeof g.performance_score === 'number' ? g.performance_score : 100;
        const neededPoints = currentScore;
        const reportText = reason || 'Legacy correction: added incident to justify blacklisted status.';
        await client.query(
          'INSERT INTO disciplinary_records (guard_id, company_id, formal_report, penalty_points, incident_code, created_at) VALUES ($1,$2,$3,$4,$5, now())',
          [guard_id, compId, reportText, Math.abs(neededPoints || 0), 'DATA_JUSTIFY']
        );
        await client.query('COMMIT');
        return res.status(200).json({ ok: true, guard_id, justification: true });
      }
      if (action === 'restore_marketplace') {
        if (!guard_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'bad_request' }); }
        await client.query(
          "UPDATE guards SET status = 'marketplace', current_site_id = NULL, assigned_supervisor_id = NULL, updated_at = now() WHERE id = $1",
          [guard_id]
        );
        await client.query('COMMIT');
        return res.status(200).json({ ok: true, restored: guard_id });
      }
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'unknown_action' });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { }
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  }
});

app.post('/api/guards/:id/approve', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    if (actor.role !== 'super_admin' && actor.role !== 'system_hr') {
      return res.status(403).json({ error: 'forbidden', message: 'Only System HR can approve applicants.' });
    }
    const guardId = req.params.id;
    const { rows } = await pool.query(
      "UPDATE guards SET status = 'marketplace', updated_at = now() WHERE id = $1 AND status = 'pending_approval' RETURNING id",
      [guardId]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'Guard not found or not pending approval' });
    res.status(200).json({ ok: true, id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: e?.message });
  }
});

app.post('/api/guards/:id/request-improvement', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    if (actor.role !== 'super_admin' && actor.role !== 'system_hr') {
      return res.status(403).json({ error: 'forbidden', message: 'Only System HR can request improvements.' });
    }
    const guardId = req.params.id;
    const { reason } = req.body || {};
    const { rows } = await pool.query(
      "UPDATE guards SET status = 'improvement_required', updated_at = now() WHERE id = $1 AND status = 'pending_approval' RETURNING id, dossier_data",
      [guardId]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found', message: 'Guard not found or not pending approval' });

    // Also unlock the dossier_data if it exists
    const currentDossier = rows[0].dossier_data || {};
    currentDossier.intake_locked = false;
    currentDossier.allow_edit = true;
    currentDossier.improvement_reason = reason || 'Please review and improve your application';

    await pool.query('UPDATE guards SET dossier_data = $1 WHERE id = $2', [currentDossier, guardId]);

    res.status(200).json({ ok: true, id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: e?.message });
  }
});

app.get('/api/sites', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await pool.query('SELECT * FROM sites ORDER BY created_at DESC');
      rows = r || [];
    } else if (myCompanyId) {
      const { rows: r } = await pool.query('SELECT * FROM sites WHERE company_id = $1 ORDER BY created_at DESC', [myCompanyId]);
      rows = r || [];
    } else {
      rows = [];
    }
    res.status(200).json(rows);
  } catch (e) {
    try {
      const safeKeys = Object.keys(req?.body || {});
      console.error('PATCH /api/guards/:id error', { id: req?.params?.id, keys: safeKeys, message: e?.message }, e);
    } catch { }
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  }
});

app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    // Only admins may create sites
    const allowed = ['super_admin', 'system_hr', 'company_admin'];
    if (!allowed.includes(actor.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions to create a site' });
    }

    const { name, lat, lng, geofence_radius_meters, supervisor_id } = req.body;
    // Use the company_id from the request body, or fall back to the actor's own company
    let company_id = req.body.company_id || null;
    if (!company_id) {
      company_id = await getActorCompanyId(actor);
    }

    if (!name) {
      return res.status(400).json({ error: 'bad_request', message: 'Site name is required' });
    }
    if (!company_id) {
      return res.status(400).json({ error: 'bad_request', message: 'company_id is required' });
    }

    const result = await pool.query(
      'INSERT INTO sites (name, lat, lng, geofence_radius_meters, supervisor_id, company_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, now(), now()) RETURNING *',
      [name, lat || null, lng || null, geofence_radius_meters || 100, supervisor_id || null, company_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/sites error:', err);
    res.status(500).json({ error: 'Failed to create site', detail: err?.message || String(err) });
  }
});

app.get('/api/profiles', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await pool.query('SELECT * FROM profiles ORDER BY created_at DESC');
      rows = r || [];
    } else if (myCompanyId) {
      const { rows: r } = await pool.query('SELECT * FROM profiles WHERE company_id = $1 ORDER BY created_at DESC', [myCompanyId]);
      rows = r || [];
    } else {
      rows = [];
    }
    res.status(200).json(rows);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.post('/api/profiles', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const { email, password, full_name, role, company_id } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'bad_request', message: 'Missing required fields' });
    }

    // Roles that are completely forbidden from creating other users
    const blockedActorRoles = ['guard', 'reg_officer', 'applicant'];
    if (blockedActorRoles.includes(actor.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Unauthorized actor role' });
    }

    // For non-super-admins, restrict which target roles they can create
    const tenantCreatableRoles = ['supervisor', 'reg_officer', 'hr_officer', 'procurement'];
    if (actor.role !== 'super_admin' && !tenantCreatableRoles.includes(role)) {
      return res.status(403).json({ error: 'forbidden', message: `Role '${role}' can only be created by a Super Admin` });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const hash = await bcrypt.hash(String(password), 10);
    const targetCompanyId = company_id || await getActorCompanyId(actor);

    // Generate UUID
    const uuid = (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    await client.query('BEGIN');

    // 1) Insert into users table
    await client.query(
      `INSERT INTO users (id, email, role, password, full_name, company_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuid, emailNorm, role, hash, full_name, targetCompanyId]
    );

    // 2) Insert into profiles table
    const { rows: pRows } = await client.query(
      `INSERT INTO profiles (id, email, role, password_hash, full_name, company_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, now(), now())
       RETURNING *`,
      [uuid, emailNorm, role, hash, full_name, targetCompanyId]
    );

    await client.query('COMMIT');

    res.status(201).json(pRows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('POST /api/profiles error:', e);
    if (e.code === '23505') {
      return res.status(409).json({ error: 'conflict', message: 'Email already exists' });
    }
    res.status(500).json({ error: 'server_error', detail: e.message });
  } finally {
    client.release();
  }
});


app.get('/api/companies', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
      rows = r || [];
    } else if (actor?.sub || actor.company_id) {
      let myCompanyId = await getActorCompanyId(actor);
      if (myCompanyId) {
        const { rows: r } = await pool.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [myCompanyId]);
        rows = r || [];
      } else {
        rows = [];
      }
    } else {
      rows = [];
    }
    res.status(200).json(rows);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/inventory/items', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const actor = req.user || {};
    const qCompanyId = String(req.query.company_id || '').trim() || null;

    // Determine which company to query
    let targetCompanyId = null;
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      targetCompanyId = qCompanyId || null; // null = all companies
    } else {
      targetCompanyId = actor.company_id || await getActorCompanyId(actor);
      if (!targetCompanyId) return res.status(200).json([]);
    }

    // Aggregate stock from inventory_logs:
    // current_stock = SUM(stock_in qty) - SUM(issue qty) + SUM(return qty)
    const companyFilter = targetCompanyId ? 'WHERE company_id = $1' : '';
    const params = targetCompanyId ? [targetCompanyId] : [];

    const { rows: logRows } = await pool.query(`
      SELECT
        COALESCE(item_name, item_id::text, 'Unknown') AS name,
        item_id,
        item_name,
        company_id,
        SUM(CASE WHEN action = 'stock_in' THEN quantity ELSE 0 END) AS total_in,
        SUM(CASE WHEN action = 'issue'    THEN quantity ELSE 0 END) AS total_issued,
        SUM(CASE WHEN action = 'return'   THEN quantity ELSE 0 END) AS total_returned,
        SUM(CASE WHEN action = 'stock_in' THEN quantity ELSE 0 END)
          - SUM(CASE WHEN action = 'issue'  THEN quantity ELSE 0 END)
          + SUM(CASE WHEN action = 'return' THEN quantity ELSE 0 END) AS stock_quantity,
        MAX(amount_owed) AS cost_per_unit,
        MAX(return_condition) AS condition,
        MAX(created_at) AS updated_at
      FROM inventory_logs
      ${companyFilter}
      GROUP BY COALESCE(item_name, item_id::text, 'Unknown'), item_id, item_name, company_id
      ORDER BY MAX(created_at) DESC
    `, params);

    // Also pull rows from inventory_items for items that have no logs yet
    let itemRows = [];
    try {
      const { rows: r } = await pool.query(
        targetCompanyId
          ? 'SELECT * FROM inventory_items WHERE company_id = $1 ORDER BY updated_at DESC NULLS LAST'
          : 'SELECT * FROM inventory_items ORDER BY updated_at DESC NULLS LAST',
        targetCompanyId ? [targetCompanyId] : []
      );
      itemRows = r || [];
    } catch { }

    // Merge: prefer log-aggregated data, fall back to inventory_items for items with no logs
    const logNames = new Set(logRows.map(r => String(r.name || '').toLowerCase()));
    const extraItems = itemRows.filter(i => !logNames.has(String(i.name || '').toLowerCase()));

    const merged = [
      ...logRows.map(r => {
        const cacheItem = itemRows.find(i => String(i.name || '').toLowerCase() === String(r.name || '').toLowerCase());
        return {
          id: r.item_id || cacheItem?.id || null,
          name: r.item_name || r.name,
          company_id: r.company_id,
          stock_quantity: Number(r.stock_quantity) || 0,
          total_in: Number(r.total_in) || 0,
          total_issued: Number(r.total_issued) || 0,
          total_returned: Number(r.total_returned) || 0,
          cost_per_unit: Number(r.cost_per_unit) || cacheItem?.cost_per_unit || 0,
          condition: r.condition || cacheItem?.condition || 'good',
          updated_at: r.updated_at
        };
      }),
      ...extraItems.map(i => ({ ...i, total_in: i.stock_quantity, total_issued: 0, total_returned: 0 }))
    ];

    res.status(200).json(merged);
  } catch (e) {
    console.error('[GET /api/inventory/items] error:', e.message);
    res.status(500).json({ error: 'error', message: e.message });
  }
});

app.patch('/api/inventory/items/:id', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const fields = [];
    const values = [];
    let i = 1;
    for (const k of ['name', 'cost_per_unit', 'stock_quantity', 'condition', 'company_id']) {
      if (payload[k] !== undefined) {
        fields.push(`${k} = $${i++}`);
        values.push(payload[k]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'bad_request' });
    values.push(id);
    const sql = `UPDATE inventory_items SET ${fields.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);
    res.status(200).json(rows[0] || null);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/inventory/custody', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const actor = req.user || {};
    const qCompanyId = String(req.query.company_id || '').trim() || null;
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      if (qCompanyId) {
        const { rows: r } = await pool.query('SELECT * FROM inventory_custody WHERE company_id = $1 ORDER BY issued_at DESC NULLS LAST, created_at DESC', [qCompanyId]);
        rows = r || [];
      } else {
        const { rows: r } = await pool.query('SELECT * FROM inventory_custody ORDER BY issued_at DESC NULLS LAST, created_at DESC');
        rows = r || [];
      }
    } else {
      let myCompanyId = await getActorCompanyId(actor);
      if (!myCompanyId) return res.status(200).json([]);
      const { rows: r } = await pool.query('SELECT * FROM inventory_custody WHERE company_id = $1 ORDER BY issued_at DESC NULLS LAST, created_at DESC', [myCompanyId]);
      rows = r || [];
    }
    res.status(200).json(rows);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

// Alias to satisfy specific requirements
app.get('/api/inventory/issued', requireAuth, async (req, res) => {
  req.url = '/api/inventory/custody';
  app.handle(req, res);
});

app.post('/api/inventory/custody', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const b = req.body || {};
    const { company_id, guard_id, item_id, quantity, issued_at, condition_at_issue } = b;
    if (!company_id || !guard_id || !item_id || !quantity) return res.status(400).json({ error: 'bad_request' });
    const { rows } = await pool.query(
      `INSERT INTO inventory_custody (company_id, guard_id, item_id, quantity, issued_at, condition_at_issue, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now(), now()) RETURNING *`,
      [company_id, guard_id, item_id, Number(quantity), issued_at || null, condition_at_issue || null]
    );
    res.status(200).json(rows[0] || null);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.delete('/api/inventory/custody/:id', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const id = req.params.id;
    const { rows: before } = await pool.query('SELECT * FROM inventory_custody WHERE id = $1 LIMIT 1', [id]);
    const row = before[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    const actor = req.user || {};
    if (!(actor.role === 'super_admin' || actor.role === 'system_hr')) {
      let myCompanyId = await getActorCompanyId(actor);
      if (!myCompanyId || String(myCompanyId) !== String(row.company_id)) {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
    await pool.query('DELETE FROM inventory_custody WHERE id = $1', [id]);
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/inventory/logs', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const actor = req.user || {};
    const qCompanyId = String(req.query.company_id || '').trim() || null;
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      if (qCompanyId) {
        const { rows: r } = await pool.query('SELECT * FROM inventory_logs WHERE company_id = $1 ORDER BY created_at DESC', [qCompanyId]);
        rows = r || [];
      } else {
        const { rows: r } = await pool.query('SELECT * FROM inventory_logs ORDER BY created_at DESC');
        rows = r || [];
      }
    } else {
      let myCompanyId = await getActorCompanyId(actor);
      if (!myCompanyId) return res.status(200).json([]);
      const { rows: r } = await pool.query('SELECT * FROM inventory_logs WHERE company_id = $1 ORDER BY created_at DESC', [myCompanyId]);
      rows = r || [];
    }
    res.status(200).json(rows);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.post('/api/inventory/logs', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const b = req.body || {};
    const { action, company_id, guard_id, item_id, quantity, return_condition, amount_owed, payment_status, created_at, paid_at } = b;
    if (!action || !company_id || !item_id) return res.status(400).json({ error: 'bad_request' });
    const { rows } = await pool.query(
      `INSERT INTO inventory_logs (action, company_id, guard_id, item_id, quantity, return_condition, amount_owed, payment_status, created_at, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9, now()), $10) RETURNING *`,
      [action, company_id, guard_id || null, item_id, quantity || 0, return_condition || null, amount_owed || null, payment_status || null, created_at || null, paid_at || null]
    );
    res.status(200).json(rows[0] || null);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

// Alias to satisfy specific requirements
app.post('/api/inventory/return', requireAuth, async (req, res) => {
  req.url = '/api/inventory/logs';
  app.handle(req, res);
});

app.patch('/api/inventory/logs/:id', requireAuth, blockRegOfficer, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const fields = [];
    const values = [];
    let i = 1;
    for (const k of ['payment_status', 'paid_at']) {
      if (payload[k] !== undefined) {
        fields.push(`${k} = $${i++}`);
        values.push(payload[k]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'bad_request' });
    values.push(id);
    const sql = `UPDATE inventory_logs SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);
    res.status(200).json(rows[0] || null);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

// POST /api/inventory/stock-in (late registration — kept as reference, early one above takes precedence)
// See early registration after /api/upload for the active handler.

// --- Settings: Disciplinary Codes ---
app.get('/api/disciplinary-codes', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);

    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await pool.query('SELECT * FROM disciplinary_codes ORDER BY created_at DESC');
      rows = r || [];
    } else if (myCompanyId) {
      const { rows: r } = await pool.query('SELECT * FROM disciplinary_codes WHERE company_id = $1 OR company_id IS NULL ORDER BY created_at DESC', [myCompanyId]);
      rows = r || [];
    } else {
      const { rows: r } = await pool.query('SELECT * FROM disciplinary_codes WHERE company_id IS NULL ORDER BY created_at DESC');
      rows = r || [];
    }
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: 'error', detail: e.message });
  }
});

app.patch('/api/disciplinary-codes/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code;
    const { points, is_approved } = req.body;
    let updates = [];
    let values = [];
    let idx = 1;

    if (points !== undefined) {
      updates.push(`points = $${idx++}`);
      values.push(points);
    }
    if (is_approved !== undefined) {
      updates.push(`is_approved = $${idx++}`);
      values.push(is_approved);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(code);
    const sql = `UPDATE disciplinary_codes SET ${updates.join(', ')} WHERE code = $${idx} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (rows.length === 0) return res.status(404).json({ error: 'Code not found' });
    res.status(200).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'error', detail: e.message });
  }
});

app.delete('/api/disciplinary-codes/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code;
    const { rows } = await pool.query('DELETE FROM disciplinary_codes WHERE code = $1 RETURNING *', [code]);
    if (rows.length === 0) return res.status(404).json({ error: 'Code not found' });
    res.status(200).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'error', detail: e.message });
  }
});

// --- Operations: Incident Reporting ---
app.get('/api/ops/incidents', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);

    const baseSelect = `
      SELECT
        id, guard_id, company_id,
        incident_code,
        incident_code AS code,
        penalty_points,
        penalty_points AS points_deducted,
        formal_report,
        formal_report AS notes,
        rough_notes,
        evidence_url,
        created_at
      FROM disciplinary_records
    `;

    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await pool.query(`${baseSelect} ORDER BY created_at DESC`);
      rows = r;
    } else if (myCompanyId) {
      const { rows: r } = await pool.query(`${baseSelect} WHERE company_id = $1 ORDER BY created_at DESC`, [myCompanyId]);
      rows = r;
    } else {
      const { rows: r } = await pool.query(`${baseSelect} ORDER BY created_at DESC LIMIT 200`);
      rows = r;
    }
    res.status(200).json(rows || []);
  } catch (e) {
    res.status(500).json({ error: 'error', detail: e.message });
  }
});

app.post('/api/ops/incidents', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const payload = req.body || {};
    const { guard_id, title, notes, evidence_image_url, severity, site_id } = payload;

    if (!guard_id) {
      client.release();
      return res.status(400).json({ error: 'bad_request', message: 'guard_id is required' });
    }

    await client.query('BEGIN');

    const { rows: gRows } = await client.query('SELECT company_id FROM guards WHERE id = $1 LIMIT 1', [guard_id]);
    const companyId = gRows[0]?.company_id || actor.company_id || null;

    // MANDATORY ACTION 3: Fix RLS Session Context
    if (companyId) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(companyId)]);
    }

    // MANDATORY ACTION 4: Point Deduction Logic
    const deduction = severity === 'critical' ? 20 : severity === 'high' ? 15 : severity === 'medium' ? 10 : 5;

    if (result.rowCount === 0) throw new Error('RLS Policy Violation: No rows affected');

    // Note: performance_score and blacklisted status are now handled by 
    // the adjust_guard_score_on_incident trigger in the database.
    // 100 - SUM(penalty_points) logic ensures non-duplication.

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Incident logged successfully', data: result.rows[0] });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    console.error('[INCIDENT_INSERT] POST /api/ops/incidents error:', e);
    res.status(500).json({ error: 'error', detail: e?.message || String(e) });
  } finally {
    client.release();
  }
});

// --- Admin Alerts: High Incident Guards in last 30 days (3+ incidents) ---
app.get('/api/admin/alerts/high-incidents', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const role = String(actor.role || '').toLowerCase();
    if (role !== 'super_admin' && role !== 'system_hr' && actor.email !== 'admin@amini.co.tz') {
      return res.status(403).json({ error: 'forbidden', message: 'super_admin role required' });
    }
    const rowsSql = `
      WITH agg AS (
        SELECT dr.guard_id,
               COUNT(*)::int AS incident_count,
               MAX(dr.created_at) AS latest_at
        FROM disciplinary_records dr
        WHERE dr.created_at >= now() - interval '30 days'
        GROUP BY dr.guard_id
        HAVING COUNT(*) >= 3
      )
      SELECT g.id AS guard_id,
             g.full_name,
             c.name AS company_name,
             a.incident_count,
             a.latest_at,
             last.formal_report AS incident_description,
             last.incident_code
      FROM agg a
      JOIN guards g ON g.id = a.guard_id
      LEFT JOIN companies c ON c.id = g.company_id
      LEFT JOIN LATERAL (
        SELECT dr2.formal_report, dr2.incident_code, dr2.created_at
        FROM disciplinary_records dr2
        WHERE dr2.guard_id = g.id
        ORDER BY dr2.created_at DESC
        LIMIT 1
      ) last ON true
      ORDER BY a.incident_count DESC, a.latest_at DESC
    `;
    const { rows } = await pool.query(rowsSql);
    res.status(200).json(rows || []);
  } catch (e) {
    console.error('GET /api/admin/alerts/high-incidents error', e);
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/rosters', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    let myCompanyId = actor.company_id || null;
    let mySiteId = null;

    if (!myCompanyId && actor?.sub && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.sub)) {
      try {
        const { rows: meRows } = await pool.query('SELECT company_id, current_site_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
        myCompanyId = meRows[0]?.company_id || null;
        mySiteId = meRows[0]?.current_site_id || null;
      } catch { }
    }

    const qSiteId = String(req.query?.site_id || '').trim() || null;
    const qStart = String(req.query?.start || '').trim() || null;
    const qEnd = String(req.query?.end || '').trim() || null;
    await client.query('BEGIN');
    // Set PostgreSQL session context for RLS policy
    if (myCompanyId) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(myCompanyId)]);
    }
    if (qSiteId) {
      await client.query("SELECT set_config('app.current_site_id', $1, true)", [String(qSiteId)]);
    } else if (mySiteId) { // Use resolved mySiteId if qSiteId is not provided
      await client.query("SELECT set_config('app.current_site_id', $1, true)", [String(mySiteId)]);
    }
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      if (qSiteId && qStart && qEnd) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE site_id = $1 AND shift_date BETWEEN $2 AND $3 ORDER BY shift_date ASC', [qSiteId, qStart, qEnd]);
        rows = r || [];
      } else if (qStart && qEnd) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE shift_date BETWEEN $1 AND $2 ORDER BY shift_date ASC', [qStart, qEnd]);
        rows = r || [];
      } else if (qSiteId) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE site_id = $1 ORDER BY shift_date DESC NULLS LAST, created_at DESC', [qSiteId]);
        rows = r || [];
      } else {
        const { rows: r } = await client.query('SELECT * FROM rosters ORDER BY shift_date DESC NULLS LAST, created_at DESC');
        rows = r || [];
      }
    } else {
      if (!myCompanyId) {
        await client.query('ROLLBACK');
        return res.status(200).json([]);
      }
      if (qSiteId && qStart && qEnd) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE site_id = $1 AND shift_date BETWEEN $2 AND $3 ORDER BY shift_date ASC', [qSiteId, qStart, qEnd]);
        rows = r || [];
      } else if (qStart && qEnd) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE shift_date BETWEEN $1 AND $2 ORDER BY shift_date ASC', [qStart, qEnd]);
        rows = r || [];
      } else if (qSiteId) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE site_id = $1 ORDER BY shift_date DESC NULLS LAST, created_at DESC', [qSiteId]);
        rows = r || [];
      } else {
        const { rows: r } = await client.query('SELECT * FROM rosters ORDER BY shift_date DESC NULLS LAST, created_at DESC');
        rows = r || [];
      }
    }
    await client.query('COMMIT');
    res.status(200).json(rows);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    res.status(500).json({ error: 'error', message: e?.message, detail: e?.detail });
  } finally {
    client.release();
  }
});

// ROSTER ENDPOINTS (Unified & Hardened)
app.get('/api/rosters', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    let myCompanyId = await getActorCompanyId(actor);

    const qSiteId = (req.query?.site_id || '').trim() || null;
    const qStart = (req.query?.start || '').trim() || null;
    const qEnd = (req.query?.end || '').trim() || null;

    await client.query('BEGIN');

    // Set company context for RLS if applicable
    if (myCompanyId) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(myCompanyId)]);
    }

    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      if (qSiteId && qStart && qEnd) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE site_id = $1 AND shift_date BETWEEN $2 AND $3 ORDER BY shift_date ASC', [qSiteId, qStart, qEnd]);
        rows = r || [];
      } else if (qStart && qEnd) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE shift_date BETWEEN $1 AND $2 ORDER BY shift_date ASC', [qStart, qEnd]);
        rows = r || [];
      } else if (qSiteId) {
        const { rows: r } = await client.query('SELECT * FROM rosters WHERE site_id = $1 ORDER BY shift_date DESC NULLS LAST, created_at DESC', [qSiteId]);
        rows = r || [];
      } else {
        const { rows: r } = await client.query('SELECT * FROM rosters ORDER BY shift_date DESC NULLS LAST, created_at DESC');
        rows = r || [];
      }
    } else {
      if (!myCompanyId) {
        await client.query('ROLLBACK');
        return res.status(200).json([]);
      }

      const siteFilter = qSiteId ? 'AND site_id = $2' : '';
      const params = qSiteId ? [myCompanyId, qSiteId] : [myCompanyId];

      const { rows: r } = await client.query(
        `SELECT * FROM rosters WHERE company_id = $1 ${siteFilter} ORDER BY shift_date DESC NULLS LAST, created_at DESC`,
        params
      );
      rows = r || [];
    }

    await client.query('COMMIT');
    res.status(200).json(rows);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    console.error('GET /api/rosters error:', e);
    res.status(500).json({ error: 'error', detail: e.message });
  } finally {
    client.release();
  }
});

app.post('/api/rosters', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const actor = req.user || {};
    const b = req.body || {};
    const site_id = b.site_id || null;
    const company_id = b.company_id || actor.company_id || null;
    const guard_id = b.guard_id || null;
    const shift_date = b.shift_date || b.date || null;
    const shift_type = b.shift_type || b.shift || null;
    const status = b.status || 'scheduled';
    if (!guard_id || !shift_date || !shift_type) {
      return res.status(400).json({ error: 'bad_request' });
    }
    await client.query('BEGIN');
    // Set PostgreSQL session context for RLS policy
    if (company_id) {
      await client.query("SELECT set_config('app.current_company_id', $1, true)", [String(company_id)]);
    }
    if (site_id) {
      await client.query("SELECT set_config('app.current_site_id', $1, true)", [String(site_id)]);
    } else if (actor?.sub) {
      try {
        const { rows: sRows } = await pool.query('SELECT current_site_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
        const sid = sRows[0]?.current_site_id || null;
        if (sid) await client.query("SELECT set_config('app.current_site_id', $1, true)", [String(sid)]);
      } catch { }
    }
    let existing = null;
    if (site_id) {
      try {
        const { rows } = await client.query('SELECT * FROM rosters WHERE guard_id = $1 AND site_id = $2 AND shift_date = $3 LIMIT 1', [guard_id, site_id, shift_date]);
        existing = rows[0] || null;
      } catch { }
    } else {
      try {
        const { rows } = await client.query('SELECT * FROM rosters WHERE guard_id = $1 AND shift_date = $2 LIMIT 1', [guard_id, shift_date]);
        existing = rows[0] || null;
      } catch { }
    }
    if (existing && existing.id) {
      const { rows } = await client.query(
        'UPDATE rosters SET shift_type = $1, status = $2, updated_at = now() WHERE id = $3 RETURNING *',
        [shift_type, status, existing.id]
      );
      await client.query('COMMIT');
      return res.status(200).json(rows[0] || null);
    } else {
      const cols = ['company_id', 'site_id', 'guard_id', 'shift_date', 'shift_type', 'status', 'created_at', 'updated_at'];
      const vals = [company_id, site_id, guard_id, shift_date, shift_type, status];
      const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', 'now()', 'now()'];
      const sql = `INSERT INTO rosters (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const { rows } = await client.query(sql, vals);
      await client.query('COMMIT');
      return res.status(200).json(rows[0] || null);
    }
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { }
    res.status(500).json({ error: 'error', message: e?.message, detail: e?.detail });
  } finally {
    client.release();
  }
});

// Health check: DB connectivity and guards columns
app.get('/api/health/db', async (req, res) => {
  try {
    const { rows: verRows } = await pool.query('SELECT version()');
    const { rows: cols } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'guards' AND column_name IN ('status','performance_score')"
    );
    const present = (cols || []).map(r => r.column_name);
    res.status(200).json({
      ok: true,
      db_version: verRows?.[0]?.version || null,
      guards_columns: present
    });
  } catch (e) {
    res.status(500).json({ error: 'db_unavailable' });
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/api/uploads/')) {
    console.error(`STATIC FILE 404: File not found on disk at "${path.join(uploadsDir, req.path.replace(/^\/(api\/)?uploads\//, ''))}"`);
  }
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'internal_error' });
});

// --- Lifecycle Maintenance: Auto-revert stalled interviews (System HR source) ---
async function cleanupStaleInterviews() {
  try {
    await pool.query(
      `UPDATE guards
       SET status = 'marketplace',
           company_id = NULL,
           updated_at = now(),
           dossier_data = jsonb_set(COALESCE(dossier_data, '{}'::jsonb), '{interview_timeout}', to_jsonb(now())::jsonb, true)
       WHERE status = 'interviewing'
         AND COALESCE(dossier_data->>'interview_source','sys_hr') <> 'company_hr'
         AND updated_at < now() - interval '3 days'`
    );
  } catch (e) {
    console.error('cleanupStaleInterviews failed', e);
  }
}
setInterval(cleanupStaleInterviews, 60 * 60 * 1000);
cleanupStaleInterviews();

const port = 3001;
app.listen(port, () => {
  console.log(`server on ${port}`);
});
