const input = document.getElementById('input');
const clearBtn = document.getElementById('clearBtn');
const charCountLive = document.getElementById('charCountLive');
const statsGrid = document.getElementById('statsGrid');

const STATS = [
    { key: 'chars', label: '总字符数（含空格）' },
    { key: 'charsNoSpace', label: '总字符数（不含空格）' },
    { key: 'cjk', label: '中文字数' },
    { key: 'words', label: '单词数' },
    { key: 'lines', label: '行数' },
    { key: 'paragraphs', label: '段落数' },
    { key: 'numbers', label: '数字数' },
    { key: 'punctuation', label: '标点数' },
    { key: 'readTime', label: '阅读时间' },
    { key: 'longestLine', label: '最长行' },
    { key: 'shortestLine', label: '最短行' },
];

function calc(text) {
    const chars = text.length;
    const charsNoSpace = text.replace(/[\s]/g, '').length;
    const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
    const words = text.trim() ? (text.trim().split(/[\s]+/).length) : 0;
    const lines = text ? text.split('\n').length : 0;
    const paragraphs = text ? text.split(/\n\s*\n/).filter(p => p.trim()).length : 0;
    const numbers = (text.match(/[0-9]/g) || []).length;
    const punctuation = (text.match(/[，。！？、；：""''（）【】《》——……·,.\!?;:()\[\]{}""''<>\/\-_@#$%^&*~`]/g) || []).length;

    const cjkReadTime = Math.ceil(cjk / 300);
    const enReadTime = Math.ceil(words / 200);
    const readTime = cjkReadTime + enReadTime;
    const readTimeStr = readTime === 0 ? '< 1 分钟' : `约 ${readTime} 分钟`;

    const linesArr = text.split('\n');
    let longestLen = 0, shortestLen = Infinity;
    for (const l of linesArr) {
        const len = l.length;
        if (len > longestLen) longestLen = len;
        if (len < shortestLen) shortestLen = len;
    }
    if (linesArr.length <= 1) shortestLen = longestLen;

    return { chars, charsNoSpace, cjk, words, lines, paragraphs, numbers, punctuation, readTime: readTimeStr, longestLine: longestLen + ' 字符', shortestLine: shortestLen + ' 字符' };
}

function render() {
    const data = calc(input.value);
    charCountLive.textContent = data.chars;
    statsGrid.innerHTML = STATS.map(s => `<div class="stat-card"><div class="value">${data[s.key]}</div><div class="label">${s.label}</div></div>`).join('');
}

clearBtn.addEventListener('click', () => { input.value = ''; render(); });
input.addEventListener('input', render);
render();
