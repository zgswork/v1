// —— 模块：直线 ——
const program_002 = {
    title: '直线',
    fields: [[{ id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const layer = q(v.layer || '0');
        return `(progn (setq p1 (getpoint "\\n[直线] 起点: ")) (setq p2 (getpoint "\\n[直线] 终点: "))(entmake (list '(0 . "LINE") (cons 10 p1) (cons 11 p2) (cons 8 "${layer}"))) (princ "\\n已画直线"))`;
    }
};