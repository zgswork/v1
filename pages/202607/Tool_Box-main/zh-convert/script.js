const input = document.getElementById('input');
const output = document.getElementById('output');
const inputCount = document.getElementById('inputCount');
const outputCount = document.getElementById('outputCount');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const swapBtn = document.getElementById('swapBtn');
const labelFrom = document.getElementById('labelFrom');
const labelTo = document.getElementById('labelTo');
const inputLabel = document.getElementById('inputLabel');
const outputLabel = document.getElementById('outputLabel');
const themeToggle = document.getElementById('themeToggle');

let isS2T = true;
let converterS2T = null;
let converterT2S = null;

function initConverters() {
    converterS2T = OpenCC.Converter({ from: 'cn', to: 'tw' });
    converterT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });
}

function convert() {
    const text = input.value;
    if (!text) {
        output.value = '';
        inputCount.textContent = '0';
        outputCount.textContent = '0';
        return;
    }
    const result = isS2T ? converterS2T(text) : converterT2S(text);
    output.value = result;
    inputCount.textContent = text.length;
    outputCount.textContent = result.length;
}

function swapDirection() {
    isS2T = !isS2T;
    labelFrom.textContent = isS2T ? '简体' : '繁体';
    labelTo.textContent = isS2T ? '繁体' : '简体';
    inputLabel.textContent = isS2T ? '简体原文' : '繁体原文';
    outputLabel.textContent = isS2T ? '繁体结果' : '简体结果';
    input.placeholder = isS2T ? '在此输入简体文本...' : '在此输入繁体文本...';
    output.placeholder = isS2T ? '繁体结果将在此显示...' : '简体结果将在此显示...';
    convert();
}

copyBtn.addEventListener('click', async () => {
    const text = output.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '已复制!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.textContent = '复制结果';
            copyBtn.classList.remove('copied');
        }, 1500);
    } catch {
        output.select();
        document.execCommand('copy');
        copyBtn.textContent = '已复制!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.textContent = '复制结果';
            copyBtn.classList.remove('copied');
        }, 1500);
    }
});

clearBtn.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    inputCount.textContent = '0';
    outputCount.textContent = '0';
});

swapBtn.addEventListener('click', swapDirection);

input.addEventListener('input', convert);

// Theme
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.innerHTML = theme === 'light' ? '&#9790;' : '&#9788;';
    localStorage.setItem('zh-convert-theme', theme);
}
const savedTheme = localStorage.getItem('zh-convert-theme');
if (savedTheme) {
    setTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    setTheme('light');
}
themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
});

initConverters();
