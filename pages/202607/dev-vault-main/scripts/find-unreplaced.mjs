import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');
const TOOLS_DIR = path.resolve(ROOT, 'tools');

// First pass: collect ALL external URLs and their expected local entries
const re = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)'(,[^}]*)?}/g;
const allEntries = [];
let m;
while ((m = re.exec(html)) !== null) {
  const url = m[3];
  if (!url.startsWith('https://yurukusa.github.io/')) continue;
  const toolName = url.replace(/\/+$/, '').split('/').pop();
  const cat = m[4];
  const localPath = path.resolve(TOOLS_DIR, cat, toolName + '.html');
  const exists = existsSync(localPath);
  allEntries.push({ full: m[0], name: m[1], desc: m[2], url, cat, rest: m[5] || '', toolName, localPath, exists });
}

// Find unique unreplaced tool names
const unreplaced = new Map();
for (const e of allEntries) {
  if (e.exists && e.url.startsWith('https://yurukusa.github.io/')) {
    const key = e.toolName;
    if (!unreplaced.has(key)) {
      unreplaced.set(key, e);
    }
  }
}

console.log(`Entries with local files still pointing external: ${allEntries.filter(e => e.exists).length}`);
console.log(`Unique tools not replaced: ${unreplaced.size}\n`);

console.log('Tools not replaced (all still point to external):');
for (const [name, e] of unreplaced) {
  console.log(`  ${name} (cat: ${e.cat})`);
}
