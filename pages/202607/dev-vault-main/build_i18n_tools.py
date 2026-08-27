"""
Build i18n for individual tool files.

Usage:
  python build-i18n-tools.py extract <file>          # extract strings to stdout
  python build-i18n-tools.py extract-all [outdir]     # extract all files
  python build-i18n-tools.py inject <file> <trans.json>   # inject i18n
"""

import sys, os, json, re, html as html_mod

I18N_DECLARE = """
<script>
try{var _l=JSON.parse(localStorage.getItem('_dv_lang')||'""');if(_l!=='zh')_l='en'}catch(e){_l='en'}
var _L=_l;
function T(k){var a=_LANG&&_LANG[k];return a?a[_L==='zh'?1:0]:k}
function sL(l){try{localStorage.setItem('_dv_lang',l)}catch(e){}location.reload()}
</script>"""

I18N_EXEC = """
<script>
(function(){var L=_L;
if(typeof _LANG==='undefined'){_LANG={}}
document.documentElement.lang=L;
var tk=document.documentElement.getAttribute('tk');if(tk&&_LANG[tk])document.title=T(tk);
document.querySelectorAll('[ti]').forEach(function(e){
  var k=e.getAttribute('ti');if(!k||!_LANG[k])return;
  e.textContent=T(k);
});
document.querySelectorAll('[tp]').forEach(function(e){
  var k=e.getAttribute('tp');if(!k||!_LANG[k])return;
  e.placeholder=T(k);
});
document.querySelectorAll('.lb').forEach(function(b){b.classList.toggle('a',b.getAttribute('dl')===L)});
})();
</script>"""

LANG_BAR = '<div class="lb" style="position:absolute;top:12px;right:12px;display:flex;gap:4px;z-index:100;font-size:0.75rem">'
LANG_BAR += '<button class="lb" dl="en" onclick="sL(\'en\')" style="padding:3px 8px;border-radius:5px;border:1px solid #444;background:transparent;color:#888;cursor:pointer;font-weight:600">EN</button>'
LANG_BAR += '<button class="lb" dl="zh" onclick="sL(\'zh\')" style="padding:3px 8px;border-radius:5px;border:1px solid #444;background:transparent;color:#888;cursor:pointer;font-weight:600">中</button>'
LANG_BAR += '</div>'
LANG_CSS = '<style>.lb.a{background:#1a2744!important;color:#4da6ff!important;border-color:#2a4a7a!important}</style>'


def esc_re(s):
    return re.escape(s)


def strip_script_style(html):
    """Remove <script> and <style> tag contents to avoid false extraction matches."""
    s = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.I)
    s = re.sub(r'<style[^>]*>.*?</style>', '', s, flags=re.DOTALL | re.I)
    return s


