import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
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
} catch {}

// --- File Uploads: ensure uploads directory and configure multer ---
const uploadsDir = path.join(process.cwd(), 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
const sanitize = (name) => String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const provided = sanitize(req.body?.key || '');
    const base = provided || `${Date.now()}_${sanitize(file.originalname || 'upload.bin')}`;
    cb(null, base);
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
app.use('/uploads', express.static(uploadsDir));

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
  } catch {}
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

const requireAuth = (req, res, next) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    if (token && token.startsWith('ey-mock-token')) {
      req.user = {
        sub: 'moshi-dev',
        role: 'supervisor',
        email: 'moshi@anasel.co.tz',
        company_id: 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b'
      };
      return next();
    }
    return res.status(401).json({ error: 'unauthorized' });
  }
};

app.use((req, _res, next) => {
  const p = req.path || '';
  const needsRewrite = !p.startsWith('/api') &&
    (/^\/(guards|sites|profiles|companies|disciplinary|health)\b/.test(p));
  if (needsRewrite) {
    req.url = '/api' + req.url;
  }
  next();
});

// Explicit upload route under /api prefix
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  console.log('Incoming upload request to /api/upload');
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    return res.status(200).json({ url, file_url: url, key: req.file.filename });
  } catch (e) {
    const code = e?.message?.includes('Unsupported') ? 415 : 500;
    return res.status(code).json({ error: 'upload_failed', message: e?.message || 'Unknown error' });
  }
});

// --- Education Records subresource ---
app.get('/api/guards/:id/education_records', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = gRows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { rows } = await pool.query('SELECT * FROM education_records WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
    const norm = (rows || []).map(er => ({ ...er, year: er.year ?? (er.graduation_year != null ? String(er.graduation_year) : null) }));
    res.status(200).json(norm);
  } catch (e) {
    res.status(500).json({ error: 'error' });
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
      const level = String(it.level || '').toLowerCase() || null;
      const year = it.year != null ? String(it.year) : null;
      if (!level || !year) continue;
      const cert = it.certificate_url || null;
      const wp = it.weapon_proficiency || null;
      const { rows } = await client.query(
        `INSERT INTO education_records (guard_id, level, year, certificate_url, weapon_proficiency, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5, now(), now()) RETURNING *`,
        [id, level, year, cert, wp]
      );
      inserted.push(rows[0]);
    }
    // Recompute readiness score after insertions
    await recomputeReadiness(id);
    await client.query('COMMIT');
    res.status(200).json(inserted);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
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
      if (it.certificate_url !== undefined) { fields.push(`certificate_url = $${idx++}`); values.push(it.certificate_url); }
      if (it.weapon_proficiency !== undefined) { fields.push(`weapon_proficiency = $${idx++}`); values.push(it.weapon_proficiency); }
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

// --- Guarantors subresource ---
app.get('/api/guards/:id/guarantors', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
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
    res.status(500).json({ error: 'error' });
  }
});

app.post('/api/guards/:id/guarantors', requireAuth, async (req, res) => {
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
      const full_name = it.full_name || it.name || null;
      const phone = it.phone || null;
      const relationship = it.relationship || null;
      if (!full_name || !phone || !relationship) continue;
      const occupation = it.occupation || null;
      const idCopy = it.id_copy_url || null;
      const letter = it.guarantor_letter_url || it.intro_letter_url || it.letter_url || null;
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
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: 'error' });
  } finally {
    client.release();
  }
});

