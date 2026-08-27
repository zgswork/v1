// ======== State ========
const state = {
    images: [],
    currentIndex: -1,
    logoDataUrl: null,
    logoImage: null,
    wmType: 'text',
    mode: 'single',
    position: 'cc',
    tileSpacing: 120,
    opacity: 0.5,
    scale: 100,
    rotate: 0,
    text: 'Watermark',
    fontSize: 36,
    color: '#888888',
    exportFormat: 'jpeg',
    exportQuality: 90,
};

// ======== DOM ========
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imgList = document.getElementById('imgList');
const previewSection = document.getElementById('previewSection');
const origPreview = document.getElementById('origPreview');
const wmPreview = document.getElementById('wmPreview');

const wmText = document.getElementById('wmText');
const wmFontSize = document.getElementById('wmFontSize');
const wmColor = document.getElementById('wmColor');
const wmOpacity = document.getElementById('wmOpacity');
const opacityVal = document.getElementById('opacityVal');
const wmScale = document.getElementById('wmScale');
const scaleVal = document.getElementById('scaleVal');
const wmRotate = document.getElementById('wmRotate');
const rotateVal = document.getElementById('rotateVal');
const posGrid = document.getElementById('posGrid');
const posSection = document.getElementById('posSection');
const tileSection = document.getElementById('tileSection');
const tileSpacing = document.getElementById('tileSpacing');
const tileSpacingVal = document.getElementById('tileSpacingVal');
const textSettings = document.getElementById('textSettings');
const imageSettings = document.getElementById('imageSettings');
const uploadLogoBtn = document.getElementById('uploadLogoBtn');
const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const logoImg = document.getElementById('logoImg');
const removeLogoBtn = document.getElementById('removeLogoBtn');
const exportFormat = document.getElementById('exportFormat');
const exportQuality = document.getElementById('exportQuality');
const exportQualityVal = document.getElementById('exportQualityVal');
const exportHint = document.getElementById('exportHint');
const applyBtn = document.getElementById('applyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');

// ======== Toast ========
let toastTimer;
function toast(msg) {
    clearTimeout(toastTimer);
    const el = document.querySelector('.toast');
    if (el) el.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), 2500);
}

// ======== Upload ========
dropZone.addEventListener('click', () => fileInput.click());
document.getElementById('clickTrigger').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

function handleFiles(files) {
    const valid = [];
    for (const f of files) {
        if (!f.type.match(/^image\/(jpeg|png|webp)$/)) continue;
        valid.push(f);
    }
    if (!valid.length) { toast('仅支持 JPG/PNG/WebP 格式的图片'); return; }
    for (const f of valid) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.images.push({ file: f, dataUrl: e.target.result, img });
                if (state.currentIndex === -1) {
                    state.currentIndex = 0;
                    updatePreview();
                }
                renderImageList();
                updateButtons();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(f);
    }
}

function renderImageList() {
    imgList.innerHTML = '';
    state.images.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'img-item' + (i === state.currentIndex ? ' active' : '');
        const dlBtn = item.resultDataUrl
            ? `<button class="dl" data-idx="${i}" title="下载此张">⬇</button>`
            : '';
        div.innerHTML = `
            <img src="${item.dataUrl}" alt="">
            <button class="del" data-idx="${i}">×</button>
            ${dlBtn}
        `;
        div.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            state.currentIndex = i;
            renderImageList();
            updatePreview();
        });
        div.querySelector('.del').addEventListener('click', (e) => {
            e.stopPropagation();
            state.images.splice(i, 1);
            if (state.currentIndex >= state.images.length) state.currentIndex = state.images.length - 1;
            if (state.currentIndex === -1) previewSection.style.display = 'none';
            renderImageList();
            updatePreview();
            updateButtons();
        });
        const dl = div.querySelector('.dl');
        if (dl) {
            dl.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadSingle(i);
            });
        }
        imgList.appendChild(div);
    });
}

// ======== Watermark Mode ========
document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        posSection.style.display = state.mode === 'single' ? '' : 'none';
        tileSection.style.display = state.mode === 'tile' ? '' : 'none';
        updatePreview();
    });
});

