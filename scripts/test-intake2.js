async function postGuard(payload) {
  const res = await fetch('http://localhost:3001/api/guards', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ey-mock-token-123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log('POST STATUS:', res.status);
  console.log('POST BODY:', text);
  let id = null;
  try { id = JSON.parse(text).id; } catch {}
  return id;
}

async function getGuard(id) {
  const res = await fetch(`http://localhost:3001/api/guards/${id}`, {
    headers: { 'Authorization': 'Bearer ey-mock-token-123' }
  });
  const text = await res.text();
  console.log('GET STATUS:', res.status);
  console.log('GET BODY:', text);
}

async function main() {
  const payload = {
    first_name: 'Mwajuma',
    middle_name: 'Salum',
    last_name: 'Ali',
    physical_address: 'Mikocheni B',
    nida_number: '19909999000000000001',
    phone: '0711000001',
    dob: '1990-09-09',
    status: 'draft',
    education: [
      { institution_name: 'Kijitonyama Sec', level: 'secondary', start_date: '2007-01-01', end_date: '2010-11-30', graduation_year: '2010' }
    ],
    guarantor_records: [
      { full_name: 'Omary K', relationship: 'uncle', phone: '0711000222', id_copy_url: 'http://x/id.png', guarantor_letter_url: 'http://x/letter.pdf' }
    ]
  };
  const id = await postGuard(payload);
  if (id) await getGuard(id);
}
main().catch(err => {
  console.error('TEST2 ERROR:', err);
  process.exit(1);
});
