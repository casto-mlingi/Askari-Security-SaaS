export function getImageUrl(path: string): string {
  const apiUrl = (import.meta as any)?.env?.VITE_API_URL || 'https://api.amini.co.tz';
  const base = `${String(apiUrl).replace(/\/+$/, '')}/uploads`;
  if (!path) return '';
  const trimmed = String(path).trim().replace(/^\/+/, '');
  return `${base}/${trimmed}`;
}

