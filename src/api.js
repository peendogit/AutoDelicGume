// API helper
export function getToken() {
  return localStorage.getItem('adg_token');
}

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const err = await res.json();
      throw new Error(err.error || 'Greška');
    }
    throw new Error('HTTP ' + res.status);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}
