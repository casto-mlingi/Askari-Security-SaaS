-- AMINI Security SaaS Database Migration Script
-- Run this in Supabase SQL Editor to ensure all tables and fields exist

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create timestamp update function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    contact_email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_companies ON companies;
CREATE TRIGGER set_timestamp_companies BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Profiles table
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

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_profiles ON profiles;
CREATE TRIGGER set_timestamp_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Sites table
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

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_sites ON sites;
CREATE TRIGGER set_timestamp_sites BEFORE UPDATE ON sites FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Administrative logs table
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

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_announcements ON announcements;
CREATE TRIGGER set_timestamp_announcements BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Equipment items table
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

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_equipment_items ON equipment_items;
CREATE TRIGGER set_timestamp_equipment_items BEFORE UPDATE ON equipment_items FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Guards table (main table)
CREATE TABLE IF NOT EXISTS guards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    nida_number TEXT NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    phone TEXT,
    profile_score INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 100,
    readiness_score INTEGER DEFAULT 0,
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
    weapon_qualification TEXT,
    next_of_kin_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_relationship TEXT,
    nida_front_url TEXT,
    birth_cert_url TEXT,
    application_letter_url TEXT,
    residence_letter_url TEXT,
    medical_report_url TEXT,
    dossier_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_guards_nida_number UNIQUE (nida_number)
);

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_guards ON guards;
CREATE TRIGGER set_timestamp_guards BEFORE UPDATE ON guards FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Education records table
CREATE TABLE IF NOT EXISTS education_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('primary', 'secondary', 'advanced', 'nta4_5', 'military')),
    year TEXT NOT NULL,
    certificate_url TEXT,
    weapon_proficiency TEXT CHECK (weapon_proficiency IN ('pass', 'fail')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_education_records ON education_records;
CREATE TRIGGER set_timestamp_education_records BEFORE UPDATE ON education_records FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Guarantors table
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

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_guarantors ON guarantors;
CREATE TRIGGER set_timestamp_guarantors BEFORE UPDATE ON guarantors FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Attendance logs table
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

-- Disciplinary codes table
CREATE TABLE IF NOT EXISTS disciplinary_codes (
    code TEXT PRIMARY KEY NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_code_per_company UNIQUE (code, company_id)
);

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_disciplinary_codes ON disciplinary_codes;
CREATE TRIGGER set_timestamp_disciplinary_codes BEFORE UPDATE ON disciplinary_codes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Incident reports table
CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    code TEXT NOT NULL REFERENCES disciplinary_codes(code) ON DELETE RESTRICT,
    notes TEXT,
    evidence_url TEXT,
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add modern columns for Digital DOB (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_reports' AND column_name = 'title') THEN
        ALTER TABLE incident_reports ADD COLUMN title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_reports' AND column_name = 'severity') THEN
        ALTER TABLE incident_reports ADD COLUMN severity TEXT CHECK (severity IN ('low','medium','high','critical'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_reports' AND column_name = 'evidence_image_url') THEN
        ALTER TABLE incident_reports ADD COLUMN evidence_image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incident_reports' AND column_name = 'updated_at') THEN
        ALTER TABLE incident_reports ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Kit issuances table
CREATE TABLE IF NOT EXISTS kit_issuances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    issuer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    items_issued JSONB NOT NULL,
    guard_signature_hash TEXT,
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave requests table
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

-- Drop existing trigger if it exists, then recreate
DROP TRIGGER IF EXISTS set_timestamp_leave_requests ON leave_requests;
CREATE TRIGGER set_timestamp_leave_requests BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'standard', 'enterprise')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_end TIMESTAMPTZ NOT NULL,
    max_guards INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_guards_company_id ON guards(company_id);
CREATE INDEX IF NOT EXISTS idx_guards_application_status ON guards(application_status);
CREATE INDEX IF NOT EXISTS idx_guards_current_site_id ON guards(current_site_id);
CREATE INDEX IF NOT EXISTS idx_sites_company_id ON sites(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_administrative_logs_company_id ON administrative_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_announcements_company_id ON announcements(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_company_id ON equipment_items(company_id);
CREATE INDEX IF NOT EXISTS idx_education_records_guard_id ON education_records(guard_id);
CREATE INDEX IF NOT EXISTS idx_guarantors_guard_id ON guarantors(guard_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_guard_id ON incident_reports(guard_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_guard_id ON leave_requests(guard_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_guard_id ON attendance_logs(guard_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_guard_id ON incident_reports(guard_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_guard_id ON leave_requests(guard_id);

-- Insert default disciplinary codes if they don't exist
INSERT INTO disciplinary_codes (code, label, points) VALUES
('AWOL', 'Absence Without Leave', 25),
('LATE', 'Late for Duty', 5),
('UNIFORM', 'Improper Uniform', 5),
('SLEEP', 'Sleeping on Duty', 40),
('THEFT', 'Theft or Misconduct', 100),
('OTHER_REPORT', 'Other Self-Reported Issue', 0)
ON CONFLICT (code, company_id) DO NOTHING;

-- Add any missing columns to existing tables (safe to run multiple times)
-- Add any missing columns to existing tables (safe to run multiple times)
DO $$
BEGIN
    -- Add weapon_qualification to guards if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guards' AND column_name = 'weapon_qualification') THEN
        ALTER TABLE guards ADD COLUMN weapon_qualification TEXT;
        RAISE NOTICE 'Added weapon_qualification column to guards table';
    ELSE
        RAISE NOTICE 'weapon_qualification column already exists in guards table';
    END IF;

    -- Add readiness_score to guards if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guards' AND column_name = 'readiness_score') THEN
        ALTER TABLE guards ADD COLUMN readiness_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added readiness_score column to guards table';
    ELSE
        RAISE NOTICE 'readiness_score column already exists in guards table';
    END IF;

    -- Add medical_report_url to guards if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guards' AND column_name = 'medical_report_url') THEN
        ALTER TABLE guards ADD COLUMN medical_report_url TEXT;
        RAISE NOTICE 'Added medical_report_url column to guards table';
    ELSE
        RAISE NOTICE 'medical_report_url column already exists in guards table';
    END IF;

    -- Add any other missing columns here as needed
    -- Example:
    -- IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guards' AND column_name = 'new_column') THEN
    --     ALTER TABLE guards ADD COLUMN new_column TEXT;
    --     RAISE NOTICE 'Added new_column to guards table';
    -- END IF;
END $$;

-- Ensure all tables have proper permissions for authenticated users
-- Grant necessary permissions (adjust as needed for your RLS policies)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Company-scoped inventory hardening (safe to run multiple times)
-- Add company_id columns to inventory tables
ALTER TABLE IF EXISTS inventory_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS inventory_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS inventory_custody ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Enable RLS on inventory tables
ALTER TABLE IF EXISTS inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_custody ENABLE ROW LEVEL SECURITY;

-- Replace permissive policies with company-scoped policies (super_admin can see all)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_items' AND polname = 'inventory_items_select') THEN
    DROP POLICY inventory_items_select ON inventory_items;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_items' AND polname = 'inventory_items_insert') THEN
    DROP POLICY inventory_items_insert ON inventory_items;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_items' AND polname = 'inventory_items_update') THEN
    DROP POLICY inventory_items_update ON inventory_items;
  END IF;
END$$;

DROP POLICY IF EXISTS inventory_items_select_company ON inventory_items;
CREATE POLICY inventory_items_select_company ON inventory_items
FOR SELECT
TO authenticated
USING (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_items.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);
DROP POLICY IF EXISTS inventory_items_insert_company ON inventory_items;
CREATE POLICY inventory_items_insert_company ON inventory_items
FOR INSERT
TO authenticated
WITH CHECK (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_items.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);
DROP POLICY IF EXISTS inventory_items_update_company ON inventory_items;
CREATE POLICY inventory_items_update_company ON inventory_items
FOR UPDATE
TO authenticated
USING (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_items.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_items.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_logs' AND polname = 'inventory_logs_select') THEN
    DROP POLICY inventory_logs_select ON inventory_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_logs' AND polname = 'inventory_logs_insert') THEN
    DROP POLICY inventory_logs_insert ON inventory_logs;
  END IF;
END$$;
DROP POLICY IF EXISTS inventory_logs_select_company ON inventory_logs;
CREATE POLICY inventory_logs_select_company ON inventory_logs
FOR SELECT
TO authenticated
USING (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_logs.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);
DROP POLICY IF EXISTS inventory_logs_insert_company ON inventory_logs;
CREATE POLICY inventory_logs_insert_company ON inventory_logs
FOR INSERT
TO authenticated
WITH CHECK (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_logs.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_custody' AND polname = 'inventory_custody_select') THEN
    DROP POLICY inventory_custody_select ON inventory_custody;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_custody' AND polname = 'inventory_custody_insert') THEN
    DROP POLICY inventory_custody_insert ON inventory_custody;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_custody' AND polname = 'inventory_custody_delete') THEN
    DROP POLICY inventory_custody_delete ON inventory_custody;
  END IF;
END$$;
DROP POLICY IF EXISTS inventory_custody_select_company ON inventory_custody;
CREATE POLICY inventory_custody_select_company ON inventory_custody
FOR SELECT
TO authenticated
USING (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_custody.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);
DROP POLICY IF EXISTS inventory_custody_insert_company ON inventory_custody;
CREATE POLICY inventory_custody_insert_company ON inventory_custody
FOR INSERT
TO authenticated
WITH CHECK (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_custody.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);
DROP POLICY IF EXISTS inventory_custody_delete_company ON inventory_custody;
CREATE POLICY inventory_custody_delete_company ON inventory_custody
FOR DELETE
TO authenticated
USING (
  (
    SELECT p.role = 'super_admin' OR p.company_id = inventory_custody.company_id
    FROM profiles p WHERE p.id = auth.uid()
  )
);

-- Indexes for company scoping on inventory tables
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_id ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_company_id ON inventory_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_custody_company_id ON inventory_custody(company_id);
