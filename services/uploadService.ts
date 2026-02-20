export const uploadToAmini = async (file: File): Promise<string> => {
  const env: any = (import.meta as any)?.env || {};
  const apiBase = env?.VITE_API_BASE_URL || '/api';
  const endpoint = env?.VITE_UPLOAD_URL || `${apiBase}/upload`;

  const token = localStorage.getItem('amini_auth_token');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${Date.now()}_${safeName}`;

  const form = new FormData();
  form.append('file', file);
  form.append('key', key);
  const resp = await fetch(endpoint, {
    method: 'POST',
    body: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    keepalive: true,
  });
  if (!resp.ok) {
    let message = 'Upload failed';
    if (resp.status === 413) message = 'File too large (max 10MB)';
    else if (resp.status === 415) message = 'Unsupported file type (images/PDF only)';
    else {
      const text = await resp.text().catch(() => '');
      message = text || `Upload failed (${resp.status})`;
    }
    throw new Error(message);
  }
  const data = await resp.json().catch(() => ({}));
  const url: string = data?.url || data?.file_url || '';
  if (!url) throw new Error('Upload response missing URL');
  return url;
};