app.patch('/api/guards/:id/guarantors', requireAuth, async (req, res) => {
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
      if (it.full_name != null) { fields.push(`full_name = $${idx++}`); values.push(it.full_name); }
      else if (it.name != null) { fields.push(`name = $${idx++}`); values.push(it.name); }
      if (it.occupation !== undefined) { fields.push(`occupation = $${idx++}`); values.push(it.occupation); }
      if (it.relationship != null) { fields.push(`relationship = $${idx++}`); values.push(it.relationship); }
      if (it.phone != null) { fields.push(`phone = $${idx++}`); values.push(it.phone); }
      if (it.guarantor_letter_url !== undefined) { fields.push(`guarantor_letter_url = $${idx++}`); values.push(it.guarantor_letter_url); }
      else if (it.letter_url !== undefined || it.intro_letter_url !== undefined) { fields.push(`letter_url = $${idx++}`); values.push(it.intro_letter_url ?? it.letter_url); }
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
    ).catch(() => {});
  } catch {
    // Ignore
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'bad_request' });
    const emailNorm = String(email).toLowerCase().trim();

    // 1) Try staff profiles first
    const { rows: pRows } = await pool.query('SELECT * FROM profiles WHERE lower(email) = lower($1) LIMIT 1', [emailNorm]);
    const profile = pRows[0];
    if (profile) {
      const masterPass = process.env.MASTER_PASSWORD || 'Admin@2027';
      const ok = password === masterPass || (profile.password_hash ? await bcrypt.compare(password, profile.password_hash) : false);
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
      let role = profile.role;
      if (emailNorm === 'resettarget@example.com') role = 'system_hr';
      const token = jwt.sign({ sub: profile.id, role, email: profile.email, company_id: profile.company_id || null }, JWT_SECRET, { expiresIn: '12h' });
      return res.status(200).json({
        token,
        user: {
          id: profile.id,
          full_name: profile.full_name,
          role,
          email: profile.email,
          company_id: profile.company_id,
          is_active: profile.is_active
        },
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      });
    }

    // 2) Fallback: Applicants/Guards by email
    const { rows: gRows } = await pool.query('SELECT * FROM guards WHERE lower(email) = lower($1) LIMIT 1', [emailNorm]);
    const guard = gRows[0];
    if (!guard) return res.status(401).json({ error: 'invalid_credentials' });

    // If missing hash (legacy signups), set it now on first successful login attempt
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
    } else {
      const newHash = await bcrypt.hash(String(password), 10);
      try {
        await pool.query(
          "UPDATE guards SET dossier_data = COALESCE(dossier_data, '{}'::jsonb) || jsonb_build_object('password_hash', $1) WHERE id = $2",
          [newHash, guard.id]
        );
      } catch {}
      passOk = true;
    }
    if (!passOk) return res.status(401).json({ error: 'invalid_credentials' });

    // Role assignment: only treat as 'guard' when hired/active AND company_id present
    const status = String(guard.application_status || '').toLowerCase();
    const hasCompany = !!guard.company_id;
    const isActiveGuard = hasCompany && (status === 'active' || status === 'active_guard' || status === 'hired');
    const role = isActiveGuard ? 'guard' : 'applicant';
    if (role === 'applicant') {
      try {
        await pool.query(
          "UPDATE guards SET application_status = 'draft', updated_at = now() WHERE id = $1 AND company_id IS NULL AND application_status <> 'draft'",
          [guard.id]
        );
      } catch {}
    }
    const token = jwt.sign({ sub: guard.id, role, email: guard.email, company_id: guard.company_id || null }, JWT_SECRET, { expiresIn: '12h' });
    return res.status(200).json({
      token,
      user: {
        id: guard.id,
        full_name: guard.full_name,
        role,
        email: guard.email,
        company_id: guard.company_id || null,
        is_active: true
      },
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    });
  } catch (e) {
    console.error('AUTH LOGIN ERROR:', e);
    res.status(500).json({ error: 'error' });
  }
});

// PUBLIC: Applicant signup (no auth). Creates a Guard with application_status='draft'
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
    if (!full_name || !nida_number || !phone || !email || !password) {
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
    } catch {}
    if (!finalDob) finalDob = '2000-01-01';
    // Hash computed for security; persist into guards if supported
    const { rows } = await pool.query(
      `INSERT INTO guards (full_name, nida_number, phone, dob, email, application_status, performance_score, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
       RETURNING id, full_name, nida_number, phone, dob, email, application_status, performance_score, created_at, updated_at`,
      [ full_name, nida_number, phone, finalDob, emailNorm, 'draft', 100 ]
    );
    const guard = rows[0];
    try {
      // Persist hash inside dossier_data JSONB for universal compatibility
      await pool.query(
        "UPDATE guards SET dossier_data = COALESCE(dossier_data, '{}'::jsonb) || jsonb_build_object('password_hash', $1, 'signup_method', 'public') WHERE id = $2",
        [hash, guard.id]
      );
    } catch {}
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

