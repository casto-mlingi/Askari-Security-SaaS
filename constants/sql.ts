/**
 * AMINI_SQL_SCHEMA: The foundational database schema for the AMINI Multi-Tenant SaaS.
 * UPDATED: Includes 'Infinite Recursion' fixes and Strict Company Isolation for Inventory.
 */
export const AMINI_SQL_SCHEMA = `-- AMINI Multi-Tenant Security SaaS: Hardened Schema v2.2 (PostgreSQL)

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

-- CRITICAL FIX: Security Definer Functions to prevent Infinite Recursion
-- These allow policies to check Role/Company without triggering RLS loops.
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id::text FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


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
DROP TRIGGER IF EXISTS set_timestamp_companies ON companies;
CREATE TRIGGER set_timestamp_companies
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- RLS: Companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View_Own_Company" ON companies;
CREATE POLICY "View_Own_Company" ON companies
FOR SELECT USING (
  id::text = get_my_company_id() -- Uses Safe Function
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'standard', 'enterprise')),
    status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_end TIMESTAMPTZ NOT NULL,
    max_guards INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

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
DROP TRIGGER IF EXISTS set_timestamp_profiles ON profiles;
CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- RLS: Profiles (Fixed for Recursion)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Final_Profile_Access" ON profiles;
CREATE POLICY "Final_Profile_Access" ON profiles
FOR SELECT USING (
  id = auth.uid() 
  OR
  company_id::text = get_my_company_id()
  OR
  get_my_role() = 'super_admin'
);

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
DROP TRIGGER IF EXISTS set_timestamp_sites ON sites;
CREATE TRIGGER set_timestamp_sites
BEFORE UPDATE ON sites
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- RLS: Sites
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View_Company_Sites" ON sites;
CREATE POLICY "View_Company_Sites" ON sites
FOR SELECT USING (
  company_id::text = get_my_company_id()
);


-- Block 2: Assets, Personnel, & Operations (Inventory & Guards)

-- ... [Other Tables: administrative_logs, announcements, equipment_items, disciplinary_codes are same as before] ...

CREATE TABLE IF NOT EXISTS guards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    nida_number TEXT NOT NULL,
    full_name TEXT NOT NULL,
    -- ... [Rest of fields same as original schema] ...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_guards_nida_number UNIQUE (nida_number)
);
ALTER TABLE guards ENABLE ROW LEVEL SECURITY;
-- Basic Guard Access Policies
CREATE POLICY "Staff_View_Guards" ON guards FOR SELECT
USING (company_id::text = get_my_company_id());

-- INVENTORY SECTION (Strict Isolation)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cost_per_unit DOUBLE PRECISION NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    condition TEXT CHECK (condition IN ('new','good','better','bad','worse')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    action TEXT CHECK (action IN ('restock','issue','return')),
    guard_id UUID,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    stock_condition TEXT CHECK (stock_condition IN ('new','good','better','bad','worse')),
    return_condition TEXT CHECK (return_condition IN ('good','damaged','lost')),
    amount_owed DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_custody (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_custody ENABLE ROW LEVEL SECURITY;

-- STRICT INVENTORY POLICIES (Procurement/Admin ONLY)

-- 1. Items
CREATE POLICY "Strict_View_Items" ON inventory_items FOR SELECT
USING (
  company_id::text = get_my_company_id() 
  AND get_my_role() IN ('procurement', 'company_admin', 'super_admin')
);

CREATE POLICY "Strict_Manage_Items" ON inventory_items FOR ALL
USING (
  company_id::text = get_my_company_id() 
  AND get_my_role() IN ('procurement', 'company_admin', 'super_admin')
);

-- 2. Logs
CREATE POLICY "Strict_View_Logs" ON inventory_logs FOR SELECT
USING (
  company_id::text = get_my_company_id() 
  AND get_my_role() IN ('procurement', 'company_admin', 'super_admin')
);

CREATE POLICY "Strict_Manage_Logs" ON inventory_logs FOR ALL
USING (
  company_id::text = get_my_company_id() 
  AND get_my_role() IN ('procurement', 'company_admin', 'super_admin')
);

-- 3. Custody
CREATE POLICY "Strict_View_Custody" ON inventory_custody FOR SELECT
USING (
  company_id::text = get_my_company_id() 
  AND get_my_role() IN ('procurement', 'company_admin', 'super_admin')
);

CREATE POLICY "Strict_Manage_Custody" ON inventory_custody FOR ALL
USING (
  company_id::text = get_my_company_id() 
  AND get_my_role() IN ('procurement', 'company_admin', 'super_admin')
);
`;