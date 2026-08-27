"""
Inject batch translations into tool files.

Usage:
  python inject_batch.py <batch_json> [--dry]
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from build_i18n_tools import inject_file

def main():
    batch_file = sys.argv[1]
    dry_run = '--dry' in sys.argv
    tools_dir = os.path.join(os.path.dirname(__file__), 'tools')

    with open(batch_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    files = [k for k in data if k != '_files']
    success = 0
    skip = 0
    errors = []

    for fn in files:
        # Find the file in tools_dir
        fp = None
        for root, dirs, dir_files in os.walk(tools_dir):
            if fn in dir_files:
                fp = os.path.join(root, fn)
                break

        if not fp:
            errors.append(f'{fn}: not found')
            continue

        # Check if all entries have zh
        strings = data[fn]
        has_zh = any('zh' in v for v in strings.values())
        if not has_zh:
            print(f'  SKIP {fn}: no zh')
            skip += 1
            continue

        try:
            inject_file(fp, strings, dry_run=dry_run)
            success += 1
        except Exception as e:
            errors.append(f'{fn}: {e}')

    print(f'\n=== {success} injected, {skip} skipped, {len(errors)} errors ===')
    if errors:
        for e in errors[:10]:
            print(f'  ERROR: {e}')

if __name__ == '__main__':
    main()
