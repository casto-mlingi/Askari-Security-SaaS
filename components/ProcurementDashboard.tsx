import React, { useEffect, useMemo, useState } from 'react';
import { Guard } from '../types';
import { READ_ONLY } from '../services/supabaseClient';
import { api } from '../services/api';

type InventoryItem = {
  id: string;
  company_id?: string | null;
  name: string;
  cost_per_unit: number;
  stock_quantity: number;
  condition?: 'new' | 'good' | 'fair' | 'better' | 'bad' | 'worse' | null;
};

type InventoryCustody = {
  id: string;
  guard_id: string;
  item_id: string;
  quantity: number;
  issued_at?: string;
  condition_at_issue?: 'new' | 'good' | 'fair' | 'better' | 'bad' | 'worse' | null;
};

type InventoryLog = {
  id: string;
  action: 'restock' | 'issue' | 'return';
  guard_id?: string | null;
  item_id: string;
  quantity: number;
  return_condition?: 'good' | 'damaged' | 'lost' | 'bad' | 'worse' | null;
  amount_owed?: number | null;
  created_at: string;
  payment_status?: 'paid' | 'unpaid' | 'n/a' | null;
  paid_at?: string | null;
};

interface ProcurementDashboardProps {
  guards: Guard[];
  companyId?: string;
  equipment?: any[];
  onIssueKit?: (guardId: string, itemQuantities: Record<string, number>, signature: string) => void;
}

