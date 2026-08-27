// ── DOM refs ──
const sensorEl = document.getElementById('sensor');
const cocGroup = document.getElementById('cocGroup');
const cocCustom = document.getElementById('cocCustom');
const focalEl = document.getElementById('focal');
const apertureEl = document.getElementById('aperture');
const distanceEl = document.getElementById('distance');

const hyperfocalVal = document.getElementById('hyperfocalVal');
const nearVal = document.getElementById('nearVal');
const farVal = document.getElementById('farVal');
const totalVal = document.getElementById('totalVal');
const frontPct = document.getElementById('frontPct');
const rearPct = document.getElementById('rearPct');

const diagramTrack = document.getElementById('diagramTrack');
const dofBar = document.getElementById('dofBar');
const mkNear = document.getElementById('mkNear');
const mkFocus = document.getElementById('mkFocus');
const mkFar = document.getElementById('mkFar');
const mkHyper = document.getElementById('mkHyper');

const legNearVal = document.getElementById('legNearVal');
const legFocusVal = document.getElementById('legFocusVal');
const legFarVal = document.getElementById('legFarVal');
const legHyperVal = document.getElementById('legHyperVal');
const legNear = document.getElementById('legNear');
const legFar = document.getElementById('legFar');
const legHyper = document.getElementById('legHyper');

// ── Constants ──
const MIN_DIST = 0.1;
const MAX_DIST = 10000;
const RATIO = MAX_DIST / MIN_DIST;

const PRESETS = {
    ff: 0.029,
    'aps-c': 0.019,
    m43: 0.015,
    '1inch': 0.011,
};

sensorEl.addEventListener('change', () => {
    cocGroup.classList.toggle('hidden', sensorEl.value !== 'custom');
    calcAndRender();
});

// ── Math ──
function posToDist(pos) {
    return MIN_DIST * Math.pow(RATIO, pos);
}

function distToPos(dist) {
    if (dist <= MIN_DIST) return 0;
    if (dist >= MAX_DIST) return 1;
    return Math.log(dist / MIN_DIST) / Math.log(RATIO);
}

function getCoC() {
    if (sensorEl.value === 'custom') return parseFloat(cocCustom.value) || 0.02;
    return PRESETS[sensorEl.value];
}

function calcHyperfocal(f, N, c) {
    if (f <= 0 || N <= 0 || c <= 0) return NaN;
    const fm = f / 1000;
    const cm = c / 1000;
    return (fm * fm) / (N * cm) + fm;
}

function calcDOF(H, f, s) {
    const fm = f / 1000;
    const Dn = (H * s) / (H + s - fm);
    if (s >= H - 1e-9) {
        return { Dn, Df: Infinity, total: Infinity, isInfinite: true };
    }
    const Df = (H * s) / (H - s - fm);
    return { Dn, Df, total: Df - Dn, isInfinite: false };
}

function formatDist(m) {
    if (m === Infinity || isNaN(m)) return '∞';
    if (m < 0.01) return `${(m * 1000).toFixed(1)} mm`;
    if (m < 1) return `${(m * 100).toFixed(1)} cm`;
    if (m < 10) return `${m.toFixed(2)} m`;
    if (m < 100) return `${m.toFixed(1)} m`;
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
}

function roundDist(d) {
    if (d < 1) return Math.round(d * 100) / 100;
    if (d < 10) return Math.round(d * 10) / 10;
    if (d < 100) return Math.round(d);
    return Math.round(d / 10) * 10;
}

