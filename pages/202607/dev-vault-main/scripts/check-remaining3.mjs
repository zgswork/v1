import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');

// Find ALL yurukusa.github.io references
let idx = 0;
let startPos = 0;
while (true) {
  const pos = html.indexOf('yurukusa.github.io', startPos);
  if (pos === -1) break;
  const contextStart = Math.max(0, pos - 60);
  const contextEnd = Math.min(html.length, pos + 80);
  console.log(`[${++idx}] at ${pos}: ...${html.substring(contextStart, contextEnd)}...\n`);
  startPos = pos + 1;
}
