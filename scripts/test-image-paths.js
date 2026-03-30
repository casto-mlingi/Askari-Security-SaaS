// Validates getImageUrl and ensures there are no raw '/uploads/' references in components
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getImageUrl } from '../utils/images.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}

const abs1 = getImageUrl('avatar.jpg');
assert(abs1.startsWith('https://api.amini.co.tz/uploads/'), 'getImageUrl should prefix origin');
assert(abs1.endsWith('/avatar.jpg'), 'getImageUrl should retain filename');

const abs2 = getImageUrl('/nested/abc.png');
assert(abs2 === 'https://api.amini.co.tz/uploads/nested/abc.png', 'getImageUrl should strip leading slash');

const compDir = path.join(root, 'components');
const files = fs.readdirSync(compDir).filter(f => f.endsWith('.tsx'));
let bad = [];
for (const f of files) {
  const full = path.join(compDir, f);
  const txt = fs.readFileSync(full, 'utf8');
  if (txt.includes('/uploads/')) bad.push(f);
}
if (bad.length) {
  console.error('FAIL Found raw /uploads/ references in:', bad.join(', '));
  process.exit(1);
}
console.log('PASS image path tests');
process.exit(0);

