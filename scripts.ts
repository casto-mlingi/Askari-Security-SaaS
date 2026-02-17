export const adminScripts = `
Company Admin Script
SQL SCRIPTS FOR 

///Company Admin script 

-- 1. Create/Update the Profile for the Company Admin
INSERT INTO public.profiles (id, email, full_name, role, company_id)
VALUES (
  '4dd4c7a4-d1a3-4c98-b587-c640e37b2493',
  'amanianasel@proton.me',
  'Amani Anasel',
  'company_admin',
  'd639b8f0-b4b3-4f4b-bfed-1bfc4d554e9d'
)
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'company_admin',
  company_id = 'd639b8f0-b4b3-4f4b-bfed-1bfc4d554e9d';

-- 2. Verify the Admin is linked
SELECT * FROM profiles WHERE role = 'company_admin';

///COMPAMY CORE PROCUMENT

-- 1. Create or Update Adriana as PROCUREMENT
INSERT INTO public.profiles (id, email, full_name, role, company_id)
VALUES (
  'bb4f8097-f185-4c81-a278-0d9748de0520',
  'adrianaanasel@proton.me',
  'Adriana Anasel',
  'procurement',
  'd639b8f0-b4b3-4f4b-bfed-1bfc4d554e9d'
)
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'procurement',
  company_id = 'd639b8f0-b4b3-4f4b-bfed-1bfc4d554e9d';

-- 2. Verify the change
SELECT * FROM profiles WHERE email = 'adrianaanasel@proton.me';
`;
