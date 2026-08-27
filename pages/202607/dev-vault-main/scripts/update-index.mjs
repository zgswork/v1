import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.resolve(ROOT, 'index.html');

const html = readFileSync(INDEX, 'utf-8');

// Parse all tool entries with position info
function parseTools(html) {
  const tools = [];
  const re = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)',icon:'([^']*)'(?:,featured:(true))?}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    tools.push({
      full: m[0],
      name: m[1],
      desc: m[2],
      url: m[3],
      cat: m[4],
      icon: m[5],
      featured: m[6] === 'true',
      index: m.index,
    });
  }
  return tools;
}

function toolNameFromUrl(url) {
  const parts = url.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1];
}

const allTools = parseTools(html);
const externalTools = allTools.filter(t => t.url.startsWith('https://yurukusa.github.io/'));
const localTools = allTools.filter(t => t.url.startsWith('tools/'));

console.log(`Total: ${allTools.length}, External: ${externalTools.length}, Local: ${localTools.length}`);

// Build replacements: old entry -> new entry
const replacements = new Map();
let removed = 0, converted = 0, keptExternal = 0;

for (const tool of externalTools) {
  const toolName = toolNameFromUrl(tool.url);
  const localPath = `tools/${tool.cat}/${toolName}.html`;
  const fullPath = path.resolve(ROOT, localPath);

  if (existsSync(fullPath)) {
    // File downloaded -> convert to local path
    const newEntry = `{name:'${tool.name}',desc:'${tool.desc}',url:'${localPath}',cat:'${tool.cat}',icon:'${tool.icon}'${tool.featured ? ',featured:true' : ''}}`;
    replacements.set(tool.full, newEntry);
    converted++;
  } else {
    // File not available -> keep as-is (external fallback)
    keptExternal++;
  }
}

// Apply replacements to original HTML (from end to start to preserve indices)
let result = html;
for (const [oldStr, newStr] of replacements) {
  // Replace only first occurrence (each entry is unique)
  result = result.replace(oldStr, newStr);
}

writeFileSync(INDEX, result, 'utf-8');

console.log(`\nDone. Converted to local: ${converted}, Kept external (404): ${keptExternal}, Total external: ${externalTools.length}`);
