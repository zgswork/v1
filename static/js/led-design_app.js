/* =======================
   LED显示屏 主逻辑
   ======================= */
function initSelect(selectId, dataKey, defaultValue) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const list = LED_DATA[dataKey];
    if (!Array.isArray(list)) return;
    sel.innerHTML = '';
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        sel.appendChild(opt);
    });
    const valToSet = defaultValue !== undefined ? defaultValue : list[0];
    if (defaultValue !== undefined) { sel.value = defaultValue; }
    updateProductSeries();
    updateSnhwState();
}
document.addEventListener('DOMContentLoaded', () => {
    initSelect('snhw', '室内户外');
    initSelect('azys', '安装样式');
    initSelect('flmj', '法兰埋件');
    initSelect('xmqy', '项目区域');
    Version && ['headerVersion', 'alertVersion'].forEach(id => document.getElementById(id).textContent = Version);
})
/* =======================
   级联渲染
   ======================= */
function updateProductSeries() {
    const snhw = snhwEl.value;
    const seriesMap = productData[snhw] || {};
    cpxlEl.innerHTML = '';
    cpxhEl.innerHTML = '';
    Object.keys(seriesMap).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        cpxlEl.appendChild(opt);
    });
    updateProductModels();
}
function updateProductModels() {
    const snhw = snhwEl.value;
    const series = cpxlEl.value;
    const models = (productData[snhw] && productData[snhw][series]) || [];
    cpxhEl.innerHTML = '';
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        cpxhEl.appendChild(opt);
    });
    updateCombos();
}
/* =======================
   工具
   ======================= */
