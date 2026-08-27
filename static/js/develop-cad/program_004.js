// —— 模块：多段线 ——
const program_004 = {
    title: '多段线',
    fields: [[{ id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const layer = q(v.layer || '0');
        return `(progn (setq p0 (getpoint "\\n[多段线] 起点(回车结束): ")) (setq pts (list p0))(while (setq p (getpoint "\\n下一点(回车结束): ")) (setq pts (append pts (list p))))(entmake (append (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") '(100 . "AcDbPolyline")(cons 8 "${layer}") (cons 90 (length pts)) '(70 . 0))(mapcar '(lambda (p) (cons 10 (list (car p) (cadr p)))) pts)))(princ (strcat "\\n已画多段线，顶点 " (itoa (length pts)))))`;
    }
};