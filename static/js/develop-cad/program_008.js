// —— 模块：矩形阵列 ——
const program_008 = {
    title: '矩形阵列',
    fields: [[{ id: 'rows', label: '行', type: 'number', def: 3 },
    { id: 'cols', label: '列', type: 'number', def: 3 },
    { id: 'gap', label: '间距', type: 'number', def: 30 },
    { id: 'size', label: '半径', type: 'number', def: 10 }],
    [{ id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const rows = num(v.rows, 3), cols = num(v.cols, 3), gap = num(v.gap, 30), size = num(v.size, 10), layer = q(v.layer || '0');
        return `(progn (setq pt (getpoint "\\n[阵列] 左下基点: ")) (setq r 0)(repeat ${rows} (setq c 0) (repeat ${cols}(entmake (list '(0 . "CIRCLE") (cons 10 (list (+ (car pt) (* c ${gap})) (+ (cadr pt) (* r ${gap})) 0.0))(cons 40 ${size}) (cons 8 "${layer}"))) (setq c (1+ c))) (setq r (1+ r)))(princ (strcat "\\n已阵列 " (itoa (* ${rows} ${cols})) " 个圆")))`;
    }
};