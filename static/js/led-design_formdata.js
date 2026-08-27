/* =======================
   LED显示屏 表单结构数据配置
   通过修改本文件即可扩展/调整表单字段，无需改动 HTML 和主逻辑
   ======================= */

const FORM_CONFIG = {
    // ===== 表单标题与声明 =====
    title: 'LED显示屏 模组 安装结构设计',
    titleSuffix: 'V1.20.0 by 笙',
    notice: [
        '1、本应用仅适用于模组磁吸平面前维护钢结构；',
        '2、输出的文件仅供参考，不得作为施工依据，默认同意本声明，否则请放弃使用。'
    ],

    // ===== 行(row)定义 =====
    // 每一行是一个 row 对象，包含若干 field
    // field 支持的通用属性:
    //   type      : 'select' | 'number' | 'text' | 'checkbox'
    //   id        : DOM id (同时作为 FormData 的 name)
    //   label     : 显示标签
    //   value     : 默认值(可选)
    //   readonly  : 是否只读(可选, boolean)
    //   disabled  : 是否禁用(可选, boolean)
    //   min/step  : number 类型专用(可选)
    //   optionsKey: select 类型专用, 对应 LED_DATA 中的键名(可选)
    //              如果提供, 初始化时自动填充下拉选项
    //              如果不提供, 下拉选项由 initSelect 在级联逻辑中填充
    //   hidden    : 是否初始隐藏(可选, boolean), 用于"自动推荐"等条件控制
    //   onChange  : 关联的回调名(字符串), 由主逻辑注册(可选)
    //
    // 条件行(conditionalRow):
    //   key   : 用于 JS 控制显示/隐藏的 id
    //   showWhen: 触发显示的条件说明(注释用)
    //   rows  : 该行内部包含的子 row 数组(结构同外层 rows)

    rows: [
        // ===== 第一行 =====
        {
            fields: [
                { type: 'select', id: 'snhw', label: '室内户外', optionsKey: '室内户外', value: '室内' },
                { type: 'select', id: 'cpxl', label: '产品系列' },
                { type: 'select', id: 'cpxh', label: '产品型号' },
                { type: 'number', id: 'pdjj', label: '屏点间距', readonly: true },
            ]
        },
        // ===== 第二行 =====
        {
            fields: [
                { type: 'number', id: 'dycd', label: '单元长度' },
                { type: 'number', id: 'dygd', label: '单元高度' },
                { type: 'number', id: 'bbsb', label: '包边上边' },
                { type: 'select', id: 'azys', label: '安装样式', optionsKey: '安装样式', value: '壁挂' },
            ]
        },
        // ===== 第三行 =====
        {
            fields: [
                { type: 'number', id: 'plls', label: '排列列数', value: 10, min: 1, step: 1 },
                { type: 'number', id: 'plhs', label: '排列行数', value: 10, min: 1, step: 1 },
                { type: 'number', id: 'bbxb', label: '包边下边' },
                { type: 'number', id: 'bbcb', label: '包边侧边' },
            ]
        },
        // ===== 第四行 =====
        {
            fields: [
                { type: 'number', id: 'dyhd', label: '单元厚度' },
                { type: 'number', id: 'pthd', label: '屏体厚度', value: 100 },
                { type: 'number', id: 'ldgd', label: '离地高度' },
                { type: 'number', id: 'jlwd', label: '距离屋顶' },
            ]
        },
        // ===== 第五行 =====
        {
            fields: [
                { type: 'number', id: 'xscd', label: '显示长度', readonly: true },
                { type: 'number', id: 'xsgd', label: '显示高度', readonly: true },
                { type: 'select', id: 'flmj', label: '法兰埋件', optionsKey: '法兰埋件', value: '150*150*8埋件' },
                { type: 'select', id: 'xmqy', label: '项目区域', optionsKey: '项目区域', value: '国内' },
            ]
        },
    ],

    // ===== 条件行(由复选框控制显示/隐藏) =====
    conditionalRows: [
        {
            key: 'rowSteelX',                    // 外层包裹 div 的 id
            showWhen: '!zdtj (自动推荐未勾选时显示)',
            rows: [
                // 第六行
                {
                    fields: [
                        { type: 'number', id: 'mjhj', label: '埋件横距', value: 1216 },
                        { type: 'number', id: 'mjsj', label: '埋件竖距', value: 1500 },
                    ]
                },
                // 第七行
                {
                    fields: [
                        { type: 'text', id: 'dybt', label: '单元背条' },
                        { type: 'text', id: 'bthg', label: '背条横杆' },
                        { type: 'text', id: 'ntlg', label: '牛腿连杆' },
                        { type: 'text', id: 'sphg', label: '水平横杆' },
                    ]
                },
            ]
        }
    ],

    // ===== 复选框行 =====
    // checked: 初始是否勾选  |  disabled: 初始是否禁用(永久禁用)
    checkboxRow: {
        fields: [
            { type: 'checkbox', id: 'psyt', label: '屏示意图', checked: true },
            { type: 'checkbox', id: 'pggt', label: '屏钢构图', checked: true },
            { type: 'checkbox', id: 'zdtj', label: '自动推荐', checked: true },
            { type: 'checkbox', id: 'cltj', label: '材料统计', disabled: true },
            { type: 'checkbox', id: 'dxft', label: 'DXF图纸',  checked: true },
            { type: 'checkbox', id: 'pdft', label: 'PDF图纸',  disabled: true },
        ]
    },

    // ===== 按钮行 =====
    buttons: [
        { id: 'drawBtn',     label: '绘图',  action: 'drawDxf' },
        { id: 'showAlertBtn', label: '关于',  action: 'showAlert' },
        { id: 'closeBtn',    label: '取消',  action: 'closePage' },
    ],

    // ===== 状态信息区域 =====
    statusArea: {
        msgId: 'msg',
        histId: 'hist',
    },
};

