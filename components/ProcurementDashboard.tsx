import React, { useEffect, useMemo, useState } from 'react';
import { Guard } from '../types';
import { supabase } from '../services/supabaseClient';

type InventoryItem = {
  id: string;
  name: string;
  cost_per_unit: number;
  stock_quantity: number;
  condition?: 'new' | 'good' | 'better' | 'bad' | 'worse' | null;
};

type InventoryCustody = {
  id: string;
  guard_id: string;
  item_id: string;
  quantity: number;
  issued_at?: string;
};

type InventoryLog = {
  id: string;
  action: 'restock' | 'issue' | 'return';
  guard_id?: string | null;
  item_id: string;
  quantity: number;
  return_condition?: 'good' | 'damaged' | 'lost' | null;
  amount_owed?: number | null;
  created_at: string;
};

interface ProcurementDashboardProps {
  guards: Guard[];
  equipment?: any[];
  onIssueKit?: (guardId: string, itemQuantities: Record<string, number>, signature: string) => void;
}

const ProcurementDashboard: React.FC<ProcurementDashboardProps> = ({ guards }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [custody, setCustody] = useState<InventoryCustody[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [tab, setTab] = useState<'overview' | 'issue' | 'return' | 'liability'>('overview');
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueGuardId, setIssueGuardId] = useState<string>('');
  const [issueRows, setIssueRows] = useState<Array<{ itemId: string; qty: number }>>([{ itemId: '', qty: 1 }]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnCustody, setReturnCustody] = useState<InventoryCustody | null>(null);
  const [returnCondition, setReturnCondition] = useState<'good' | 'damaged' | 'lost'>('good');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: itemsData } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });
      const itemsFinal = itemsData || [];
      const { data: custodyData } = await supabase.from('inventory_custody').select('*').order('issued_at', { ascending: false });
      const { data: logsData } = await supabase.from('inventory_logs').select('*').order('created_at', { ascending: false });
      setItems(itemsFinal || []);
      setCustody(custodyData || []);
      setLogs(logsData || []);
    };
    load();
  }, []);

  const issuedWithNames = useMemo(() => {
    return custody.map(c => {
      const g = guards.find(x => x.id === c.guard_id);
      const it = items.find(x => x.id === c.item_id);
      return { custody: c, guardName: g?.full_name || 'Unknown', itemName: it?.name || 'Unknown', cost: it?.cost_per_unit || 0 };
    });
  }, [custody, guards, items]);

  const liabilityRows = useMemo(() => {
    return logs
      .filter(l => l.action === 'return' && (l.return_condition === 'damaged' || l.return_condition === 'lost'))
      .map(l => {
        const g = guards.find(x => x.id === l.guard_id);
        const it = items.find(x => x.id === l.item_id);
        const amount = l.amount_owed || 0;
        return { id: l.id, guardName: g?.full_name || 'Unknown', itemName: it?.name || 'Unknown', condition: l.return_condition, amount };
      });
  }, [logs, guards, items]);

  const issuedByGuard = useMemo(() => {
    const map = new Map<string, { guardId: string; guardName: string; items: Array<{ name: string; qty: number }>; total: number; names: Set<string> }>();
    for (const row of issuedWithNames) {
      const gid = row.custody.guard_id;
      const gname = row.guardName;
      const itemName = row.itemName;
      const qty = row.custody.quantity;
      const unit = row.cost || 0;
      const line = (unit || 0) * (qty || 0);
      if (!map.has(gid)) {
        map.set(gid, { guardId: gid, guardName: gname, items: [], total: 0, names: new Set() });
      }
      const entry = map.get(gid)!;
      entry.items.push({ name: itemName, qty });
      entry.total += line;
      entry.names.add(itemName);
    }
    return Array.from(map.values())
      .map(e => ({ guardId: e.guardId, guardName: e.guardName, items: e.items, total: e.total, distinctCount: e.names.size }))
      .sort((a, b) => a.guardName.localeCompare(b.guardName));
  }, [issuedWithNames]);
  const eligibleGuards = useMemo(() => {
    return guards.filter(g => g.application_status === 'hired' || g.application_status === 'active');
  }, [guards]);
  const openRestock = (item: InventoryItem) => {
    setRestockItem(item);
    setRestockQty(0);
    setRestockOpen(true);
  };

  const confirmRestock = async () => {
    if (!restockItem || restockQty <= 0) return;
    setIsSyncing(true);
    const newQty = restockItem.stock_quantity + restockQty;
    await supabase.from('inventory_items').update({ stock_quantity: newQty }).eq('id', restockItem.id);
    await supabase.from('inventory_logs').insert({
      action: 'restock',
      item_id: restockItem.id,
      quantity: restockQty,
      created_at: new Date().toISOString(),
    });
    setItems(prev => prev.map(i => i.id === restockItem.id ? { ...i, stock_quantity: newQty } : i));
    setLogs(prev => [{ id: `log-${Date.now()}`, action: 'restock', item_id: restockItem.id, quantity: restockQty, created_at: new Date().toISOString() } as InventoryLog, ...prev]);
    setIsSyncing(false);
    setRestockOpen(false);
    setRestockItem(null);
    setRestockQty(0);
  };

  const confirmIssue = async () => {
    const rows = issueRows.filter(r => r.itemId && r.qty > 0);
    if (!issueGuardId || rows.length === 0) return;
    setIsSyncing(true);
    const aggregate = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.itemId] = (acc[r.itemId] || 0) + r.qty;
      return acc;
    }, {});
    for (const [itemId, qty] of Object.entries(aggregate)) {
      const item = items.find(i => i.id === itemId);
      const qtyNum = Number(qty) || 0;
      if (!item || qtyNum > item.stock_quantity) {
        setIsSyncing(false);
        return;
      }
    }
    for (const [itemId, qty] of Object.entries(aggregate)) {
      const item = items.find(i => i.id === itemId)!;
      const qtyNum = Number(qty) || 0;
      const newQty = item.stock_quantity - qtyNum;
      await supabase.from('inventory_items').update({ stock_quantity: newQty }).eq('id', item.id);
      const { data: insertedRows } = await supabase.from('inventory_custody').insert({
        guard_id: issueGuardId,
        item_id: item.id,
        quantity: qtyNum,
        issued_at: new Date().toISOString(),
      }).select('*');
      await supabase.from('inventory_logs').insert({
        action: 'issue',
        guard_id: issueGuardId,
        item_id: item.id,
        quantity: qtyNum,
        created_at: new Date().toISOString(),
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: newQty } : i));
      if (insertedRows && insertedRows.length > 0) setCustody(prev => [...insertedRows as any, ...prev]);
      setLogs(prev => [{ id: `log-${Date.now()}`, action: 'issue', guard_id: issueGuardId, item_id: item.id, quantity: qtyNum, created_at: new Date().toISOString() } as InventoryLog, ...prev]);
    }
    await supabase.from('guards').update({ application_status: 'active' }).eq('id', issueGuardId);
    setIsSyncing(false);
    setIssueOpen(false);
    setIssueRows([{ itemId: '', qty: 1 }]);
  };

  const confirmReturn = async () => {
    if (!returnCustody) return;
    const item = items.find(i => i.id === returnCustody.item_id);
    if (!item) return;
    setIsSyncing(true);
    let updateStock = item.stock_quantity;
    let updateDamaged = item.damaged_quantity;
    if (returnCondition === 'good') updateStock = item.stock_quantity + returnCustody.quantity;
    if (returnCondition === 'damaged') updateDamaged = item.damaged_quantity + returnCustody.quantity;
    await supabase.from('inventory_items').update({ stock_quantity: updateStock, damaged_quantity: updateDamaged }).eq('id', item.id);
    const amount = (returnCondition === 'damaged' || returnCondition === 'lost') ? item.cost_per_unit * returnCustody.quantity : 0;
    await supabase.from('inventory_logs').insert({
      action: 'return',
      guard_id: returnCustody.guard_id,
      item_id: item.id,
      quantity: returnCustody.quantity,
      return_condition: returnCondition,
      amount_owed: amount,
      created_at: new Date().toISOString(),
    });
    await supabase.from('inventory_custody').delete().eq('id', returnCustody.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: updateStock, damaged_quantity: updateDamaged } : i));
    setCustody(prev => prev.filter(c => c.id !== returnCustody.id));
    setLogs(prev => [{ id: `log-${Date.now()}`, action: 'return', guard_id: returnCustody.guard_id, item_id: item.id, quantity: returnCustody.quantity, return_condition: returnCondition, amount_owed: amount, created_at: new Date().toISOString() } as InventoryLog, ...prev]);
    setIsSyncing(false);
    setReturnOpen(false);
    setReturnCustody(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Procurement & Inventory</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Stock, Custody & Liability</p>
        </div>
        <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner overflow-x-auto">
           <button onClick={() => setTab('overview')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${tab === 'overview' ? 'bg-white text-primary shadow-lg' : 'text-slate-400'}`}>Overview</button>
           <button onClick={() => setTab('issue')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${tab === 'issue' ? 'bg-white text-primary shadow-lg' : 'text-slate-400'}`}>Issue</button>
           <button onClick={() => setTab('return')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${tab === 'return' ? 'bg-white text-primary shadow-lg' : 'text-slate-400'}`}>Return</button>
           <button onClick={() => setTab('liability')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${tab === 'liability' ? 'bg-white text-primary shadow-lg' : 'text-slate-400'}`}>Liability</button>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Inventory Items</h3>
            <button onClick={() => setIssueOpen(true)} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Issue Item</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-3 px-2">Item Name</th>
                  <th className="py-3 px-2">In Stock</th>
                  <th className="py-3 px-2">Condition</th>
                  <th className="py-3 px-2">Unit Cost</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-b">
                    <td className="py-3 px-2 font-bold">{it.name}</td>
                    <td className="py-3 px-2">{it.stock_quantity}</td>
                    <td className="py-3 px-2">{it.condition || '—'}</td>
                    <td className="py-3 px-2">{Intl.NumberFormat().format(it.cost_per_unit)}</td>
                    <td className="py-3 px-2 text-right">
                      <button onClick={() => openRestock(it)} className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg">Restock</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">No items</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'issue' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Issue Equipment</h3>
            <button onClick={() => setIssueOpen(true)} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">New Issue</button>
          </div>
          <div className="space-y-3">
            {issuedByGuard.map(g => (
              <div key={g.guardId} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{g.guardName}</p>
                    <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                      {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(g.total)}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                      {g.distinctCount} items
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {g.items.map((it, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {it.name} • {it.qty}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {issuedByGuard.length === 0 && <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No custody records</p>}
          </div>
        </div>
      )}

      
      {tab === 'return' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Currently Issued Items</h3>
          <div className="space-y-3">
            {issuedWithNames.map(row => (
              <div key={row.custody.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{row.itemName}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Guard: {row.guardName} • Qty: {row.custody.quantity}</p>
                </div>
                <button onClick={() => { setReturnCustody(row.custody); setReturnOpen(true); }} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Return</button>
              </div>
            ))}
            {issuedWithNames.length === 0 && (
              <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No active custody</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'liability' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Recent Financial Losses</h3>
          <div className="space-y-2">
            {liabilityRows.map(r => (
              <div key={r.id} className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{r.guardName}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{r.itemName} • {r.condition}</p>
                </div>
                <span className="text-[10px] font-black text-red-600 font-hud">{Intl.NumberFormat().format(r.amount)}</span>
              </div>
            ))}
            {liabilityRows.length === 0 && <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No losses</p>}
          </div>
        </div>
      )}

      {restockOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Restock</h3>
              <button onClick={() => setRestockOpen(false)} className="w-8 h-8 bg-white border border-slate-200 rounded-full">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-bold text-slate-600">{restockItem?.name}</p>
              <input type="number" min={1} value={restockQty} onChange={e => setRestockQty(Number(e.target.value) || 0)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl" />
              <button onClick={confirmRestock} disabled={isSyncing} className="w-full py-3 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">{isSyncing ? 'Processing...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {issueOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Issue Item</h3>
              <button onClick={() => setIssueOpen(false)} className="w-8 h-8 bg-white border border-slate-200 rounded-full">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <label htmlFor="issue-guard" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Guard</label>
              <select id="issue-guard" name="issueGuard" value={issueGuardId} onChange={e => setIssueGuardId(e.target.value)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl">
                <option value="">Select Guard</option>
                {eligibleGuards.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
              <div className="space-y-3">
                {issueRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={`issue-item-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Item</label>
                      <select id={`issue-item-${idx}`} name={`issueItem-${idx}`} value={row.itemId} onChange={e => setIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, itemId: e.target.value } : r))} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl">
                      <option value="">Item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.stock_quantity})</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`issue-qty-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Quantity</label>
                      <input id={`issue-qty-${idx}`} name={`issueQty-${idx}`} type="number" min={1} value={row.qty} onChange={e => setIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) || 1 } : r))} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl" />
                    </div>
                    <button onClick={() => setIssueRows(prev => prev.filter((_, i) => i !== idx))} className="h-12 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase">Remove</button>
                  </div>
                ))}
                <button onClick={() => setIssueRows(prev => [...prev, { itemId: '', qty: 1 }])} className="w-full py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">Add Item</button>
              </div>
              <button onClick={confirmIssue} disabled={isSyncing || !issueGuardId} className="w-full py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">{isSyncing ? 'Processing...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {returnOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Return Item</h3>
              <button onClick={() => setReturnOpen(false)} className="w-8 h-8 bg-white border border-slate-200 rounded-full">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <label htmlFor="return-condition" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Return Condition</label>
              <select id="return-condition" name="returnCondition" value={returnCondition} onChange={e => setReturnCondition(e.target.value as any)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl">
                <option value="good">Good</option>
                <option value="damaged">Damaged</option>
                <option value="lost">Lost</option>
              </select>
              <button onClick={() => confirmReturn()} disabled={isSyncing} className="w-full py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">{isSyncing ? 'Processing...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementDashboard;
