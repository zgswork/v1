import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');

// Find ALL remaining yurukusa.github.io references with context
const re = /url:'https:\/\/yurukusa\.github\.io\/([^\/]+)\//g;
let m;
let idx = 0;
while ((m = re.exec(html)) !== null) {
  const start = Math.max(0, m.index - 60);
  const end = Math.min(html.length, m.index + m[0].length + 60);
  const context = html.substring(start, end);
  console.log(`[${++idx}] ${m[1]} — context: ...${context}...\n`);
}

// Count total
const all = html.match(/yurukusa\.github\.io/g) || [];
console.log(`Total remaining references: ${all.length}`);