// ── Render ──
function calcAndRender() {
    const f = parseFloat(focalEl.value);
    const N = parseFloat(apertureEl.value);
    const s = parseFloat(distanceEl.value);
    const c = getCoC();

    const valid = f > 0 && N > 0 && s >= MIN_DIST && c > 0;

    if (!valid) {
        const dash = '—';
        hyperfocalVal.textContent = dash;
        nearVal.textContent = dash;
        farVal.textContent = dash;
        totalVal.textContent = dash;
        frontPct.textContent = dash;
        rearPct.textContent = dash;
        legNearVal.textContent = dash;
        legFocusVal.textContent = dash;
        legFarVal.textContent = dash;
        legHyperVal.textContent = dash;
        return;
    }

    const H = calcHyperfocal(f, N, c);
    const { Dn, Df, total, isInfinite } = calcDOF(H, f, s);

    hyperfocalVal.textContent = formatDist(H);
    nearVal.textContent = formatDist(Dn);
    farVal.textContent = isInfinite ? '∞' : formatDist(Df);
    totalVal.textContent = isInfinite ? '∞' : formatDist(total);

    const frontDOF = s - Dn;
    const rearDOF = isInfinite ? Infinity : Df - s;

    if (isInfinite) {
        frontPct.textContent = '100%';
        rearPct.textContent = '∞';
    } else if (total > 0) {
        frontPct.textContent = `${(frontDOF / total * 100).toFixed(0)}%`;
        rearPct.textContent = `${(rearDOF / total * 100).toFixed(0)}%`;
    } else {
        frontPct.textContent = '—';
        rearPct.textContent = '—';
    }

    // ── Update diagram markers ──
    const pNear = distToPos(Dn);
    const pFocus = distToPos(s);
    const pFar = isInfinite ? 1 : distToPos(Df);
    const pHyper = distToPos(H);

    mkNear.style.left = `${pNear * 100}%`;
    mkFocus.style.left = `${pFocus * 100}%`;

    if (isInfinite) {
        mkFar.className = 'mk mk-inf';
        mkFar.textContent = '∞';
        mkFar.style.left = '100%';
    } else {
        mkFar.className = 'mk mk-far';
        mkFar.textContent = '';
        mkFar.style.left = `${pFar * 100}%`;
    }

    dofBar.style.left = `${pNear * 100}%`;
    dofBar.style.width = `${(pFar - pNear) * 100}%`;

    mkHyper.classList.toggle('hidden', pHyper < 0 || pHyper > 1);
    mkHyper.style.left = `${pHyper * 100}%`;

    // ── Update legend ──
    legNearVal.textContent = formatDist(Dn);
    legFocusVal.textContent = formatDist(s);
    legFarVal.textContent = isInfinite ? '∞' : formatDist(Df);
    legFarVal.className = isInfinite ? 'val inf' : 'val';
    legHyperVal.textContent = `H ${formatDist(H)}`;
    legHyper.classList.toggle('hidden', pHyper < 0 || pHyper > 1);
}

// ── Drag ──
let isDragging = false;

function getTrackPos(clientX) {
    const rect = diagramTrack.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

function onPointerDown(e) {
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dist = posToDist(getTrackPos(clientX));
    distanceEl.value = roundDist(dist);
    mkFocus.classList.add('dragging');
    calcAndRender();
    e.preventDefault();
}

function onPointerMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dist = posToDist(getTrackPos(clientX));
    distanceEl.value = roundDist(dist);
    calcAndRender();
    e.preventDefault();
}

function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    mkFocus.classList.remove('dragging');
}

diagramTrack.addEventListener('mousedown', onPointerDown);
document.addEventListener('mousemove', onPointerMove);
document.addEventListener('mouseup', onPointerUp);

diagramTrack.addEventListener('touchstart', onPointerDown, { passive: false });
document.addEventListener('touchmove', onPointerMove, { passive: false });
document.addEventListener('touchend', onPointerUp);

// ── Input sync ──
function onInputChange() {
    let v = parseFloat(distanceEl.value);
    if (isNaN(v) || v < MIN_DIST) v = MIN_DIST;
    if (v > MAX_DIST) v = MAX_DIST;
    distanceEl.value = v;
    calcAndRender();
}

distanceEl.addEventListener('input', onInputChange);
focalEl.addEventListener('input', calcAndRender);
apertureEl.addEventListener('input', calcAndRender);
cocCustom.addEventListener('input', calcAndRender);

calcAndRender();
