let qrCodeInstance = null;
let lastText = '';

const input = document.getElementById('qr-input');
const qrcode = document.getElementById('qrcode');
const hintText = document.getElementById('hintText');
const previewBox = document.getElementById('previewBox');
const errorMsg = document.getElementById('errorMsg');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const copyBtn = document.getElementById('copyBtn');

const modeSingle = document.getElementById('modeSingle');
const modeGrad = document.getElementById('modeGrad');
const gradRow = document.getElementById('gradRow');

const fgInput = document.getElementById('foreground');
const bgInput = document.getElementById('background');
const g1Input = document.getElementById('gradient-color1');
const g2Input = document.getElementById('gradient-color2');

const fgSwatch = document.getElementById('fg-swatch');
const bgSwatch = document.getElementById('bg-swatch');
const g1Swatch = document.getElementById('g1-swatch');
const g2Swatch = document.getElementById('g2-swatch');
const fgHex = document.getElementById('fg-hex');
const bgHex = document.getElementById('bg-hex');
const g1Hex = document.getElementById('g1-hex');
const g2Hex = document.getElementById('g2-hex');

let currentSize = 300;
let currentErr = 'H';
let currentDots = 'square';
let currentCorners = 'square';
let useGradient = false;

function getOptions() {
    const fg = fgInput.value;
    const bg = bgInput.value;
    const dotsOpts = { type: currentDots };

    if (useGradient) {
        dotsOpts.gradient = {
            type: 'linear', rotation: 0,
            colorStops: [
                { offset: 0, color: g1Input.value },
                { offset: 1, color: g2Input.value },
            ],
        };
    } else {
        dotsOpts.color = fg;
    }

    const cornerGrad = useGradient ? {
        gradient: {
            type: 'linear', rotation: 0,
            colorStops: [
                { offset: 0, color: g1Input.value },
                { offset: 1, color: g2Input.value },
            ],
        }
    } : { color: fg };

    return {
        width: currentSize,
        height: currentSize,
        type: 'canvas',
        data: input.value.trim(),
        qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: currentErr },
        imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 6, crossOrigin: 'anonymous' },
        dotsOptions: dotsOpts,
        cornersSquareOptions: { type: currentCorners, ...cornerGrad },
        cornersDotOptions: { type: currentCorners === 'dot' ? 'dot' : 'square', ...cornerGrad },
        backgroundOptions: { color: bg },
    };
}

function generateQR() {
    const text = input.value.trim();
    if (!text) {
        if (qrCodeInstance) { qrcode.innerHTML = ''; qrCodeInstance = null; }
        previewBox.classList.remove('has-qr');
        hintText.classList.remove('hidden');
        errorMsg.classList.add('hidden');
        lastText = '';
        return;
    }
    if (text === lastText && qrCodeInstance) return;
    lastText = text;

    hintText.classList.add('hidden');
    errorMsg.classList.add('hidden');
    previewBox.classList.add('has-qr');

    try {
        const opts = getOptions();
        if (qrCodeInstance) {
            qrCodeInstance.update(opts);
        } else {
            qrcode.innerHTML = '';
            qrCodeInstance = new QRCodeStyling(opts);
            qrCodeInstance.append(qrcode);
        }
    } catch { showError('生成失败'); }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function regenerate() {
    lastText = '';
    if (qrCodeInstance) { qrcode.innerHTML = ''; qrCodeInstance = null; }
    generateQR();
}

function getCanvas() { return qrcode.querySelector('canvas'); }

function downloadPNG() { if (qrCodeInstance) qrCodeInstance.download({ name: 'qrcode', extension: 'png' }); }
function downloadSVG() { if (qrCodeInstance) qrCodeInstance.download({ name: 'qrcode', extension: 'svg' }); }

async function copyQR() {
    const canvas = getCanvas();
    if (!canvas) return;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copyBtn.textContent = '已复制!';
        setTimeout(() => copyBtn.textContent = '复制图片', 1500);
    } catch { showError('复制失败，请手动下载'); }
}

function setupColor(input, swatch, hex, pickerId) {
    swatch.style.background = input.value;
    hex.textContent = input.value;
    input.addEventListener('input', () => {
        swatch.style.background = input.value;
        hex.textContent = input.value;
        regenerate();
    });
    document.getElementById(pickerId).addEventListener('click', () => input.click());
}

setupColor(fgInput, fgSwatch, fgHex, 'fgPicker');
setupColor(bgInput, bgSwatch, bgHex, 'bgPicker');
setupColor(g1Input, g1Swatch, g1Hex, 'g1Picker');
setupColor(g2Input, g2Swatch, g2Hex, 'g2Picker');

modeSingle.addEventListener('click', () => {
    useGradient = false;
    modeSingle.classList.add('active');
    modeGrad.classList.remove('active');
    gradRow.classList.add('hidden');
    regenerate();
});
modeGrad.addEventListener('click', () => {
    useGradient = true;
    modeGrad.classList.add('active');
    modeSingle.classList.remove('active');
    gradRow.classList.remove('hidden');
    regenerate();
});

function setupGroup(groupId, callback) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            callback(btn.dataset.v);
            regenerate();
        });
    });
}

setupGroup('sizeGroup', v => currentSize = parseInt(v));
setupGroup('errGroup', v => currentErr = v);
setupGroup('dotsGroup', v => currentDots = v);
setupGroup('cornersGroup', v => currentCorners = v);

input.addEventListener('input', generateQR);
downloadPngBtn.addEventListener('click', downloadPNG);
downloadSvgBtn.addEventListener('click', downloadSVG);
copyBtn.addEventListener('click', copyQR);
