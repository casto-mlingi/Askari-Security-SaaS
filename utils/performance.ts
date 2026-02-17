export type PerfCategory = { label: string; cls: string };

export const getPerfCategory = (p?: number): PerfCategory => {
  const v = typeof p === 'number' ? p : 0;
  if (v >= 85) return { label: 'High', cls: 'text-emerald-600' };
  if (v >= 75) return { label: 'Medium High', cls: 'text-emerald-500' };
  if (v >= 64) return { label: 'Medium', cls: 'text-yellow-600' };
  if (v >= 53) return { label: 'Lower Medium', cls: 'text-amber-600' };
  if (v >= 35) return { label: 'Lower', cls: 'text-orange-600' };
  if (v >= 5) return { label: 'High Risk', cls: 'text-red-600' };
  return { label: 'Blacklisted', cls: 'text-red-700' };
};

