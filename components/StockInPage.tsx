import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
 
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
 
const StockInPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<StockRow[]>([{ name: '', qty: 1, unitCost: 0, condition: 'new' }]);
  const [isSyncing, setIsSyncing] = useState(false);
 
  useEffect(() => {
    const load = async () => {
      const { data: itemsData } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });
      setItems((itemsData || []) as any);
    };
    load();
    const channel = supabase
      .channel('inventory_items_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, payload => {
        const n: any = (payload as any).new;
        const o: any = (payload as any).old;
        if ((payload as any).eventType === 'INSERT') {
          setItems(prev => [n, ...prev.filter(i => i.id !== n.id)]);
        } else if ((payload as any).eventType === 'UPDATE') {
          setItems(prev => prev.map(i => i.id === n.id ? n : i));
        } else if ((payload as any).eventType === 'DELETE') {
          setItems(prev => prev.filter(i => i.id !== o.id));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
 
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
    const valid = rows.filter(r => r.name.trim() && r.qty > 0 && r.unitCost > 0);
    if (valid.length === 0) return;
    setIsSyncing(true);
    for (const r of valid) {
      const { data: existing, error: findErr, status } = await supabase
        .from('inventory_items')
        .select('id, stock_quantity')
        .eq('name', r.name.trim())
        .maybeSingle();
      if (findErr && status !== 406) {
        setIsSyncing(false);
        alert('Failed to query inventory. Please check your database policies.');
        return;
      }
      if (existing?.id) {
        const newQty = (existing.stock_quantity || 0) + r.qty;
        const { error: updErr } = await supabase.from('inventory_items').update({ stock_quantity: newQty, cost_per_unit: r.unitCost, condition: r.condition }).eq('id', existing.id);
        if (updErr) {
          const { error: updErr2 } = await supabase.from('inventory_items').update({ stock_quantity: newQty, cost_per_unit: r.unitCost }).eq('id', existing.id);
          if (updErr2) {
            setIsSyncing(false);
            alert('Failed to update item. Please check your database policies.');
            return;
          }
        }
        const { error: logErr } = await supabase.from('inventory_logs').insert({
          action: 'restock',
          item_id: existing.id,
          quantity: r.qty,
          stock_condition: r.condition,
          created_at: new Date().toISOString(),
        });
        if (logErr) {
          await supabase.from('inventory_logs').insert({
            action: 'restock',
            item_id: existing.id,
            quantity: r.qty,
            created_at: new Date().toISOString(),
          });
        }
        setItems(prev => prev.map(i => i.id === existing.id ? { ...i, stock_quantity: newQty, cost_per_unit: r.unitCost, condition: r.condition } : i));
      } else {
        const { data: createdRows, error: insErr } = await supabase
          .from('inventory_items')
          .insert([{
            name: r.name.trim(),
            stock_quantity: r.qty,
            condition: r.condition,
            cost_per_unit: r.unitCost,
          }])
          .select('*');
        if (insErr) {
          const { data: createdRows2, error: insErr2 } = await supabase
            .from('inventory_items')
            .insert([{
              name: r.name.trim(),
              stock_quantity: r.qty,
              cost_per_unit: r.unitCost,
            }])
            .select('*');
          if (insErr2) {
            setIsSyncing(false);
            alert('Failed to create item. Please check your database policies.');
            return;
          }
          const created2 = Array.isArray(createdRows2) ? createdRows2[0] as any : createdRows2 as any;
          if (created2?.id) {
            const { error: logErr2b } = await supabase.from('inventory_logs').insert({
              action: 'restock',
              item_id: created2.id,
              quantity: r.qty,
              created_at: new Date().toISOString(),
            });
            if (logErr2b) {
              // ignore log failure fallback
            }
            setItems(prev => [created2 as InventoryItem, ...prev]);
          }
          continue;
        }
        const created = Array.isArray(createdRows) ? createdRows[0] as any : createdRows as any;
        if (created?.id) {
          const { error: logErr2 } = await supabase.from('inventory_logs').insert({
            action: 'restock',
            item_id: created.id,
            quantity: r.qty,
            stock_condition: r.condition,
            created_at: new Date().toISOString(),
          });
          if (logErr2) {
            await supabase.from('inventory_logs').insert({
              action: 'restock',
              item_id: created.id,
              quantity: r.qty,
              created_at: new Date().toISOString(),
            });
          }
          setItems(prev => [created as InventoryItem, ...prev]);
        }
      }
    }
    setIsSyncing(false);
    setRows([{ name: '', qty: 1, unitCost: 0, condition: 'new' }]);
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
          <button
            onClick={confirmStockIn}
            disabled={isSyncing || rows.filter(r => r.name.trim() && r.qty > 0 && r.unitCost > 0).length === 0}
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
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
              disabled={isSyncing || rows.filter(r => r.name.trim() && r.qty > 0 && r.unitCost > 0).length === 0}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
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
