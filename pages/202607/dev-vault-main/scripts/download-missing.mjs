import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.resolve(ROOT, 'index.html');
const TOOLS_DIR = path.resolve(ROOT, 'tools');

function parseTools(html) {
  const tools = [];
  const re = /{name:'([^']*)',desc:'[^']*',url:'([^']*)',cat:'([^']*)'/g;
  const seen = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[2];
    const cat = m[3];
    if (url.startsWith('https://yurukusa.github.io/') && !seen.has(url)) {
      seen.add(url);
      const toolName = url.replace(/\/+$/, '').split('/').pop();
      tools.push({ name: m[1], url, cat, toolName });
    }
  }
  return tools;
}

function isDownloaded(toolName) {
  const dirs = readdirSync(TOOLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dir of dirs) {
    if (existsSync(path.join(TOOLS_DIR, dir.name, toolName + '.html'))) return true;
  }
  return false;
}

async function tryDownload(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function main() {
  const html = readFileSync(INDEX, 'utf-8');
  const allTools = parseTools(html);
  const missing = allTools.filter(t => !isDownloaded(t.toolName));

  console.log(`Total external: ${allTools.length}, Missing local: ${missing.length}\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < missing.length; i++) {
    const t = missing[i];
    const filePath = path.resolve(TOOLS_DIR, t.cat, `${t.toolName}.html`);
    const pct = ((i + 1) / missing.length * 100).toFixed(1);

    if (existsSync(filePath)) continue;

    let content = null;
    let usedBranch = 'main';
    // Try main branch first
    const urlMain = `https://raw.githubusercontent.com/yurukusa/${t.toolName}/main/index.html`;
    try {
      content = await tryDownload(urlMain);
    } catch {
      // Try master branch as fallback
      const urlMaster = `https://raw.githubusercontent.com/yurukusa/${t.toolName}/master/index.html`;
      try {
        content = await tryDownload(urlMaster);
        usedBranch = 'master';
      } catch {
        fail++;
        process.stdout.write(`\r${pct}% [${i+1}/${missing.length}] ${t.toolName} — FAIL`);
        continue;
      }
    }

    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    ok++;
    process.stdout.write(`\r${pct}% [${i+1}/${missing.length}] ${t.toolName} — OK (${usedBranch})`);

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n\nDone. Downloaded: ${ok}, Failed: ${fail}`);
}

main().catch(console.error);