function evalExpr(expr) {
    try {
        if (!/^[\d\s+\-*/().]+$/.test(expr)) return 0;
        return Function('"use strict";return (' + expr + ')')();
    } catch (e) { return 0; }
}
function normalizePositiveInt(el) {
    const v = Math.max(1, Math.trunc(Number(el.value)) || 1);
    if (String(el.value) !== String(v)) el.value = v;
    return v;
}
function swapPipeSize(s) {
    let p = s.split('*');
    if (p.length >= 2) { let t = p[0]; p[0] = p[1]; p[1] = t; }
    return p.join('*');
}
function updateCombos() {
    const v = cpxhEl.value;
    if (v.startsWith('Q') || v.startsWith('CC') || v.startsWith('R')) {
        dycdEl.value = 320; dygdEl.value = 160;
        dyhdEl.value = 22.5; if (snhwEl.value == '户外') { dyhdEl.value = 26 }
    } else if (v.startsWith('XS')) {
        dycdEl.value = 320; dygdEl.value = 240; dyhdEl.value = 20.6;
    } else if (v.startsWith('XC')) {
        dycdEl.value = 600; dygdEl.value = 337.5; dyhdEl.value = 39.8;
    } else if (v.startsWith('YK')) {
        dycdEl.value = 600; dygdEl.value = 337.5; dyhdEl.value = 37.4;
    } else if (v.startsWith('VK')) {
        dycdEl.value = 600; dygdEl.value = 337.5; dyhdEl.value = 53;
    } else if (v.startsWith('DM')) {
        dycdEl.value = 500; dygdEl.value = 500; dyhdEl.value = 68;
    } else if (v.startsWith('HY')) {
        dycdEl.value = 500; dygdEl.value = 500; dyhdEl.value = 68;
    } else if (v.startsWith('LY')) {
        dycdEl.value = 500; dygdEl.value = 500; dyhdEl.value = 88;
    } else if (v.startsWith('CG')) {
        dycdEl.value = 500; dygdEl.value = 500; dyhdEl.value = 72;
    } else if (v.startsWith('EM')) {
        dycdEl.value = 500; dygdEl.value = 500; dyhdEl.value = 20.6;
    } else if (v.startsWith('CS')) {
        dycdEl.value = 640; dygdEl.value = 480; dyhdEl.value = 39;
    } else if (v.startsWith('DW')) {
        dycdEl.value = 640; dygdEl.value = 343; dyhdEl.value = 59.5;
    } else if (v.startsWith('GS')) {
        dycdEl.value = 1000; dygdEl.value = 1000; dyhdEl.value = 77;
    } else if ((v.startsWith('TS'))) {
        dycdEl.value = 1000; dygdEl.value = 1000; dyhdEl.value = 28;
    } else if (v.startsWith('UTS')) {
        dycdEl.value = 1000; dygdEl.value = 500; dyhdEl.value = 78;
    } else if (cpxhSettings[v]) {
        const { dycd, dygd } = cpxhSettings[v];
        dycdEl.value = dycd; dygdEl.value = dygd;
    } else {
        dycdEl.value = defaultQSettings.dycd;
        dygdEl.value = defaultQSettings.dygd;
    }
    pdjjEl.value = cpxhSettings[v]?.pdjj ?? pdjjEl.value;
    xscdEl.value = (+dycdEl.value || 0) * normalizePositiveInt(pllsEl);
    xsgdEl.value = (+dygdEl.value || 0) * normalizePositiveInt(plhsEl);
}
function swapFirstTwo(str) {
    const list = str.split('*');
    if (list.length >= 3) { [list[0], list[1]] = [list[1], list[0]]; }
    return list.join('*');
}
function updatezcsgState() {
    zcsgEl.value = "";
    if (['吊装', '顶天立地'].includes(azysEl.value)) {
        const lsztH = [xsgdEl, bbsbEl, jlwdEl, bbxbEl, ldgdEl].reduce((sum, el) => sum + (parseFloat(el?.value) || 0), 0);
        zcsgEl.value = "60*120*5方管";
        if (lsztH < 5000) zcsgEl.value = "50*100*5方管";
        if (lsztH < 4000) zcsgEl.value = "40*80*4方管";
        if (lsztH < 3000) zcsgEl.value = "40*60*3方管";
        if (lsztH < 2000) zcsgEl.value = "40*40*3方管";
    }
}
function updatedybtState() {
    const s = snhwSettings[snhwEl.value];
    if (!s) return;
    dybtEl.value = s.dybt;
    bthgEl.value = swapFirstTwo(s.dybt);
    ntlgEl.value = swapFirstTwo(s.dybt);
    sphgEl.value = LED_DATA['材料列表'][1];
    flmjEl.value = LED_DATA['法兰埋件'][1];
    if (dycdEl.value > 320) { [dybtEl, bthgEl, ntlgEl].forEach(el => el.value = "40*40*3方管") }
    updatezcsgState();
}
function updateSnhwState() {
    updatedybtState();
    updatezcsgState();
    updateSteelFieldsState();
    applyPthdLimit();
}
function updateLdgdState() {
    const v = azysEl.value;
    const ldgdEdit = (v === '落地拉墙' || v === '顶天立地');
    const jlwdEdit = (v === '吊装' || v === '顶天立地');
    const lkjxEdit = (v === '嵌入');
    ldgdEl.readOnly = !ldgdEdit; ldgdEl.classList.toggle('readonly', !ldgdEdit);
    jlwdEl.readOnly = !jlwdEdit; jlwdEl.classList.toggle('readonly', !jlwdEdit);
    lkjxEl.readOnly = !lkjxEdit; lkjxEl.classList.toggle('readonly', !lkjxEdit);
    if (!ldgdEdit) ldgdEl.value = 0;
    else if (!ldgdEl.value || +ldgdEl.value === 0) ldgdEl.value = 500;
    if (!jlwdEdit) jlwdEl.value = 0;
    else if (!jlwdEl.value || +jlwdEl.value === 0) jlwdEl.value = 500;
    if (!lkjxEdit) lkjxEl.value = 0;
    else if (!lkjxEl.value || +lkjxEl.value === 0) lkjxEl.value = 0;
    updateBbsbState();
    updateHorizontalBeam();
    applyPthdLimit();
}
function updateBbsbState() {
    const e = azysEl.value === '嵌入';
    [bbcbEl, bbsbEl, bbxbEl].forEach(el => { el.readOnly = e; el.classList.toggle('readonly', e) });
    if (e) { bbsbEl.value = 0; bbxbEl.value = 0; bbcbEl.value = 0 }
    else if (!bbsbEl.value || +bbsbEl.value === 0) { bbsbEl.value = 50; bbxbEl.value = 50; bbcbEl.value = 50 }
    updateSteelFieldsState();
    updateHorizontalBeam();
}
/* ========== 新增：计算并限制屏体厚度 ========== */
function applyPthdLimit() {
    if (!pggtEl.checked) return;            // 未选中钢结构图时不处理
    const dybtStr = dybtEl.value.trim();
    const bthgStr = bthgEl.value.trim();
    const zcsgStr = zcsgEl.value.trim();
    const dyhdVal = parseFloat(dyhdEl.value) || 0;
    let minThick = dyhdVal;
    // 背条方管：取第高度
    const parts1 = dybtStr.split('*');
    if (parts1.length >= 2) { const wall = parseFloat(parts1[1]); if (!isNaN(wall)) minThick += wall }
    // 背条横杆：取第宽度
    const parts2 = bthgStr.split('*');
    if (parts2.length >= 2) { const h = parseFloat(parts2[0]); if (!isNaN(h)) minThick += h }
    // 主承竖杆：取第高度
    const parts3 = zcsgStr.split('*');
    if (parts3.length >= 2) { const h0 = parseFloat(parts3[1]); if (!isNaN(h0)) minThick += h0 }
    const current = parseFloat(pthdEl.value) || 0;
    if (current < minThick) { pthdEl.value = minThick }
}
function updateSteelFieldsState() {
    // ----- 新增：检测 pggt 是否从 false → true，若是则自动勾选 zdtj -----
    const currentChecked = pggtEl.checked;
    if (currentChecked && !(pggtEl.dataset.prevChecked === 'true')) { zdtjEl.checked = true }// 自动推荐默认勾选
    pggtEl.dataset.prevChecked = currentChecked;
    // -----------------------------------------------------------------
    // ----- 新增：检测 psyt 是否从 false → true，若是则自动勾选 dxft -----
    const currentChecked0 = psytEl.checked;
    if (currentChecked0 && !(psytEl.dataset.prevChecked === 'true')) { dxftEl.checked = true }// 自动推荐默认勾选
    psytEl.dataset.prevChecked = currentChecked0;
    // -----------------------------------------------------------------
    const psytC = psytEl.checked;
    const pggtC = pggtEl.checked;
    const zdtjC = zdtjEl.checked;
    const dxftC = dxftEl.checked;
    const pdftC = pdftEl.checked;
    if (!psytC) { [pggtEl, cltjEl, dxftEl, pdftEl].forEach(el => el.checked = false) }
    const active = pggtEl.checked;
    const disable = !active || zdtjC;
    [dybtEl, bthgEl, ntlgEl, sphgEl, dycdEl, dygdEl, dyhdEl, mjhjEl, mjsjEl].forEach(f => {
        f.readOnly = disable;
        f.classList.toggle('readonly', disable);
    });
    // ----- 新增：控制屏体厚度 -----
    if (!active) {
        pthdEl.value = 100;
        pthdEl.readOnly = true;
        pthdEl.classList.add('readonly');
    } else {
        pthdEl.readOnly = false;
        pthdEl.classList.remove('readonly');
        applyPthdLimit();
    }
    if (!active) {
        [dybtEl, bthgEl, ntlgEl, sphgEl, zcsgEl].forEach(el => el.value = '');
        [zdtjEl, cltjEl].forEach(el => el.checked = false)
    } else {
        updatedybtState();
    }
    drawBtnEl.disabled = !(psytC && (dxftC || pdftC));
    drawBtnEl.classList.toggle('readonly', drawBtnEl.disabled);
    updateHorizontalBeam();
    // 控制第六行和第七行的显示/隐藏
    const rowSteel = document.getElementById('rowSteelX');
    if (rowSteel) rowSteel.style.display = zdtjC ? 'none' : '';
}
function updateHorizontalBeam() {
    const bbxb = parseInt(bbxbEl.value) || 0;
    const ldgd = parseInt(ldgdEl.value) || 0;
    const sum = bbxb + ldgd;
    const beamVal = sphgEl.value.trim();
    let beamHeight = 0;
    if (beamVal) {
        const parts = beamVal.split('*');
        if (parts.length >= 2) {
            const heightStr = parts[1].replace(/[^0-9.]/g, '');
            beamHeight = parseFloat(heightStr) || 0;
        }
    }
    if (beamHeight > 0 && sum < beamHeight) { sphgEl.value = ''; }
}
/* =======================
   弹窗 & 页面
   ======================= */
