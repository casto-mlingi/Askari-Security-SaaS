import { validateEducationRecords } from '../utils/validation.js';

function run(name, fn) {
  try {
    fn();
    console.log(`PASS - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}: ${e.message || e}`);
  }
}

run('Empty list yields no errors', () => {
  const out = validateEducationRecords([]);
  if (Object.keys(out).length !== 0) throw new Error('Expected no errors');
});

run('Missing institution flagged', () => {
  const out = validateEducationRecords([
    { level: 'secondary', institution_name: '', year: '2020' }
  ]);
  if (!out['edu_institution_0']) throw new Error('Expected institution error');
});

run('Invalid year flagged', () => {
  const out = validateEducationRecords([
    { level: 'secondary', institution_name: 'ABC', year: '20' }
  ]);
  if (!out['edu_year_0']) throw new Error('Expected year error');
});

run('Date range end < start flagged', () => {
  const out = validateEducationRecords([
    { level: 'secondary', institution_name: 'ABC', start_date: '2022-01-02', end_date: '2022-01-01' }
  ]);
  if (!out['edu_end_0']) throw new Error('Expected end date error');
});

run('Valid record yields no errors', () => {
  const out = validateEducationRecords([
    { level: 'secondary', institution_name: 'ABC', year: '2020' }
  ]);
  if (Object.keys(out).length !== 0) throw new Error('Expected no errors');
});

console.log('All tests completed');