// ======== Tile Spacing ========
tileSpacing.addEventListener('input', () => {
    state.tileSpacing = +tileSpacing.value;
    tileSpacingVal.textContent = tileSpacing.value + 'px';
    updatePreview();
});

// ======== Watermark Type ========
document.querySelectorAll('.wm-type .btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.wm-type .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.wmType = btn.dataset.wm;
        textSettings.style.display = (state.wmType === 'text' || state.wmType === 'both') ? '' : 'none';
        imageSettings.style.display = (state.wmType === 'image' || state.wmType === 'both') ? '' : 'none';
        updatePreview();
    });
});

function loadLogoImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
        state.logoImage = img;
        updatePreview();
    };
    img.src = dataUrl;
}

uploadLogoBtn.addEventListener('click', () => logoInput.click());
logoInput.addEventListener('change', () => {
    const f = logoInput.files[0];
    if (!f) return;
    if (!f.type.match(/^image\/(jpeg|png|webp)$/)) { toast('仅支持 JPG/PNG/WebP 格式'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        state.logoDataUrl = e.target.result;
        logoImg.src = e.target.result;
        logoPreview.style.display = 'block';
        uploadLogoBtn.textContent = '更换 Logo';
        loadLogoImage(e.target.result);
    };
    reader.readAsDataURL(f);
});
removeLogoBtn.addEventListener('click', () => {
    state.logoDataUrl = null;
    state.logoImage = null;
    logoPreview.style.display = 'none';
    uploadLogoBtn.textContent = '上传 Logo';
    logoInput.value = '';
    updatePreview();
});

// ======== Position Grid ========
posGrid.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        posGrid.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.position = btn.dataset.pos;
        updatePreview();
    });
});

// ======== Sliders ========
wmOpacity.addEventListener('input', () => {
    state.opacity = wmOpacity.value / 100;
    opacityVal.textContent = wmOpacity.value + '%';
    updatePreview();
});
wmScale.addEventListener('input', () => {
    state.scale = +wmScale.value;
    scaleVal.textContent = wmScale.value + '%';
    updatePreview();
});
wmRotate.addEventListener('input', () => {
    state.rotate = +wmRotate.value;
    rotateVal.textContent = wmRotate.value + '°';
    updatePreview();
});

wmText.addEventListener('input', () => { state.text = wmText.value; updatePreview(); });
wmFontSize.addEventListener('input', () => { state.fontSize = +wmFontSize.value; updatePreview(); });
wmColor.addEventListener('input', () => { state.color = wmColor.value; updatePreview(); });

// ======== Export Settings ========
exportFormat.addEventListener('change', () => {
    state.exportFormat = exportFormat.value;
    exportHint.textContent = state.exportFormat === 'png' ? 'PNG 无损输出' : 'JPEG / WebP 支持品质调节';
    if (state.exportFormat === 'png') { exportQuality.disabled = true; }
    else { exportQuality.disabled = false; }
    updatePreview();
});
exportQuality.addEventListener('input', () => {
    state.exportQuality = +exportQuality.value;
    exportQualityVal.textContent = exportQuality.value + '%';
    updatePreview();
});

// ======== Canvas Drawing ========
function getProportionalScale(w, h) {
    return Math.min(w, h) / 400;
}

function drawWatermark(ctx, w, h) {
    const hasText = state.wmType === 'text' || state.wmType === 'both';
    const hasImage = state.wmType === 'image' || state.wmType === 'both';

    if (!hasText && !hasImage) return;

    const opacity = Math.max(0, Math.min(1, state.opacity));

    if (state.mode === 'tile') {
        drawTileWatermark(ctx, w, h, hasText, hasImage, opacity);
        return;
    }

    const scale = state.scale / 100;
    const pScale = getProportionalScale(w, h);

    if (hasText && state.text.trim()) {
        const fontSize = state.fontSize * scale * pScale;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = state.color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const text = state.text;
        const metrics = ctx.measureText(text);
        const tw = metrics.width;
        const th = fontSize;
        const pos = getPosition(w, h, tw, th);
        const cx = pos.x + tw / 2;
        const cy = pos.y + th / 2;

        ctx.translate(cx, cy);
        ctx.rotate(state.rotate * Math.PI / 180);
        ctx.translate(-cx, -cy);

        ctx.fillText(text, pos.x + tw / 2, pos.y + th / 2);
        ctx.restore();
    }

    if (hasImage && state.logoImage) {
        drawLogoOnCanvas(ctx, state.logoImage, w, h, opacity, pScale);
    }
}

