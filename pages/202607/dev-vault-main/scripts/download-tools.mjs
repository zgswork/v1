import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.resolve(ROOT, 'index.html');

// Parse tool entries from the TOOLS array
function parseTools(html) {
  const tools = [];
  const re = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)',icon:'([^']*)'(?:,featured:(true))?}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    tools.push({ name: m[1], desc: m[2], url: m[3], cat: m[4], icon: m[5], featured: m[6] === 'true' });
  }
  return tools;
}

// Extract tool name from URL
function toolNameFromUrl(url) {
  const parts = url.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1];
}

async function download(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function main() {
  const html = readFileSync(INDEX, 'utf-8');
  const allTools = parseTools(html);
  const externalTools = allTools.filter(t => t.url.startsWith('https://yurukusa.github.io/'));

  console.log(`Found ${allTools.length} tools total, ${externalTools.length} external\n`);

  let ok = 0, fail = 0, skip = 0;

  for (let i = 0; i < externalTools.length; i++) {
    const tool = externalTools[i];
    const toolName = toolNameFromUrl(tool.url);
    const catDir = path.resolve(ROOT, 'tools', tool.cat);
    const filePath = path.resolve(catDir, `${toolName}.html`);
    const pct = ((i + 1) / externalTools.length * 100).toFixed(1);

    if (existsSync(filePath)) {
      skip++;
      process.stdout.write(`\r${pct}% [${i+1}/${externalTools.length}] ${toolName}.html — skipped (exists)`);
      continue;
    }

    try {
      const content = await download(tool.url);
      mkdirSync(catDir, { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
      ok++;
      process.stdout.write(`\r${pct}% [${i+1}/${externalTools.length}] ${toolName}.html — OK`);
    } catch (e) {
      fail++;
      process.stdout.write(`\r${pct}% [${i+1}/${externalTools.length}] ${toolName}.html — FAIL: ${e.message}`);
    }

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n\nDone. Downloaded: ${ok}, Skipped: ${skip}, Failed: ${fail}`);
}

main().catch(console.error);
