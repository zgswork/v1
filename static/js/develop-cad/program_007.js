// —— 模块：线性标注 ——
const program_007 = {
    title: '线性标注',
    fields: [[{ id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const layer = q(v.layer || '0');
        return `(progn (setq p1 (getpoint "\\n[标注] 第一点: ")) (setq p2 (getpoint "\\n[标注] 第二点: "))(setq loc (getpoint "\\n[标注] 尺寸线位置: ")) (command "_.DIMLINEAR" p1 p2 loc) (princ "\\n已标注"))`;
    }
};