const ProcurementDashboard: React.FC<ProcurementDashboardProps> = ({ guards, companyId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [custody, setCustody] = useState<InventoryCustody[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [tab, setTab] = useState<'overview' | 'issue' | 'return' | 'liability'>('overview');
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueGuardId, setIssueGuardId] = useState<string>('');
  const [issueRows, setIssueRows] = useState<Array<{ itemId: string; qty: number; condition: 'new' | 'good' | 'fair' }>>([{ itemId: '', qty: 1, condition: 'new' }]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnGuardId, setReturnGuardId] = useState<string | null>(null);
  const [returnRows, setReturnRows] = useState<Array<{ custodyId: string, returnCondition: 'good' | 'damaged' | 'lost' | 'bad' | 'worse' }>>([]);

  const returnGuardCustody = useMemo(() => {
    return custody.filter(c => c.guard_id === returnGuardId);
  }, [custody, returnGuardId]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [liabilityDebugRelax, setLiabilityDebugRelax] = useState(false);
  const issueDraftKey = useMemo(() => `procurement_issue_draft:${companyId || 'anon'}`, [companyId]);
  const restockDraftKey = useMemo(() => `procurement_restock_qty:${companyId || 'anon'}`, [companyId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(issueDraftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { issueGuardId?: string; issueRows?: Array<{ itemId: string; qty: number; condition?: 'new' | 'good' | 'fair' }> };
        if (parsed && Array.isArray(parsed.issueRows)) {
          setIssueRows(parsed.issueRows.map(r => ({ itemId: r.itemId, qty: r.qty, condition: r.condition || 'new' })));
        }
        if (parsed && typeof parsed.issueGuardId === 'string') {
          setIssueGuardId(parsed.issueGuardId);
        }
      }
    } catch {}
  }, [issueDraftKey]);

  useEffect(() => {
    try {
      const payload = { issueGuardId, issueRows };
      localStorage.setItem(issueDraftKey, JSON.stringify(payload));
    } catch {}
  }, [issueGuardId, issueRows, issueDraftKey]);

  useEffect(() => {
    try {
      if (restockItem?.id) {
        const raw = localStorage.getItem(`${restockDraftKey}:${restockItem.id}`);
        if (raw) {
          const qty = Number(JSON.parse(raw));
          if (!Number.isNaN(qty)) setRestockQty(qty);
        }
      }
    } catch {}
  }, [restockItem, restockDraftKey]);

  useEffect(() => {
    try {
      if (restockItem?.id) {
        localStorage.setItem(`${restockDraftKey}:${restockItem.id}`, JSON.stringify(restockQty));
      }
    } catch {}
  }, [restockItem, restockQty, restockDraftKey]);

  useEffect(() => {
    const load = async () => {
      let itemsFinal: any[] = [];
      let custodyData: any[] = [];
      let logsData: any[] = [];
      try {
        const TENANT_COMPANY_ID = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
        let effectiveCompanyId = companyId || TENANT_COMPANY_ID;
        if (!companyId) {
          try {
            const parsed = JSON.parse(localStorage.getItem('amini_user') || 'null');
            effectiveCompanyId = parsed?.company_id || TENANT_COMPANY_ID;
          } catch {
            effectiveCompanyId = TENANT_COMPANY_ID;
          }
        }
        const itemsRes = await api.get('/inventory/items?company_id=' + effectiveCompanyId);
        itemsFinal = (itemsRes.data as any[]) || [];
        const custodyRes = await api.get('/inventory/custody?company_id=' + effectiveCompanyId);
        custodyData = (custodyRes.data as any[]) || [];
        const logsRes = await api.get('/inventory/logs?company_id=' + effectiveCompanyId);
        logsData = (logsRes.data as any[]) || []
      } catch (e) {
        itemsFinal = itemsFinal || [];
        custodyData = custodyData || [];
        logsData = logsData || [];
      }
      const allowedGuardIds = new Set((guards || []).map(g => g.id));
      const filteredCustody = (custodyData || []).filter(c => allowedGuardIds.has(c.guard_id));
      const filteredLogs = (logsData || []).filter(l => !l.guard_id || allowedGuardIds.has(l.guard_id));
      setItems(itemsFinal || []);
      setCustody(filteredCustody || []);
      setLogs(filteredLogs || []);
    };
    load();
  }, [companyId, guards]);

  const issuedWithNames = useMemo(() => {
    return custody.map(c => {
      const g = guards.find(x => x.id === c.guard_id);
      const it = items.find(x => x.id === c.item_id);
      return { custody: c, guardName: g?.full_name || 'Unknown', itemName: it?.name || 'Unknown', cost: it?.cost_per_unit || 0 };
    });
  }, [custody, guards, items]);

  const liabilityRows = useMemo(() => {
    const unpaidFilter = (x: string | null | undefined) => String(x || '').toLowerCase() === 'unpaid';
    return logs
      .filter(l => l.action === 'return' && (liabilityDebugRelax || unpaidFilter(l.payment_status)))
      .map(l => {
        const g = guards.find(x => x.id === l.guard_id);
        const it = items.find(x => x.id === l.item_id);
        const unit = it?.cost_per_unit || 0;
        const qty = l.quantity || 0;
        const amount = (l.amount_owed != null ? l.amount_owed : unit * qty) || 0;
        return { id: l.id, guardName: g?.full_name || 'Unknown Guard', itemName: it?.name || 'Unknown Item', condition: l.return_condition, amount, payment_status: l.payment_status, paid_at: l.paid_at };
      });
  }, [logs, guards, items, liabilityDebugRelax]);

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
  const recentIssuesByGuard = useMemo(() => {
    const byGuard = new Map<string, Array<{ itemName: string; qty: number; created_at: string }>>();
    for (const l of logs) {
      if (l.action !== 'issue' || !l.guard_id) continue;
      const gId = l.guard_id;
      const item = items.find(i => i.id === l.item_id);
      const name = item?.name || 'Unknown';
      if (!byGuard.has(gId)) byGuard.set(gId, []);
      byGuard.get(gId)!.push({ itemName: name, qty: l.quantity, created_at: l.created_at });
    }
    const result = new Map<string, Array<{ itemName: string; qty: number; created_at: string }>>();
    for (const [gid, arr] of byGuard.entries()) {
      const sorted = arr
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
      result.set(gid, sorted);
    }
    return result;
  }, [logs, items]);
  useEffect(() => {
    if (tab === 'liability') {
      setLiabilityDebugRelax(true);
      setTimeout(() => setLiabilityDebugRelax(false), 2000);
    }
  }, [tab]);
  useEffect(() => {
    if (tab === 'liability') {
      console.log('DEBUG Liability - All Logs:', logs);
      console.log('DEBUG Liability - Guards:', guards);
      console.log('DEBUG Liability - Items:', items);
    }
  }, [tab, logs, guards, items]);
  const eligibleGuards = useMemo(() => {
    return guards.filter(g => {
      const s = String((g as any)?.status || '').toLowerCase();
      return s === 'interviewing' || s === 'active';
    });
  }, [guards]);
  const hiredCount = useMemo(() => eligibleGuards.length, [eligibleGuards]);
  useEffect(() => {
    console.log('ProcurementDashboard: hired guards count', hiredCount);
  }, [hiredCount]);
  const openRestock = (item: InventoryItem) => {
    setRestockItem(item);
    setRestockQty(0);
    setRestockOpen(true);
  };

  const confirmRestock = async () => {
    console.log('🚀 Action Started: confirmRestock');
    if (READ_ONLY) {
      (window as any).showNotification?.('error', 'Production is read-only. Restock disabled.');
      console.warn('❌ Validation Failed:', 'READ_ONLY mode');
      return;
    }
    if (!restockItem || restockQty <= 0) {
      console.warn('❌ Validation Failed:', 'Missing restockItem or invalid restockQty', { restockItem, restockQty });
      return;
    }
    console.log('📦 Payload:', { itemId: restockItem.id, addQty: restockQty });
    setIsSyncing(true);
    const newQty = restockItem.stock_quantity + restockQty;
    await api.patch('/inventory/items/' + restockItem.id, { stock_quantity: newQty });
    await api.post('/inventory/logs', {
      action: 'restock',
      company_id: companyId,
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
    try {
      if (restockItem?.id) {
        localStorage.removeItem(`${restockDraftKey}:${restockItem.id}`);
      }
    } catch {}
  };

  const confirmIssue = async () => {
    console.log('🚀 Action Started: confirmIssue');
    const rows = issueRows.filter(r => r.itemId && r.qty > 0);
    if (!issueGuardId || rows.length === 0) {
      console.warn('❌ Validation Failed:', 'Missing issueGuardId or no valid rows', { issueGuardId, issueRows });
      return;
    }
    const TENANT_COMPANY_ID = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
    let effectiveCompanyId = TENANT_COMPANY_ID;
    try {
      const parsed = JSON.parse(localStorage.getItem('amini_user') || 'null');
      effectiveCompanyId = parsed?.company_id || TENANT_COMPANY_ID;
    } catch {
      effectiveCompanyId = TENANT_COMPANY_ID;
    }
    console.log('📦 Payload:', { issueGuardId, rows: rows.map(r => ({ ...r, company_id: effectiveCompanyId })), companyId: effectiveCompanyId });
    setIsSyncing(true);
    for (const row of rows) {
      const item = items.find(i => i.id === row.itemId);
      const qtyNum = parseInt(String(row.qty), 10) || 0;
      if (!item || qtyNum > item.stock_quantity) {
        setIsSyncing(false);
        return;
      }
      const newQty = item.stock_quantity - qtyNum;
      await api.patch('/inventory/items/' + item.id, { stock_quantity: newQty });
      console.log('Final Payload with Company ID:', { company_id: effectiveCompanyId, guard_id: issueGuardId, item_id: item.id, quantity: qtyNum, condition_at_issue: row.condition });
      const inserted = await api.post('/inventory/custody', {
        company_id: effectiveCompanyId,
        guard_id: issueGuardId,
        item_id: item.id,
        quantity: qtyNum,
        issued_at: new Date().toISOString(),
        condition_at_issue: row.condition,
      });
      console.log('Final Payload with Company ID:', { company_id: effectiveCompanyId, guard_id: issueGuardId, item_id: item.id, quantity: qtyNum, action: 'issue', payment_status: 'n/a' });
      await api.post('/inventory/logs', {
        action: 'issue',
        company_id: effectiveCompanyId,
        guard_id: issueGuardId,
        item_id: item.id,
        quantity: qtyNum,
        payment_status: 'n/a',
        created_at: new Date().toISOString(),
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: newQty } : i));
      if (inserted.data) setCustody(prev => [inserted.data as any, ...prev]);
      setLogs(prev => [{ id: `log-${Date.now()}`, action: 'issue', guard_id: issueGuardId, item_id: item.id, quantity: qtyNum, payment_status: 'n/a', created_at: new Date().toISOString() } as InventoryLog, ...prev]);
    }
    try {
      const selectedGuard = guards.find(g => g.id === issueGuardId);
      const s = String((selectedGuard as any)?.status || '').toLowerCase();
      if (s === 'interviewing') {
        await api.patch('/guards/' + issueGuardId, { status: 'active' });
        (window as any).showNotification?.('success', 'Tools issued and guard activated.');
      } else {
        (window as any).showNotification?.('success', 'Tools issued.');
      }
    } catch (e) {
      console.error('Activation failed', e);
      (window as any).showNotification?.('error', 'Issued tools saved. Activation skipped or failed.');
    }
    setIsSyncing(false);
    setIssueOpen(false);
    setIssueRows([{ itemId: '', qty: 1, condition: 'new' }]);
    setIssueGuardId('');
    try {
      localStorage.removeItem(issueDraftKey);
    } catch {}
  };

  const confirmReturn = async () => {
    console.log('🚀 Action Started: confirmReturn');
    const validRows = returnRows.filter(r => r.custodyId);
    if (!returnGuardId || validRows.length === 0) {
      console.warn('❌ Validation Failed:', 'Missing returnGuardId or valid returnRows', { returnGuardId, returnRows });
      return;
    }

    const TENANT_COMPANY_ID = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
    let effectiveCompanyId = TENANT_COMPANY_ID;
    try {
      const parsed = JSON.parse(localStorage.getItem('amini_user') || 'null');
      effectiveCompanyId = parsed?.company_id || TENANT_COMPANY_ID;
    } catch {
      effectiveCompanyId = TENANT_COMPANY_ID;
    }

    setIsSyncing(true);

    for (const row of validRows) {
      const custItem = returnGuardCustody.find(c => c.id === row.custodyId);
      if (!custItem) continue;

      const item = items.find(i => i.id === custItem.item_id);
      if (!item) continue;

      let updateStock = item.stock_quantity;
      if (row.returnCondition === 'good') updateStock = item.stock_quantity + custItem.quantity;
      await api.patch('/inventory/items/' + item.id, { stock_quantity: updateStock });
      
      const badOrWorse = row.returnCondition === 'bad' || row.returnCondition === 'worse';
      const amount = (row.returnCondition === 'damaged' || row.returnCondition === 'lost' || badOrWorse) ? item.cost_per_unit * custItem.quantity : 0;
      const paymentStatus = row.returnCondition === 'good' ? 'n/a' : 'unpaid';
      
      const logRes = await api.post('/inventory/logs', {
        action: 'return',
        company_id: effectiveCompanyId,
        guard_id: custItem.guard_id,
        item_id: item.id,
        quantity: custItem.quantity,
        return_condition: row.returnCondition,
        amount_owed: amount,
        payment_status: paymentStatus,
        created_at: new Date().toISOString(),
      });
      await api.delete('/inventory/custody/' + custItem.id);

      setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: updateStock } : i));
      setCustody(prev => prev.filter(c => c.id !== custItem.id));
      if ((logRes as any)?.data) {
        setLogs(prev => [((logRes as any).data as InventoryLog), ...prev]);
      } else {
        setLogs(prev => [{ id: `log-${Date.now()}`, action: 'return', guard_id: custItem.guard_id, item_id: item.id, quantity: custItem.quantity, return_condition: row.returnCondition, amount_owed: amount, payment_status: paymentStatus, created_at: new Date().toISOString() } as InventoryLog, ...prev]);
      }
    }

    setIsSyncing(false);
    setReturnOpen(false);
    setReturnGuardId(null);
    setReturnRows([]);
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
            <button onClick={() => setIssueOpen(true)} disabled={false} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">Issue Tools & Activate</button>
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
                      <button onClick={() => openRestock(it)} disabled={READ_ONLY} className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg disabled:opacity-50">Restock</button>
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
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Issue Tools & Activate</h3>
            <button onClick={() => setIssueOpen(true)} disabled={false} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">New Issue</button>
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
                <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                  {(recentIssuesByGuard.get(g.guardId) || []).map((ri, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      {ri.itemName} • {ri.qty}
                    </span>
                  ))}
                  {(recentIssuesByGuard.get(g.guardId) || []).length === 0 && (
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      No recent issues
                    </span>
                  )}
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
                  {row.custody.condition_at_issue ? (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Condition at Issue: {row.custody.condition_at_issue}</p>
                  ) : null}
                </div>
                <button onClick={() => { setReturnGuardId(row.custody.guard_id); setReturnRows([{ custodyId: row.custody.id, returnCondition: 'good' }]); setReturnOpen(true); }} disabled={false} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">Return</button>
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
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{r.guardName}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{r.itemName} • {r.condition}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${r.payment_status === 'paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                    {r.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-red-600 font-hud">{Intl.NumberFormat().format(r.amount)}</span>
                  {r.payment_status !== 'paid' && (
                    <button
                      onClick={async () => {
                        try {
                          const TENANT_COMPANY_ID = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
                          const res = await api.patch('/inventory/logs/' + r.id, { payment_status: 'paid', paid_at: new Date().toISOString(), company_id: TENANT_COMPANY_ID });
                          const updated = (res as any)?.data as InventoryLog | undefined;
                          if (updated?.id) {
                            setLogs(prev => prev.map(l => l.id === updated.id ? updated : l));
                          } else {
                            setLogs(prev => prev.map(l => l.id === r.id ? { ...l, payment_status: 'paid', paid_at: new Date().toISOString() } : l));
                          }
                        } catch {}
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg"
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
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
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Issue Tools & Activate</h3>
              <button onClick={() => setIssueOpen(false)} className="w-8 h-8 bg-white border border-slate-200 rounded-full">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <label htmlFor="issue-guard" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Guard</label>
              <select id="issue-guard" name="issueGuard" value={issueGuardId} onChange={e => setIssueGuardId(e.target.value)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl">
                <option value="">Select Guard</option>
                {eligibleGuards.map(g => {
                  const s = String((g as any)?.status || '').toLowerCase();
                  const statusLabel = s === 'active' ? 'Active' : (s === 'interviewing' ? 'Interviewing' : s || 'unknown');
                  return <option key={g.id} value={g.id}>{g.full_name} ({statusLabel})</option>;
                })}
              </select>
              <div className="space-y-3">
                {issueRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-3">
                    <div>
                      <label htmlFor={`issue-item-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Item</label>
                      <select id={`issue-item-${idx}`} name={`issueItem-${idx}`} value={row.itemId} onChange={e => setIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, itemId: e.target.value } : r))} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl">
                      <option value="">Item</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.stock_quantity})</option>)}
                      </select>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        In Stock: {items.find(i => i.id === row.itemId)?.stock_quantity ?? 0}
                      </p>
                    </div>
                    <div>
                      <label htmlFor={`issue-qty-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Quantity</label>
                      <input id={`issue-qty-${idx}`} name={`issueQty-${idx}`} type="number" min={1} value={row.qty} onChange={e => setIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) || 1 } : r))} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl" />
                    </div>
                    <div>
                      <label htmlFor={`issue-cond-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Condition</label>
                      <select id={`issue-cond-${idx}`} name={`issueCond-${idx}`} value={row.condition} onChange={e => setIssueRows(prev => prev.map((r, i) => i === idx ? { ...r, condition: e.target.value as 'new' | 'good' | 'fair' } : r))} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl">
                        <option value="new">New</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                      </select>
                    </div>
                    <button onClick={() => setIssueRows(prev => prev.filter((_, i) => i !== idx))} className="h-12 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase">Remove</button>
                  </div>
                ))}
                <button onClick={() => setIssueRows(prev => [...prev, { itemId: '', qty: 1, condition: 'new' }])} className="w-full py-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">Add Item</button>
              </div>
              <button onClick={confirmIssue} disabled={isSyncing || !issueGuardId} className="w-full py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">{isSyncing ? 'Processing...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {returnOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[1.5rem] shadow-2xl border border-white/20 overflow-hidden">
            <div className="px-6 py-5 bg-[#1868A8] flex justify-between items-center text-white">
              <h3 className="text-[13px] font-black uppercase tracking-widest">Return Items</h3>
              <button onClick={() => setReturnOpen(false)} className="text-white hover:text-white/80 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {returnRows.map((row, idx) => {
                  const selectedCustody = returnGuardCustody.find(c => c.id === row.custodyId);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-end p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="col-span-12 md:col-span-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Item to Return</label>
                        <select 
                          value={row.custodyId} 
                          onChange={e => setReturnRows(prev => prev.map((r, i) => i === idx ? { ...r, custodyId: e.target.value } : r))} 
                          className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm"
                        >
                          <option value="">Select Item</option>
                          {returnGuardCustody.map(c => {
                            const iName = items.find(itm => itm.id === c.item_id)?.name || 'Unknown';
                            return <option key={c.id} value={c.id}>{iName} ({c.quantity} issued)</option>;
                          })}
                        </select>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 ml-2">
                          Condition at Issue: {selectedCustody?.condition_at_issue || 'Unknown'}
                        </p>
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Return Condition</label>
                        <select 
                          value={row.returnCondition} 
                          onChange={e => setReturnRows(prev => prev.map((r, i) => i === idx ? { ...r, returnCondition: e.target.value as any } : r))} 
                          className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm"
                        >
                          <option value="good">Good</option>
                          <option value="damaged">Damaged</option>
                          <option value="lost">Lost</option>
                          <option value="bad">Bad</option>
                          <option value="worse">Worse</option>
                        </select>
                      </div>
                      <div className="col-span-12 md:col-span-2">
                        <button 
                          onClick={() => setReturnRows(prev => prev.filter((_, i) => i !== idx))}
                          disabled={returnRows.length === 1}
                          className="w-full h-12 bg-white border border-slate-200 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {returnRows.length < returnGuardCustody.length && (
                  <button 
                    onClick={() => {
                      const unusedCustody = returnGuardCustody.find(c => !returnRows.some(r => r.custodyId === c.id));
                      setReturnRows(prev => [...prev, { custodyId: unusedCustody?.id || '', returnCondition: 'good' }]);
                    }} 
                    className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 hover:text-[#1868A8] hover:border-[#1868A8] hover:bg-blue-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    + Add Another Item
                  </button>
                )}
              </div>
              <button 
                onClick={() => confirmReturn()} 
                disabled={isSyncing || returnRows.filter(r => r.custodyId).length === 0} 
                className="w-full py-4 mt-2 bg-[#1868A8] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-[#145a90] disabled:bg-slate-300 transition-colors"
               >
                {isSyncing ? 'Processing...' : `Confirm Return${returnRows.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementDashboard;