/* =======================
   表单渲染引擎
   读取 FORM_CONFIG 自动生成 HTML 并插入 DOM
   ======================= */
function renderForm(containerId) {
    const cfg = FORM_CONFIG;
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';

    // 标题
    html += `<h2>${cfg.title} <span style="font-size:.5em;font-weight:normal;">${cfg.titleSuffix}</span></h2>\n`;

    // 声明
    html += `<h5>*声明：<br>${cfg.notice.map(n => n).join('<br>')}</h5>\n`;

    // 普通行
    cfg.rows.forEach(row => {
        html += renderRow(row);
    });

    // 条件行
    if (cfg.conditionalRows && cfg.conditionalRows.length) {
        cfg.conditionalRows.forEach(cond => {
            html += `<div id="${cond.key}">\n`;
            html += `  <div class="divider-line"></div>\n`;
            cond.rows.forEach(row => {
                html += renderRow(row, '  ');
            });
            html += `</div>\n`;
        });
    }

    // 分隔线 + 复选框行
    html += `<div class="divider-line"></div>\n`;
    html += `<div class="row checkbox-row">\n`;
    cfg.checkboxRow.fields.forEach(f => {
        const checked = f.checked ? ' checked' : '';
        const disabled = f.disabled ? ' disabled' : '';
        html += `    <label class="steel-label"><input type="checkbox" id="${f.id}" name="${f.id}"${checked}${disabled}>${f.label}</label>\n`;
    });
    html += `</div>\n`;

    // 分隔线 + 按钮行
    html += `<div class="divider-line"></div>\n`;
    html += `<div class="btn-row">\n`;
    cfg.buttons.forEach(b => {
        html += `    <button id="${b.id}" name="${b.id}" onclick="${b.action}()">${b.label}</button>\n`;
    });
    html += `</div>\n`;

    // 状态信息
    html += `<div class="divider-line"></div>\n`;
    html += `<div id="${cfg.statusArea.msgId}" name="${cfg.statusArea.msgId}" class="hidden"></div>\n`;
    html += `<ol id="${cfg.statusArea.histId}" name="${cfg.statusArea.histId}" class="hidden"></ol>\n`;

    container.innerHTML = html;

    // 渲染完成后, 触发初始下拉框填充
    initFormSelects();
}

/* 渲染单行 */
function renderRow(row, indent = '') {
    let h = `${indent}<div class="row">\n`;
    row.fields.forEach(f => {
        h += `${indent}    <label>${f.label}</label>`;
        h += renderField(f);
        h += `\n`;
    });
    h += `${indent}</div>\n`;
    return h;
}

/* 渲染单个字段(input/select) */
function renderField(f) {
    const readonly = f.readonly ? ' readonly class="readonly"' : '';
    const disabled = f.disabled ? ' disabled' : '';
    const valueAttr = f.value !== undefined ? ` value="${f.value}"` : '';
    const minAttr = f.min !== undefined ? ` min="${f.min}"` : '';
    const stepAttr = f.step !== undefined ? ` step="${f.step}"` : '';

    if (f.type === 'select') {
        return `<select id="${f.id}" name="${f.id}"${disabled}></select>`;
    } else if (f.type === 'number') {
        return `<input id="${f.id}" name="${f.id}" type="number"${valueAttr}${minAttr}${stepAttr}${readonly}>`;
    } else if (f.type === 'text') {
        return `<input id="${f.id}" name="${f.id}" type="text"${valueAttr}${readonly}>`;
    }
    // 兜底
    return `<input id="${f.id}" name="${f.id}"${valueAttr}>`;
}

/* 根据配置初始化所有带 optionsKey 的下拉框 */
function initFormSelects() {
    const cfg = FORM_CONFIG;
    const allFields = [];

    // 收集所有 field
    cfg.rows.forEach(r => r.fields.forEach(f => allFields.push(f)));
    if (cfg.conditionalRows) {
        cfg.conditionalRows.forEach(cond => {
            cond.rows.forEach(r => r.fields.forEach(f => allFields.push(f)));
        });
    }

    // 填充下拉选项
    allFields.forEach(f => {
        if (f.type === 'select' && f.optionsKey) {
            initSelect(f.id, f.optionsKey, f.value);
        }
    });
}

/*
 * 自包含的 initSelect（渲染引擎内部使用）
 * 注意：此函数与 led-design_app.js 中的 initSelect 逻辑一致，
 *       但独立存在以确保渲染引擎不依赖任何外部脚本。
 *       如果 app.js 先加载，它的同名函数会覆盖此函数（行为一致，无副作用）。
 */
function initSelect(selectId, dataKey, defaultValue) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const list = (typeof LED_DATA !== 'undefined') ? LED_DATA[dataKey] : null;
    if (!Array.isArray(list)) return;
    sel.innerHTML = '';
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        sel.appendChild(opt);
    });
    if (defaultValue !== undefined) { sel.value = defaultValue; }
}
