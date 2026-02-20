import React, { useMemo, useState } from 'react';
import { Guard, Profile, UserRole } from '../types';
import { api } from '../services/api';
 
interface WaitForApprovalProps {
  guards: Guard[];
  currentUser?: Profile | null;
  onOpenDossier?: (guard: Guard) => void;
  onApproved?: (guardId: string) => void;
  onRequestedEdit?: (guardId: string, note: string) => void;
  computeReadiness?: (g: Guard) => number;
}
 
const WaitForApproval: React.FC<WaitForApprovalProps> = ({ guards, currentUser, onOpenDossier, onApproved, onRequestedEdit, computeReadiness }) => {
  const isPrivileged = currentUser?.role === UserRole.SYSTEM_HR || currentUser?.role === UserRole.SUPER_ADMIN;
  const applicants = useMemo(() => {
    return guards.filter(g => String((g as any)?.status || '').toLowerCase() === 'submitted_application');
  }, [guards]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedForEdit, setSelectedForEdit] = useState<Guard | null>(null);
  const [editNote, setEditNote] = useState('');
  // removed inline document preview from card; use View Dossier for full disclosure
 
  const handleApprove = async (g: Guard) => {
    try {
      const result = await api.patch(`/guards/${g.id}`, { status: 'marketplace', company_id: null });
      if (result?.data) {
        (window as any).showNotification?.('success', 'Approved to Marketplace.');
      } else {
        (window as any).showNotification?.('warning', 'Offline: approval saved locally.');
      }
      onApproved?.(g.id);
    } catch {
      (window as any).showNotification?.('error', 'Failed to approve.');
    }
  };
 
  const handleRequestEdit = async () => {
    const g = selectedForEdit;
    const note = editNote.trim();
    if (!g || !note) return;
    const hrNote = {
      id: `hrn-${Date.now()}`,
      author_id: currentUser?.id,
      note,
      created_at: new Date().toISOString()
    };
    try {
      await api.post('/resubmit-requests', {
        guard_id: g.id,
        company_id: currentUser?.company_id,
        reason: note,
        status: 'approved'
      });
      await api.patch(`/guards/${g.id}`, {
        status: 'draft',
        dossier_data: {
          ...(g.dossier_data || {}),
          allow_edit: true,
          hr_private_notes: [ ...(g.dossier_data?.hr_private_notes || []), hrNote ]
        }
      });
      (window as any).showNotification?.('success', 'Edit requested and profile unlocked.');
      onRequestedEdit?.(g.id, note);
      setEditModalOpen(false);
      setSelectedForEdit(null);
      setEditNote('');
    } catch {
      (window as any).showNotification?.('error', 'Failed to request edit.');
    }
  };
 
  const ageOf = (dob?: string | null) => {
    if (!dob) return null;
    try {
      const d = new Date(dob);
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      return age;
    } catch { return null; }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Applicants awaiting HR approval</p>
      </div>
 
      {applicants.length === 0 ? (
        <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No applicants pending approval</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {applicants.map(g => (
            <div key={g.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex items-start mb-6">
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDossier?.(g)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDossier?.(g); }}
                >
                  {g.passport_photo_url ? (
                    <img src={g.passport_photo_url} alt={g.full_name} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-black text-xl">
                      {g.full_name?.[0] || 'G'}
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{g.full_name}</h4>
                    <p className="text-xs text-slate-500">{g.nida_number}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {typeof computeReadiness === 'function' && (
                        <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          {computeReadiness(g)}%
                        </div>
                      )}
                      <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        {ageOf(g.dob) ? `${ageOf(g.dob)} yrs` : 'Age N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span>Phone</span><span className="font-black text-slate-700 font-mono">{g.phone || 'N/A'}</span></div>
                <div className="flex justify-between"><span>Address</span><span className="font-black text-slate-700">{(g as any).physical_address || 'N/A'}</span></div>
                <div className="flex justify-between"><span>Emergency</span><span className="font-black text-slate-700">
                  {((g as any).emergency_contact_name || (g as any).dossier_data?.emergency_contact || (g as any).emergency_contact || 'N/A')}
                  {(g as any).emergency_contact_phone ? ` • ${(g as any).emergency_contact_phone}` : ''}
                </span></div>
                <div className="flex justify-between"><span>Skill: K-9 Handler</span><span className="font-black text-slate-700">{Array.isArray(g.security_training) && g.security_training.includes('k9_handler') ? '✓' : 'NA'}</span></div>
                <div className="flex justify-between"><span>Skill: Fire Safety</span><span className="font-black text-slate-700">{Array.isArray(g.security_training) && g.security_training.includes('fire_safety') ? '✓' : 'NA'}</span></div>
              </div>
              {/* details moved to Applicant Disclosure (View Dossier) for a cleaner card */}
              {isPrivileged && (
                <div className="mt-6 space-y-3">
                  <div className="flex gap-3">
                    <button onClick={() => handleApprove(g)} className="flex-1 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-lg">
                      Approve to Marketplace
                    </button>
                    <button onClick={() => { setSelectedForEdit(g); setEditModalOpen(true); }} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all">
                      Request Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editModalOpen && selectedForEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Private Note to Applicant</p>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Write instructions for the applicant..."
              className="w-full h-28 px-4 py-3 bg-slate-50 border-2 rounded-xl text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-3">
              <button onClick={() => setEditModalOpen(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl">
                Cancel
              </button>
              <button onClick={handleRequestEdit} className="flex-1 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">
                Save & Unlock
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Inline document preview removed; use View Dossier */}
    </div>
  );
};
 
export default WaitForApproval;
