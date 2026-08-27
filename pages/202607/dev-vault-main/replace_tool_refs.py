"""Batch replace yurukusa references with gokuscraper in all tool HTML files."""
import re, os, glob

TOOLS_DIR = r'L:\垃圾项目\dev-toolkit\tools'

REPLACEMENTS = [
    # 1. yurukusa.github.io → gokuscraper.github.io/dev-vault (MUST be before global yurukusa replace)
    ('yurukusa.github.io', 'gokuscraper.github.io/dev-vault'),
    # 2. All remaining yurukusa → gokuscraper (catches github.com/yurukusa, JSON-LD, text, etc.)
    ('yurukusa', 'gokuscraper'),
    # 3. Project name
    ('Dev Toolkit', 'Dev Vault'),
]

# Fix doubled paths from the domain+repo replacement
EXTRA_REPLACEMENTS = [
    ('dev-vault/dev-toolkit', 'dev-vault'),
    ('dev-vault/dev-vault', 'dev-vault'),
]

LINES_TO_DELETE_PATTERNS = [
    'cc-toolkit',
    'dev.to/yurukusa',
]

# Collect all HTML files
files = glob.glob(os.path.join(TOOLS_DIR, '**', '*.html'), recursive=True)
print(f"Found {len(files)} HTML files in tools/")

changed = 0
total_replacements = 0

for fpath in sorted(files):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Apply string replacements
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new)
    
    # Apply extra path fixes
    for old, new in EXTRA_REPLACEMENTS:
        if old in content:
            content = content.replace(old, new)
    
    # Delete lines containing cc-toolkit or dev.to/yurukusa
    for pattern in LINES_TO_DELETE_PATTERNS:
        if pattern in content:
            lines = content.split('\n')
            new_lines = [l for l in lines if pattern not in l]
            content = '\n'.join(new_lines)

    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        changed += 1
        # Count replacements
        for old, new in REPLACEMENTS + EXTRA_REPLACEMENTS:
            total_replacements += original.count(old) - content.count(old)

print(f"Modified: {changed} files")
print(f"Total replacements: {total_replacements}")

# Verify no yurukusa remains
remaining = 0
for fpath in sorted(files):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'yurukusa' in content.lower():
        remaining += 1
        # Show first occurrence
        idx = content.lower().find('yurukusa')
        line_start = content.rfind('\n', 0, idx) + 1
        line_end = content.find('\n', idx)
        line = content[line_start:line_end] if line_end > 0 else content[line_start:]
        print(f"  REMAINING: {fpath} -> {line.strip()[:100]}")

print(f"Files with remaining yurukusa refs: {remaining}")
