import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const html = readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');

// Find npm Dep Graph entry
let idx = html.indexOf("{name:'npm Dep Graph'");
let end = html.indexOf('}', idx);
let entry = html.substring(idx, end + 1);
console.log('Entry:', entry);
console.log('Has icon:', entry.includes("icon:"));

// Also check what the update-all-copies regex would match
const updateRe = /{name:'([^']*)',desc:'([^']*)',url:'([^']*)',cat:'([^']*)',icon:'([^']*)'(?:,featured:(true))?}/g;
const updateMatches = [];
let m;
while ((m = updateRe.exec(html)) !== null) {
  if (m[1] === 'npm Dep Graph') {
    updateMatches.push(m[0]);
  }
}
console.log('Update script matches for npm Dep Graph:', updateMatches.length);

// Check if maybe there's more content after cat before icon or end
const afterCatRe = /{name:'npm Dep Graph',desc:'([^']*)',url:'([^']*)',cat:'data'([^}]*)}/g;
const afterMatches = [];
let m2;
while ((m2 = afterCatRe.exec(html)) !== null) {
  afterMatches.push(m2[3]);
}
console.log('Content after cat for npm Dep Graph:', JSON.stringify(afterMatches));

// For reference, also find a tool that WAS replaced
const replacedRe = /{name:'dep-tree'/g;
const replacedMatches = html.match(replacedRe);
console.log('\nMatching dep-tree (should have been replaced):', replacedMatches ? replacedMatches.length : 0);

// Check entry for dep-tree
let idx2 = html.indexOf("{name:'dep-tree'");
if (idx2 >= 0) {
  let end2 = html.indexOf('}', idx2);
  console.log('dep-tree entry (replaced):', html.substring(idx2, end2 + 1));
}
