// Quick smoke test for auth/session and /api/guards status codes
(async () => {
  const base = 'http://localhost:3001/api';
  const headers = { 'Content-Type': 'application/json' };
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'admin@amini.co.tz', password: 'Admin@2027' })
  });
  const login = await loginRes.json();
  const token = login?.token || '';
  if (!token) {
    console.error('FAIL login: no token', login);
    process.exit(1);
  }
  console.log('PASS login');
  const badPayload = { full_name: '', nida_number: '', phone: '' }; // missing requireds
  const saveRes = await fetch(`${base}/guards`, {
    method: 'POST',
    headers: { ...headers, Authorization: `Bearer ${token}` },
    body: JSON.stringify(badPayload)
  });
  const status = saveRes.status;
  if (status === 400) console.log('PASS /api/guards returns 400 for validation errors');
  else {
    const txt = await saveRes.text();
    console.error('FAIL /api/guards expected 400, got', status, txt);
    process.exit(1);
  }
  // Ensure token still present
  const meRes = await fetch(`${base}/guards`, { headers: { Authorization: `Bearer ${token}` } });
  if (meRes.status === 200) console.log('PASS session intact after failure');
  else {
    console.error('FAIL session lost, status', meRes.status);
    process.exit(1);
  }
  // Unauthorized check: no token should yield 401
  const unauthRes = await fetch(`${base}/guards`);
  if (unauthRes.status === 401) console.log('PASS 401 for missing auth');
  else {
    console.error('FAIL expected 401 for missing auth, got', unauthRes.status);
    process.exit(1);
  }
  console.log('All checks passed');
  process.exit(0);
})().catch(e => { console.error('Test crashed', e); process.exit(1); });