function drawTileWatermark(ctx, w, h, hasText, hasImage, opacity) {
    const spacing = state.tileSpacing;
    const angle = state.rotate * Math.PI / 180;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (hasText && state.text.trim()) {
        const fontSize = state.fontSize;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = state.color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        const text = state.text;
        const metrics = ctx.measureText(text);
        const tw = metrics.width + spacing;
        const th = fontSize * 1.5 + spacing;

        const diag = Math.ceil(Math.sqrt(w * w + h * h));
        for (let y = -diag; y < diag + th; y += th) {
            for (let x = -diag; x < diag + tw; x += tw) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }
        }
    }

    if (hasImage && state.logoImage) {
        const scale = state.scale / 100;
        let lw = state.logoImage.naturalWidth * scale;
        let lh = state.logoImage.naturalHeight * scale;
        const stepX = lw + spacing;
        const stepY = lh + spacing;

        const diag = Math.ceil(Math.sqrt(w * w + h * h));
        for (let y = -diag; y < diag + stepY; y += stepY) {
            for (let x = -diag; x < diag + stepX; x += stepX) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.drawImage(state.logoImage, -lw / 2, -lh / 2, lw, lh);
                ctx.restore();
            }
        }
    }

    ctx.restore();
}

function drawLogoOnCanvas(ctx, logo, w, h, opacity, pScale) {
    if (pScale === undefined) pScale = 1;
    let lw = logo.naturalWidth * (state.scale / 100) * pScale;
    let lh = logo.naturalHeight * (state.scale / 100) * pScale;

    const maxW = w * 0.4;
    const maxH = h * 0.4;
    if (lw > maxW) { lh *= maxW / lw; lw = maxW; }
    if (lh > maxH) { lw *= maxH / lh; lh = maxH; }

    const pos = getPosition(w, h, lw, lh);
    const cx = pos.x + lw / 2;
    const cy = pos.y + lh / 2;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.rotate(state.rotate * Math.PI / 180);
    ctx.translate(-cx, -cy);
    ctx.drawImage(logo, pos.x, pos.y, lw, lh);
    ctx.restore();
}

function getPosition(canvasW, canvasH, elW, elH) {
    const margin = 20;
    switch (state.position) {
        case 'tl': return { x: margin, y: margin };
        case 'tc': return { x: (canvasW - elW) / 2, y: margin };
        case 'tr': return { x: canvasW - elW - margin, y: margin };
        case 'cl': return { x: margin, y: (canvasH - elH) / 2 };
        case 'cc': return { x: (canvasW - elW) / 2, y: (canvasH - elH) / 2 };
        case 'cr': return { x: canvasW - elW - margin, y: (canvasH - elH) / 2 };
        case 'bl': return { x: margin, y: canvasH - elH - margin };
        case 'bc': return { x: (canvasW - elW) / 2, y: canvasH - elH - margin };
        case 'br': return { x: canvasW - elW - margin, y: canvasH - elH - margin };
    }
}

// ======== Export Helpers ========
const MIME_MAP = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT_MAP = { jpeg: '.jpg', png: '.png', webp: '.webp' };

function getExportOpts() {
    return {
        mime: MIME_MAP[state.exportFormat],
        ext: EXT_MAP[state.exportFormat],
        quality: state.exportFormat === 'png' ? undefined : state.exportQuality / 100,
    };
}

function renderFullImage(ctx, img, w, h) {
    if (state.exportFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
}

// ======== Preview (WYSIWYG) ========
let previewTimer;

function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(doUpdatePreview, 150);
}

