import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');

// Test the regex against a specific entry
let idx = html.indexOf("{name:'npm Dep Graph'");
let end = html.indexOf('}', idx) + 1;
let entry = html.substring(idx, end);

const regex = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)',icon:'([^']*)'(?:,featured:(true))?}/g;
regex.lastIndex = 0;
const m = regex.exec(entry);
if (m) {
  console.log('MATCH!');
  console.log('  icon:', JSON.stringify(m[5]));
} else {
  console.log('NO MATCH');
  // Try without the optional featured
  const regex2 = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)',icon:'([^']*)}/g;
  regex2.lastIndex = 0;
  const m2 = regex2.exec(entry);
  if (m2) {
    console.log('MATCH with simpler regex!');
    console.log('  icon:', JSON.stringify(m2[5]));
  } else {
    console.log('Still no match with simpler regex');
  }
}

// Check for any fields after icon by seeing what's after the icon quote
let iconStart = entry.indexOf("icon:");
let afterIcon = entry.substring(iconStart);
console.log('\nAfter "icon:":', JSON.stringify(afterIcon));

// Check for issues with the '🕸' emoji specifically
const iconValue = entry.substring(entry.indexOf("icon:'") + 6, entry.lastIndexOf("'"));
console.log('Icon value chars:');
for (let i = 0; i < iconValue.length; i++) {
  console.log(`  [${i}] U+${iconValue.charCodeAt(i).toString(16).padStart(4, '0')} '${iconValue[i]}'`);
}