const alertOverlay = document.getElementById('alertOverlay');
function showAlert() {
    alertOverlay.style.display = 'flex';
    if (navigator.vibrate) navigator.vibrate(50);
}
function closeAlert() { alertOverlay.style.display = 'none'; }
function closePage() {
    if (window.opener) { window.close(); }
    else if (confirm("确定要离开此页面吗？")) {
        if (window.history.length > 1) window.history.back();
        else { window.blur(); alert("请手动关闭此标签页"); }
    }
}
/* =======================
   绘图 (FormData 进阶方案)
   ======================= */
let _lastBlob = null, _lastFilename = '';
function reDownload() {
    if (_lastBlob && _lastFilename) {
        const u = URL.createObjectURL(_lastBlob), a = document.createElement('a');
        a.href = u; a.download = _lastFilename; document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(u);
    } else alert('没有可重新下载的文件，请重新生成。');
}
async function drawDxf() {
    const msgEl = document.getElementById('msg');
    drawBtnEl.disabled = true;
    drawBtnEl.textContent = '正在努力绘图，请稍等...';
    let sec = 0;
    const timer = setInterval(() => {
        sec++;
        msgEl.innerHTML = `⏳ 正在努力绘图，请稍等... 已用时 ${sec} 秒`;
        msgEl.classList.remove('hidden');
    }, 1000);
    // ✨ 核心优化：直接从 form 收集所有带 name 属性的数据
    //const form = document.getElementById('designForm');
    //const fd = new FormData(form);
    const fd = new FormData();
    document.querySelectorAll('[name]').forEach(el => {
        if (el.disabled) return;                        // 跳过禁用元素（与 FormData 行为一致）
        if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked) { fd.append(el.name, el.value) }   // 只添加选中的复选框/单选框            
        } else { fd.append(el.name, el.value) }               // 普通 input、select、textarea

    });
    try {
        const res = await fetch('/dxf/', { method: 'POST', body: fd });
        clearInterval(timer);
        if (!res.ok) throw new Error(await res.text() || '绘图失败');
        const cd = res.headers.get('content-disposition') || '';
        let fn = 'design.dxf';
        const m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
        if (m && m[1]) fn = decodeURIComponent(m[1]);
        const blob = await res.blob();
        _lastBlob = blob; _lastFilename = fn;
        const u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(u);
        msgEl.innerHTML = `✅ 已绘图完毕并下载: <a href="#" onclick="reDownload();return false;">${fn}</a>`;
    } catch (err) {
        clearInterval(timer);
        msgEl.textContent = '绘图失败: ' + err.message;
        msgEl.classList.remove('hidden');
    } finally {
        drawBtnEl.disabled = false;
        drawBtnEl.textContent = '绘图';
    }
}
/* =======================
   初始化与事件绑定
   ======================= */
