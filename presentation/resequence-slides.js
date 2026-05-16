import { readdirSync, renameSync } from 'fs';
import { join } from 'path';

const dir = join(import.meta.dirname, 'slides');
const files = readdirSync(dir).filter(f => f.endsWith('.html')).sort();

const renames = files.map((old, i) => {
  const num = String(i + 1).padStart(2, '0');
  const suffix = old.replace(/^\d+[a-z]?-/, '');
  return { old, new: `${num}-${suffix}` };
}).filter(r => r.old !== r.new);

if (!renames.length) { console.log('Slides already sequential.'); process.exit(0); }

const tmp = renames.map(r => ({ from: r.old, to: `_tmp_${r.new}` }));
tmp.forEach(r => renameSync(join(dir, r.from), join(dir, r.to)));
renames.forEach(r => renameSync(join(dir, `_tmp_${r.new}`), join(dir, r.new)));

console.log(`Renamed ${renames.length} slides:`);
renames.forEach(r => console.log(`  ${r.old} → ${r.new}`));
