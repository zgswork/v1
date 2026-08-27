import json, re, subprocess, os

INDEX_FILE = "index.html"
TRANS_FILE = "translations.json"

with open(TRANS_FILE, "r", encoding="utf-8") as f:
    trans = json.load(f)

with open(INDEX_FILE, "rb") as f:
    raw = f.read()
if raw[:2] == b"\xff\xfe":
    raw = raw[2:]
    if len(raw) % 2 != 0:
        raw = raw[:-1]
    html = raw.decode("utf-16-le")
elif raw[:3] == b"\xef\xbb\xbf":
    html = raw[3:].decode("utf-8")
else:
    html = raw.decode("utf-8")

print(f"HTML length: {len(html)}")

ts = html.index("const TOOLS=[")
te = html.index("];", ts) + 2
tools_str = html[ts:te]

# Fix missing closing quotes in icon fields (pre-existing UTF-16 corruption)
def fix_icon_line(line):
    if "icon:'" not in line:
        return line, 0
    idx = line.index("icon:'") + 6  # position after icon:'
    rest = line[idx:]
    # Find where the icon value should end: before ,featured:true or before }, or before ,}
    end_markers = [",featured:true", "},", "}\r", "}\n"]
    end = len(rest)
    for m in end_markers:
        p = rest.find(m)
        if p >= 0 and p < end:
            end = p
    if end <= 0:
        return line, 0
    icon_val = rest[:end]
    if "'" not in icon_val:
        # Add closing quote before the end marker
        new_line = line[:idx + end] + "'" + line[idx + end:]
        return new_line, 1
    return line, 0

lines = tools_str.split("\n")
fixed = 0
fixed_lines = []
for l in lines:
    nl, f = fix_icon_line(l)
    fixed_lines.append(nl)
    fixed += f
tools_str = "\n".join(fixed_lines)
print(f"Icon fix: {fixed} entries fixed")

entries = []
# Remove const TOOLS=[ prefix and ]; suffix
inner = tools_str.strip()
if inner.startswith("const TOOLS=["):
    inner = inner[len("const TOOLS=["):]
if inner.endswith("];"):
    inner = inner[:-2]
normalized = inner.replace("},\r\n{", "}||{").replace("},\n{", "}||{").replace("},{", "}||{")
parts = normalized.split("||")
for part in parts:
    part = part.strip()
    if not part: continue
    if not part.startswith("{"): part = "{" + part
    if not part.endswith("}"): part += "}"
    entry = {"raw": part}
    for kv in re.findall(r"(\w+):'((?:[^'\\]|\\.)*)'", part):
        entry[kv[0]] = kv[1]
    entry["featured"] = "featured:true" in part
    entries.append(entry)

print(f"Parsed {len(entries)} tool entries")