function getEls(ids) { return Object.fromEntries(ids.map(id => [id, document.getElementById(id)])); }
const els = getEls([
    'snhw', 'cpxl', 'cpxh', 'pdjj',
    'dycd', 'dygd', 'bbsb', 'azys',
    'plls', 'plhs', 'bbxb', 'bbcb',
    'dyhd', 'pthd', 'ldgd', 'jlwd',
    'xscd', 'xsgd', 'lkjx', 'xmqy',
    'dybt', 'bthg', 'ntlg', 'sphg',
    'zcsg', 'mjhj', 'mjsj', 'flmj',
    'psyt', 'pggt', 'zdtj', 'cltj', 'dxft', 'pdft',
    'drawBtn',
]);
const {
    snhw: snhwEl, cpxl: cpxlEl, cpxh: cpxhEl, pdjj: pdjjEl,
    dycd: dycdEl, dygd: dygdEl, bbsb: bbsbEl, azys: azysEl,
    plls: pllsEl, plhs: plhsEl, bbxb: bbxbEl, bbcb: bbcbEl,
    dyhd: dyhdEl, pthd: pthdEl, ldgd: ldgdEl, jlwd: jlwdEl,
    xscd: xscdEl, xsgd: xsgdEl, lkjx: lkjxEl, xmqy: xmqyEl,
    dybt: dybtEl, bthg: bthgEl, ntlg: ntlgEl, sphg: sphgEl,
    zcsg: zcsgEl, mjhj: mjhjEl, mjsj: mjsjEl, flmj: flmjEl,
    psyt: psytEl, pggt: pggtEl, zdtj: zdtjEl, cltj: cltjEl, dxft: dxftEl, pdft: pdftEl,
    drawBtn: drawBtnEl,
} = els;
// 阻止 form 默认提交，防止页面刷新
document.getElementById('designForm').addEventListener('submit', e => e.preventDefault());
// 下拉框与输入框事件
snhwEl.addEventListener('change', () => { updateProductSeries(); updateSnhwState(); updateLdgdState(); });
cpxlEl.addEventListener('change', () => { updateProductModels(); updatedybtState(); updateLdgdState(); });
cpxhEl.addEventListener('change', updateCombos);
azysEl.addEventListener('change', updateLdgdState);
pthdEl.addEventListener('change', applyPthdLimit);
[dycdEl, pllsEl, dygdEl, plhsEl].forEach(el => el.addEventListener('input', () => { if (el === pllsEl || el === plhsEl) normalizePositiveInt(el); updateCombos(); updatezcsgState(); }));
// ----- 新增：监听背条、横杆、单元厚度的变化，重新限制屏体厚度 -----
[dybtEl, bthgEl, dyhdEl].forEach(el => { el.addEventListener('input', () => { if (pggtEl.checked) applyPthdLimit() }) });
// 复选框状态联动（批量绑定）
[psytEl, dxftEl, pdftEl, pggtEl, zdtjEl].forEach(el => { el.addEventListener('change', updateSteelFieldsState); });
[bbxbEl, ldgdEl, sphgEl].forEach(el => { el.addEventListener('input', updateHorizontalBeam); });
// 弹窗事件（批量绑定）
[['showAlertBtn', 'click', showAlert], ['closeAlertBtn', 'click', closeAlert]].forEach(([id, event, handler]) => {
    document.getElementById(id)?.addEventListener(event, handler);
});
alertOverlay.addEventListener('click', e => { if (e.target === alertOverlay) closeAlert(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAlert(); });
// 初始状态计算
updateProductSeries();
updateLdgdState();
updateSnhwState();
updateSteelFieldsState();
updateHorizontalBeam();