import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'software_copyright_code.txt');

const TARGET_EXTS = ['.ts', '.tsx', '.css', '.html', '.json', '.js'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'release', 'coverage'];
const ROOT_CONFIGS = [
  'package.json',
  'electron-builder.json5',
  'vite.config.ts',
  'tailwind.config.js',
  'tsconfig.json',
];

let totalLines = 0;

function shouldIgnore(filePath) {
  return IGNORE_DIRS.some((dir) => filePath.includes(path.sep + dir + path.sep));
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  
  // Count lines (including empty ones)
  const lines = content.split('\n').length;
  totalLines += lines;

  return `// --- START OF FILE: ${relativePath} ---\n${content}\n\n`;
}

function walkDir(dir) {
  let results = '';
  const list = fs.readdirSync(dir);
  
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        results += walkDir(filePath);
      }
    } else {
      const ext = path.extname(file);
      if (TARGET_EXTS.includes(ext) && !shouldIgnore(filePath)) {
        // Only process files in src/ or specific root configs
        if (filePath.includes(path.join(ROOT, 'src')) || ROOT_CONFIGS.includes(file)) {
          results += processFile(filePath);
        }
      }
    }
  });
  
  return results;
}

console.log('Starting source code extraction...');

// 1. Process Root Configs
let output = '';
ROOT_CONFIGS.forEach(file => {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) {
    output += processFile(p);
  }
});

// 2. Process src directory
const srcDir = path.join(ROOT, 'src');
if (fs.existsSync(srcDir)) {
  output += walkDir(srcDir);
}

fs.writeFileSync(OUTPUT_FILE, output);

console.log('------------------------------------------------');
console.log(`Extraction Complete!`);
console.log(`Output File: ${OUTPUT_FILE}`);
console.log(`Total Lines: ${totalLines}`);
console.log('------------------------------------------------');
