const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const formatEl = document.getElementById('format');
const inputEl = document.getElementById('input');
const widthEl = document.getElementById('width');
const heightEl = document.getElementById('height');
const hintEl = document.getElementById('hint');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');

// --- Code128B Encoding ---
const CODE128B_START = 104;
const CODE128_STOP = 106;
const CODE128_PATTERNS = [
    '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
    '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
    '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
    '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
    '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
    '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
    '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
    '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
    '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
    '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
    '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
    '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
    '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
    '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
    '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
    '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
    '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
    '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
    '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
    '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
    '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
    '11010011100', '1100011101011',
];

function encodeCode128(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 32 || c > 126) return null;
        bytes.push(c - 32);
    }
    let checksum = CODE128B_START;
    for (let i = 0; i < bytes.length; i++) {
        checksum += bytes[i] * (i + 1);
    }
    checksum = checksum % 103;
    let pattern = CODE128_PATTERNS[CODE128B_START];
    for (const b of bytes) pattern += CODE128_PATTERNS[b];
    pattern += CODE128_PATTERNS[checksum];
    pattern += CODE128_PATTERNS[CODE128_STOP];
    return pattern;
}

// --- EAN-13 / EAN-8 / UPC-A Encoding ---
const EAN_PARITY = [
    ['odd','odd','odd','odd','odd','odd'],
    ['odd','odd','even','odd','even','even'],
    ['odd','odd','even','even','odd','even'],
    ['odd','odd','even','even','even','odd'],
    ['odd','even','odd','odd','even','even'],
    ['odd','even','even','odd','odd','even'],
    ['odd','even','even','even','odd','odd'],
    ['odd','even','odd','even','odd','even'],
    ['odd','even','odd','even','even','odd'],
    ['odd','even','even','odd','even','odd'],
];

const L_CODES = {
    odd: ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'],
    even: ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'],
};
const R_CODES = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];

function encodeEAN13(digits) {
    if (digits.length !== 13) return null;
    let pattern = '101';
    const parity = EAN_PARITY[+digits[0]];
    for (let i = 1; i <= 6; i++) pattern += L_CODES[parity[i-1]][+digits[i]];
    pattern += '01010';
    for (let i = 7; i <= 12; i++) pattern += R_CODES[+digits[i]];
    pattern += '101';
    return pattern;
}

function encodeEAN8(digits) {
    if (digits.length !== 8) return null;
    let pattern = '101';
    for (let i = 0; i < 4; i++) pattern += L_CODES.odd[+digits[i]];
    pattern += '01010';
    for (let i = 4; i < 8; i++) pattern += R_CODES[+digits[i]];
    pattern += '101';
    return pattern;
}

function encodeUPCA(digits) {
    if (digits.length !== 12) return null;
    let pattern = '101';
    for (let i = 0; i < 6; i++) pattern += L_CODES.odd[+digits[i]];
    pattern += '01010';
    for (let i = 6; i < 12; i++) pattern += R_CODES[+digits[i]];
    pattern += '101';
    return pattern;
}

function generateCheckDigit(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        sum += +digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return digits + check;
}

// --- Validation ---
function validate(format, text) {
    switch (format) {
        case 'code128':
            if (!text) return '请输入内容';
            for (const c of text) {
                const code = c.charCodeAt(0);
                if (code < 32 || code > 126) return 'Code128 仅支持 ASCII 可打印字符（字母、数字、常用符号）';
            }
            return null;
        case 'ean13': {
            const clean = text.replace(/\D/g, '');
            if (clean.length > 12) return '最多 12 位数字（自动计算校验位）';
            if (clean.length < 12) return `需要 12 位数字，当前 ${clean.length} 位`;
            return null;
        }
        case 'ean8': {
            const clean = text.replace(/\D/g, '');
            if (clean.length > 7) return '最多 7 位数字（自动计算校验位）';
            if (clean.length < 7) return `需要 7 位数字，当前 ${clean.length} 位`;
            return null;
        }
        case 'upca': {
            const clean = text.replace(/\D/g, '');
            if (clean.length > 11) return '最多 11 位数字（自动计算校验位）';
            if (clean.length < 11) return `需要 11 位数字，当前 ${clean.length} 位`;
            return null;
        }
    }
}

function updateHint() {
    const err = validate(formatEl.value, inputEl.value);
    hintEl.textContent = err || '✓';
}
inputEl.addEventListener('input', updateHint);
formatEl.addEventListener('change', () => {
    const fmt = formatEl.value;
    const examples = { code128: 'ABC-123', ean13: '123456789012', ean8: '1234567', upca: '12345678901' };
    inputEl.placeholder = examples[fmt] || '';
    inputEl.value = '';
    updateHint();
});

function render() {
    const format = formatEl.value;
    let text = inputEl.value.trim();
    if (!text) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const err = validate(format, text);
    if (err) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    let pattern;
    let label = text;

    switch (format) {
        case 'code128':
            pattern = encodeCode128(text);
            label = text;
            break;
        case 'ean13': {
            const clean = text.replace(/\D/g, '');
            const full = generateCheckDigit(clean);
            pattern = encodeEAN13(full);
            label = full;
            break;
        }
        case 'ean8': {
            const clean = text.replace(/\D/g, '');
            const full = generateCheckDigit(clean);
            pattern = encodeEAN8(full);
            label = full;
            break;
        }
        case 'upca': {
            const clean = text.replace(/\D/g, '');
            const full = generateCheckDigit(clean);
            pattern = encodeUPCA(full);
            label = full;
            break;
        }
    }

    if (!pattern) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const w = +widthEl.value;
    const h = +heightEl.value;
    canvas.width = w;
    canvas.height = h;

    const margin = 20;
    const barArea = w - margin * 2;
    const moduleWidth = barArea / pattern.length;
    const barHeight = h - margin * 2 - 20;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#000';
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '1') {
            ctx.fillRect(Math.round(margin + i * moduleWidth), margin, Math.ceil(moduleWidth) + 1, barHeight);
        }
    }

    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#000';
    ctx.fillText(label, w / 2, h - 4);
}

generateBtn.addEventListener('click', render);

downloadBtn.addEventListener('click', () => {
    if (canvas.width === 0) return;
    const a = document.createElement('a');
    a.download = `barcode_${inputEl.value || 'output'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
});

// auto-generate on input with debounce
let timer;
inputEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 200); });
formatEl.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(render, 200); });
widthEl.addEventListener('input', render);
heightEl.addEventListener('input', render);

updateHint();
render();
