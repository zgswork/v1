(function() {

function range(base) {
  return Array.from({length: 26}, (_, i) => base + i);
}

function makeMap(upperCP, lowerCP) {
  const m = {};
  for (let i = 0; i < 26; i++) {
    const uc = upperCP[i];
    const lc = lowerCP[i];
    if (uc != null) m[String.fromCharCode(65 + i)] = String.fromCodePoint(uc);
    if (lc != null) m[String.fromCharCode(97 + i)] = String.fromCodePoint(lc);
  }
  return m;
}

function makeMapRaw(upperStr, lowerStr) {
  const m = {};
  for (let i = 0; i < 26; i++) {
    m[String.fromCharCode(65 + i)] = upperStr[i];
    m[String.fromCharCode(97 + i)] = lowerStr[i];
  }
  return m;
}

const styles = [
  {
    name: '粗体',
    map: makeMap(range(0x1D400), range(0x1D41A))
  },
  {
    name: '斜体',
    map: makeMap(range(0x1D434), range(0x1D44E))
  },
  {
    name: '粗斜体',
    map: makeMap(range(0x1D468), range(0x1D482))
  },
  {
    name: '手写体',
    map: makeMap(range(0x1D4D0), range(0x1D4EA))
  },
  {
    name: '哥特体',
    map: makeMap(
      [0x1D504, 0x1D505, 0x212D, 0x1D507, 0x1D508, 0x1D509, 0x1D50A,
       0x210C, 0x2111, 0x1D50D, 0x1D50E, 0x1D50F, 0x1D510, 0x1D511,
       0x1D512, 0x1D513, 0x1D514, 0x211C, 0x1D516, 0x1D517, 0x1D518,
       0x1D519, 0x1D51A, 0x1D51B, 0x1D51C, 0x2128],
      range(0x1D51E)
    )
  },
  {
    name: '双线体',
    map: makeMap(
      [0x1D538, 0x1D539, 0x2102, 0x1D53D, 0x1D53E, 0x1D53F, 0x1D540,
       0x210D, 0x1D546, 0x1D54A, 0x1D54B, 0x1D54C, 0x1D54D, 0x2115,
       null, 0x2119, 0x211A, 0x211D, null, null, null,
       null, null, null, null, 0x2124],
      range(0x1D552)
    )
  },
  {
    name: '圆圈体',
    map: makeMap(range(0x24B6), range(0x24D0))
  },
  {
    name: '全角',
    map: makeMap(range(0xFF21), range(0xFF41))
  },
  {
    name: '小型大写',
    map: makeMapRaw(
      'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqꜱᴛᴜᴠᴡxʏᴢ',
      'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqꜱᴛᴜᴠᴡxʏᴢ'
    )
  }
];

function convert(text, map) {
  return text.split('').map(ch => map[ch] || ch).join('');
}

const inputEl = document.getElementById('input');
const gridEl = document.getElementById('resultGrid');
const countEl = document.getElementById('inputCount');
const clearBtn = document.getElementById('clearBtn');

function render() {
  const text = inputEl.value;
  countEl.textContent = text.length;

  gridEl.innerHTML = '';
  styles.forEach(style => {
    const result = convert(text, style.map);
    const card = document.createElement('div');
    card.className = 'result-card';

    const nameEl = document.createElement('div');
    nameEl.className = 'style-name';
    nameEl.textContent = style.name;

    const resultEl = document.createElement('div');
    resultEl.className = 'style-result' + (result ? '' : ' empty');
    resultEl.textContent = result || '（输入文本后显示结果）';

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', function() {
      if (!result) return;
      navigator.clipboard.writeText(result).then(() => {
        this.textContent = '已复制';
        this.classList.add('copied');
        setTimeout(() => {
          this.textContent = '复制';
          this.classList.remove('copied');
        }, 1500);
      }).catch(() => {});
    });
    actions.appendChild(copyBtn);

    card.appendChild(nameEl);
    card.appendChild(resultEl);
    card.appendChild(actions);
    gridEl.appendChild(card);
  });
}

inputEl.addEventListener('input', render);
clearBtn.addEventListener('click', function() {
  inputEl.value = '';
  render();
  inputEl.focus();
});

render();

})();
