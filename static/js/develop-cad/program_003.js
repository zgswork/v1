// —— 模块：矩形 ——
const program_003 = {
    title: '矩形',
    fields: [[{ id: 'w', label: '宽度', type: 'number', def: 100 },
    { id: 'h', label: '高度', type: 'number', def: 60 },
    { id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const w = num(v.w, 100), h = num(v.h, 60), layer = q(v.layer || '0');
        return `(progn (setq p0 (getpoint "\\n[矩形] 左下角: "))(setq p1 (list (+ (car p0) ${w}) (+ (cadr p0) ${h}) 0.0))(foreach e (list (list p0 (list (car p1) (cadr p0) 0)) (list (list (car p1) (cadr p0) 0) p1)(list p1 (list (car p0) (cadr p1) 0)) (list (list (car p0) (cadr p1) 0) p0))(entmake (list '(0 . "LINE") (cons 10 (car e)) (cons 11 (cadr e)) (cons 8 "${layer}"))))(princ "\\n已画矩形"))`;
    }
};