def esc(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")

zh_items = []
missing = []
# Build normalization map for garbled characters
# The original file has corrupted Unicode (鈫? instead of ↔/→)
# Map these corrupted names to proper translation keys
GARBLED_MAP = {}
for k in trans:
    # The corruption replaces ↔/→ with 鈫? AND removes the space after the arrow
    # "CSV ↔ JSON" -> "CSV 鈫?JSON"
    g = k.replace(" ↔ ", " 鈫?").replace(" → ", " 鈫?")
    g = g.replace("↔ ", "鈫?").replace("→ ", "鈫?")
    g = g.replace(" ↔", " 鈫?").replace(" →", " 鈫?")
    if g != k:
        GARBLED_MAP[g] = k
        
def norm(s):
    return GARBLED_MAP.get(s, s)

for e in entries:
    name = e["name"]
    key = norm(name)
    if key != name:
        print(f"  norm: {repr(name)} -> {repr(key)}")
    t = trans.get(key, trans.get(name, {}))
    name_zh = t.get("nameZh", name)
    desc_zh = t.get("descZh", e["desc"])
    raw_e = e["raw"]
    
    # Fix missing closing quote in icon field (pre-existing corruption)
    icon_q = re.search(r"icon:'((?:[^'\\]|\\.)*?)'(\s*[,}])", raw_e)
    if not icon_q:
        # No closing quote found - add one before } or ,
        raw_e = re.sub(
            r"(icon:'(?:[^'\\]|\\.)*?)(\s*[,}])",
            lambda m: m.group(1) + "'" + m.group(2),
            raw_e,
            count=1
        )
        # Re-parse entry fields after fix
        for kv in re.findall(r"(\w+):'((?:[^'\\]|\\.)*)'", raw_e):
            e[kv[0]] = kv[1]
    
    raw_e = re.sub(r"name:'((?:[^'\\]|\\.)*)'", f"name:'{esc(name_zh)}'", raw_e, count=1)
    raw_e = re.sub(r"desc:'((?:[^'\\]|\\.)*)'", f"desc:'{esc(desc_zh)}'", raw_e, count=1)
    zh_items.append(raw_e)
    if key not in trans:
        missing.append(f"{name} (key={key})")

zh_array = "const TOOLS_ZH=[\n" + ",\n".join(zh_items) + "\n];"
print(f"TOOLS_ZH: {len(zh_items)} entries")
if missing:
    print(f"WARNING: {len(missing)} missing translations: {missing}")

# Check that zh_array has valid entries
zh_names = re.findall(r"name:'((?:[^'\\]|\\.)*)'", zh_array)
print(f"zh_array has {len(zh_names)} entries with names")

# Validate each raw entry ends with } properly
bad = [i for i, e in enumerate(zh_items) if not e.endswith("}")]
if bad:
    print(f"WARNING: {len(bad)} entries don't end with }}: {bad[:5]}")
    for i in bad[:3]:
        print(f"  [{i}]: {zh_items[i][-50:]}")

LANG = {
    "title": {"en": "Dev Toolkit \u2014 Free Developer Tools", "zh": "Dev Toolkit \u2014 \u514d\u8d39\u5f00\u53d1\u8005\u5de5\u5177"},
    "meta": {"en": "Free browser tools for developers and designers. No signup, no ads, no tracking. Single HTML files.", "zh": "\u9762\u5411\u5f00\u53d1\u8005\u548c\u8bbe\u8ba1\u5e08\u7684\u514d\u8d39\u6d4f\u89c8\u5668\u5de5\u5177\u3002\u65e0\u9700\u6ce8\u518c\uff0c\u65e0\u5e7f\u544a\uff0c\u65e0\u8ffd\u8e2a\uff0c\u7eaf HTML \u6587\u4ef6\u3002"},
    "h1": {"en": "Dev Toolkit", "zh": "Dev Toolkit"},
    "tagline": {"en": "Free browser tools for developers and designers", "zh": "\u9762\u5411\u5f00\u53d1\u8005\u548c\u8bbe\u8ba1\u5e08\u7684\u514d\u8d39\u6d4f\u89c8\u5668\u5de5\u5177"},
    "metaLine": {"en": "No signup. No ads. No tracking. Single HTML files.", "zh": "\u65e0\u9700\u6ce8\u518c \u00b7 \u65e0\u5e7f\u544a \u00b7 \u65e0\u8ffd\u8e2a \u00b7 \u5355 HTML \u6587\u4ef6"},
    "search": {"en": "Search {n} tools...  ( / to focus)", "zh": "\u641c\u7d22 {n} \u4e2a\u5de5\u5177...\uff08\u6309 / \u805a\u7126\uff09"},
    "picks": {"en": "Staff Picks", "zh": "\u7cbe\u9009\u63a8\u8350"},
    "noResults": {"en": "No tools match your search.", "zh": "\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u5de5\u5177\u3002"},
    "dep0": {"en": "Zero Dependencies", "zh": "\u96f6\u4f9d\u8d56"},
    "dep0d": {"en": "Every tool is a single HTML file. No npm, no build step.", "zh": "\u6bcf\u4e2a\u5de5\u5177\u90fd\u662f\u72ec\u7acb HTML \u6587\u4ef6\u3002\u65e0\u9700 npm\uff0c\u65e0\u9700\u6784\u5efa\u3002"},
    "oss": {"en": "Open Source", "zh": "\u5f00\u6e90"},
    "ossd": {"en": "All tools on GitHub. Fork, modify, self-host.", "zh": "\u6240\u6709\u5de5\u5177\u5728 GitHub \u4e0a\u3002Fork\u3001\u4fee\u6539\u3001\u81ea\u6258\u7ba1\u3002"},
    "priv": {"en": "Privacy First", "zh": "\u9690\u79c1\u4f18\u5148"},
    "privd": {"en": "Everything runs in your browser. No data leaves your machine.", "zh": "\u4e00\u5207\u5728\u6d4f\u89c8\u5668\u4e2d\u8fd0\u884c\u3002\u6570\u636e\u4e0d\u4f1a\u79bb\u5f00\u4f60\u7684\u8bbe\u5907\u3002"},
}

CAT_ZH = {
    "all": "\u5168\u90e8", "js": "JavaScript", "css": "CSS", "code": "\u7f16\u7801",
    "design": "\u8bbe\u8ba1", "image": "\u56fe\u7247", "color": "\u989c\u8272",
    "security": "\u5b89\u5168", "devops": "DevOps", "data": "\u6570\u636e",
    "writing": "\u5199\u4f5c", "ai": "AI / LLM", "api": "API",
    "seo": "SEO", "perf": "\u6027\u80fd", "network": "\u7f51\u7edc",
    "net": "\u7f51\u7edc", "infra": "\u57fa\u7840\u8bbe\u65bd", "converter": "\u8f6c\u6362",
    "reference": "\u53c2\u8003", "text": "\u6587\u672c", "math": "\u6570\u5b66",
    "crypto": "\u52a0\u5bc6", "media": "\u5a92\u4f53", "device": "\u8bbe\u5907",
}

i18n_script = f"""
// ===== i18n =====
const LANG = {json.dumps(LANG, ensure_ascii=False)};
const CAT_ZH = {json.dumps(CAT_ZH, ensure_ascii=False)};
let lang = 'en';

function t(key) {{ return (LANG[key]||{{}})[lang] || key; }}
function getTools() {{ return lang === 'zh' ? TOOLS_ZH : TOOLS; }}
function getCatLabel(c) {{ return lang === 'zh' ? (CAT_ZH[c.id] || c.id) : c.label; }}

function applyLang() {{
  document.documentElement.lang = lang;
  document.title = t('title');
  var m = document.querySelector('meta[name="description"]');
  if (m) m.content = t('meta');
  var h1 = document.querySelector('.hero h1');
  if (h1) h1.textContent = t('h1');
  var tl = document.querySelector('.tagline');
  if (tl) tl.textContent = t('tagline');
  var mt = document.querySelector('.meta');
  if (mt) mt.textContent = t('metaLine');
  var sp = document.getElementById('search');
  if (sp) sp.placeholder = t('search').replace('{{n}}', getTools().length);
  var pk = document.querySelector('.picks h2');
  if (pk) pk.textContent = t('picks');
  var pr = document.querySelectorAll('.principle');
  if (pr[0]) {{ pr[0].querySelector('h3').textContent = t('dep0'); pr[0].querySelector('p').textContent = t('dep0d'); }}
  if (pr[1]) {{ pr[1].querySelector('h3').textContent = t('oss'); pr[1].querySelector('p').textContent = t('ossd'); }}
  if (pr[2]) {{ pr[2].querySelector('h3').textContent = t('priv'); pr[2].querySelector('p').textContent = t('privd'); }}
  document.querySelectorAll('.lang-btn').forEach(function(b) {{ b.classList.toggle('active', b.dataset.lang === lang); }});
  renderFilters();
  filterTools();
}}

function setLang(l) {{ lang = l; localStorage.setItem('lang', l); applyLang(); }}
// ===== end i18n =====
"""

before_tools = html[:ts]
after_tools = html[te:]

cat_pos = after_tools.index("const CATEGORIES=[")
before_cat = after_tools[:cat_pos]
after_cat = after_tools[cat_pos:]

# Use simple str.replace for the CATEGORIES.map TOOLS references
# (the complex multi-line pattern failed due to internal whitespace)
after_cat = after_cat.replace("TOOLS.length", "getTools().length")
after_cat = after_cat.replace("TOOLS.filter(", "getTools().filter(")

# Keep the working replacements
after_cat = after_cat.replace("c.label}", "getCatLabel(c)}")
after_cat = after_cat.replace(
    "const filtered=TOOLS.filter(t=>{",
    "const filtered=getTools().filter(t=>{"
)
after_cat = after_cat.replace(
    "const picks=filtered.filter(t=>t.featured);",
    "var tools=getTools();const picks=filtered.filter(t=>t.featured);"
)

# Replace the No tools match fallback string
after_cat = after_cat.replace(
    "||'<div style=\"text-align:center;color:#555;grid-column:1/-1;padding:40px\">No tools match your search.</div>'",
    "||t('noResults')"
)

old_bottom_crlf = "renderFilters();\r\nfilterTools();"
old_bottom_lf = "renderFilters();\nfilterTools();"
new_bottom = "// Init language\nlang = (navigator.language || '').startsWith('zh') ? 'zh' : 'en';\nif (localStorage.getItem('lang')) lang = localStorage.getItem('lang');\napplyLang();"
after_cat = after_cat.replace(old_bottom_crlf, new_bottom).replace(old_bottom_lf, new_bottom)

toggle_html = (
    '<div style="position:absolute;top:16px;right:16px;display:flex;gap:6px;z-index:10">'
    '<button class="lang-btn" data-lang="en" onclick="setLang(\'en\')" style="padding:4px 10px;border-radius:6px;border:1px solid #333;background:#161616;color:#888;font-size:0.78rem;cursor:pointer;font-weight:600">EN</button>'
    '<button class="lang-btn" data-lang="zh" onclick="setLang(\'zh\')" style="padding:4px 10px;border-radius:6px;border:1px solid #333;background:#161616;color:#888;font-size:0.78rem;cursor:pointer;font-weight:600">\u4e2d</button>'
    '</div>'
)

before_tools = before_tools.replace(
    '<div class="container">',
    '<div class="container" style="position:relative">'
)
before_tools = before_tools.replace(
    '<div class="hero">',
    toggle_html + '\n  <div class="hero">'
)

style_end = before_tools.index("</style>")
lang_css = "\n.lang-btn.active{background:#1a2744;color:#4da6ff;border-color:#2a4a7a}\n"
before_tools = before_tools[:style_end] + lang_css + before_tools[style_end:]

result = before_tools + tools_str + "\n\n" + zh_array + "\n\n" + i18n_script + "\n\n" + before_cat + after_cat

with open("index.html", "w", encoding="utf-8") as f:
    f.write(result)

print(f"Written index.html ({len(result)} bytes)")

# Validate with Node.js - extract all script content
si = result.index("<script>")
ei = result.index("</script>", si + 8)
script_js = result[si + 8:ei]
print(f"Script block: {len(script_js)} chars")

with open("_tmp_valid.js", "w", encoding="utf-8") as f:
    f.write(script_js)
r = subprocess.run(["node", "-e", "try{new Function(require('fs').readFileSync('_tmp_valid.js','utf8'));console.log('SCRIPT: VALID');}catch(e){console.log('SCRIPT: INVALID - '+e.message);}"], capture_output=True, text=True)
print(r.stdout.strip())
if r.stderr: print("STDERR:", r.stderr.strip())
os.remove("_tmp_valid.js")
