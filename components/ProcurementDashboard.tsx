import React, { useState, useMemo } from 'react';
import { Guard, ApplicationStatus, EquipmentItem, KitIssuance } from '../types';

interface KitState {
  [itemId: string]: boolean;
}

interface ProcurementDashboardProps {
  guards: Guard[];
  equipment: EquipmentItem[];
  onIssueKit: (guardId: string, itemQuantities: Record<string, number>, signature: string) => void;
}

const ProcurementDashboard: React.FC<ProcurementDashboardProps> = ({ guards, equipment, onIssueKit }) => {
  const [kits, setKits] = useState<Record<string, KitState>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const pendingGuards = useMemo(() => 
    guards.filter(g => g.application_status === ApplicationStatus.PROCUREMENT_PENDING),
    [guards]
  );

  const handleKitToggle = (guardId: string, itemId: string) => {
    setKits(prev => ({
      ...prev,
      [guardId]: {
        ...(prev[guardId] || {}),
        [itemId]: !prev[guardId]?.[itemId]
      }
    }));
  };
  
  const handleSignatureChange = (guardId: string, name: string) => {
    setSignatures(prev => ({ ...prev, [guardId]: name }));
  };

  const handleIssueAndActivate = async (guardId: string) => {
    const kit = kits[guardId] || {};
    const sig = signatures[guardId];

    const allChecked = equipment.every(item => kit[item.id]);
    
    if (!allChecked) {
      alert("Verification Error: All mandated equipment must be physically verified before digital commitment.");
      return;
    }

    if (!sig || sig.trim().length < 3) {
      alert("Administrative Error: Personnel digital signature is mandatory for chain of custody.");
      return;
    }

    setIsProcessing(guardId);
    await new Promise(r => setTimeout(r, 1500));
    
    const itemQuantities: Record<string, number> = {};
    for (const itemId in kit) {
      if (kit[itemId]) {
        // Assuming quantity of 1 for each checked item
        itemQuantities[itemId] = 1;
      }
    }

    onIssueKit(guardId, itemQuantities, sig);
    setIsProcessing(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Procurement & Logistics</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Kit Issuance & Chain of Custody Management</p>
        </div>
        <div className="bg-slate-100 px-6 py-4 rounded-2xl border border-slate-200 shadow-inner flex items-center gap-4">
           <span className="text-3xl font-black text-primary font-hud">{pendingGuards.length}</span>
           <span className="text-xs font-black text-slate-500 uppercase leading-tight">Personnel<br/>Awaiting Kit</span>
        </div>
      </div>
      
      {pendingGuards.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {pendingGuards.map(guard => (
            <div key={guard.id} className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
               <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                     <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/10">
                       {guard.full_name[0]}
                     </div>
                     <div>
                       <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{guard.full_name}</h3>
                       <p className="text-[10px] font-mono font-bold text-slate-400 mt-2 uppercase">NIDA: {guard.nida_number.slice(0, 10)}...</p>
                     </div>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm">PENDING</span>
               </div>
               
               <div className="p-8 flex-grow space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Standard Issue Kit</p>
                  {equipment.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleKitToggle(guard.id, item.id)}
                      className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${kits[guard.id]?.[item.id] ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${kits[guard.id]?.[item.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200'}`}>
                           {kits[guard.id]?.[item.id] && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4"/></svg>}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-slate-400">{item.stock_quantity} left</span>
                    </div>
                  ))}
               </div>
               
               <div className="p-8 bg-slate-50 border-t-2 border-slate-100 space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Digital Signature</label>
                     <input
                       type="text"
                       placeholder="Guard must sign their full name here"
                       value={signatures[guard.id] || ''}
                       onChange={e => handleSignatureChange(guard.id, e.target.value)}
                       className="w-full h-14 px-6 bg-white border-2 border-slate-200 rounded-xl font-black uppercase text-xs outline-none focus:border-primary transition-all shadow-sm"
                     />
                  </div>
                  <button
                    onClick={() => handleIssueAndActivate(guard.id)}
                    disabled={isProcessing === guard.id}
                    className="w-full py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-primary transition-all active:scale-95 shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:cursor-not-allowed"
                  >
                    {isProcessing === guard.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                        COMMITTING...
                      </>
                    ) : (
                      'Issue Kit & Activate Personnel'
                    )}
                  </button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-32 border-4 border-dashed border-slate-100 rounded-[4rem] bg-white">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
          </div>
          <p className="font-black text-slate-400 uppercase tracking-[0.4em] text-xs">No Pending Kit Issuances</p>
        </div>
      )}
    </div>
  );
};

export default ProcurementDashboard;