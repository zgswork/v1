"""Replace ASCII text icons with emoji icons for all 500 dev tools."""
import re, json, subprocess

EMOJI_MAP = {
    # === code (109 tools) ===
    'JSON Format': '📋',
    'JSON Diff': '🔀',
    'Regex Test': '🔍',
    'Diff Text': '📝',
    'Cron Explain': '⏰',
    'TS Error': '❌',
    'env-vars': '🔤',
    'Unicode Search': '🔣',
    'Port Ref': '🔌',
    'MIME Types': '📄',
    'Base64 Tool': '🔐',
    'Hash Gen': '🔑',
    'Timestamp': '⏱️',
    'Commit Msg': '💬',
    'Env Check': '✅',
    'License Pick': '📜',
    'Chmod Calc': '🔢',
    'HTTP Status': '🌐',
    'JWT Builder': '🪪',
    'URL Parser': '🔗',
    'UUID Gen': '🆔',
    'Password Gen': '🔒',
    'Meta Tags': '🏷️',
    'HTML Escape': '&️⃣',
    'Text Transform': '🔤',
    'CSV ↔ JSON': '🔄',
    'SQL Format': '🗄️',
    'YAML ↔ JSON': '🔄',
    'TOML ↔ JSON': '🔄',
    'JSON → TypeScript': '🔷',
    'Regex Replace': '✂️',
    'JSON Path': '📍',
    'Encode Decode': '🔀',
    'Number Base': '🔢',
    'Data URI': '🖼️',
    'Case Convert': '🔤',
    'Subnet Calc': '🌐',
    'JSON Schema': '📋',
    'Keycode': '⌨️',
    'Git Cheatsheet': '📘',
    'Regex Cheatsheet': '📘',
    'HTML to JSX': '⚛️',
    'Tailwind Converter': '🎨',
    'HTML Minifier': '✂️',
    'JS Minifier': '✂️',
    'CSS Minifier': '✂️',
    'JSON Viewer': '🔍',
    'API Tester': '🧪',
    'Locale Format': '🌍',
    'gitignore Gen': '📄',
    'htaccess Gen': '⚙️',
    'Env Gen': '🔤',
    'Nginx Config': '⚙️',
    'Dockerfile Gen': '🐳',
    'GH Actions Gen': '⚡',
    'Makefile Gen': '🔧',
    'package.json Gen': '📦',
    'tsconfig Gen': '⚙️',
    'ESLint Config Gen': '🧹',
    'Prettier Config Gen': '✨',
    'EditorConfig Gen': '⚙️',
    'License Chooser': '📜',
    'README Gen': '📖',
    'Commit Message Gen': '💬',
    'Semver Calculator': '📐',
    'Dependabot Config Gen': '🤖',
    'Cron Builder': '⏰',
    'JSON Schema Gen': '📋',
    'cURL Builder': '🌐',
    'Nginx Config Gen': '⚙️',
    'Docker Compose Gen': '🐳',
    'SSH Config Gen': '🔑',
    'Systemd Service Gen': '⚙️',
    'GitHub Profile Gen': '👤',
    'Changelog Generator': '📋',
    'Performance Budget': '📊',
    'Manifest Generator': '📋',
    '.env Validator': '✅',
    'XML Formatter': '📄',
    'Table Generator': '📊',
    'Form Builder': '📝',
    'Regex Visualizer': '🔍',
    'Tone Generator': '🎵',
    'Noise Generator': '🔊',
    'Web Metronome': '🎵',
    'Frequency Calculator': '🎵',
    'Audio Visualizer': '📊',
    'Text to Speech': '🔊',
    'ASCII Art Generator': '🎨',
    'Typing Speed Test': '⌨️',
    'Reading Time Calculator': '⏱️',
    'Screen Resolution': '📱',
    'Pomodoro Timer': '🍅',
    'Stopwatch': '⏱️',
    'Countdown Timer': '⏳',
    'HTML Entity Reference': '&️⃣',
    'Pixel Ruler': '📏',
    'JS Beautifier': '✨',
    'CSS Beautifier': '✨',
    'Popover API': '💬',
    'View Transitions': '🔄',
    'Dialog Element': '💬',
    'HTML to Markdown': '📝',
    'Markdown to HTML': '📝',
    'JS Obfuscator': '🔒',
    'Code Highlighter': '✨',
    'Mermaid Chart': '📊',
    'Markdown Diff': '📝',
    'Icon Generator': '🎨',
    'HAR Sanitizer': '🧹',
    'X.509 Cert Gen': '🛡️',
    'Animation Timing Playground': '🎬',
    'CSS Scroll Snap Builder': '📐',
    'Proxy & Reflect Patterns': '🪞',
    'Web Animations API Playground': '🎬',
    'Web Speech API Playground': '🎙️',
    'YAML Viewer': '📄',

    # === ai (5) ===
    'LLM Price': '💰',
    'Prompt Price': '💵',
    'Model Picker': '🤖',
    'AI ROI Calc': '📈',
    'CLAUDE.md Builder': '📝',

    # === api (2) ===
    'API Mock Generator': '🧪',
    'API Rate Calculator': '📊',

    # === color (2) ===
    'Image Color Picker': '🎨',
    'EyeDropper Inspector': '👁️',

    # === converter (20) ===
    'GZIP Converter': '📦',
    'IBAN Generator': '🏦',
    'MongoDB ObjectID': '🆔',
    'Hex Converter': '#️⃣',
    'VAT Validator': '🧾',
    'Roman Numeral': '🏛️',
    'Temperature Converter': '🌡️',
    'Percentage Calculator': '💯',
    'IBAN Validator': '🏦',
    'Phone Number Parser': '📞',
    'Email Normalizer': '📧',
    'User Agent Parser': '🕵️',
    'Date Time Converter': '📅',
    'JSON to TOML': '🔄',
    'JSON to XML': '🔄',
    'Safelink Decoder': '🔓',
    'TOML to YAML': '🔄',
    'XML to JSON': '🔄',
    'YAML to TOML': '🔄',

    # === crypto (10) ===
    'Bcrypt Hash': '🔑',
    'HMAC Generator': '🔑',
    'Token Generator': '🎫',
    'Encryption / Decryption': '🔐',
    'RSA Key Generator': '🔑',
    'TOTP / HOTP Generator': '🔐',
    'BIP39 Mnemonic': '📝',
    'Password Strength': '💪',
    'PDF Signature Checker': '📄',

    # === css (63) ===
    'Animation Easing': '🎬',
    'Grid Calculator': '📐',
    'Responsive Breakpoints': '📱',
    'CSS Scroll Snap': '📐',
    'CSS Gradient Text': '🌈',
    'Container Queries': '📐',
    'CSS :has() Playground': '🔍',
    'CSS Nesting': '📐',
    'Scroll Animations': '📜',
    'CSS @layer': '📚',
    'CSS Subgrid': '📐',
    'CSS @starting-style': '🎬',
    'CSS @scope': '🎯',
    'CSS text-wrap': '📝',
    'CSS @property': '🏷️',
    'CSS light-dark()': '🌓',
    'CSS field-sizing': '📐',
    'CSS Cascade Debugger': '🔍',
    'CSS Matrix Calculator': '🔢',
    'Grid Track Sizing Algorithm': '📐',
    'BFC Layout Debugger': '📦',
    'Anchor Positioning': '⚓',
    'Logical Properties': '↔️',
    'Color Spaces': '🎨',
    'CSS transition-behavior': '🎬',
    'CSS Trig Functions': '📐',
    'CSS Custom Highlights': '🖍️',
    'Cross-Doc View Transitions': '🔄',
    'CSS Scroll State': '📜',
    'CSS attr() Function': '🏷️',
    'CSS Typed OM': '🔢',
    'CSS shape()': '✂️',
    'CSS contrast-color()': '🎨',
    'CSS interpolate-size': '📐',
    'CSS reading-flow': '📖',
    'CSS :state()': '🔄',
    'CSS Relative Color': '🎨',
    'CSS content-visibility': '👁️',
    'CSS font-size-adjust': '🔤',
    'CSS Color Functions': '🎨',
    'CSS Math Functions': '🔢',
    'CSS Color Mix': '🎨',
    'CSS Individual Transforms': '🔄',
    'CSS Specificity Battle': '⚔️',
    'CSS Layer Battle': '⚔️',
    'CSS Initial Letter': '🔤',
    'CSS Input Styling': '🎨',
    'CSS Overscroll Behavior': '📜',
    'CSS Text Decoration': '✏️',
    'CSS View Timeline': '📜',
    'CSS Scroll Timeline': '📜',
    'CSS Animation Range': '🎬',
    'CSS Position Try': '📐',
    'CSS Popover': '💬',
    'CSS Toggle': '🔘',
    'CSS Fullscreen': '🖥️',
    'CSS :user-valid': '✅',
    'CSS Paint API': '🎨',
    'CSS Scrollbars': '📜',
    'CSS Highlight API': '🖍️',
    'CSS display:contents': '📦',
    'CSS Animated Grid': '📐',

    # === data (26) ===
    'gh-stats': '📊',
    'Repo Compare': '⚔️',
    'npm Health': '📊',
    'npm Compare': '⚖️',
    'Dep Tree': '🌳',
    'License Audit': '📋',
    'npm Alt': '🔀',
    'Semver Calc': '📐',
    'pkg-lint': '📦',
    'gh-releases': '📋',
    'PyPI Search': '🐍',
    'Crate Search': '🦀',
    'can-i-npm': '🔍',
    'npm Dep Graph': '🕸️',
    'GitHub Contrib': '📊',
    'npm Trends': '📈',
    'GitHub Card': '🃏',
    'dev.to Stats': '📊',
    'IP Info': '🌐',
    'DNS Lookup': '🌐',
    'SSL Check': '🔒',
    'Headers Check': '📋',
    'OG Preview': '🔍',
    'Dep Changelog': '📋',
    'Chart Builder': '📊',
    'JSON Tree Viewer': '🌳',

    # === design (52) ===
    'Color Palette': '🎨',
    'Font Pair': '🔤',
    'Font Preview': '🔤',
    'Color Extract': '🎨',
    'Contrast Check': '👁️',
    'CSS Shadow': '🌑',
    'CSS Gradient': '🌈',
    'Aspect Ratio': '📐',
    'Favicon Gen': '🖼️',
    'Emoji Picker': '😀',
    'QR Code': '📱',
    'SVG Preview': '🖼️',
    'Box Model': '📦',
    'CSS Flex': '📐',
    'CSS Grid': '📐',
    'CSS Animation': '🎬',
    'Border Radius': '🔘',
    'CSS Filter': '🎨',
    'Spacing Calc': '📐',
    'CSS Units': '📏',
    'Color Convert': '🔄',
    'Image Resize': '📐',
    'CSS Clip-Path': '✂️',
    'Placeholder Image': '🖼️',
    'Color Blind Sim': '👁️',
    'CSS Text Shadow': '🌓',
    'CSS Glass': '🪟',
    'CSS Neumorphism': '🪟',
    'HSL Picker': '🎨',
    'CSS Cursor': '🖱️',
    'CSS Transform': '🔄',
    'CSS Transition': '🎬',
    'CSS Variables': '🏷️',
    'CSS Media Query': '📱',
    'CSS Specificity': '🎯',
    'Color Mixer': '🎨',
    'CSS Reset': '🔄',
    'OG Image Generator': '🖼️',
    'Accessibility Checker': '♿',
    'SVG Optimizer': '✂️',
    'Color Name Finder': '🎨',
    'Color Wheel': '🎨',
    'Typography Scale': '📐',
    'Color Harmony': '🎨',
    'Image Filter': '🎨',
    'Image Crop': '✂️',
    'Image Watermark': '💧',
    'Image Compare': '🔀',
    'Image to Base64': '🔄',
    'Sprite Sheet': '🖼️',
    'SVG Placeholder': '🖼️',

    # === device (1) ===
    'Device Information': '📱',

    # === devops (6) ===
    'K8s YAML Generator': '☸️',
    'GitHub Actions Generator': '⚡',
    'Terraform Generator': '🏗️',
    'Grafana Dashboard': '📊',
    'CORS Header Generator': '🔗',
    'Docker Compose Converter': '🐳',

    # === image (7) ===
    'Image Filter': '🎨',
    'Image Crop': '✂️',
    'Image Watermark': '💧',
    'Image Compare': '🔀',
    'Image to Base64': '🔄',
    'Sprite Sheet': '🖼️',
    'SVG Placeholder': '🖼️',

    # === infra (1) ===
    'HTTP/3 & QUIC': '🚀',

    # === js (132) ===
    'Web Animations API': '🎬',
    'Compression Streams': '📦',
    'Web Speech API': '🎙️',
    'Intersection Observer': '👁️',
    'Resize Observer': '📐',
    'MutationObserver': '🔍',
    'Performance Observer': '📊',
    'Barcode Detection': '📷',
    'Structured Clone': '📋',
    'SW Lifecycle': '⚡',
    'JS Prototype Chain': '⛓️',
    'JS Event Loop': '🔄',
    'JS Scope Chain': '📚',
    'Web Storage Quota': '💾',
    'JS Error Stack Trace': '🔴',
    'JS Event Propagation': '🫧',
    'WeakRef & GC Visualizer': '♻️',
    'Async/Await Visualizer': '⏳',
    'V8 Hidden Classes': '🏗️',
    'Memory Leak Patterns': '💧',
    'Proxy & Reflect': '🪞',
    'AbortController Patterns': '🛑',
    'Iterator & Generator': '🔄',
    'Promise Combinators': '🤝',
    'JS Engine Pipeline': '⚙️',
    'SharedArrayBuffer & Atomics': '🧵',
    'Module Resolution': '📦',
    'GC Visualizer': '♻️',
    'Execution Context': '📚',
    'IEEE 754 Floats': '🔢',
    'Type Coercion': '🔄',
    'Regex Engine': '⚙️',
    'Symbol Explorer': '🔮',
    'Set Operations': '🔵',
    'Property Descriptors': '🔐',
    'File System Access': '📂',
    'Web Locks': '🔒',
    'Broadcast Channel': '📡',
    'URLPattern': '🔗',
    'JS Task Scheduling': '📋',
    'AbortSignal Patterns': '🛑',
    'CSP Evaluator': '🛡️',
    'Cookie Inspector': '🍪',
    'Web Crypto Explorer': '🔐',
    'Trusted Types': '🛡️',
    'Sanitizer API': '🧹',
    'Credential Management': '🔐',
    'SRI Generator': '🔒',
    'Trusted Types Explorer': '🛡️',
    'CSP Policy Builder': '🛡️',
    'Page Reveal API': '📄',
    'Navigation API': '🧭',
    'Web Share API': '📤',
    'Wake Lock API': '🔒',
    'Web Bluetooth': '📶',
    'Web Serial API': '🔌',
    'Permissions API': '🔐',
    'Clipboard API': '📋',
    'History API': '📜',
    'Keyboard API': '⌨️',
    'Document PiP API': '🖼️',
    'EditContext API': '✏️',
    'Abort Signal Patterns': '🛑',
    'Touch Events': '👆',
    'Pointer Events': '👆',
    'Drag & Drop API': '📦',
    'Geolocation API': '📍',
    'Fullscreen API': '🖥️',
    'Screen Wake Lock': '🔒',
    'Vibration API': '📳',
    'Battery API': '🔋',
    'Network Info': '📶',
    'Device Orientation': '📱',
    'Media Capabilities': '🎬',
    'Payment Request': '💳',
    'Credentialless IFrame': '🖼️',
    'Fenced Frames': '🖼️',
    'Shared Storage': '💾',
    'Private Aggregation': '🔒',
    'Attribution Reporting': '📊',
    'Topics API': '🔤',
    'WebGPU': '🎮',
    'WebCodecs': '🎬',
    'WebTransport': '🚀',
    'WebHID': '🎮',
    'WebUSB': '🔌',
    'Web MIDI': '🎵',
    'Screen Capture': '🖥️',
    'Media Streams': '🎥',
    'Audio Output': '🔊',
    'Content Index': '📋',
    'Periodic Background Sync': '🔄',
    'Background Fetch': '📥',
    'Cookie Store': '🍪',
    'Digital Goods': '💳',
    'Window Placement': '🖥️',
    'Multi-Screen Window': '🖥️',
    'Compute Pressure': '📊',
    'Preferred Color Scheme': '🎨',
    'Preferred Contrast': '👁️',
    'Reduced Motion': '🎬',
    'Ink API': '✏️',
    'Handwriting Recognition': '✏️',
    'Text Detection': '🔍',
    'Face Detection': '👤',
    'Shape Detection': '🔍',
    'WebAssembly': '⚙️',
    'WASI': '⚙️',
    'SIMD': '⚡',
    'Exception Handling': '❌',
    'Tail Call Optimization': '🔄',
    'BigInt': '🔢',
    'Temporal': '📅',
    'Iterator Helpers': '🔄',
    'Array Grouping': '📊',
    'Promise withResolvers': '🤝',
    'WeakRef': '♻️',
    'FinalizationRegistry': '♻️',
    'Explicit Resource Management': '📦',
    'Decorators': '✨',
    'Import Assertions': '📦',
    'JSON Modules': '📦',
    'CSS Modules': '📦',
    'Asset References': '📎',
    'Import Maps': '🗺️',
    'Microtasks': '⚡',
    'Realm API': '🔮',
    'Atomics': '⚡',
    'Intl': '🌍',
    'Relative Time Format': '⏱️',
    'List Format': '📋',
    'Duration Format': '⏱️',
    'Number Format': '🔢',
    'Plural Rules': '🔤',
    'Collator': '🔤',
    'Segmenter': '✂️',
    'DateTimeFormat': '📅',
    'DisplayNames': '🏷️',

    # === math (4) ===
    'Geo Distance': '📍',
    'ETA Calculator': '⏱️',
    'Math Evaluator': '🔢',
    'Benchmark Builder': '📊',

    # === media (1) ===
    'Camera Recorder': '📷',

    # === net (7) ===
    'DNS Resolution Visualizer': '🌐',
    'TLS Handshake Visualizer': '🔒',
    'WebSocket Frame Inspector': '🔌',
    'CORS Preflight Flow': '🔀',
    'TCP State Machine': '🔄',
    'HTTP Cache Flow': '📦',
    'WebRTC Signaling': '📡',

    # === network (10) ===
    'HTTP/2 Multiplexing': '🌐',
    'HAR Sanitizer': '🧹',
    'MAC Address Generator': '🆔',
    'IPv4 Converter': '🌐',
    'IPv4 Range Expander': '🌐',
    'IPv6 ULA Generator': '🌐',
    'Basic Auth Generator': '🔐',
    'MAC Address Lookup': '🔍',
    'WiFi QR Code': '📱',
    'Random Port Generator': '🔌',

    # === perf (4) ===
    'Rendering Pipeline': '🖥️',
    'Web Vitals Visualizer': '📊',
    'Long Animation Frames': '🎬',
    'OffscreenCanvas': '🖼️',

    # === reference (2) ===
    'Git Command Memo': '📘',
    'Regex Quick Reference': '📘',

    # === security (17) ===
    'CSP Builder': '🛡️',
    'SRI Gen': '🔒',
    'Robots.txt': '🤖',
    'CORS Test': '🔗',
    'Cookie Check': '🍪',
    'JWT Debugger': '🪪',
    'Security Headers': '🛡️',
    'CSP Header Builder': '🛡️',
    'Web Crypto Explorer': '🔐',
    'Trusted Types': '🛡️',
    'Sanitizer API': '🧹',
    'Credential Management': '🔐',
    'CSP Evaluator': '🛡️',
    'SRI Generator': '🔒',
    'Trusted Types Explorer': '🔒',
    'CSP Policy Builder': '🛡️',
    'Cookie Inspector': '🍪',

    # === seo (2) ===
    'Meta Tag Generator': '🏷️',
    'robots.txt Generator': '🤖',

    # === text (8) ===
    'String Obfuscator': '🔒',
    'Numeronym Generator': 'i18n',
    'NATO Alphabet': '🔤',
    'Slugify': '🔗',
    'List Converter': '📋',
    'WYSIWYG Editor': '✏️',
    'Text to Binary': '🔢',
    'Text to Unicode': '🔣',

    # === writing (9) ===
    'Word Count': '🔢',
    'Title Score': '📊',
    'README Score': '📊',
    'MD Preview': '📝',
    'Lorem Gen': '📝',
    'Markdown Table': '📊',
    'Char Count': '🔢',
    'Markdown Editor': '✏️',

    # === Untranslated dupes (same tool, diff index) ===
    'Web Animations API': '🎬',
    'Web Speech API': '🎙️',
    'Proxy & Reflect': '🪞',
    'CSS Reset': '🔄',
    'JSON Schema': '📋',
    'Popover API': '💬',
    'CSS @layer': '📚',
    'CSS color-mix()': '🎨',
    'CSS @starting-style': '🎬',
    'CSS @scope': '🎯',
    'CSS text-wrap': '📝',
    'CSS @property': '🏷️',
    'CSS light-dark()': '🌓',
    'CSS field-sizing': '📐',
    'Compression Streams': '📦',
    'Intersection Observer': '👁️',
    'Resize Observer': '📐',
    'MutationObserver': '🔍',
    'Performance Observer': '📊',
    'Structured Clone': '📋',
    'Iterator & Generator': '🔄',
    'SharedArrayBuffer & Atomics': '🧵',
    'HTTP/3 & QUIC': '🚀',
    'URLPattern': '🔗',
    'JS Iterator Helpers': '🔄',
    'CSS transition-behavior': '🎬',
    'Permissions API': '🔐',
    'Trusted Types': '🛡️',
    'Clipboard API': '📋',
    'Web NFC': '📶',
    'History API': '📜',
    'CSS Typed OM': '🔢',
    'Keyboard API': '⌨️',
    'Document PiP API': '🖼️',
    'EditContext API': '✏️',
    'Sanitizer API': '🧹',
    'Page Reveal API': '📄',
    'Navigation API': '🧭',
    'Web Share API': '📤',
    'Wake Lock API': '🔒',
    'Web Bluetooth': '📶',
    'Web Serial API': '🔌',
    'WebTransport': '🚀',
    'WeakRef & Finalizer': '♻️',
    'CSS Color Functions': '🎨',
    'CSS Math Functions': '🔢',
    'CSS Logical Properties': '↔️',
    'CSS Individual Transforms': '🔄',
    'Performance Mark & Measure': '📊',
    'CSS Specificity Battle': '⚔️',
    'MongoDB ObjectID': '🆔',
    'Geo Distance': '📍',
    'Markdown Diff': '📝',
    'Roman Numeral': '🏛️',
}