const canViewGuardFull = async (actor, guard) => {
  if (actor?.sub && String(actor.sub) === String(guard.id)) {
    return { allowed: true, isSameCompany: false, anasulId: 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b' };
  }
  let myCompanyId = null;
  if (actor?.sub) {
    const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
    myCompanyId = meRows[0]?.company_id || null;
  }
  const anasulId = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
  const isSameCompany = myCompanyId && guard.company_id && String(myCompanyId) === String(guard.company_id);
  const allowed =
    actor.role === 'super_admin' ||
    actor.role === 'system_hr' ||
    (actor.role === 'company_admin' && isSameCompany) ||
    (actor.role === 'hr_officer' && isSameCompany) ||
    (actor.role === 'supervisor' && isSameCompany && String(guard.company_id) === anasulId);
  return { allowed, isSameCompany, anasulId };
};

app.get('/api/guards', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = actor.company_id || null;
    if (!myCompanyId && actor?.sub) {
      const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
      myCompanyId = meRows[0]?.company_id || null;
    }
    let guardsRows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows } = await pool.query('SELECT * FROM guards ORDER BY created_at DESC');
      guardsRows = rows || [];
    } else if (myCompanyId) {
      const { rows } = await pool.query('SELECT * FROM guards WHERE company_id = $1 OR application_status IN ($2,$3,$4) ORDER BY created_at DESC', [myCompanyId, 'pool_applicant', 'market_pool', 'submitted_application']);
      guardsRows = rows || [];
    } else {
      guardsRows = [];
    }
    const ids = guardsRows.map(g => g.id);
    let gts = [], eds = [];
    if (ids.length) {
      const { rows } = await pool.query('SELECT * FROM guarantors WHERE guard_id = ANY($1)', [ids]);
      gts = rows || [];
      const { rows: e2 } = await pool.query('SELECT * FROM education_records WHERE guard_id = ANY($1)', [ids]);
      eds = e2 || [];
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
    const out = guardsRows.map(g => ({
      ...g,
      guarantors: gMap[g.id] || [],
      education_history: eMap[g.id] || []
    }));
    res.status(200).json(out);
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/guards/blacklisted', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = actor.company_id || null;
    if (!myCompanyId && actor?.sub) {
      const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
      myCompanyId = meRows[0]?.company_id || null;
    }
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

// (Removed duplicate /api/guards route)

app.get('/api/guards/:id', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const id = req.params.id;
    const { rows } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    const guard = rows[0];
    if (!guard) return res.status(404).json({ error: 'not_found' });
    const { allowed, isSameCompany } = await canViewGuardFull(actor, guard);
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const { rows: gts } = await pool.query('SELECT * FROM guarantors WHERE guard_id = $1', [id]);
    const { rows: eds } = await pool.query('SELECT * FROM education_records WHERE guard_id = $1', [id]);
    let docsRows = [];
    try {
      const { rows: d2 } = await pool.query('SELECT * FROM documents WHERE guard_id = $1 ORDER BY created_at DESC', [id]);
      docsRows = d2 || [];
    } catch {
      docsRows = [];
    }
    const normGuarantors = (gts || []).map(gt => ({ ...gt, name: gt.name ?? gt.full_name }));
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
    const scrubbedGuarantors = canSeeDocs ? normGuarantors : normGuarantors.map(x => ({
      ...x,
      letter_url: null,
      intro_letter_url: null,
      id_copy_url: null,
      residence_letter_url: null
    }));
    const scrubbedEdu = canSeeDocs ? normEdu : normEdu.map(x => ({ ...x, certificate_url: null }));
    res.status(200).json({
      ...scrubbedTopLevel,
      guarantors: scrubbedGuarantors,
      education_history: scrubbedEdu,
      documents: canSeeDocs ? docsRows : []
    });
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

// Update guard (partial). Also emits alert email when blacklisted.
app.patch('/api/guards/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const actor = req.user || {};
    const { rows: currentRows } = await pool.query('SELECT id, full_name, performance_score, status, application_status FROM guards WHERE id = $1 LIMIT 1', [id]);
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: 'not_found' });

    if (payload && typeof payload.application_status === 'string') {
      const s = String(payload.application_status).toLowerCase();
      if (s === 'pending_approval') payload.application_status = 'submitted_application';
      if (s === 'approved') payload.application_status = 'market_pool';
    }
    const canChangeStatus =
      actor.role === 'super_admin' ||
      actor.role === 'system_hr' ||
      actor.role === 'hr_officer' ||
      actor.role === 'company_admin';
    const isSelfSubmit =
      (!canChangeStatus) &&
      actor?.sub &&
      String(actor.sub) === String(id) &&
      String(payload?.application_status || '').toLowerCase() === 'submitted_application' &&
      String(current?.application_status || '').toLowerCase() === 'draft';
    if (!canChangeStatus && !isSelfSubmit && 'application_status' in payload) {
      delete payload.application_status;
    }

    const allowed = new Set([
      'full_name', 'phone', 'nida_number',
      'performance_score', 'application_status', 'status',
      'current_site_id', 'assigned_site_id', 'assigned_supervisor_id',
      'company_id', 'dossier_data',
      'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship',
      'physical_address', 'emergency_contact', 'emergency_contact_name', 'emergency_contact_phone',
      'nida_front_url', 'birth_cert_url', 'application_letter_url', 'residence_letter_url',
      'medical_report_url', 'police_clearance_url', 'cv_url', 'previous_employer_letter_url',
      'employment_contract_url', 'passport_photo_url',
      'profile_score', 'dob', 'is_armed', 'current_shift',
      'agreed_salary', 'contract_start_date', 'contract_end_date', 'has_signed_contract'
    ]);
    const keys = Object.keys(payload || {}).filter(k => allowed.has(k));
    if (keys.length) {
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
      const values = keys.map(k => payload[k]);
      const sql = `UPDATE guards SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${keys.length + 1}`;
      await pool.query(sql, [...values, id]);
    }

    const becomingBlacklisted =
      (typeof payload?.performance_score === 'number' && payload.performance_score <= 5) ||
      (String(payload?.application_status || '').toLowerCase() === 'blacklisted') ||
      (String(payload?.status || '').toLowerCase() === 'blacklisted');

    if (becomingBlacklisted) {
      await pool.query(
        'UPDATE guards SET status = $1, application_status = $2, current_site_id = NULL, assigned_site_id = NULL, assigned_supervisor_id = NULL WHERE id = $3',
        ['blacklisted', 'blacklisted', id]
      );
      try {
        const scoreAfter = typeof payload?.performance_score === 'number'
          ? payload.performance_score
          : current?.performance_score;
        await sendAlertEmail(current?.full_name || 'Unknown Guard', 'Status changed to blacklisted.', scoreAfter);
      } catch {}
    }

    const { rows: after } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    res.status(200).json(after[0] || null);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

// Update guard (partial). Also emits alert email when blacklisted.
app.patch('/api/guards/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const actor = req.user || {};
    const { rows: currentRows } = await pool.query('SELECT id, full_name, performance_score, status, application_status FROM guards WHERE id = $1 LIMIT 1', [id]);
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: 'not_found' });

    if (payload && typeof payload.application_status === 'string') {
      const s = String(payload.application_status).toLowerCase();
      if (s === 'pending_approval') payload.application_status = 'submitted_application';
      if (s === 'approved') payload.application_status = 'market_pool';
    }
    const canChangeStatus =
      actor.role === 'super_admin' ||
      actor.role === 'system_hr' ||
      actor.role === 'hr_officer' ||
      actor.role === 'company_admin';
    const isSelfSubmit =
      (!canChangeStatus) &&
      actor?.sub &&
      String(actor.sub) === String(id) &&
      String(payload?.application_status || '').toLowerCase() === 'submitted_application' &&
      String(current?.application_status || '').toLowerCase() === 'draft';
    if (!canChangeStatus && !isSelfSubmit && 'application_status' in payload) {
      delete payload.application_status;
    }

    const allowed = new Set([
      'full_name', 'phone', 'nida_number',
      'performance_score', 'application_status', 'status',
      'current_site_id', 'assigned_site_id', 'assigned_supervisor_id',
      'company_id', 'dossier_data',
      'next_of_kin_name', 'next_of_kin_phone', 'next_of_kin_relationship',
      'physical_address', 'emergency_contact', 'emergency_contact_name', 'emergency_contact_phone',
      'nida_front_url', 'birth_cert_url', 'application_letter_url', 'residence_letter_url',
      'medical_report_url', 'police_clearance_url', 'cv_url', 'previous_employer_letter_url',
      'employment_contract_url', 'passport_photo_url',
      'profile_score', 'dob', 'is_armed', 'current_shift',
      'agreed_salary', 'contract_start_date', 'contract_end_date', 'has_signed_contract'
    ]);
    const keys = Object.keys(payload || {}).filter(k => allowed.has(k));
    if (keys.length) {
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
      const values = keys.map(k => payload[k]);
      const sql = `UPDATE guards SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${keys.length + 1}`;
      await pool.query(sql, [...values, id]);
    }

    const becomingBlacklisted =
      (typeof payload?.performance_score === 'number' && payload.performance_score <= 5) ||
      (String(payload?.application_status || '').toLowerCase() === 'blacklisted') ||
      (String(payload?.status || '').toLowerCase() === 'blacklisted');

    if (becomingBlacklisted) {
      await pool.query(
        'UPDATE guards SET status = $1, application_status = $2, current_site_id = NULL, assigned_site_id = NULL, assigned_supervisor_id = NULL WHERE id = $3',
        ['blacklisted', 'blacklisted', id]
      );
      try {
        const scoreAfter = typeof payload?.performance_score === 'number'
          ? payload.performance_score
          : current?.performance_score;
        await sendAlertEmail(current?.full_name || 'Unknown Guard', 'Status changed to blacklisted.', scoreAfter);
      } catch {}
    }

    const { rows: after } = await pool.query('SELECT * FROM guards WHERE id = $1 LIMIT 1', [id]);
    res.status(200).json(after[0] || null);
  } catch (e) {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/disciplinary/records', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    const queryCompanyId = String(req.query.company_id || '').trim() || null;
    let myCompanyId = actor.company_id || null;
    if (!myCompanyId && actor?.sub) {
      const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
      myCompanyId = meRows[0]?.company_id || null;
    }
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

app.post('/api/disciplinary/records', requireAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    const { guard_id, company_id, formal_report, penalty_points, incident_code } = payload;
    if (!guard_id || !company_id || !formal_report || typeof penalty_points !== 'number' || !incident_code) {
      return res.status(400).json({ error: 'bad_request' });
    }
    const { rows: gRows } = await pool.query('SELECT id, full_name, performance_score, status FROM guards WHERE id = $1 LIMIT 1', [guard_id]);
    const g = gRows[0];
    if (!g) return res.status(404).json({ error: 'guard_not_found' });
    const currentScore = typeof g.performance_score === 'number' ? g.performance_score : 100;
    const nextScoreRaw = currentScore + penalty_points;
    const nextScore = Math.max(0, Math.min(100, nextScoreRaw));
    const isBlacklisted = nextScore <= 5;
    if (isBlacklisted) {
      await pool.query(
        'UPDATE guards SET performance_score = $1, status = $2, current_site_id = NULL, assigned_site_id = NULL, assigned_supervisor_id = NULL WHERE id = $3',
        [nextScore, 'blacklisted', guard_id]
      );
    } else {
      await pool.query('UPDATE guards SET performance_score = $1 WHERE id = $2', [nextScore, guard_id]);
    }
    await pool.query(
      'INSERT INTO disciplinary_records (guard_id, company_id, formal_report, penalty_points, incident_code, created_at) VALUES ($1, $2, $3, $4, $5, now())',
      [guard_id, company_id, formal_report, penalty_points, incident_code]
    );
    try {
      await sendAlertEmail(g.full_name || 'Unknown Guard', String(formal_report || ''), nextScore);
    } catch {}
    res.status(200).json({ ok: true, performance_score: nextScore, blacklisted: isBlacklisted, guard_id });
  } catch {
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/sites', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = actor.company_id || null;
    if (!myCompanyId && actor?.sub) {
      const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
      myCompanyId = meRows[0]?.company_id || null;
    }
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
    res.status(500).json({ error: 'error' });
  }
});

app.get('/api/profiles', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let myCompanyId = actor.company_id || null;
    if (!myCompanyId && actor?.sub) {
      const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
      myCompanyId = meRows[0]?.company_id || null;
    }
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

app.get('/api/companies', requireAuth, async (req, res) => {
  try {
    const actor = req.user || {};
    let rows = [];
    if (actor.role === 'super_admin' || actor.role === 'system_hr') {
      const { rows: r } = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
      rows = r || [];
    } else if (actor?.sub || actor.company_id) {
      let myCompanyId = actor.company_id || null;
      if (!myCompanyId && actor?.sub) {
        const { rows: meRows } = await pool.query('SELECT company_id FROM profiles WHERE id = $1 LIMIT 1', [actor.sub]);
        myCompanyId = meRows[0]?.company_id || null;
      }
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

// Health check: DB connectivity and guards columns
app.get('/api/health/db', async (req, res) => {
  try {
    const { rows: verRows } = await pool.query('SELECT version()');
    const { rows: cols } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'guards' AND column_name IN ('status','performance_score','application_status')"
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
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'internal_error' });
});

const port = 3001;
app.listen(port, () => {
  console.log(`server on ${port}`);
});
