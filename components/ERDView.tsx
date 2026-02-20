
import React from 'react';

const ERDView: React.FC = () => {
  const tables = [
    {
      name: 'companies',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'name', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'slug', type: 'TEXT', meta: 'UNIQUE' },
        { name: 'is_active', type: 'BOOLEAN', meta: "DEFAULT TRUE" },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-indigo-50 border-indigo-200',
      headerColor: 'bg-indigo-600'
    },
     {
      name: 'subscriptions',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'plan_type', type: 'TEXT', meta: 'CHECK' },
        { name: 'status', type: 'TEXT', meta: 'CHECK' },
        { name: 'current_period_end', type: 'TIMESTAMPTZ' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-600'
    },
    {
      name: 'profiles',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'full_name', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'role', type: 'TEXT', meta: 'CHECK' },
        { name: 'email', type: 'TEXT', meta: 'UNIQUE' },
        { name: 'password_hash', type: 'TEXT', meta: 'SECURE' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-slate-50 border-slate-200',
      headerColor: 'bg-slate-700'
    },
    {
      name: 'sites',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'name', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'lat', type: 'DOUBLE PRECISION' },
        { name: 'lng', type: 'DOUBLE PRECISION' },
        { name: 'geofence_radius_meters', type: 'INT', meta: 'DEFAULT 200' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'supervisor_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-cyan-50 border-cyan-200',
      headerColor: 'bg-cyan-600'
    },
    {
      name: 'guards',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE, NULL for pool' },
        { name: 'nida_number', type: 'TEXT', meta: 'UNIQUE' },
        { name: 'username', type: 'TEXT', meta: 'UNIQUE' },
        { name: 'password_hash', type: 'TEXT' },
        { name: 'full_name', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'dob', type: 'DATE', meta: 'NOT NULL' },
        { name: 'status', type: 'TEXT', meta: 'CHECK' },
        { name: 'current_site_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'assigned_supervisor_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'is_armed', type: 'BOOLEAN', meta: 'DEFAULT FALSE' },
        { name: 'next_of_kin_name', type: 'TEXT' },
        { name: 'next_of_kin_phone', type: 'TEXT' },
        { name: 'next_of_kin_relationship', type: 'TEXT' },
        { name: 'nida_front_url', type: 'TEXT' },
        { name: 'birth_cert_url', type: 'TEXT' },
        { name: 'application_letter_url', type: 'TEXT' },
        { name: 'residence_letter_url', type: 'TEXT' },
        { name: 'dossier_data', type: 'JSONB', meta: 'AI analysis, notes' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-600'
    },
    {
      name: 'education_records',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'guard_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'level', type: 'TEXT', meta: 'CHECK' },
        { name: 'year', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'certificate_url', type: 'TEXT' },
        { name: 'weapon_proficiency', type: 'TEXT', meta: 'CHECK' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-600'
    },
    {
      name: 'guarantors',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'guard_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'name', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'phone', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'relationship', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'letter_url', type: 'TEXT' },
        { name: 'residence_letter_url', type: 'TEXT' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-orange-50 border-orange-200',
      headerColor: 'bg-orange-600'
    },
    {
      name: 'attendance_logs',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'guard_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'site_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'supervisor_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'checked_in_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'lat', type: 'DOUBLE PRECISION', meta: 'NOT NULL' },
        { name: 'lng', type: 'DOUBLE PRECISION', meta: 'NOT NULL' },
        { name: 'distance_meters', type: 'DOUBLE PRECISION', meta: 'NOT NULL' },
        { name: 'status', type: 'TEXT', meta: 'CHECK' },
      ],
      color: 'bg-emerald-50 border-emerald-200',
      headerColor: 'bg-emerald-600'
    },
    {
      name: 'incident_reports',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'guard_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'site_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'code', type: 'TEXT', meta: 'FK disciplinary_codes' },
        { name: 'notes', type: 'TEXT' },
        { name: 'evidence_url', type: 'TEXT' },
        { name: 'reported_by', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-600'
    },
    {
      name: 'kit_issuances',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'guard_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'issuer_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'items_issued', type: 'JSONB', meta: '{item_id, qty, size, notes}' },
        { name: 'guard_signature_hash', type: 'TEXT' },
        { name: 'issued_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-amber-50 border-amber-200',
      headerColor: 'bg-amber-600'
    },
    {
      name: 'leave_requests',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'guard_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'type', type: 'TEXT', meta: 'CHECK' },
        { name: 'start_date', type: 'DATE', meta: 'NOT NULL' },
        { name: 'end_date', type: 'DATE', meta: 'NOT NULL' },
        { name: 'reason', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'status', type: 'TEXT', meta: 'CHECK' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-rose-50 border-rose-200',
      headerColor: 'bg-rose-600'
    },
    {
      name: 'announcements',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'title', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'content', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'author_profile_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-teal-50 border-teal-200',
      headerColor: 'bg-teal-600'
    },
    {
      name: 'disciplinary_codes',
      fields: [
        { name: 'code', type: 'TEXT (PK)', meta: 'NOT NULL' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE, NULL for global' },
        { name: 'label', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'points', type: 'INTEGER', meta: 'NOT NULL' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
        { name: 'updated_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-fuchsia-50 border-fuchsia-200',
      headerColor: 'bg-fuchsia-600'
    },
    {
      name: 'administrative_logs',
      fields: [
        { name: 'id', type: 'UUID (PK)', meta: 'DEFAULT v4' },
        { name: 'company_id', type: 'UUID (FK)', meta: 'CASCADE' },
        { name: 'actor_id', type: 'UUID (FK)', meta: 'SET NULL' },
        { name: 'action_type', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'entity_type', type: 'TEXT', meta: 'NOT NULL' },
        { name: 'entity_id', type: 'UUID', meta: 'NOT NULL' },
        { name: 'payload', type: 'JSONB' },
        { name: 'ip_address', type: 'TEXT' },
        { name: 'created_at', type: 'TIMESTAMPTZ', meta: 'AUTO' },
      ],
      color: 'bg-gray-50 border-gray-200',
      headerColor: 'bg-gray-600'
    },
  ];

  return (
    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 p-5 md:p-10 animate-in fade-in duration-300">
       <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900">Database Schema (ERD)</h2>
                <p className="text-slate-500 text-xs font-medium">Visual representation of AMINI's data architecture. Updated to v2.1.</p>
            </div>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tables.map(table => (
          <div key={table.name} className={`rounded-3xl border-2 shadow-md overflow-hidden ${table.color}`}>
            <div className={`p-5 ${table.headerColor}`}>
              <h3 className="font-black text-white uppercase tracking-tight">{table.name}</h3>
            </div>
            <div className="p-5 space-y-3">
              {table.fields.map(field => (
                <div key={field.name} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">{field.name}</span>
                  <div className="flex items-center gap-1.5">
                    {field.meta && <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">{field.meta}</span>}
                    <span className="font-mono font-semibold text-slate-500">{field.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ERDView;