def extract_html_texts(html):
    """Extract all translatable text from HTML elements. Returns list of (kind, text)."""
    html_clean = strip_script_style(html)
    texts = []

    def add(kind, text):
        t = html_mod.unescape(text).strip()
        if t and len(t) > 1 and t[0] != '<':
            texts.append((kind, t))

    # <title>
    m = re.search(r'<title>([^<]+)</title>', html, re.I)
    if m: add('title', m.group(1))

    # <meta description>
    for m in re.finditer(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', html, re.I):
        add('meta_desc', m.group(1))

    # <h1> <h2> <h3>
    for tag in ['h1', 'h2', 'h3']:
        for m in re.finditer(f'<{tag}[^>]*>([^<]+)</{tag}>', html_clean, re.I):
            add(tag, m.group(1))

    # subtitle p
    for m in re.finditer(r'<p\s+class=["\'](?:subtitle|sub|desc)["\'][^>]*>([^<]+)</p>', html_clean, re.I):
        add('subtitle', m.group(1))

    # buttons
    for m in re.finditer(r'<button[^>]*>([^<]+)</button>', html_clean, re.I):
        add('btn', m.group(1))

    # labels
    for m in re.finditer(r'<span[^>]*class=["\'][^"\']*label[^"\']*["\'][^>]*>([^<]+)</span>', html_clean, re.I):
        add('label', m.group(1))

    # placeholder (handle multiline)
    for m in re.finditer(r'placeholder=(["\'])(.*?)\1', html_clean, re.DOTALL):
        add('placeholder', m.group(2))

    # <strong> (section headers)
    for m in re.finditer(r'<strong[^>]*>([^<]+)</strong>', html_clean, re.I):
        add('strong', m.group(1))

    # <th>
    for m in re.finditer(r'<th[^>]*>([^<]+)</th>', html_clean, re.I):
        add('th', m.group(1))

    # <label>
    for m in re.finditer(r'<label[^>]*>([^<]+)</label>', html_clean, re.I):
        add('label', m.group(1))

    # footer/link text (use single-line matching to avoid false positives across script/style)
    for m in re.finditer(r'>([^<>\n]*Dev[^V\n]*Vault[^<>\n]*)<', html_clean):
        add('footer', m.group(1))
    for m in re.finditer(r'>([^<>\n]*free tools[^<>\n]*)<', html_clean):
        add('footer', m.group(1))

    # <a> text (link labels)
    for m in re.finditer(r'<a[^>]*href=["\'][^"\']*["\']>([^<]{1,80})</a>', html_clean, re.I):
        t = m.group(1).strip()
        if t and not t.startswith('http') and not t.startswith('#'):
            add('link', t)

    # <div> with text contents (simple case)
    for m in re.finditer(r'<div[^>]*id=["\']status["\'][^>]*>([^<]+)</div>', html_clean, re.I):
        add('status', m.group(1))

    return texts


def extract_js_texts(html):
    """Extract translatable strings from JS."""
    texts = []
    m = re.search(r'<script>(.*?)</script>', html, re.DOTALL | re.I)
    if not m: return texts
    js = m.group(1)

    # textContent = 'string'
    for m2 in re.finditer(r"""textContent\s*=\s*['"]([^'"]{2,200})['"]""", js):
        texts.append(('js_tc', m2.group(1).strip()))

    # textContent = 'prefix: ' (for "Invalid: " + e.message patterns)
    for m2 in re.finditer(r"""textContent\s*=\s*[']([^']{2,60})[']\s*\+""", js):
        t = m2.group(1)
        if t.strip():
            texts.append(('js_tc_pre', t))

    # alert/confirm strings
    for m2 in re.finditer(r"""(?:alert|confirm|prompt)\s*\(\s*['"]([^'"]{2,200})['"]\s*\)""", js):
        texts.append(('js_alert', m2.group(1).strip()))

    # Template literals with innerHTML - extract label words from <span class="l">word</span>
    for m2 in re.finditer(r'(?:innerHTML|textContent)\s*=\s*(`[^`]*`)', js):
        tl = m2.group(1)
        # Extract text between tags inside the template
        for word in re.findall(r'>(\w+)<', tl):
            if len(word) > 1 and word[0].isalpha():
                texts.append(('js_tl_word', word))

    return texts


def make_key(text, kind, used_keys):
    """Generate unique key for a string."""
    prefix = kind.replace('js_', 'j').replace('_', '')
    key = re.sub(r'[^a-z0-9]+', '_', text.lower().strip())[:25].strip('_')
    if not key:
        key = 'x'
    key2 = f'{prefix}_{key}'
    base = key2
    n = 1
    while key2 in used_keys:
        n += 1
        key2 = f'{base}_{n}'
    used_keys.add(key2)
    return key2


def extract_file(filepath):
    """Extract all translatable strings from a tool file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    used = set()
    strings = {}

    for kind, text in extract_html_texts(html):
        key = make_key(text, kind, used)
        strings[key] = {'en': text, '_k': kind}

    for kind, text in extract_js_texts(html):
        key = make_key(text, kind, used)
        strings[key] = {'en': text, '_k': kind}

    return strings


def add_ti(html, text, key, kind=''):
    """Add ti="key" attribute to the FIRST matching element containing text.
    Preserves all original content. kind hints which element type to try first."""
    t = html_mod.unescape(text).strip()
    if not t or len(t) < 2:
        return html, False

    te = re.escape(t)

    def ins_ti(m, k=key):
        full = m.group(0)
        tag_open = m.group(1)
        # full = tag_open + '>' + text + '</tag>'
        # skip the > at full[len(tag_open)]
        rest = full[len(tag_open) + 1:]
        return tag_open + f' ti="{k}">' + rest

    # Patterns ordered by specificity, then by kind hint
    head = []
    if kind == 'btn':    head = [rf'(<button[^>]*)>\s*{te}\s*</button>']
    elif kind == 'h1':   head = [rf'(<h1[^>]*)>\s*{te}\s*</h1>']
    elif kind == 'h2':   head = [rf'(<h2[^>]*)>\s*{te}\s*</h2>']
    elif kind == 'h3':   head = [rf'(<h3[^>]*)>\s*{te}\s*</h3>']
    elif kind == 'strong': head = [rf'(<strong[^>]*)>\s*{te}\s*</strong>']
    elif kind == 'status': head = [rf'(<div[^>]*id=["\']status["\'][^>]*)>\s*{te}\s*</div>']

    patterns = head + [
        rf'(<button[^>]*)>\s*{te}\s*</button>',
        rf'(<h1[^>]*)>\s*{te}\s*</h1>',
        rf'(<h2[^>]*)>\s*{te}\s*</h2>',
        rf'(<h3[^>]*)>\s*{te}\s*</h3>',
        rf'(<strong[^>]*)>\s*{te}\s*</strong>',
        rf'(<p[^>]*class=["\'](?:subtitle|sub|desc)["\'][^>]*)>\s*{te}\s*</p>',
        rf'(<span[^>]*class=["\'][^"\']*label[^"\']*["\'][^>]*)>\s*{te}\s*</span>',
        rf'(<div[^>]*id=["\']status["\'][^>]*)>\s*{te}\s*</div>',
        rf'(<p[^>]*)>\s*{te}\s*</p>',
        rf'(<(?:th|td)[^>]*)>\s*{te}\s*</(?:th|td)>',
        rf'(<label[^>]*)>\s*{te}\s*</label>',
        rf'(<a[^>]*)>\s*{te}\s*</a>',
    ]

    for pat in patterns:
        new_html, n = re.subn(pat, ins_ti, html, count=1)
        if n > 0:
            return new_html, True

    return html, False


def find_first_script_tag(html, start=0):
    """Find the first <script> tag not inside <textarea>, handling > in attributes."""
    i = start
    n = len(html)
    lb = html.lower()

    while i < n:
        # Check for textarea start (not inside an attribute value)
        if i+9 <= n and lb[i:i+9] == '<textarea' and (i+9 >= n or lb[i+9] in ('>', ' ', '\t', '\n', '\r')):
            # Find the closing > of the textarea start tag, tracking quotes
            j = i + 9
            in_sq, in_dq = False, False
            while j < n:
                c = html[j]
                if c == "'" and not in_dq:
                    in_sq = not in_sq
                elif c == '"' and not in_sq:
                    in_dq = not in_dq
                elif c == '>' and not in_sq and not in_dq:
                    break
                j += 1
            # Find the closing </textarea>
            end = html.find('</textarea>', j)
            if end >= 0:
                i = end + 11
            else:
                i = j + 1 if j < n else n
            continue

        # Check for script start
        if i+7 < n and lb[i:i+7] == '<script' and lb[i+7] in ('>', ' ', '\t', '\n', '\r'):
            return i

        i += 1

    return -1


def inject_file(filepath, translations, dry_run=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Build LANG object
    pairs = []
    for k, v in translations.items():
        en = v.get('en', '')
        zh = v.get('zh', '')
        if en and zh:
            pairs.append(f"'{k}':{json.dumps([en, zh], ensure_ascii=False)}")

    if not pairs:
        print(f"  SKIP {os.path.basename(filepath)}: no zh translations")
        return False

    added = 0

    # 1. Add tk attr to <html> for title
    for k, v in translations.items():
        if v.get('_k', '') == 'title' and v.get('zh'):
            if 'tk=' not in html:
                html = html.replace('<html ', f'<html tk="{k}" ', 1)
                added += 1
            break

    # 2. Add ti attributes to HTML elements
    for k, v in translations.items():
        en = v.get('en', '')
        zh = v.get('zh', '')
        if not en or not zh:
            continue
        kind = v.get('_k', '')
        if kind.startswith('j') or kind == 'placeholder':
            continue

        html, matched = add_ti(html, en, k, kind)
        if matched:
            added += 1

    # 2b. Handle placeholders
    for k, v in translations.items():
        en = v.get('en', '')
        zh = v.get('zh', '')
        if not en or not zh:
            continue
        kind = v.get('_k', '')
        if kind != 'placeholder':
            continue

        te = re.escape(en)
        new_html, n = re.subn(
            rf'placeholder=(["\']){te}\1',
            lambda m, k=k, en=en: f'tp="{k}" placeholder=' + m.group(1) + en + m.group(1),
            html, count=1, flags=re.DOTALL
        )
        if n > 0:
            html = new_html
            added += 1

    # 3. Replace JS textContent strings
    for k, v in translations.items():
        en = v.get('en', '')
        zh = v.get('zh', '')
        kind = v.get('_k', '')
        if not en or not zh:
            continue
        if not kind.startswith('j'):
            continue

        te = re.escape(en)

        # For prefix patterns like "Invalid: " + e.message, preserve the + 
        if kind == 'js_tc_pre':
            new_html, n = re.subn(
                rf"""textContent\s*=\s*["']{te}["']\s*\+""",
                f'textContent=T("{k}")+',
                html
            )
        elif kind == 'js_alert':
            new_html, n = re.subn(
                rf"""(?:alert|confirm|prompt)\s*\(\s*["']{te}["']\s*\)""",
                f'T("{k}")',
                html
            )
        else:
            new_html, n = re.subn(
                rf"""textContent\s*=\s*["']{te}["']""",
                f'textContent=T("{k}")',
                html
            )
        if n > 0:
            html = new_html
            added += 1

    # 4a. Inject _LANG before first tool script (after </head>)
    head_end = html.find('</head>')
    first_script = -1
    if head_end >= 0:
        first_script = find_first_script_tag(html, head_end + 7)
    lang_js = '<script>var _LANG={' + ','.join(pairs) + '};\n</script>\n'
    if first_script >= 0:
        html = html[:first_script] + '\n' + lang_js + I18N_DECLARE + '\n' + html[first_script:]
        added += 1

    # 4b. Inject I18N_EXEC before </body>
    body_close = html.rfind('</body>')
    if body_close >= 0:
        html = html[:body_close] + '\n' + I18N_EXEC + '\n' + html[body_close:]
        added += 1

    # 5. Inject lang toggle + CSS
    html = re.sub(r'(<div\s+class=["\']container["\'])(?!.*?style)', r'\1 style="position:relative"', html, count=1)
    body_tag = re.search(r'<body[^>]*>', html)
    if body_tag:
        pos = body_tag.end()
        html = html[:pos] + '\n' + LANG_BAR + LANG_CSS + '\n' + html[pos:]
        added += 1

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        n_pairs = len(pairs)
        print(f"  [{os.path.basename(filepath)}] {n_pairs} trans, {added} ops")
    else:
        print(f"  [DRY] {os.path.basename(filepath)}: {len(pairs)} trans, {added} ops")

    return added > 0


def extract_main():
    filepath = sys.argv[2]
    strings = extract_file(filepath)
    print(json.dumps({os.path.basename(filepath): strings}, ensure_ascii=False, indent=2))


def extract_all_main():
    tools_dir = os.path.join(os.path.dirname(__file__), 'tools')
    outdir = sys.argv[3] if len(sys.argv) > 3 else '_i18n_raw'
    os.makedirs(outdir, exist_ok=True)

    total_f = 0
    total_s = 0
    all_strings = {}
    for root, dirs, files in os.walk(tools_dir):
        for fn in sorted(files):
            if not fn.endswith('.html'):
                continue
            fp = os.path.join(root, fn)
            strings = extract_file(fp)
            if strings:
                all_strings[fn] = strings
                total_f += 1
                total_s += len(strings)
            print(f"  {fn}: {len(strings)} strs")

    outpath = os.path.join(outdir, '_all_strings.json')
    with open(outpath, 'w', encoding='utf-8') as f:
        json.dump(all_strings, f, ensure_ascii=False, indent=2)
    print(f"\n=== {total_f} files, {total_s} total strings -> {outpath} ===")


def inject_main():
    filepath = sys.argv[2]
    trans_file = sys.argv[3]
    dry_run = '--dry' in sys.argv

    with open(trans_file, 'r', encoding='utf-8') as f:
        trans = json.load(f)

    # trans might be {filename: {...}} or just {...}
    data = trans
    if len(trans) == 1:
        fn = list(trans.keys())[0]
        if fn.endswith('.html'):
            data = trans[fn]

    inject_file(filepath, data, dry_run=dry_run)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    mode = sys.argv[1]
    if mode == 'extract':
        extract_main()
    elif mode == 'extract-all':
        extract_all_main()
    elif mode == 'inject':
        inject_main()
    else:
        print(f"Unknown mode: {mode}")
