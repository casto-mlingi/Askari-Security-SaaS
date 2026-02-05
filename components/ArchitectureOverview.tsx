
import React from 'react';

const ArchitectureOverview: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">System Architecture</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">A high-level overview of the AMINI multi-tenant SaaS data model. (v2.1)</p>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm space-y-10">
        <section>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4">Core Multi-Tenancy Model</h3>
          <p className="text-slate-600 font-medium leading-relaxed max-w-4xl">
            AMINI is engineered as a multi-tenant platform, designed to serve multiple security companies (tenants) from a single, unified infrastructure while ensuring strict data isolation and security. The architectural foundation for this model rests on three core tables: <code className="font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">companies</code>, <code className="font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">subscriptions</code>, and <code className="font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">profiles</code>.
          </p>
          <ul className="list-disc list-inside space-y-4 mt-6 text-slate-600 max-w-4xl">
            <li>
              <strong className="font-bold text-slate-800">Companies:</strong> This table acts as the primary tenant identifier. Every resource, from guards to operational sites, is linked back to a single company record via a <code className="font-mono text-sm">company_id</code> foreign key. This is the cornerstone of our data segregation strategy.
            </li>
            <li>
              <strong className="font-bold text-slate-800">Subscriptions:</strong> Each company is associated with a subscription plan which governs their access level, feature set, and resource limits (e.g., maximum number of guards). This allows for scalable and tiered service offerings.
            </li>
            <li>
              <strong className="font-bold text-slate-800">Profiles:</strong> User accounts for administrative and operational staff are stored here. Crucially, every profile (except for the super-admin) must be linked to a <code className="font-mono text-sm">company_id</code>. Application-level logic then uses this link to ensure that users can only see and interact with data belonging to their own company.
            </li>
          </ul>
        </section>

        <div id="visual-schema-placeholder">
          <section>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-4">Personnel, Assets, & Operations Model</h3>
            <p className="text-slate-600 font-medium leading-relaxed max-w-4xl">
              This segment details the core operational entities and how they interconnect, facilitating comprehensive management of security personnel, their associated records, deployment locations, and equipment. The architectural revision to v2.1 significantly normalizes these relationships for improved data integrity, query efficiency, and clearer data ownership.
            </p>
            <ul className="list-disc list-inside space-y-4 mt-6 text-slate-600 max-w-4xl">
              <li>
                <strong className="font-bold text-slate-800">Guards:</strong> The central entity for security personnel. Each guard is primarily linked to a <code className="font-mono text-sm">company_id</code> (though pool applicants may initially be unassigned) and can be assigned to a specific <code className="font-mono text-sm">site_id</code> and a <code className="font-mono text-sm">supervisor_id</code>. Key personal and employment details are stored here. Critically, fields like Next of Kin details and document URLs (e.g., <code className="font-mono text-sm">nida_front_url</code>, <code className="font-mono text-sm">birth_cert_url</code>) are now top-level columns on this table for direct access and strong typing. The <code className="font-mono text-sm">dossier_data</code> column is now reserved exclusively for flexible JSONB content such as AI analysis artifacts and internal interviewer notes, ensuring structured data remains outside the flexible blob.
              </li>
              <li>
                <strong className="font-bold text-slate-800">Education Records:</strong> The <code className="font-mono text-sm">education_records</code> table now stores a guard's academic and professional qualifications as separate entries, linked by <code className="font-mono text-sm">guard_id</code>. This allows for multiple, distinct records per guard (e.g., secondary school, military training, NTA certifications), each with its own certificate URL and weapon proficiency status, improving granularity and query performance.
              </li>
              <li>
                <strong className="font-bold text-slate-800">Guarantors:</strong> Similarly, <code className="font-mono text-sm">guarantors</code> are now managed in their own dedicated table, with a <code className="font-mono text-sm">guard_id</code> foreign key. This provides structured storage for the required two guarantors per guard, including their names, contact information, relationship, and associated letter URLs, facilitating robust vetting and background checks.
              </li>
              <li>
                <strong className="font-bold text-slate-800">Sites:</strong> Operational locations are defined in the <code className="font-mono text-sm">sites</code> table, each belonging to a <code className="font-mono text-sm">company_id</code> and optionally assigned a <code className="font-mono text-sm">supervisor_id</code> from the <code className="font-mono text-sm">profiles</code> table. Geographic coordinates and geofence parameters are critical for attendance and tactical monitoring.
              </li>
              <li>
                <strong className="font-bold text-slate-800">Attendance Logs:</strong> This table records guard check-ins and check-outs, linking to <code className="font-mono text-sm">guards</code>, <code className="font-mono text-sm">sites</code>, and <code className="font-mono text-sm">profiles</code> (supervisors). It includes geographic coordinates and distance calculations for geofence validation, and a status to track compliance.
              </li>
              <li>
                <strong className="font-bold text-slate-800">Equipment Items:</strong> A centralized inventory of all security equipment (uniforms, weapons, communication devices), managed per <code className="font-mono text-sm">company_id</code>. This table tracks stock quantities and item categories.
              </li>
              <li>
                <strong className="font-bold text-slate-800">Kit Issuances:</strong> Records specific instances of <code className="font-mono text-sm">equipment_items</code> being issued to a <code className="font-mono text-sm">guard_id</code>. This includes quantities of each item and an issuer <code className="font-mono text-sm">profile_id</code> for a clear chain of custody and accountability.
              </li>
            </ul>
          </section>
        </div>

        {/* This will be filled in Block 3 */}
        <div id="personnel-ops-placeholder"></div>
        <div id="assets-auditing-placeholder"></div>
      </div>
    </div>
  );
};

export default ArchitectureOverview;