function doUpdatePreview() {
    const idx = state.currentIndex;
    if (idx < 0 || idx >= state.images.length) { previewSection.style.display = 'none'; return; }
    previewSection.style.display = '';

    const item = state.images[idx];
    const img = item.img;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const maxW = 400;
    const displayScale = Math.min(1, maxW / nw);
    const pw = Math.round(nw * displayScale);
    const ph = Math.round(nh * displayScale);

    const offscreen = document.createElement('canvas');
    offscreen.width = nw;
    offscreen.height = nh;
    const offCtx = offscreen.getContext('2d');
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, nw, nh);
    offCtx.drawImage(img, 0, 0, nw, nh);

    origPreview.width = pw;
    origPreview.height = ph;
    const octx = origPreview.getContext('2d');
    octx.drawImage(offscreen, 0, 0, nw, nh, 0, 0, pw, ph);

    const offWM = document.createElement('canvas');
    offWM.width = nw;
    offWM.height = nh;
    const wmCtx = offWM.getContext('2d');
    renderFullImage(wmCtx, img, nw, nh);
    drawWatermark(wmCtx, nw, nh);

    wmPreview.width = pw;
    wmPreview.height = ph;
    const wctx = wmPreview.getContext('2d');
    wctx.drawImage(offWM, 0, 0, nw, nh, 0, 0, pw, ph);
}

// ======== Apply Batch ========
applyBtn.addEventListener('click', async () => {
    if (!state.images.length) return;
    const opts = getExportOpts();
    processingOverlay.classList.add('show');
    processingText.textContent = '正在处理图片...';

    for (let i = 0; i < state.images.length; i++) {
        processingText.textContent = `正在处理第 ${i + 1}/${state.images.length} 张...`;
        const item = state.images[i];
        const img = item.img;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        renderFullImage(ctx, img, c.width, c.height);
        drawWatermark(ctx, c.width, c.height);
        item.resultDataUrl = c.toDataURL(opts.mime, opts.quality);
        await new Promise(r => setTimeout(r, 10));
    }

    processingOverlay.classList.remove('show');
    downloadBtn.disabled = false;
    renderImageList();
    updateButtons();
    toast(`已完成 ${state.images.length} 张图片的水印处理`);
});

// ======== Download ========
function downloadSingle(index) {
    const item = state.images[index];
    if (!item || !item.resultDataUrl) { toast('请先应用水印'); return; }
    const opts = getExportOpts();
    const a = document.createElement('a');
    a.download = item.file.name.replace(/\.[^.]+$/, '_WaterMark' + opts.ext);
    a.href = item.resultDataUrl;
    a.click();
}

downloadBtn.addEventListener('click', async () => {
    const results = state.images.filter(i => i.resultDataUrl);
    if (!results.length) { toast('请先应用水印'); return; }
    const opts = getExportOpts();

    if (results.length === 1) {
        const a = document.createElement('a');
        a.download = results[0].file.name.replace(/\.[^.]+$/, '_WaterMark' + opts.ext);
        a.href = results[0].resultDataUrl;
        a.click();
        return;
    }

    processingOverlay.classList.add('show');
    processingText.textContent = '正在打包 ZIP...';
    await new Promise(r => setTimeout(r, 50));

    const JSZip = window.JSZip;
    if (!JSZip) { toast('ZIP 库加载中，请稍后重试'); processingOverlay.classList.remove('show'); return; }

    const zip = new JSZip();
    for (const item of results) {
        const name = item.file.name.replace(/\.[^.]+$/, '_WaterMark' + opts.ext);
        const data = item.resultDataUrl.split(',')[1];
        zip.file(name, data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.download = 'WaterMark_Images.zip';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    processingOverlay.classList.remove('show');
    toast('ZIP 已下载');
});

// ======== Helpers ========
function updateButtons() {
    const hasImgs = state.images.length > 0;
    applyBtn.disabled = !hasImgs;
    const processed = state.images.filter(i => i.resultDataUrl).length;
    if (!hasImgs) downloadBtn.disabled = true;
    else downloadBtn.disabled = processed === 0;
    downloadBtn.textContent = processed === 0
        ? '全部下载'
        : `下载全部 (${processed})`;
    statusText.textContent = !hasImgs
        ? '请先添加图片'
        : processed === 0
            ? `${state.images.length} 张图片已加载`
            : `${state.images.length} 张 · ${processed} 张已处理`;
}

// ======== Init ========
updateButtons();
