
/**
 * AMINI_SQL_SCHEMA: The foundational database schema for the AMINI Multi-Tenant SaaS.
 * This is exported as a string for documentation and reference within the app.
 *
 * ARCHITECTURAL REVISION: 2.1
 * - Normalized `education_history`, `guarantors`, and `next_of_kin` into dedicated tables/columns for improved data integrity and querying.
 * - Added new tables for `equipment_items`, `leave_requests`, `announcements`, and `disciplinary_codes`.
 * - Implemented an automatic `updated_at` trigger for all new tables.
 * - Enforced data integrity with stricter CHECK constraints and CASCADE/SET NULL on foreign keys.
 * - Clarified JSONB data structures with comments.
 */
export const AMINI_SQL_SCHEMA = `-- AMINI Multi-Tenant Security SaaS: Hardened Schema v2.1 (PostgreSQL)

-- Block 0: Core Extensions & Reusable Functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to automatically update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Block 1: Core Identity, Multi-Tenancy, & Infrastructure

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, 
    contact_email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_companies
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'standard', 'enterprise')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_end TIMESTAMPTZ NOT NULL,
    max_guards INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin', 'hr_officer', 'procurement', 'supervisor')),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_company_role CHECK ((role = 'super_admin' AND company_id IS NULL) OR (role <> 'super_admin' AND company_id IS NOT NULL))
);
CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    geofence_radius_meters INTEGER DEFAULT 200, 
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_sites
BEFORE UPDATE ON sites
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS administrative_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, 
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, -- Company-specific announcements
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Who created it
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_announcements
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS equipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('uniform', 'footwear', 'tactical', 'weapon', 'communications')),
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_equipment_items
BEFORE UPDATE ON equipment_items
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS disciplinary_codes (
    code TEXT PRIMARY KEY NOT NULL, -- E.g., 'AWOL', 'LATE'
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Nullable for global codes, specific for tenant overrides
    label TEXT NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_code_per_company UNIQUE (code, company_id)
);
CREATE TRIGGER set_timestamp_disciplinary_codes
BEFORE UPDATE ON disciplinary_codes
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Block 2: Assets, Personnel, & Operations

CREATE TABLE IF NOT EXISTS guards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Nullable for pool applicants
    nida_number TEXT NOT NULL,
    username TEXT UNIQUE, -- For guard portal login
    password_hash TEXT, -- Nullable until account is claimed
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    phone TEXT,
    profile_score INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 100,
    application_status TEXT NOT NULL DEFAULT 'draft' CHECK (application_status IN ('draft', 'pending', 'pool_applicant', 'interview_locked', 'procurement_pending', 'interviewing', 'hired', 'active', 'rejected', 'blacklisted', 'disqualified', 'leave_without_permit', 'on_leave')),
    current_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    assigned_supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    agreed_salary DOUBLE PRECISION,
    contract_start_date DATE,
    contract_end_date DATE,
    has_signed_contract BOOLEAN DEFAULT FALSE,
    employment_contract_url TEXT,
    current_shift TEXT CHECK (current_shift IN ('day', 'night')),
    leave_return_date DATE,
    consecutive_absences INTEGER DEFAULT 0,
    residence_lat DOUBLE PRECISION,
    residence_lng DOUBLE PRECISION,
    is_armed BOOLEAN DEFAULT FALSE,
    
    -- Next of Kin (migrated from dossier_data)
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,

    -- Documents (migrated from dossier_data / top-level)
    nida_front_url TEXT,
    birth_cert_url TEXT,
    application_letter_url TEXT,
    residence_letter_url TEXT,

    -- Remaining JSONB data for flexibility / AI analysis
    dossier_data JSONB,
    -- JSONB Structure for dossier_data:
    -- {
    --   "interviewer_notes": "...",
    --   "rejection_reason": "...",
    --   "ai_analysis": { "reliability_score": 85, "reasoning": "...", "risk_flags": ["..."], "analyzed_at": "timestamp" }
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Explicit Constraint for NIDA Uniqueness
    CONSTRAINT uq_guards_nida_number UNIQUE (nida_number)
);
CREATE TRIGGER set_timestamp_guards
BEFORE UPDATE ON guards
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS education_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('primary', 'secondary', 'advanced', 'nta4_5', 'military')),
    year TEXT NOT NULL, -- Store as text to allow flexible formats like '2010', '2015-2017'
    certificate_url TEXT,
    weapon_proficiency TEXT CHECK (weapon_proficiency IN ('pass', 'fail')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_education_records
BEFORE UPDATE ON education_records
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS guarantors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL,
    letter_url TEXT,
    residence_letter_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_guarantors
BEFORE UPDATE ON guarantors
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'rejected'))
);

CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    code TEXT NOT NULL REFERENCES disciplinary_codes(code) ON DELETE RESTRICT, -- RESTRICT to prevent deleting code if used
    notes TEXT,
    evidence_url TEXT,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kit_issuances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    issuer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    items_issued JSONB NOT NULL, -- Array of { item_id: UUID, qty: int, size: string }
    guard_signature_hash TEXT,
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('short', 'long')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_leave_requests
BEFORE UPDATE ON leave_requests
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
`;