# Category fallback emojis
CAT_FALLBACK = {
    'code': '💻',
    'ai': '🤖',
    'api': '🔗',
    'color': '🎨',
    'converter': '🔄',
    'crypto': '🔐',
    'css': '🎨',
    'data': '📊',
    'design': '🎨',
    'device': '📱',
    'devops': '⚙️',
    'image': '🖼️',
    'infra': '🏗️',
    'js': '⚡',
    'math': '🔢',
    'media': '📷',
    'net': '🌐',
    'network': '🌐',
    'perf': '⚡',
    'reference': '📘',
    'security': '🛡️',
    'seo': '🔍',
    'text': '📝',
    'writing': '✍️',
}


def get_emoji(name: str, cat: str, current_icon: str) -> str:
    """Get emoji icon for a tool."""
    # If already a good emoji (> U+2000 or emoji range), keep it
    for c in current_icon:
        o = ord(c)
        if o > 0x2000 and not (0x4E00 <= o <= 0x9FFF):
            return current_icon  # already emoji/symbol
    # Check explicit mapping
    if name in EMOJI_MAP:
        return EMOJI_MAP[name]
    # Fallback by category
    return CAT_FALLBACK.get(cat, '🔧')


def main():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Parse TOOLS entries
    si = html.index("const TOOLS=[")
    depth = 0
    ei = si
    for i, c in enumerate(html[si:]):
        if c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                ei = si + i + 1
                break
    tools_block = html[si:ei]

    # Parse each entry
    inner = tools_block[len("const TOOLS=["):].strip()
    entries = []
    start = 0
    while start < len(inner):
        s = inner.find('{', start)
        if s < 0:
            break
        depth = 0
        e = s
        for i, c in enumerate(inner[s:], s):
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    e = i + 1
                    break
        entry_str = inner[s:e]
        name = re.search(r"name:'([^']*)'", entry_str)
        cat = re.search(r"cat:'([^']*)'", entry_str)
        icon = re.search(r"icon:'([^']*)'", entry_str)
        entries.append({
            'raw': entry_str,
            'name': name.group(1) if name else '',
            'cat': cat.group(1) if cat else '',
            'icon': icon.group(1) if icon else '',
        })
        start = e
        while start < len(inner) and inner[start] in ',\n\r\t ':
            start += 1

    print(f"Parsed {len(entries)} TOOLS entries", flush=True)

    # Fix icons
    fixed = 0
    unchanged_emoji = 0
    new_entries = []

    for e in entries:
        old_icon = e['icon']
        is_emoji = any(ord(c) > 0x2000 and not (0x4E00 <= ord(c) <= 0x9FFF) for c in old_icon)
        if is_emoji:
            unchanged_emoji += 1
            new_entries.append(e['raw'])
            continue

        new_icon = get_emoji(e['name'], e['cat'], old_icon)
        new_raw = e['raw'].replace(f"icon:'{old_icon}'", f"icon:'{new_icon}'", 1)
        new_entries.append(new_raw)
        if old_icon != new_icon:
            fixed += 1
            if fixed <= 5:
                print(f"  [{fixed}] {repr(e['name'])}: {repr(old_icon)} -> {repr(new_icon)}", flush=True)

    print(f"\nFixed: {fixed} icons, Kept emoji: {unchanged_emoji}", flush=True)

    # Rebuild TOOLS block
    new_inner = ',\n'.join(new_entries)
    new_tools_block = f"const TOOLS=[{new_inner}];"
    html = html[:si] + new_tools_block + html[ei:]

    # Also fix TOOLS_ZH icons (same entries, same order)
    m2 = re.search(r'const TOOLS_ZH=\[(.*?)\];', html, re.DOTALL)
    if m2:
        # For TOOLS_ZH, we replace icon fields similarly - they're in same order
        zh_inner = m2.group(1)
        zh_entries = []
        start = 0
        while start < len(zh_inner):
            s = zh_inner.find('{', start)
            if s < 0: break
            depth = 0
            e = s
            for i, c in enumerate(zh_inner[s:], s):
                if c == '{': depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        e = i + 1
                        break
            entry_str = zh_inner[s:e]
            icon = re.search(r"icon:'([^']*)'", entry_str)
            zh_entries.append({
                'raw': entry_str,
                'icon': icon.group(1) if icon else '',
            })
            start = e
            while start < len(zh_inner) and zh_inner[start] in ',\n\r\t ':
                start += 1

        print(f"Parsed {len(zh_entries)} TOOLS_ZH entries", flush=True)

        # Use the same emoji as corresponding TOOLS entry
        fixed_zh = 0
        new_zh_entries = []
        for i, ze in enumerate(zh_entries):
            old_icon_zh = ze['icon']
            # Get new icon from the already-processed TOOLS entry
            new_raw = ze['raw']
            if i < len(entries):
                nname = entries[i]['name']
                ncat = entries[i]['cat']
                new_icon = get_emoji(nname, ncat, old_icon_zh)
                if old_icon_zh != new_icon:
                    new_raw = ze['raw'].replace(f"icon:'{old_icon_zh}'", f"icon:'{new_icon}'", 1)
                    fixed_zh += 1
            new_zh_entries.append(new_raw)

        print(f"TOOLS_ZH: fixed {fixed_zh} icons", flush=True)

        new_zh_inner = ',\n'.join(new_zh_entries)
        new_zh_block = f"const TOOLS_ZH=[{new_zh_inner}];"
        html = html[:m2.start()] + new_zh_block + html[m2.end():]

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"\nWritten index.html ({len(html)} bytes)", flush=True)

    # Validate JS
    ssi = html.index("<script>")
    eei = html.index("</script>", ssi + 8)
    script_js = html[ssi + 8:eei]
    print(f"Script block: {len(script_js)} chars", flush=True)

    with open("_tmp_emoji.js", "w", encoding="utf-8") as f:
        f.write(script_js)
    r = subprocess.run(
        ["node", "-e",
         "try{new Function(require('fs').readFileSync('_tmp_emoji.js','utf8'));console.log('SCRIPT: VALID');}"
         "catch(e){console.log('SCRIPT: INVALID - '+e.message);}"],
        capture_output=True, text=True)
    print(r.stdout.strip(), flush=True)
    if r.stderr:
        print("STDERR:", r.stderr.strip(), flush=True)
    import os
    os.remove("_tmp_emoji.js")


if __name__ == '__main__':
    main()
