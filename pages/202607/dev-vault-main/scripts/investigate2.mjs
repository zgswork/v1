import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');

// Find npm Dep Graph entry and show exact bytes
let idx = html.indexOf("{name:'npm Dep Graph'");
let end = html.indexOf('}', idx) + 1;
let entry = html.substring(idx, end);

console.log('Entry length in chars:', entry.length);
console.log('Entry bytes:', Buffer.byteLength(entry, 'utf-8'));
console.log('---');
for (let i = 0; i < entry.length; i++) {
  const ch = entry[i];
  const code = entry.charCodeAt(i);
  if (code > 127 || ch === '{' || ch === '}' || ch === "'" || ch === ',' || ch === ':') {
    console.log(`[${i}] 0x${code.toString(16)} '${ch}' (U+${code.toString(16).padStart(4, '0')})`);
  }
}

console.log('\n--- Raw entry ---');
console.log(entry);
