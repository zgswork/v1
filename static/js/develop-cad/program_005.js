// —— 模块：文字 ——
const program_005 = {
    title: '文字',
    fields: [[{ id: 'hgt', label: '字高', type: 'number', def: 5 },
    { id: 'text', label: '文字内容', type: 'text', def: '示例文字' },
    { id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const hgt = num(v.hgt, 5), txt = q(v.text || 'TEXT'), layer = q(v.layer || '0');
        return `(progn (setq pt (getpoint "\\n[文字] 插入点: "))(entmake (list '(0 . "TEXT") (cons 10 pt) (cons 11 pt) (cons 40 ${hgt}) (cons 1 "${txt}") (cons 8 "${layer}")))(princ "\\n已写文字"))`;
    }
};