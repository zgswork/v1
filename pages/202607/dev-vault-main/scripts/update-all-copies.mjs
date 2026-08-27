import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.resolve(ROOT, 'index.html');

const html = readFileSync(INDEX, 'utf-8');

// Get all unique tool entries across all 4 copies
const seen = new Set();
const replacements = [];

const re = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)',icon:'([^']*)'(?:,featured:(true))?}/g;
let m;
while ((m = re.exec(html)) !== null) {
  const url = m[3];
  if (!url.startsWith('https://yurukusa.github.io/')) continue;
  const toolName = url.replace(/\/+$/, '').split('/').pop();
  const cat = m[4];
  const localPath = `tools/${cat}/${toolName}.html`;
  const fullPath = path.resolve(ROOT, localPath);
  if (!existsSync(fullPath)) continue;
  const key = url; // unique key
  if (seen.has(key)) continue;
  seen.add(key);
  const newEntry = `{name:'${m[1]}',desc:'${m[2]}',url:'${localPath}',cat:'${cat}',icon:'${m[5]}'${m[6] ? ',featured:true' : ''}}`;
  replacements.push([m[0], newEntry]);
}

console.log(`Found ${seen.size} unique external tools with local files to replace`);

// Replace all occurrences (across all 4 copies)
let result = html;
for (const [oldStr, newStr] of replacements) {
  result = result.split(oldStr).join(newStr);
}

writeFileSync(INDEX, result, 'utf-8');
console.log('Done. All copies updated.');
