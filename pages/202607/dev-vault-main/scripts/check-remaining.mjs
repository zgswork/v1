import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');
const TOOLS_DIR = path.resolve(ROOT, 'tools');

const re = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)'/g;
const stillExternal = [];
let m;
while ((m = re.exec(html)) !== null) {
  const url = m[3];
  if (!url.startsWith('https://yurukusa.github.io/')) continue;
  const toolName = url.replace(/\/+$/, '').split('/').pop();
  const cat = m[4];
  const localPath = path.resolve(TOOLS_DIR, cat, toolName + '.html');
  const exists = existsSync(localPath);
  if (exists) {
    stillExternal.push({ name: m[1], toolName, cat, url, localPath: `tools/${cat}/${toolName}.html` });
  }
}

console.log(`Tool entries still pointing to external URL (but local file exists): ${stillExternal.length}`);
if (stillExternal.length > 0) {
  console.log('\nFirst 10:');
  stillExternal.slice(0, 10).forEach(e => {
    console.log(`  name: '${e.name}', url: '${e.url}' -> tools/${e.cat}/${e.toolName}.html`);
  });
}
