// —— 模块：圆排 ——
const program_001 = {
    title: '圆排',
    fields: [[{ id: 'size', label: '半径', type: 'number', def: 10 },
    { id: 'count', label: '数量', type: 'number', def: 3 },
    { id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const size = num(v.size, 10), count = num(v.count, 3), layer = q(v.layer || '0');
        return `(progn (setq pt (getpoint "\\n[圆排] 基点: ")) (setq i 0)(repeat ${count} (entmake (list '(0 . "CIRCLE")(cons 10 (list (+ (car pt) (* i ${size} 2.5)) (cadr pt) 0.0)) (cons 40 ${size}) (cons 8 "${layer}")))(setq i (1+ i))) (princ (strcat "\\n已生成 " (itoa ${count}) " 个圆")))`;
    }
};