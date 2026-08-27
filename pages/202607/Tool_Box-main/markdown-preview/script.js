const input = document.getElementById('input');
const preview = document.getElementById('preview');
const clearBtn = document.getElementById('clearBtn');
const copyMdBtn = document.getElementById('copyMdBtn');
const copyHtmlBtn = document.getElementById('copyHtmlBtn');
const downloadMdBtn = document.getElementById('downloadMdBtn');
const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const lineCount = document.getElementById('lineCount');

const SAMPLE = `# Hello Markdown

这是一个 **Markdown** 实时预览工具，支持 GFM（GitHub Flavored Markdown）语法。

## 文本样式

**粗体** · *斜体* · ~~删除线~~ · \`行内代码\`

## 代码块

\`\`\`javascript
function greet(name) {
  const msg = \`Hello, \${name}!\`;
  console.log(msg);
  return msg;
}
\`\`\`

\`\`\`python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## 表格

| 功能 | 是否支持 | 备注 |
|------|----------|------|
| GFM 表格 | ✅ | 支持对齐 |
| 语法高亮 | ✅ | highlight.js |
| 任务列表 | ✅ | GFM 扩展 |

## 引用

> 简洁即优雅。
>
> —— 写代码的哲学

## 任务列表

- [x] 已完成任务
- [ ] 待完成任务
- [ ] 优先级高

## 列表

1. 第一项
2. 第二项
3. 第三项

- 无序项 A
- 无序项 B
- 无序项 C

---

试试在左侧编辑这段内容！
`;

function render() {
    const text = input.value;
    const html = marked.parse(text, { breaks: true, gfm: true });
    preview.innerHTML = html;
    preview.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));

    const chars = text.length;
    const words = text.trim() ? text.trim().split(/[\s]+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    charCount.textContent = chars;
    wordCount.textContent = words;
    lineCount.textContent = lines;
}

function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ 已复制';
        setTimeout(() => btn.textContent = orig, 1200);
    }).catch(() => {
        const orig = btn.textContent;
        btn.textContent = '✗ 失败';
        setTimeout(() => btn.textContent = orig, 1200);
    });
}

input.addEventListener('input', render);

clearBtn.addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
});

copyMdBtn.addEventListener('click', () => copyText(input.value, copyMdBtn));
copyHtmlBtn.addEventListener('click', () => copyText(preview.innerHTML, copyHtmlBtn));
downloadMdBtn.addEventListener('click', () => download(input.value, 'markdown.md', 'text/markdown'));
downloadHtmlBtn.addEventListener('click', () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Markdown</title></head><body>${preview.innerHTML}</body></html>`;
    download(html, 'markdown.html', 'text/html');
});

input.value = SAMPLE;
render();
