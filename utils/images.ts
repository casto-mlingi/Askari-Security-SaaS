export function getImageUrl(path: string): string {
  const base = 'https://api.amini.co.tz/uploads';
  if (!path) return '';
  const trimmed = String(path).trim().replace(/^\/+/, '');
  return `${base}/${trimmed}`;
}

