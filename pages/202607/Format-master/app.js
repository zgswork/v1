(function(){
'use strict';
var STORAGE = { settings: 'format.settings.v1', logs: 'format.logs.v1', templates: 'format.templates.v1' };
var PAPER = { A4: { width: 210, height: 297 }, Letter: { width: 215.9, height: 279.4 }, B5: { width: 176, height: 250 } };
var SIZE_TABLE = [
  { name: '1英寸', pt: 72, mm: '25.30', px: '95.6' },
  { name: '大特号', pt: 63, mm: '22.14', px: '83.7' },
  { name: '特号', pt: 54, mm: '18.97', px: '71.7' },
  { name: '初号', pt: 42, mm: '14.82', px: '56' },
  { name: '小初', pt: 36, mm: '12.70', px: '48' },
  { name: '一号', pt: 26, mm: '9.17', px: '34.7' },
  { name: '小一', pt: 24, mm: '8.47', px: '32' },
  { name: '二号', pt: 22, mm: '7.76', px: '29.3' },
  { name: '小二', pt: 18, mm: '6.35', px: '24' },
  { name: '三号', pt: 16, mm: '5.64', px: '21.3' },
  { name: '小三', pt: 15, mm: '5.29', px: '20' },
  { name: '四号', pt: 14, mm: '4.94', px: '18.7' },
  { name: '小四', pt: 12, mm: '4.23', px: '16' },
  { name: '五号', pt: 10.5, mm: '3.70', px: '14' },
  { name: '小五', pt: 9, mm: '3.18', px: '12' },
  { name: '六号', pt: 7.5, mm: '2.56', px: '10' },
  { name: '小六', pt: 6.5, mm: '2.29', px: '8.7' },
  { name: '七号', pt: 5.5, mm: '1.94', px: '7.3' },
  { name: '八号', pt: 5, mm: '1.76', px: '6.7' }
];
var FONT_SUGGESTIONS = ['黑体', '方正小标宋简体', '仿宋_GB2312', '楷体GB2312', '宋体', 'SimHei', 'FangSong_GB2312', 'KaiTi_GB2312', 'SimSun', 'Microsoft YaHei', 'PingFang SC', 'Times New Roman'];
var DEFAULTS = {
  paperPreset: 'A4',
  pageWidth: 210,
  pageHeight: 297,
  marginTop: 25,
  marginRight: 20,
  marginBottom: 25,
  marginLeft: 25,
  enablePageNumber: true,
  footerDistance: 10,
  footerAlign: 'center',
  footerFont: 'Times New Roman',
  titleFont: '黑体',
  titleColor: '#000000',
  titleSize: 22,
  titleLineSpacingPt: 28,
  subtitleFont: '宋体',
  subtitleColor: '#333333',
  subtitleSize: 16,
  subtitleLineSpacingPt: 24,
  h1Size: 18,
  h1Font: '黑体',
  h1Color: '#000000',
  h1Bold: true,
  h2Size: 16,
  h2Font: '黑体',
  h2Color: '#000000',
  h2Bold: true,
  h3Size: 14,
  h3Font: '黑体',
  h3Color: '#000000',
  h3Bold: true,
  h4Size: 12,
  h4Font: '黑体',
  h4Color: '#000000',
  h4Bold: true,
  titleBold: false,
  subtitleBold: false,
  bodyFont: '宋体',
  bodyColor: '#000000',
  latinFont: 'Times New Roman',
  bodySize: 12,
  bodyLineSpacingPt: 24,
  firstLineIndent: 2,
  bodyIndentLeft: 0,
  bodyIndentRight: 0,
  autoLatinFont: true,
  cleanBlankLines: true,
  convertFullWidth: true,
  autoDetectMarkdown: true,
  enableToc: false,
  tocTitle: '目录',
  tocLevels: '1-4',
  pageBreakBeforeHeading: false,
  templateName: '',
  templateVersion: '1.0.0'
};
var PRESETS = [
  {
    name: '公文标准',
    version: '1.0.0',
    settings: Object.assign({}, DEFAULTS, {
      titleFont: '黑体',
      titleSize: 22,
      titleLineSpacingPt: 28,
      subtitleFont: '仿宋_GB2312',
      subtitleSize: 16,
      subtitleLineSpacingPt: 24,
      bodyFont: '宋体',
      bodySize: 12,
      bodyLineSpacingPt: 24,
      firstLineIndent: 2,
      tocTitle: '目录'
    })
  },
  {
    name: '学术论文',
    version: '1.0.0',
    settings: Object.assign({}, DEFAULTS, {
      titleFont: 'Times New Roman',
      titleSize: 20,
      bodyFont: 'Times New Roman',
      latinFont: 'Times New Roman',
      bodySize: 12,
      bodyLineSpacingPt: 22,
      firstLineIndent: 0,
      tocTitle: 'Contents'
    })
  },
  {
    name: '简洁报告',
    version: '1.0.0',
    settings: Object.assign({}, DEFAULTS, {
      titleFont: 'PingFang SC',
      titleSize: 20,
      bodyFont: 'PingFang SC',
      bodySize: 13,
      bodyLineSpacingPt: 22,
      firstLineIndent: 1.5,
      tocTitle: '目录'
    })
  }
];
var state = { settings: loadSettings(), logs: loadLogs(), templates: loadTemplates(), queue: [], docs: [], activeId: null, pageIndex: 0, zoom: 100, busy: false };
var el = {};
function $(id){ return document.getElementById(id); }
function loadJson(key, fallback){ try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
function saveJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function loadSettings(){
  var settings = Object.assign({}, DEFAULTS, loadJson(STORAGE.settings, {}));
  if (settings.lineHeight && !settings.bodyLineSpacingPt) {
    settings.bodyLineSpacingPt = Math.round(Number(settings.bodySize || 12) * Number(settings.lineHeight));
  }
  if (typeof settings.enablePageNumber === 'undefined') settings.enablePageNumber = DEFAULTS.enablePageNumber;
  if (!settings.titleLineSpacingPt) settings.titleLineSpacingPt = DEFAULTS.titleLineSpacingPt;
  if (!settings.subtitleLineSpacingPt) settings.subtitleLineSpacingPt = DEFAULTS.subtitleLineSpacingPt;
  if (!settings.titleColor) settings.titleColor = DEFAULTS.titleColor;
  if (!settings.subtitleColor) settings.subtitleColor = DEFAULTS.subtitleColor;
  if (!settings.bodyColor) settings.bodyColor = DEFAULTS.bodyColor;
  return settings;
}
function loadLogs(){ var logs = loadJson(STORAGE.logs, []); return Array.isArray(logs) ? logs : []; }
function loadTemplates(){ var templates = loadJson(STORAGE.templates, []); return Array.isArray(templates) ? templates : []; }
function saveSettings(){ saveJson(STORAGE.settings, state.settings); }
function saveLogs(){ saveJson(STORAGE.logs, state.logs.slice(-500)); }
function saveTemplates(){ saveJson(STORAGE.templates, state.templates.slice(-100)); }
function uid(prefix){ return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36); }
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function fmtBytes(bytes){ if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1024 / 1024).toFixed(1) + ' MB'; }
function sanitizeName(name){ return String(name || 'document').replace(/[\/:*?"<>|]+/g, '_').trim() || 'document'; }
function stamp(){ var d = new Date(); var p = function(n){ return String(n).padStart(2, '0'); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
function escapeHtml(value){ return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escapeXml(value){ return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function toHalfWidth(str){ return String(str).replace(/[　！-～]/g, function(ch){ return ch === '　' ? ' ' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }); }
function looksLikeTitleLine(text){
  var line = String(text || '').trim();
  if (!line) return false;
  if (/^(#{1,6}\s|[-*+]\s+|\d+\.\s+)/.test(line)) return false;
  if (line.length > 32) return false;
  if (/[。！？!?；;：:]$/.test(line)) return false;
  if ((line.match(/\s+/g) || []).length > 4) return false;
  return true;
}
function debounce(fn, wait){ var timer = null; return function(){ var args = arguments; clearTimeout(timer); timer = setTimeout(function(){ fn.apply(null, args); }, wait || 250); }; }
function getSizeMeta(value){
  var numeric = Number(value);
  var found = SIZE_TABLE.find(function(item){ return item.pt === numeric; });
  if (found) return found;
  return { name: String(value), pt: numeric, mm: '', px: '' };
}
function sizeOptionLabel(item){
  return item.name + ' / ' + item.pt + 'pt / ' + item.mm + 'mm / ' + item.px + 'px';
}
function populateSizeOptions(select){
  if (!select) return;
  select.innerHTML = SIZE_TABLE.map(function(item){
    return '<option value="' + item.pt + '">' + escapeHtml(sizeOptionLabel(item)) + '</option>';
  }).join('');
}
function populateAllSizeOptions(){
  ['titleSize', 'subtitleSize', 'h1Size', 'h2Size', 'h3Size', 'h4Size', 'bodySize'].forEach(function(id){
    populateSizeOptions(el[id]);
  });
}
function hexColor(value){
  var color = String(value || '').trim();
  return color || '#000000';
}
function setStatus(text, kind){ el.statusText.textContent = text; el.runtimePill.textContent = kind === 'error' ? 'Error' : kind === 'warn' ? 'Warn' : kind === 'done' ? 'OK' : 'Ready'; el.runtimePill.className = 'pill ' + (kind === 'error' ? 'failed' : kind === 'warn' ? 'warning' : kind === 'done' ? 'done' : 'waiting'); }
function log(level, message, meta){ var entry = { level: level, message: message, meta: meta || {}, time: new Date().toISOString() }; state.logs.push(entry); saveLogs(); el.logCount.textContent = 'Log: ' + state.logs.length; setStatus(message, level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'done'); }
function syncCssVars(){ document.documentElement.style.setProperty('--page-width', state.settings.pageWidth + 'mm'); document.documentElement.style.setProperty('--page-height', state.settings.pageHeight + 'mm'); document.documentElement.style.setProperty('--page-margin-top', state.settings.marginTop + 'mm'); document.documentElement.style.setProperty('--page-margin-right', state.settings.marginRight + 'mm'); document.documentElement.style.setProperty('--page-margin-bottom', state.settings.marginBottom + 'mm'); document.documentElement.style.setProperty('--page-margin-left', state.settings.marginLeft + 'mm'); }
function getActiveDoc(){ if (!state.docs.length) return null; return state.docs.find(function(d){ return d.id === state.activeId; }) || state.docs[0]; }
function parseTocLevels(text){
  var levels = new Set();
  String(text || '').split(',').forEach(function(part){
    var item = part.trim();
    if (!item) return;
    var range = item.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      for (var i = Number(range[1]); i <= Number(range[2]); i++) levels.add(i);
    } else {
      var n = Number(item);
      if (!Number.isNaN(n)) levels.add(n);
    }
  });
  return levels.size ? levels : new Set([1, 2, 3, 4]);
}
function applySettings(next, quiet){
  state.settings = Object.assign({}, state.settings, next || {});
  saveSettings();
  syncForm();
  syncCssVars();
  if (!quiet) log('INFO', '样式设置已更新', { keys: Object.keys(next || {}) });
  updatePreview();
}
function cleanInputText(text){
  var out = String(text || '').replace(/\r\n?/g, '\n');
  if (state.settings.convertFullWidth) out = toHalfWidth(out);
  if (state.settings.cleanBlankLines) out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  out = out.replace(/\u0000/g, '');
  if (out.length > 20000) {
    out = out.slice(0, 20000);
    log('WARN', '文本已截断到 20000 字符', { limit: 20000 });
  }
  return out.trimEnd();
}
function isMarkdownCandidate(text){
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s)/.test(text);
}
function inferSourceType(name, text){
  var lower = String(name || '').toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.md') || (state.settings.autoDetectMarkdown && isMarkdownCandidate(text))) return 'markdown';
  return 'text';
}
function parseBlocks(text, sourceType){
  var blocks = [];
  var para = [];
  var lines = String(text || '').split('\n');
  var title = '';
  var titleSet = false;
  function flush(){
    if (!para.length) return;
    var content = para.join(' ').replace(/\s+/g, ' ').trim();
    if (content) blocks.push({ type: 'paragraph', text: content });
    para = [];
  }
  lines.forEach(function(raw){
    var line = raw.trimEnd();
    var heading = line.match(/^(#{1,6})\s+(.+)$/);
    var list = line.match(/^(?:[-*+]\s+|\d+\.\s+)(.+)$/);
    if (heading && (sourceType === 'markdown' || state.settings.autoDetectMarkdown)) {
      flush();
      if (!titleSet && blocks.length === 0) {
        title = heading[2].trim();
        titleSet = true;
        return;
      }
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      return;
    }
    if (list && (sourceType === 'markdown' || state.settings.autoDetectMarkdown)) {
      flush();
      blocks.push({ type: 'list', text: list[1].trim() });
      return;
    }
    if (!line.trim()) {
      flush();
      return;
    }
    if (!titleSet && blocks.length === 0 && para.length === 0 && looksLikeTitleLine(line)) {
      title = line.trim();
      titleSet = true;
      return;
    }
    para.push(line.trim());
  });
  flush();
  if (!title) {
    var first = blocks.find(function(block){ return block.type === 'heading' || block.type === 'paragraph'; });
    if (first) title = first.text;
  }
  return { title: title || '未命名文档', hasTitle: titleSet, blocks: blocks, rawText: text, sourceType: sourceType };
}
function buildDocModel(spec){
  var doc = { id: uid('doc'), name: spec.name, title: spec.title || spec.name, hasTitle: Boolean(spec.hasTitle), rawText: spec.rawText || '', sourceType: spec.sourceType || 'text', blocks: spec.blocks || [], outline: [], pages: [], warnings: [] };
  doc.outline = doc.blocks.filter(function(block){ return block.type === 'heading'; }).map(function(block, index){ return { level: block.level || 1, text: block.text, page: Math.max(1, Math.floor(index / 2) + 1) }; });
  doc.pages = paginateDoc(doc);
  doc.warnings = collectWarnings(doc);
  return doc;
}
function collectWarnings(doc){
  var warnings = [];
  var fonts = [state.settings.titleFont, state.settings.subtitleFont, state.settings.bodyFont, state.settings.latinFont, state.settings.footerFont];
  var known = ['Aptos', 'Calibri', 'Arial', 'Times New Roman', 'SimSun', 'Microsoft YaHei', 'Songti SC', 'PingFang SC', 'SimHei', '方正小标宋简体', '仿宋_GB2312', '楷体GB2312', 'FangSong_GB2312', 'KaiTi_GB2312'];
  var missing = fonts.filter(function(font){ return font && known.indexOf(font) === -1; });
  if (missing.length) warnings.push('检测到缺少字体 ' + missing.join('、') + '，导出与预览可能存在差异。');
  if (doc.rawText.length > 18000) warnings.push('当前文档接近粘贴上限，建议拆分处理。');
  return warnings;
}
function estimateBlockHeight(block, settings, usableWidth){
  var charsPerLine = Math.max(12, Math.floor((usableWidth * 1.6) / Math.max(8, settings.bodySize * 0.6)));
  if (block.type === 'toc') return 180;
  if (block.type === 'heading') return settings.titleLineSpacingPt + settings.titleSize * 1.2;
  if (block.type === 'list') return settings.bodyLineSpacingPt * Math.max(1, Math.ceil(block.text.length / charsPerLine)) + 8;
  var lines = Math.max(1, Math.ceil(block.text.length / charsPerLine));
  return settings.bodyLineSpacingPt * lines + settings.bodySize * 0.8;
}
function paginateDoc(doc){
  var settings = state.settings;
  var usableWidth = settings.pageWidth - settings.marginLeft - settings.marginRight;
  var maxHeight = settings.pageHeight - settings.marginTop - settings.marginBottom - settings.footerDistance - 12;
  var pages = [];
  var current = [];
  var used = 0;
  function push(){
    if (current.length) pages.push({ blocks: current.slice(), number: pages.length + 1 });
    current = [];
    used = 0;
  }
  if (settings.enableToc && doc.outline.length) pages.push({ blocks: [{ type: 'toc', title: settings.tocTitle, items: doc.outline.filter(function(item){ return parseTocLevels(settings.tocLevels).has(item.level); }) }], number: 1 });
  doc.blocks.forEach(function(block){
    if (block.type === 'heading' && settings.pageBreakBeforeHeading && current.length) push();
    var h = estimateBlockHeight(block, settings, usableWidth);
    if (used + h > maxHeight && current.length) push();
    current.push(block);
    used += h;
  });
  push();
  if (!pages.length) pages.push({ blocks: [], number: 1 });
  if (settings.enableToc && doc.outline.length) {
    var bodyPages = pages[0].blocks[0] && pages[0].blocks[0].type === 'toc' ? pages.slice(1) : pages;
    if (!(pages[0].blocks[0] && pages[0].blocks[0].type === 'toc')) {
      pages = [{ blocks: [{ type: 'toc', title: settings.tocTitle, items: doc.outline.filter(function(item){ return parseTocLevels(settings.tocLevels).has(item.level); }) }], number: 1 }].concat(bodyPages);
    }
  }
  return pages;
}
function updateClipboardDoc(){
  var text = cleanInputText(el.textInput.value);
  var sourceType = inferSourceType('clipboard.txt', text);
  var parsed = parseBlocks(text, sourceType);
  var doc = buildDocModel({ name: '粘贴文本', title: parsed.title, hasTitle: parsed.hasTitle, rawText: text, sourceType: 'clipboard', blocks: parsed.blocks });
  state.docs = state.docs.filter(function(d){ return d.sourceType !== 'clipboard'; });
  state.docs.unshift(doc);
  state.activeId = doc.id;
  state.pageIndex = 0;
}
function addQueueFiles(files){
  Array.from(files || []).forEach(function(file){ state.queue.push({ id: uid('queue'), file: file, name: file.name, size: file.size, status: 'waiting', progress: 0, error: '', result: null }); });
  renderQueue();
  processQueue();
  log('INFO', '文件已加入队列', { count: files.length });
}
async function processQueue(){
  if (state.busy) return;
  state.busy = true;
  try {
    for (var i = 0; i < state.queue.length; i++) {
      var item = state.queue[i];
      if (item.status !== 'waiting') continue;
      item.status = 'processing';
      item.progress = 20;
      renderQueue();
      try {
        var doc = await importFile(item.file);
        item.result = doc;
        item.status = 'done';
        item.progress = 100;
        state.docs.push(doc);
        state.activeId = doc.id;
        state.pageIndex = 0;
        log('INFO', '文件处理完成', { file: item.name, paragraphs: doc.blocks.length });
      } catch (err) {
        item.status = 'failed';
        item.error = err && err.message ? err.message : String(err);
        log('ERROR', '文件处理失败: ' + item.name, { error: item.error });
      }
      renderQueue();
      renderPreview();
    }
  } finally {
    state.busy = false;
  }
}
async function importFile(file){
  if (file.size > 10 * 1024 * 1024 && !confirm('文件 ' + file.name + ' 超过 10MB，可能较慢，是否继续导入？')) throw new Error('用户取消大文件导入');
  if (inferSourceType(file.name, '') === 'docx') {
    var parsed = await parseDocx(file);
    return buildDocModel({ name: file.name, title: parsed.title, hasTitle: parsed.hasTitle, rawText: parsed.rawText, sourceType: 'docx', blocks: parsed.blocks });
  }
  var text = cleanInputText(await file.text());
  var sourceType = inferSourceType(file.name, text);
  var parsedText = parseBlocks(text, sourceType);
  return buildDocModel({ name: file.name, title: parsedText.title, hasTitle: parsedText.hasTitle, rawText: text, sourceType: sourceType, blocks: parsedText.blocks });
}
async function parseDocx(file){
  var buffer = await file.arrayBuffer();
  var entry = findZipEntry(buffer, 'word/document.xml');
  if (!entry) throw new Error('未找到 word/document.xml');
  var xmlText = await readZipEntryText(buffer, entry);
  var parser = new DOMParser();
  var xml = parser.parseFromString(xmlText, 'application/xml');
  var paras = Array.from(xml.getElementsByTagName('w:p'));
  var blocks = [];
  var title = '';
  var titleSet = false;
  paras.forEach(function(p){
    var styleNode = p.querySelector('w\\:pStyle, pStyle');
    var style = styleNode ? (styleNode.getAttribute('w:val') || styleNode.getAttribute('val') || '') : '';
    var m = style.match(/Heading([1-4])/i);
    var level = m ? Number(m[1]) : 0;
    var text = Array.from(p.getElementsByTagName('w:t')).map(function(n){ return n.textContent || ''; }).join('').trim();
    if (!text) return;
    if (!titleSet && blocks.length === 0 && (level === 1 || looksLikeTitleLine(text))) {
      title = text;
      titleSet = true;
      return;
    }
    if (level >= 1 && level <= 4) blocks.push({ type: 'heading', level: level, text: text });
    else blocks.push({ type: 'paragraph', text: text });
  });
  var heading = blocks.find(function(b){ return b.type === 'heading'; });
  if (!title) title = heading ? heading.text : sanitizeName(file.name).replace(/\.docx$/i, '');
  return { title: title, hasTitle: titleSet, rawText: blocks.map(function(b){ return b.text; }).join('\n\n'), blocks: blocks };
}
function findZipEntry(buffer, filename){
  var view = new DataView(buffer);
  for (var offset = buffer.byteLength - 22; offset >= 0; offset--) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    var total = view.getUint16(offset + 10, true);
    var cdOffset = view.getUint32(offset + 16, true);
    var ptr = cdOffset;
    for (var i = 0; i < total; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      var method = view.getUint16(ptr + 10, true);
      var compressedSize = view.getUint32(ptr + 20, true);
      var nameLength = view.getUint16(ptr + 28, true);
      var extraLength = view.getUint16(ptr + 30, true);
      var commentLength = view.getUint16(ptr + 32, true);
      var localOffset = view.getUint32(ptr + 42, true);
      var name = new TextDecoder().decode(new Uint8Array(buffer, ptr + 46, nameLength));
      if (name === filename) return { method: method, compressedSize: compressedSize, localOffset: localOffset };
      ptr += 46 + nameLength + extraLength + commentLength;
    }
  }
  return null;
}
async function readZipEntryText(buffer, entry){
  var view = new DataView(buffer);
  var offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('ZIP 本地头损坏');
  var nameLength = view.getUint16(offset + 26, true);
  var extraLength = view.getUint16(offset + 28, true);
  var dataOffset = offset + 30 + nameLength + extraLength;
  var compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize);
  var bytes;
  if (entry.method === 0) {
    bytes = new Uint8Array(compressed);
  } else if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 ZIP 解压');
    var stream = new Response(compressed).body.pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error('不支持的压缩方法: ' + entry.method);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function renderQueue(){
  el.queueList.innerHTML = '';
  if (!state.queue.length) {
    el.queueList.innerHTML = '<div class="hint">暂无待处理文件。可以拖拽文件到输入区，或点击"选择文件"。</div>';
    return;
  }
  state.queue.forEach(function(item){
    var node = document.createElement('div');
    node.className = 'queue-item';
    node.innerHTML = '<div class="queue-item-top"><div><div class="queue-item-title">' + escapeHtml(item.name) + '</div><div class="queue-item-sub">' + fmtBytes(item.size) + '</div></div><span class="status-pill ' + item.status + '">' + ({ waiting: '等待', processing: '处理中', done: '完成', failed: '失败' }[item.status] || item.status) + '</span></div><div class="progress"><div style="width:' + item.progress + '%"></div></div><div class="row end"><button data-remove="' + item.id + '">移除</button></div>' + (item.error ? '<div class="error">' + escapeHtml(item.error) + '</div>' : '');
    el.queueList.appendChild(node);
  });
}
function renderPage(page, index, doc){
  var settings = state.settings;
  var scale = state.zoom / 100;
  var width = (settings.pageWidth * scale).toFixed(2) + 'mm';
  var height = (settings.pageHeight * scale).toFixed(2) + 'mm';
  var padding = [settings.marginTop * scale, settings.marginRight * scale, settings.marginBottom * scale, settings.marginLeft * scale].map(function(v){ return v.toFixed(2) + 'mm'; }).join(' ');
  var html = '';
  var titleStyle = 'font-family:"' + settings.titleFont + '";color:' + hexColor(settings.titleColor) + ';';
  var subtitleStyle = 'font-family:"' + settings.subtitleFont + '";color:' + hexColor(settings.subtitleColor) + ';';
  var bodyStyle = 'font-family:"' + settings.bodyFont + '";color:' + hexColor(settings.bodyColor) + ';';

  if (page.blocks.length && page.blocks[0].type === 'toc') {
    var toc = page.blocks[0];
    html += '<div class="toc-box"><div style="' + titleStyle + 'font-weight:700;font-size:' + settings.titleSize + 'pt;line-height:' + settings.titleLineSpacingPt + 'pt;text-align:center;">' + escapeHtml(toc.title || settings.tocTitle) + '</div>';
    if (!doc.outline.length) html += '<div class="hint">暂无目录项。</div>';
    doc.outline.filter(function(item){ return parseTocLevels(settings.tocLevels).has(item.level); }).forEach(function(item){
      html += '<div class="toc-item"><span style="' + bodyStyle + 'padding-left:' + ((item.level - 1) * 12) + 'px;font-size:' + settings.bodySize + 'pt;line-height:' + settings.bodyLineSpacingPt + 'pt;">' + escapeHtml(item.text) + '</span><span style="' + bodyStyle + 'font-size:' + settings.bodySize + 'pt;line-height:' + settings.bodyLineSpacingPt + 'pt;">' + item.page + '</span></div>';
    });
    html += '</div>';
  }

  page.blocks.forEach(function(block){
    if (block.type === 'toc') return;
    if (block.type === 'heading') {
      var level = clamp(block.level || 1, 1, 4);
      var size = settings['h' + level + 'Size'] || settings.titleSize;
      html += '<div class="preview-block heading-' + level + '" style="' + titleStyle + 'font-size:' + size + 'pt;line-height:' + settings.titleLineSpacingPt + 'pt;">' + escapeHtml(block.text) + '</div>';
    } else if (block.type === 'list') {
      html += '<div class="preview-block list" style="' + bodyStyle + 'font-size:' + settings.bodySize + 'pt;line-height:' + settings.bodyLineSpacingPt + 'pt;">• ' + escapeHtml(block.text) + '</div>';
    } else {
      html += '<div class="preview-block body" style="' + bodyStyle + 'font-size:' + settings.bodySize + 'pt;line-height:' + settings.bodyLineSpacingPt + 'pt;text-indent:' + settings.firstLineIndent + 'em;">' + escapeHtml(block.text) + '</div>';
    }
  });

  if (!html) html = '<div class="hint">空页面</div>';
  return '<article class="page" style="width:' + width + ';height:' + height + ';"><div class="page-inner" style="padding:' + padding + ';"><div class="preview-title"><span>' + escapeHtml(doc.title || doc.name) + '</span><span>Page ' + (index + 1) + '</span></div><div class="page-content">' + html + '</div><div class="preview-footer"><span>' + escapeHtml(settings.footerAlign === 'left' ? '左对齐页脚' : settings.footerAlign === 'right' ? '右对齐页脚' : '居中页脚') + '</span><span>第 ' + (index + 1) + ' 页</span></div></div></article>';
}
function renderPreview(){ el.previewFrame.innerHTML = ''; el.previewErr.classList.add('hidden'); el.previewWarn.classList.add('hidden'); var doc = getActiveDoc(); if (!doc) { el.previewFrame.innerHTML = '<div class="hint">暂无文档。输入文本或导入文件后，这里会显示分页预览。</div>'; updateStats(); return; } if (doc.warnings && doc.warnings.length) { el.previewWarn.classList.remove('hidden'); el.previewWarn.textContent = doc.warnings[0]; } var pages = doc.pages || []; if (!pages.length) pages = [{ blocks: [], number: 1 }]; state.pageIndex = clamp(state.pageIndex, 0, pages.length - 1); el.pageIndicator.textContent = (state.pageIndex + 1) + ' / ' + pages.length; el.zoomLabelBtn.textContent = state.zoom + '%'; el.fileBadge.textContent = doc.name; el.docStats.textContent = doc.blocks.length + ' 段落'; pages.forEach(function(page, index){ var node = document.createElement('div'); node.innerHTML = renderPage(page, index, doc); var pageEl = node.firstChild; if (index === state.pageIndex) pageEl.style.outline = '2px solid rgba(47,126,219,.20)'; el.previewFrame.appendChild(pageEl); }); updateStats(); }
function updateStats(){ el.itemsCount.textContent = 'Items: ' + state.docs.length; el.logCount.textContent = 'Log: ' + state.logs.length; }
function collectSettingsFromForm(){ state.settings = Object.assign({}, state.settings, readForm()); saveSettings(); syncCssVars(); }
function serializeTemplate(name){ return { name: name, version: state.settings.templateVersion || '1.0.0', createdAt: new Date().toISOString(), settings: Object.assign({}, state.settings, { templateName: name }) }; }
function downloadBlob(filename, blob){ var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(function(){ URL.revokeObjectURL(url); }, 1000); }
function downloadJson(filename, value){ downloadBlob(filename, new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })); }
function downloadText(filename, text, type){ downloadBlob(filename, new Blob([text], { type: type || 'text/plain;charset=utf-8' })); }
function exportCurrent(){ var doc = getActiveDoc(); if (!doc) return alert('没有可导出的文档。'); if (doc.sourceType === 'clipboard' && !el.textInput.value.trim()) return alert('文本输入框为空，无内容可导出。'); var bytes = buildDocxPackage(doc, state.settings); downloadBlob(sanitizeName(doc.name || doc.title) + '_formatted_' + stamp() + '.docx', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); log('INFO', '导出当前文档', { file: doc.name }); }
function exportAll(){ var docs = state.docs.filter(function(d){ return d.sourceType !== 'clipboard'; }); if (!docs.length) return alert('没有可导出的文件文档。'); docs.forEach(function(doc){ var bytes = buildDocxPackage(doc, state.settings); downloadBlob(sanitizeName(doc.name || doc.title) + '_formatted.docx', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); }); log('INFO', '批量导出完成', { count: docs.length }); }
function downloadLogs(){ downloadJson('format_' + stamp() + '.log.json', state.logs); }
function loadPreset(name){ var preset = PRESETS.find(function(p){ return p.name === name; }) || state.templates.find(function(t){ return t.name === name; }); if (!preset) return alert('未找到模板：' + name); state.settings = Object.assign({}, state.settings, preset.settings || preset, { templateName: preset.name, templateVersion: preset.version || '1.0.0' }); saveSettings(); renderAll(); log('INFO', '模板已加载', { name: name }); }
function saveTemplateCurrent(){ var name = (el.templateName.value || state.settings.templateName || prompt('模板名称', '新模板') || '').trim(); if (!name) return; var payload = serializeTemplate(name); var idx = state.templates.findIndex(function(t){ return t.name === name; }); if (idx >= 0) { if (!confirm('模板 "' + name + '" 已存在，是否覆盖？')) return; state.templates[idx] = payload; } else { state.templates.push(payload); } saveTemplates(); state.settings.templateName = name; state.settings.templateVersion = payload.version; saveSettings(); renderAll(); downloadJson('format_template_' + sanitizeName(name) + '_' + stamp() + '.json', payload); log('INFO', '模板已保存', { name: name }); }
function importTemplate(){ var input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = async function(){ var file = input.files && input.files[0]; if (!file) return; try { var payload = JSON.parse(await file.text()); var settings = Object.assign({}, DEFAULTS); Object.keys(DEFAULTS).forEach(function(key){ if (payload.settings && Object.prototype.hasOwnProperty.call(payload.settings, key)) settings[key] = payload.settings[key]; }); var name = payload.name || '未命名模板'; var version = payload.version || '1.0.0'; var template = { name: name, version: version, settings: settings }; state.templates = state.templates.filter(function(t){ return t.name !== name; }).concat([template]); saveTemplates(); state.settings = Object.assign({}, state.settings, settings, { templateName: name, templateVersion: version }); saveSettings(); syncForm(); syncCssVars(); renderAll(); log('INFO', '模板已导入', { name: name }); } catch (err) { alert('模板导入失败: ' + err.message); log('ERROR', '模板导入失败', { error: err.message }); } }; input.click(); }
function buildDocxPackage(doc, settings){
  var entries = [
    { path: '[Content_Types].xml', text: contentTypesXml(settings) },
    { path: '_rels/.rels', text: relsXml() },
    { path: 'word/document.xml', text: buildDocumentXml(doc, settings) },
    { path: 'word/_rels/document.xml.rels', text: documentRelsXml(settings) },
    { path: 'word/styles.xml', text: stylesXml(settings) },
    { path: 'word/settings.xml', text: settingsXml(settings) },
    { path: 'docProps/core.xml', text: coreXml(doc) },
    { path: 'docProps/app.xml', text: appXml(doc) }
  ];
  if (settings.enablePageNumber !== false) {
    entries.push({ path: 'word/footer1.xml', text: footerXml(settings, 'default') });
    if (settings.footerAlign === 'oddEven') {
      entries.push({ path: 'word/footer2.xml', text: footerXml(settings, 'even') });
    }
  }
  return createZip(entries);
}
function contentTypesXml(settings){
  var overrides = [
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>',
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
  ];
  if (settings.enablePageNumber !== false) {
    overrides.splice(2, 0, '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
    if (settings.footerAlign === 'oddEven') overrides.splice(3, 0, '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + overrides.join('') + '</Types>';
}
function relsXml(){ return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'; }
function documentRelsXml(settings){
  var rels = ['<Relationship Id="rSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'];
  if (settings.enablePageNumber !== false) {
    rels.push('<Relationship Id="rFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>');
    if (settings.footerAlign === 'oddEven') rels.push('<Relationship Id="rFooter2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>');
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>';
}
function settingsXml(settings){
  var parts = [];
  if (settings.enablePageNumber !== false && settings.footerAlign === 'oddEven') parts.push('<w:evenAndOddHeaders/>');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + parts.join('') + '</w:settings>';
}
function footerAlignValue(settings, parity){
  if (settings.footerAlign === 'left') return 'left';
  if (settings.footerAlign === 'right') return 'right';
  if (settings.footerAlign === 'oddEven') return parity === 'even' ? 'left' : 'right';
  return 'center';
}
function footerXml(settings, parity){ var align = footerAlignValue(settings, parity); var rPr = '<w:rPr><w:rFonts w:ascii="' + escapeXml(settings.footerFont) + '" w:hAnsi="' + escapeXml(settings.footerFont) + '" w:eastAsia="' + escapeXml(settings.footerFont) + '"/><w:sz w:val="20"/></w:rPr>'; return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="' + align + '"/></w:pPr><w:fldSimple w:instr=" PAGE "><w:r>' + rPr + '<w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>'; }
function coreXml(doc){ var now = new Date().toISOString(); return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + escapeXml(doc.title || doc.name) + '</dc:title><dc:creator>Format</dc:creator><cp:lastModifiedBy>Format</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>'; }
function appXml(doc){ return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Format</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant><vt:variant><vt:i4>' + doc.blocks.filter(function(b){ return b.type === 'heading'; }).length + '</vt:i4></vt:variant></vt:vector></HeadingPairs></Properties>'; }

function crc32(bytes){ var table = crc32.table || (crc32.table = new Uint32Array(256).map(function(_, index){ var crc = index; for (var i = 0; i < 8; i++) crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1); return crc >>> 0; })); var crc = 0xFFFFFFFF; for (var i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0; }
function createZip(entries){ var encoder = new TextEncoder(); var chunks = []; var central = []; var offset = 0; entries.forEach(function(entry){ var nameBytes = encoder.encode(entry.path); var dataBytes = encoder.encode(entry.text); var crc = crc32(dataBytes); var local = new Uint8Array(30 + nameBytes.length); var lv = new DataView(local.buffer); lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0, true); lv.setUint32(14, crc, true); lv.setUint32(18, dataBytes.length, true); lv.setUint32(22, dataBytes.length, true); lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true); local.set(nameBytes, 30); chunks.push(local, dataBytes); var cd = new Uint8Array(46 + nameBytes.length); var cv = new DataView(cd.buffer); cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true); cv.setUint32(16, crc, true); cv.setUint32(20, dataBytes.length, true); cv.setUint32(24, dataBytes.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true); cd.set(nameBytes, 46); central.push(cd); offset += local.length + dataBytes.length; }); var centralLen = central.reduce(function(sum, c){ return sum + c.length; }, 0); var end = new Uint8Array(22); var ev = new DataView(end.buffer); ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralLen, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true); chunks = chunks.concat(central, [end]); var total = chunks.reduce(function(sum, c){ return sum + c.length; }, 0); var zip = new Uint8Array(total); var cursor = 0; chunks.forEach(function(chunk){ zip.set(chunk, cursor); cursor += chunk.length; }); return zip; }

function openOutputFolder(){ alert('浏览器版原型无法直接打开文件夹；请使用导出按钮保存文档。'); }
function saveCurrentSettings(){ state.settings = Object.assign({}, state.settings, readForm()); saveSettings(); syncCssVars(); }
function initDom(){
  el.textInput = $('textInput');
  el.countLabel = $('countLabel');
  el.cleanBlank = $('cleanBlank');
  el.fullWidth = $('fullWidth');
  el.mdDetect = $('mdDetect');
  el.fileInput = $('fileInput');
  el.pickFilesBtn = $('pickFilesBtn');
  el.queueList = $('queueList');
  el.templateBadge = $('templateBadge');
  el.fileBadge = $('fileBadge');
  el.previewWarn = $('previewWarn');
  el.previewErr = $('previewErr');
  el.previewFrame = $('previewFrame');
  el.prevPageBtn = $('prevPageBtn');
  el.nextPageBtn = $('nextPageBtn');
  el.zoomOutBtn = $('zoomOutBtn');
  el.zoomInBtn = $('zoomInBtn');
  el.zoomLabelBtn = $('zoomLabelBtn');
  el.openOutputBtn = $('openOutputBtn');
  el.pageIndicator = $('pageIndicator');
  el.docStats = $('docStats');
  el.runtimePill = $('runtimePill');
  el.statusText = $('statusText');
  el.itemsCount = $('itemsCount');
  el.logCount = $('logCount');
  el.saveTemplateBtn = $('saveTemplateBtn');
  el.saveTemplateBtn2 = $('saveTemplateBtn2');
  el.importTemplateBtn = $('importTemplateBtn');
  el.exportCurrentBtn = $('exportCurrentBtn');
  el.exportAllBtn = $('exportAllBtn');
  el.downloadLogsBtn = $('downloadLogsBtn');
  el.resetBtn = $('resetBtn');
  el.paperPreset = $('paperPreset');
  el.pageWidth = $('pageWidth');
  el.pageHeight = $('pageHeight');
  el.marginTop = $('marginTop');
  el.marginRight = $('marginRight');
  el.marginBottom = $('marginBottom');
  el.marginLeft = $('marginLeft');
  el.enablePageNumber = $('enablePageNumber');
  el.footerDistance = $('footerDistance');
  el.footerAlign = $('footerAlign');
  el.footerFont = $('footerFont');
  el.titleFont = $('titleFont');
  el.titleColor = $('titleColor');
  el.titleSize = $('titleSize');
  el.titleLineSpacingPt = $('titleLineSpacingPt');
  el.subtitleFont = $('subtitleFont');
  el.subtitleColor = $('subtitleColor');
  el.subtitleSize = $('subtitleSize');
  el.subtitleLineSpacingPt = $('subtitleLineSpacingPt');
  el.h1Size = $('h1Size');
  el.h2Size = $('h2Size');
  el.h3Size = $('h3Size');
  el.h4Size = $('h4Size');
  el.bodyFont = $('bodyFont');
  el.bodyColor = $('bodyColor');
  el.latinFont = $('latinFont');
  el.bodySize = $('bodySize');
  el.bodyLineSpacingPt = $('bodyLineSpacingPt');
  el.firstLineIndent = $('firstLineIndent');
  el.bodyIndentLeft = $('bodyIndentLeft');
  el.bodyIndentRight = $('bodyIndentRight');
  el.autoLatinFont = $('autoLatinFont');
  el.enableToc = $('enableToc');
  el.tocTitle = $('tocTitle');
  el.tocLevels = $('tocLevels');
  el.pageBreakBeforeHeading = $('pageBreakBeforeHeading');
  el.templateName = $('templateName');
  el.templateVersion = $('templateVersion');
  el.clearTextBtn = $('clearTextBtn');
  el.clearFilesBtn = $('clearFilesBtn');
  el.footerFontSelect = $('footerFontSelect');
  el.titleFontSelect = $('titleFontSelect');
  el.subtitleFontSelect = $('subtitleFontSelect');
  el.bodyFontSelect = $('bodyFontSelect');
  el.latinFontSelect = $('latinFontSelect');
  el.titleBold = $('titleBold');
  el.subtitleBold = $('subtitleBold');
  el.h1FontSelect = $('h1FontSelect');
  el.h1Font = $('h1Font');
  el.h1Color = $('h1Color');
  el.h1Bold = $('h1Bold');
  el.h2FontSelect = $('h2FontSelect');
  el.h2Font = $('h2Font');
  el.h2Color = $('h2Color');
  el.h2Bold = $('h2Bold');
  el.h3FontSelect = $('h3FontSelect');
  el.h3Font = $('h3Font');
  el.h3Color = $('h3Color');
  el.h3Bold = $('h3Bold');
  el.h4FontSelect = $('h4FontSelect');
  el.h4Font = $('h4Font');
  el.h4Color = $('h4Color');
  el.h4Bold = $('h4Bold');
}

var FONT_OPTIONS = ['宋体','黑体','仿宋_GB2312','方正小标宋简体','楷体GB2312','Times New Roman'];
function syncFontSelect(selectEl, inputEl, value){
  if (!selectEl) return;
  var isCustom = FONT_OPTIONS.indexOf(value) === -1;
  selectEl.value = isCustom ? '__custom__' : value;
  if (inputEl) {
    inputEl.classList.toggle('hidden', !isCustom);
    inputEl.value = isCustom ? value : '';
  }
}
function getFontValue(selectEl, inputEl){
  if (!selectEl) return '';
  return selectEl.value === '__custom__' ? (inputEl ? inputEl.value.trim() : '') : selectEl.value;
}
function syncForm(){
  var s = state.settings;
  ['paperPreset','pageWidth','pageHeight','marginTop','marginRight','marginBottom','marginLeft','footerDistance','footerAlign','titleSize','titleLineSpacingPt','subtitleSize','subtitleLineSpacingPt','h1Size','h2Size','h3Size','h4Size','bodySize','bodyLineSpacingPt','firstLineIndent','bodyIndentLeft','bodyIndentRight','tocTitle','tocLevels','templateName','templateVersion'].forEach(function(id){ if (el[id]) el[id].value = s[id]; });
  syncFontSelect(el.footerFontSelect, el.footerFont, s.footerFont);
  syncFontSelect(el.titleFontSelect, el.titleFont, s.titleFont);
  syncFontSelect(el.subtitleFontSelect, el.subtitleFont, s.subtitleFont);
  syncFontSelect(el.bodyFontSelect, el.bodyFont, s.bodyFont);
  syncFontSelect(el.latinFontSelect, el.latinFont, s.latinFont);
  syncFontSelect(el.h1FontSelect, el.h1Font, s.h1Font);
  syncFontSelect(el.h2FontSelect, el.h2Font, s.h2Font);
  syncFontSelect(el.h3FontSelect, el.h3Font, s.h3Font);
  syncFontSelect(el.h4FontSelect, el.h4Font, s.h4Font);
  if (el.titleColor) el.titleColor.value = s.titleColor;
  if (el.subtitleColor) el.subtitleColor.value = s.subtitleColor;
  if (el.bodyColor) el.bodyColor.value = s.bodyColor;
  if (el.h1Color) el.h1Color.value = s.h1Color;
  if (el.h2Color) el.h2Color.value = s.h2Color;
  if (el.h3Color) el.h3Color.value = s.h3Color;
  if (el.h4Color) el.h4Color.value = s.h4Color;
  if (el.titleBold) el.titleBold.checked = s.titleBold;
  if (el.subtitleBold) el.subtitleBold.checked = s.subtitleBold;
  if (el.h1Bold) el.h1Bold.checked = s.h1Bold;
  if (el.h2Bold) el.h2Bold.checked = s.h2Bold;
  if (el.h3Bold) el.h3Bold.checked = s.h3Bold;
  if (el.h4Bold) el.h4Bold.checked = s.h4Bold;
  if (el.enablePageNumber) el.enablePageNumber.checked = s.enablePageNumber !== false;
  if (el.footerAlign) el.footerAlign.disabled = !(s.enablePageNumber !== false);
  if (el.footerDistance) el.footerDistance.disabled = !(s.enablePageNumber !== false);
  if (el.footerFontSelect) el.footerFontSelect.disabled = !(s.enablePageNumber !== false);
  if (el.footerFont) el.footerFont.disabled = !(s.enablePageNumber !== false);
  el.cleanBlank.checked = s.cleanBlankLines;
  el.fullWidth.checked = s.convertFullWidth;
  el.mdDetect.checked = s.autoDetectMarkdown;
  el.autoLatinFont.checked = s.autoLatinFont;
  el.enableToc.checked = s.enableToc;
  el.pageBreakBeforeHeading.checked = s.pageBreakBeforeHeading;
  el.templateBadge.textContent = s.templateName || '未加载模板';
}

function readForm(){
  return {
    paperPreset: el.paperPreset.value,
    pageWidth: Number(el.pageWidth.value),
    pageHeight: Number(el.pageHeight.value),
    marginTop: Number(el.marginTop.value),
    marginRight: Number(el.marginRight.value),
    marginBottom: Number(el.marginBottom.value),
    marginLeft: Number(el.marginLeft.value),
    enablePageNumber: el.enablePageNumber.checked,
    footerDistance: Number(el.footerDistance.value),
    footerAlign: el.footerAlign.value,
    footerFont: getFontValue(el.footerFontSelect, el.footerFont),
    titleFont: getFontValue(el.titleFontSelect, el.titleFont),
    titleColor: el.titleColor.value,
    titleSize: Number(el.titleSize.value),
    titleLineSpacingPt: Number(el.titleLineSpacingPt.value),
    titleBold: el.titleBold.checked,
    subtitleFont: getFontValue(el.subtitleFontSelect, el.subtitleFont),
    subtitleColor: el.subtitleColor.value,
    subtitleSize: Number(el.subtitleSize.value),
    subtitleLineSpacingPt: Number(el.subtitleLineSpacingPt.value),
    subtitleBold: el.subtitleBold.checked,
    h1Font: getFontValue(el.h1FontSelect, el.h1Font),
    h1Color: el.h1Color.value,
    h1Size: Number(el.h1Size.value),
    h1Bold: el.h1Bold.checked,
    h2Font: getFontValue(el.h2FontSelect, el.h2Font),
    h2Color: el.h2Color.value,
    h2Size: Number(el.h2Size.value),
    h2Bold: el.h2Bold.checked,
    h3Font: getFontValue(el.h3FontSelect, el.h3Font),
    h3Color: el.h3Color.value,
    h3Size: Number(el.h3Size.value),
    h3Bold: el.h3Bold.checked,
    h4Font: getFontValue(el.h4FontSelect, el.h4Font),
    h4Color: el.h4Color.value,
    h4Size: Number(el.h4Size.value),
    h4Bold: el.h4Bold.checked,
    bodyFont: getFontValue(el.bodyFontSelect, el.bodyFont),
    bodyColor: el.bodyColor.value,
    latinFont: getFontValue(el.latinFontSelect, el.latinFont),
    bodySize: Number(el.bodySize.value),
    bodyLineSpacingPt: Number(el.bodyLineSpacingPt.value),
    firstLineIndent: Number(el.firstLineIndent.value),
    bodyIndentLeft: Number(el.bodyIndentLeft.value),
    bodyIndentRight: Number(el.bodyIndentRight.value),
    autoLatinFont: el.autoLatinFont.checked,
    cleanBlankLines: el.cleanBlank.checked,
    convertFullWidth: el.fullWidth.checked,
    autoDetectMarkdown: el.mdDetect.checked,
    enableToc: el.enableToc.checked,
    tocTitle: el.tocTitle.value,
    tocLevels: el.tocLevels.value,
    pageBreakBeforeHeading: el.pageBreakBeforeHeading.checked,
    templateName: el.templateName.value,
    templateVersion: el.templateVersion.value
  };
}

function stylesXml(settings){
  var titleColor = String(settings.titleColor || '#000000').replace('#', '');
  var subtitleColor = String(settings.subtitleColor || titleColor).replace('#', '');
  var bodyColor = String(settings.bodyColor || '#000000').replace('#', '');
  var titleSpacing = Math.round(Number(settings.titleLineSpacingPt || 28) * 20);
  var bodySpacing = Math.round(Number(settings.bodyLineSpacingPt || 24) * 20);
  var subtitleSpacing = Math.round(Number(settings.subtitleLineSpacingPt || 24) * 20);
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.bodyFont) + '" w:hAnsi="' + escapeXml(settings.bodyFont) + '" w:eastAsia="' + escapeXml(settings.bodyFont) + '"/><w:color w:val="' + bodyColor + '"/><w:sz w:val="' + Math.round(Number(settings.bodySize) * 2) + '"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="' + bodySpacing + '" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:line="' + bodySpacing + '" w:lineRule="exact"/></w:pPr><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.bodyFont) + '" w:hAnsi="' + escapeXml(settings.bodyFont) + '" w:eastAsia="' + escapeXml(settings.bodyFont) + '"/><w:color w:val="' + bodyColor + '"/><w:sz w:val="' + Math.round(Number(settings.bodySize) * 2) + '"/></w:rPr></w:style>' + [1,2,3,4].map(function(level){ var size = Number(settings['h' + level + 'Size'] || settings.titleSize); var hfont = settings['h' + level + 'Font'] || settings.titleFont; var hcolor = String(settings['h' + level + 'Color'] || '#000000').replace('#', ''); var hbold = settings['h' + level + 'Bold'] !== false ? '<w:b/>' : ''; return '<w:style w:type="paragraph" w:styleId="Heading' + level + '"><w:name w:val="heading ' + level + '"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:line="' + titleSpacing + '" w:lineRule="exact"/></w:pPr><w:rPr><w:rFonts w:ascii="' + escapeXml(hfont) + '" w:hAnsi="' + escapeXml(hfont) + '" w:eastAsia="' + escapeXml(hfont) + '"/><w:color w:val="' + hcolor + '"/>' + hbold + '<w:sz w:val="' + Math.round(size * 2) + '"/></w:rPr></w:style>'; }).join('') + '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:line="' + subtitleSpacing + '" w:lineRule="exact"/></w:pPr><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.subtitleFont) + '" w:hAnsi="' + escapeXml(settings.subtitleFont) + '" w:eastAsia="' + escapeXml(settings.subtitleFont) + '"/><w:color w:val="' + subtitleColor + '"/>' + (settings.subtitleBold ? '<w:b/>' : '') + '<w:sz w:val="' + Math.round(Number(settings.subtitleSize) * 2) + '"/></w:rPr></w:style></w:styles>';
}

function buildDocumentXml(doc, settings){
  var titleColor = String(settings.titleColor || '#000000').replace('#', '');
  var subtitleColor = String(settings.subtitleColor || titleColor).replace('#', '');
  var bodyColor = String(settings.bodyColor || '#000000').replace('#', '');
  var titleSpacing = Math.round(Number(settings.titleLineSpacingPt || 28) * 20);
  var bodySpacing = Math.round(Number(settings.bodyLineSpacingPt || 24) * 20);
  var subtitleSpacing = Math.round(Number(settings.subtitleLineSpacingPt || 24) * 20);
  var parts = [];

  if (doc.hasTitle && doc.title) {
    parts.push('<w:p><w:pPr><w:jc w:val="center"/><w:keepNext/><w:spacing w:line="' + titleSpacing + '" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.titleFont) + '" w:hAnsi="' + escapeXml(settings.titleFont) + '" w:eastAsia="' + escapeXml(settings.titleFont) + '"/><w:color w:val="' + titleColor + '"/>' + (settings.titleBold ? '<w:b/>' : '') + '<w:sz w:val="' + Math.round(Number(settings.titleSize) * 2) + '"/></w:rPr><w:t>' + escapeXml(doc.title) + '</w:t></w:r></w:p>');
  }

  if (settings.enableToc && doc.outline.length) {
    parts.push('<w:p><w:pPr><w:jc w:val="center"/><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="' + escapeXml(settings.titleFont) + '" w:hAnsi="' + escapeXml(settings.titleFont) + '" w:eastAsia="' + escapeXml(settings.titleFont) + '"/><w:color w:val="' + titleColor + '"/><w:sz w:val="' + Math.round(Number(settings.titleSize) * 2) + '"/></w:rPr><w:t>' + escapeXml(settings.tocTitle) + '</w:t></w:r></w:p>');
    var tocLevels = parseTocLevels(settings.tocLevels);
    doc.outline.forEach(function(item){
      if (!tocLevels.has(item.level)) return;
      parts.push('<w:p><w:pPr><w:ind w:left="' + ((item.level - 1) * 360) + '"/><w:spacing w:line="' + bodySpacing + '" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.bodyFont) + '" w:hAnsi="' + escapeXml(settings.bodyFont) + '" w:eastAsia="' + escapeXml(settings.bodyFont) + '"/><w:color w:val="' + bodyColor + '"/><w:sz w:val="' + Math.round(Number(settings.bodySize) * 2) + '"/></w:rPr><w:t>' + escapeXml(item.text) + '</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.bodyFont) + '" w:hAnsi="' + escapeXml(settings.bodyFont) + '" w:eastAsia="' + escapeXml(settings.bodyFont) + '"/><w:color w:val="' + bodyColor + '"/><w:sz w:val="' + Math.round(Number(settings.bodySize) * 2) + '"/></w:rPr><w:t xml:space="preserve"> ...... ' + item.page + '</w:t></w:r></w:p>');
    });
    parts.push('<w:p><w:r><w:br/></w:r></w:p>');
  }

  doc.blocks.forEach(function(block){
    if (block.type === 'heading') {
      var level = clamp(block.level || 1, 1, 4);
      var hsize = Number(settings['h' + level + 'Size'] || settings.titleSize);
      var hfont = settings['h' + level + 'Font'] || settings.titleFont;
      var hcolor = String(settings['h' + level + 'Color'] || titleColor).replace('#', '');
      var hbold = settings['h' + level + 'Bold'] !== false ? '<w:b/>' : '';
      parts.push('<w:p><w:pPr><w:pStyle w:val="Heading' + level + '"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="' + escapeXml(hfont) + '" w:hAnsi="' + escapeXml(hfont) + '" w:eastAsia="' + escapeXml(hfont) + '"/><w:color w:val="' + hcolor + '"/>' + hbold + '<w:sz w:val="' + Math.round(hsize * 2) + '"/></w:rPr><w:t>' + escapeXml(block.text) + '</w:t></w:r></w:p>');
      return;
    }
    if (block.type === 'list') {
      parts.push('<w:p><w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:line="' + bodySpacing + '" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.bodyFont) + '" w:hAnsi="' + escapeXml(settings.bodyFont) + '" w:eastAsia="' + escapeXml(settings.bodyFont) + '"/><w:color w:val="' + bodyColor + '"/><w:sz w:val="' + Math.round(Number(settings.bodySize) * 2) + '"/></w:rPr><w:t>• ' + escapeXml(block.text) + '</w:t></w:r></w:p>');
      return;
    }
    var first = settings.firstLineIndent ? ' w:firstLine="' + Math.round(settings.firstLineIndent * 180) + '"' : '';
    parts.push('<w:p><w:pPr><w:ind w:left="' + Math.round(settings.bodyIndentLeft * 56.7) + '" w:right="' + Math.round(settings.bodyIndentRight * 56.7) + '"' + first + '/><w:spacing w:line="' + bodySpacing + '" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="' + escapeXml(settings.bodyFont) + '" w:hAnsi="' + escapeXml(settings.bodyFont) + '" w:eastAsia="' + escapeXml(settings.bodyFont) + '"/><w:color w:val="' + bodyColor + '"/><w:sz w:val="' + Math.round(Number(settings.bodySize) * 2) + '"/></w:rPr><w:t>' + escapeXml(block.text) + '</w:t></w:r></w:p>');
  });

  var w = Math.round(settings.pageWidth * 56.7);
  var h = Math.round(settings.pageHeight * 56.7);
  var footerRefs = '';
  if (settings.enablePageNumber !== false) {
    footerRefs = '<w:footerReference w:type="default" r:id="rFooter1"/>' + (settings.footerAlign === 'oddEven' ? '<w:footerReference w:type="even" r:id="rFooter2"/>' : '');
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + parts.join('') + '<w:sectPr>' + footerRefs + '<w:pgSz w:w="' + w + '" w:h="' + h + '"/><w:pgMar w:top="' + Math.round(settings.marginTop * 56.7) + '" w:right="' + Math.round(settings.marginRight * 56.7) + '" w:bottom="' + Math.round(settings.marginBottom * 56.7) + '" w:left="' + Math.round(settings.marginLeft * 56.7) + '" w:footer="' + Math.round(settings.footerDistance * 56.7) + '" w:gutter="0"/></w:sectPr></w:body></w:document>';
}

function renderAll(){ renderQueue(); renderPreview(); updateStats(); }
function bindEvents(){
  el.textInput.addEventListener('input', debounce(function(){
    var text = cleanInputText(el.textInput.value);
    el.textInput.value = text;
    el.countLabel.textContent = text.length + ' / 20000';
    updateClipboardDoc();
    saveCurrentSettings();
    renderAll();
  }, 250));

  [el.cleanBlank, el.fullWidth, el.mdDetect].forEach(function(node){
    node.addEventListener('change', function(){
      saveCurrentSettings();
      updateClipboardDoc();
      renderAll();
    });
  });

  ['paperPreset','enablePageNumber','pageWidth','pageHeight','marginTop','marginRight','marginBottom','marginLeft','footerDistance','footerAlign','titleSize','titleLineSpacingPt','subtitleSize','subtitleLineSpacingPt','h1Size','h2Size','h3Size','h4Size','bodySize','bodyLineSpacingPt','firstLineIndent','bodyIndentLeft','bodyIndentRight','autoLatinFont','enableToc','tocTitle','tocLevels','pageBreakBeforeHeading','templateName','templateVersion'].forEach(function(id){
    if (!el[id]) return;
    el[id].addEventListener(el[id].type === 'checkbox' || el[id].type === 'color' ? 'change' : 'input', debounce(function(){
      saveCurrentSettings();
      if (id === 'paperPreset' && PAPER[el.paperPreset.value]) {
        state.settings.pageWidth = PAPER[el.paperPreset.value].width;
        state.settings.pageHeight = PAPER[el.paperPreset.value].height;
        syncForm();
        saveSettings();
      }
      if (id === 'enablePageNumber' || id === 'footerAlign') syncForm();
      renderAll();
    }, 180));
  });

  ['titleColor','subtitleColor','bodyColor','h1Color','h2Color','h3Color','h4Color'].forEach(function(id){
    if (!el[id]) return;
    el[id].addEventListener('change', debounce(function(){
      saveCurrentSettings();
      renderAll();
    }, 180));
  });

  ['titleBold','subtitleBold','h1Bold','h2Bold','h3Bold','h4Bold'].forEach(function(id){
    if (!el[id]) return;
    el[id].addEventListener('change', function(){
      saveCurrentSettings();
      renderAll();
    });
  });

  [['footerFontSelect','footerFont'],['titleFontSelect','titleFont'],['subtitleFontSelect','subtitleFont'],['bodyFontSelect','bodyFont'],['latinFontSelect','latinFont'],['h1FontSelect','h1Font'],['h2FontSelect','h2Font'],['h3FontSelect','h3Font'],['h4FontSelect','h4Font']].forEach(function(pair){
    var sel = el[pair[0]];
    var inp = el[pair[1]];
    if (sel) {
      sel.addEventListener('change', function(){
        var isCustom = sel.value === '__custom__';
        if (inp) inp.classList.toggle('hidden', !isCustom);
        saveCurrentSettings();
        renderAll();
      });
    }
    if (inp) {
      inp.addEventListener('input', debounce(function(){
        saveCurrentSettings();
        renderAll();
      }, 250));
    }
  });

  el.pickFilesBtn.addEventListener('click', function(){ el.fileInput.click(); });
  el.fileInput.addEventListener('change', function(){ if (el.fileInput.files && el.fileInput.files.length) addQueueFiles(el.fileInput.files); el.fileInput.value = ''; });
  el.exportCurrentBtn.addEventListener('click', exportCurrent);
  el.exportAllBtn.addEventListener('click', exportAll);
  el.downloadLogsBtn.addEventListener('click', downloadLogs);
  el.openOutputBtn.addEventListener('click', openOutputFolder);
  el.saveTemplateBtn.addEventListener('click', saveTemplateCurrent);
  el.saveTemplateBtn2.addEventListener('click', saveTemplateCurrent);
  el.importTemplateBtn.addEventListener('click', importTemplate);
  el.prevPageBtn.addEventListener('click', function(){ state.pageIndex = Math.max(0, state.pageIndex - 1); renderPreview(); });
  el.nextPageBtn.addEventListener('click', function(){ var doc = getActiveDoc(); var total = doc && doc.pages ? doc.pages.length : 1; state.pageIndex = Math.min(total - 1, state.pageIndex + 1); renderPreview(); });
  el.zoomOutBtn.addEventListener('click', function(){ state.zoom = clamp(state.zoom - 10, 50, 200); renderPreview(); });
  el.zoomInBtn.addEventListener('click', function(){ state.zoom = clamp(state.zoom + 10, 50, 200); renderPreview(); });
  document.body.addEventListener('dragover', function(e){ e.preventDefault(); });
  document.body.addEventListener('drop', function(e){ e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addQueueFiles(e.dataTransfer.files); });

  el.queueList.addEventListener('click', function(e){
    var rbtn = e.target.closest('[data-remove]');
    if (rbtn) {
      var rid = rbtn.getAttribute('data-remove');
      var idx = state.queue.findIndex(function(q){ return q.id === rid; });
      if (idx >= 0) {
        var removed = state.queue.splice(idx, 1)[0];
        if (removed && removed.result) state.docs = state.docs.filter(function(d){ return d.id !== removed.result.id; });
      }
      renderAll();
      log('INFO', '队列项已移除', { id: rid });
    }
  });

  if (el.clearTextBtn) {
    el.clearTextBtn.addEventListener('click', function(){
      if (!el.textInput.value.trim()) return;
      if (!confirm('确认清空文本输入区？此操作不可撤销。')) return;
      el.textInput.value = '';
      el.countLabel.textContent = '0 / 20000';
      state.docs = state.docs.filter(function(d){ return d.sourceType !== 'clipboard'; });
      if (state.activeId && !state.docs.find(function(d){ return d.id === state.activeId; })) {
        state.activeId = state.docs.length ? state.docs[0].id : null;
      }
      state.pageIndex = 0;
      renderAll();
      log('INFO', '文本输入已清空');
    });
  }

  if (el.clearFilesBtn) {
    el.clearFilesBtn.addEventListener('click', function(){
      if (!state.queue.length) return;
      if (!confirm('确认清除所有文件队列？此操作不可撤销。')) return;
      state.queue = [];
      state.docs = state.docs.filter(function(d){ return d.sourceType === 'clipboard'; });
      if (state.activeId && !state.docs.find(function(d){ return d.id === state.activeId; })) {
        state.activeId = state.docs.length ? state.docs[0].id : null;
      }
      state.pageIndex = 0;
      renderAll();
      log('INFO', '文件队列已清空');
    });
  }

  var coffeeLink = document.getElementById('coffeeLink');
  var qrOverlay = document.getElementById('qrOverlay');
  if (coffeeLink && qrOverlay) {
    coffeeLink.addEventListener('click', function(){ qrOverlay.classList.remove('hidden'); });
  }
}

function init(){
  initDom();
  populateAllSizeOptions();
  if (!state.templates.length) state.templates = PRESETS.map(function(p){ return { name: p.name, version: p.version, settings: p.settings }; });
  saveTemplates();
  syncForm();
  syncCssVars();
  updateClipboardDoc();
  bindEvents();
  renderAll();
  setStatus('等待输入内容。');
  window.addEventListener('beforeunload', function(){ saveSettings(); saveLogs(); saveTemplates(); });
}

init();
})();
