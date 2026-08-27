import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.resolve(ROOT, 'index.html');
const TOOLS_DIR = path.resolve(ROOT, 'tools');

const html = readFileSync(INDEX, 'utf-8');
const dirs = readdirSync(TOOLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());

let result = html;
let replaced = 0;

// Find all external URLs in tool entries and replace with local paths
const re = /url:'https:\/\/yurukusa\.github\.io\/([^\/]+)\/'/g;
let m;
while ((m = re.exec(html)) !== null) {
  const toolName = m[1];
  const externalUrl = m[0]; // e.g., url:'https://yurukusa.github.io/npm-dep-graph/'

  // Find which category this tool belongs to by checking which dir has the file
  for (const dir of dirs) {
    const filePath = path.join(TOOLS_DIR, dir.name, `${toolName}.html`);
    if (existsSync(filePath)) {
      const localUrl = `url:'tools/${dir.name}/${toolName}.html'`;
      if (result.includes(externalUrl)) {
        result = result.split(externalUrl).join(localUrl);
        replaced++;
      }
      break;
    }
  }
}

writeFileSync(INDEX, result, 'utf-8');
console.log(`Replaced ${replaced} external URLs with local paths.`);

// Verify
const remaining = (result.match(/yurukusa\.github\.io/g) || []).length;
console.log(`Remaining yurukusa.github.io references: ${remaining}`);
