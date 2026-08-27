"""
Batch translate tool strings using Google Translate API (batched, primary)
→ Edge (fallback 1) → DeepL (fallback 2).

Usage: python batch_translate.py [batch_ids...]
  If no batch IDs given, processes all batches 01-19.
"""
import sys, os, json, time, requests

I18N_DIR = 'L:\\垃圾项目\\dev-toolkit\\_i18n_raw'
BATCH_SIZE = 20

# ── Google Translate (primary, supports batch) ──────────
GTX_URL = "https://translate-pa.googleapis.com/v1/translateHtml"
GTX_KEY = "AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520"

def gtx_batch(texts, source="en", target="zh"):
    """Translate multiple texts in one API call. Returns list of translated texts."""
    source_code = source if source != "auto" else "auto"
    payload = [[texts, source_code, target], "te_lib"]
    resp = requests.post(
        GTX_URL,
        headers={"Content-Type": "application/json+protobuf", "X-Goog-API-Key": GTX_KEY},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
        return data[0]
    raise ValueError(f"Unexpected gtx response: {data}")

# ── Edge Free API (fallback 1) ─────────────────────────
EDGE_AUTH = "https://edge.microsoft.com/translate/auth"
EDGE_TRANS = "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0"
_edge_token = None
_edge_token_expires = 0

def _get_edge_token():
    global _edge_token, _edge_token_expires
    now = time.time() * 1000
    if _edge_token and now < _edge_token_expires:
        return _edge_token
    resp = requests.get(EDGE_AUTH, timeout=15)
    resp.raise_for_status()
    _edge_token = resp.text.strip()
    _edge_token_expires = now + 8 * 60 * 1000
    return _edge_token

def edge_one(text, source="en", target="zh"):
    token = _get_edge_token()
    params = {"to": target}
    if source != "auto":
        params["from"] = source
    resp = requests.post(
        EDGE_TRANS, params=params,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=[{"Text": text}], timeout=15,
    )
    if resp.status_code == 401:
        global _edge_token
        _edge_token = None
        resp = requests.post(
            EDGE_TRANS, params=params,
            headers={"Authorization": f"Bearer {_get_edge_token()}", "Content-Type": "application/json"},
            json=[{"Text": text}], timeout=15,
        )
    resp.raise_for_status()
    return resp.json()[0]["translations"][0]["text"]

# ── DeepLX (fallback 2) ────────────────────────────────
DEEPLX_URL = "https://deeplx-serverless.api2026.workers.dev/translate"

def deeplx_one(text, source="en", target="zh"):
    body = {"text": text, "target_lang": target.upper()}
    if source != "auto":
        body["source_lang"] = source.upper()
    resp = requests.post(DEEPLX_URL, json=body, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict) and "data" in data:
        return data["data"]
    raise ValueError(f"Unexpected deeplx response: {data}")

def translate_one(text, source="en", target="zh"):
    """Translate single text with 3-level fallback."""
    if not text or not text.strip():
        return text
    try:
        return gtx_batch([text], source, target)[0]
    except:
        pass
    try:
        return edge_one(text, source, target)
    except:
        pass
    return deeplx_one(text, source, target)

def translate_batch_file(batch_id, delay=0.2):
    """Translate all untranslated strings in a batch file."""
    in_file = os.path.join(I18N_DIR, f'batch_{batch_id}.json')
    out_file = os.path.join(I18N_DIR, f'batch_{batch_id}_translated.json')
    
    if not os.path.exists(in_file):
        print(f"  NOT FOUND: batch_{batch_id}.json")
        return None
    
    with open(in_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    files_list = data.get('_files', [k for k in data if k != '_files'])
    
    # Collect pending translations
    pending = []
    already = 0
    for fn in files_list:
        strings = data.get(fn, {})
        if not isinstance(strings, dict):
            continue
        for key, val in strings.items():
            if not isinstance(val, dict):
                continue
            if 'zh' in val:
                already += 1
                continue
            en_text = val.get('en', '')
            if en_text:
                pending.append((fn, key, en_text))
    
    total = len(pending)
    print(f"  {len(files_list)} files, {already} existing + {total} pending")
    
    if total == 0:
        return {'total': 0, 'translated': 0, 'errors': 0}
    
    translated = 0
    errors = []
    
    for start in range(0, total, BATCH_SIZE):
        batch = pending[start:start + BATCH_SIZE]
        texts = [item[2] for item in batch]
        
        # Try Google batch
        try:
            results = gtx_batch(texts, "en", "zh")
            for (fn, key, _), zh_text in zip(batch, results):
                data[fn][key]['zh'] = zh_text
                translated += 1
        except Exception as e:
            # Fall back to individual translation
            for fn, key, text in batch:
                try:
                    zh_text = translate_one(text)
                    data[fn][key]['zh'] = zh_text
                    translated += 1
                except Exception as e2:
                    errors.append((fn, key, str(e2)))
        
        if translated % 100 == 0 or (total < 100 and translated > 0):
            print(f"    {translated}/{total}...")
        time.sleep(delay)
    
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"  Done: {translated}/{total} translated, {len(errors)} errors")
    return {'total': total, 'translated': translated, 'errors': len(errors)}

def main():
    batch_ids = sys.argv[1:] if len(sys.argv) > 1 else [f'{i:02d}' for i in range(1, 20)]
    
    total_t = 0
    total_e = 0
    
    for bid in sorted(batch_ids):
        print(f"\n=== Batch {bid} ===")
        result = translate_batch_file(bid)
        if result:
            total_t += result.get('translated', 0)
            total_e += result.get('errors', 0)
    
    print(f"\n{'='*40}")
    print(f"Total: {total_t} translated, {total_e} errors")

if __name__ == '__main__':
    main()
