import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
 
type InventoryItem = {
  id: string;
  name: string;
  cost_per_unit: number;
  stock_quantity: number;
  condition?: 'new' | 'good' | 'better' | 'bad' | 'worse' | null;
};
 
type StockRow = {
  name: string;
  qty: number;
  unitCost: number;
  condition: 'new' | 'good' | 'better' | 'bad' | 'worse';
};
 
interface StockInProps {
  companyId: string;
}

const StockInPage: React.FC<StockInProps> = ({ companyId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<StockRow[]>([{ name: '', qty: 1, unitCost: 0, condition: 'new' }]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [companyEquipmentNames, setCompanyEquipmentNames] = useState<string[]>([]);
  const storageKey = useMemo(() => `stock_in_rows:${companyId || 'anon'}`, [companyId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRows(parsed);
        }
      }
    } catch {}
  }, [storageKey]);
 
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {}
  }, [rows, storageKey]);
 
  useEffect(() => {
    const load = async () => {
      try {
        const isUuid = !!companyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
        if (isUuid) {
          const res = await api.get<InventoryItem[]>(`/inventory/items?company_id=${companyId}`);
          setItems((res.data || []) as any);
        } else {
          const res = await api.get<InventoryItem[]>(`/inventory/items`);
          setItems((res.data || []) as any);
        }
      } catch {
        const res = await api.get<InventoryItem[]>(`/inventory/items`);
        setItems((res.data || []) as any);
      }
    };
    load();
    return () => {};
  }, [companyId, companyEquipmentNames]);
 
  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + ((Number(r.qty) || 0) * (Number(r.unitCost) || 0)), 0);
  }, [rows]);
 
  const addRow = () => {
    setRows(prev => [...prev, { name: '', qty: 1, unitCost: 0, condition: 'new' }]);
  };
 
  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };
 
  const confirmStockIn = async () => {
    console.log('🚀 Action Started: confirmStockIn');
    console.log('Checking Company ID:', companyId);
    if (!companyId) {
      alert('System Error: Company ID is missing. Please refresh.');
      console.error('❌ Validation Failed:', 'Missing companyId');
      return;
    }
    const normalized = rows
      .map(v => ({
      ...v,
        name: String(v.name || '').trim(),
        qty: Number(v.qty) || 0,
        unitCost: Number(String(v.unitCost).replace(/[^0-9.]/g, '')) || 0,
        condition: String(v.condition || '').toLowerCase() as any
      }))
      .filter(v => v.name && v.qty > 0 && v.unitCost >= 0);
    if (normalized.length === 0) {
      const invalids = rows.map((r, idx) => {
        const nameOk = String(r.name || '').trim() !== '';
        const qtyOk = Number(r.qty) > 0;
        const costOk = Number(String(r.unitCost).replace(/[^0-9.]/g, '')) >= 0;
        return !nameOk || !qtyOk || !costOk ? `Row ${idx + 1}: ${!nameOk ? 'Missing name' : ''} ${!qtyOk ? 'Invalid qty' : ''} ${!costOk ? 'Invalid unit cost' : ''}`.trim() : null;
      }).filter(Boolean).join(' • ');
      setErrorMessage(invalids || 'No valid rows to process');
      (window as any).showNotification?.('error', invalids || 'No valid rows');
      try { alert(invalids || 'No valid rows'); } catch {}
      console.warn('❌ Validation Failed:', invalids || 'No valid rows', { rows });
      return;
    }
    console.log('📦 Payload:', { companyId, items: normalized });
    setIsSyncing(true);
    try {
      await api.post('/inventory/stock-in', { company_id: companyId, items: normalized });
      const res = await api.get<InventoryItem[]>(`/inventory/items?company_id=${companyId}`);
      setItems((res.data || []) as any);
      setErrorMessage('');
      (window as any).showNotification?.('success', 'Stock updated');
    } catch (error) {
      console.error('Error during inventory update', error);
      setErrorMessage('Stock update failed');
      (window as any).showNotification?.('error', 'Stock update failed');
    }
    setIsSyncing(false);
    setRows([{ name: '', qty: 1, unitCost: 0, condition: 'new' }]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };
 
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Stock In</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Add Items To Inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total</span>{' '}
            <span className="text-lg font-black font-hud">{Intl.NumberFormat().format(grandTotal)}</span>
          </div>
          {errorMessage && (
            <div className="px-4 py-2 rounded-2xl bg-red-50 border border-red-200">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{errorMessage}</span>
            </div>
          )}
          <button
            onClick={confirmStockIn}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest"
          >
            {isSyncing ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
 
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50"
            >
              <div className="grid md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <label htmlFor={`item-name-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Item Name</label>
                  <input
                    id={`item-name-${idx}`}
                    name={`itemName-${idx}`}
                    value={row.name}
                    onChange={e => setRows(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                    placeholder="e.g., Baton, Boots, Reflector Jacket"
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`item-qty-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Quantity</label>
                  <input
                    id={`item-qty-${idx}`}
                    name={`quantity-${idx}`}
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={e => setRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) || 1 } : r))}
                    placeholder="1"
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`item-unit-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Unit Cost</label>
                  <input
                    id={`item-unit-${idx}`}
                    name={`unitCost-${idx}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.unitCost}
                    onChange={e => setRows(prev => prev.map((r, i) => i === idx ? { ...r, unitCost: Number(e.target.value) || 0 } : r))}
                    placeholder="0.00"
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`item-cond-${idx}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Condition</label>
                  <select
                    id={`item-cond-${idx}`}
                    name={`condition-${idx}`}
                    value={row.condition}
                    onChange={e => setRows(prev => prev.map((r, i) => i === idx ? { ...r, condition: e.target.value as any } : r))}
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="new">New</option>
                    <option value="good">Good</option>
                    <option value="better">Better</option>
                    <option value="bad">Bad</option>
                    <option value="worse">Worse</option>
                  </select>
                </div>
                <div className="md:col-span-1 flex md:block items-center justify-end">
                  <button
                    onClick={() => removeRow(idx)}
                    className="w-full h-12 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black uppercase"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Row Total</span>
                <span className="text-sm font-black">{Intl.NumberFormat().format((Number(row.qty) || 0) * (Number(row.unitCost) || 0))}</span>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={addRow}
              className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              Add Row
            </button>
            <button
              onClick={confirmStockIn}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              {isSyncing ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
 
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Current Inventory</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 px-2">Item Name</th>
                <th className="py-3 px-2">In Stock</th>
                <th className="py-3 px-2">Condition</th>
                <th className="py-3 px-2">Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-b">
                  <td className="py-3 px-2 font-bold">{it.name}</td>
                  <td className="py-3 px-2">{it.stock_quantity}</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                      {it.condition || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-2">{Intl.NumberFormat().format(it.cost_per_unit)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">No items</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
 
export default StockInPage;
