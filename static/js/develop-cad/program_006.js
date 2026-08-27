// —— 模块：插入块 ——
const program_006 = {
    title: '插入块',
    fields: [[{ id: 'block', label: '块名', type: 'text', def: 'MYBLOCK' },
    { id: 'scale', label: '比例', type: 'number', def: 1 },
    { id: 'rot', label: '旋转°', type: 'number', def: 0 },
    { id: 'layer', label: '图层', type: 'text', def: '0' }]],
    buildLisp(v) {
        const scale = num(v.scale, 1), rot = num(v.rot, 0), blk = q(v.block || ''), layer = q(v.layer || '0');
        return `(progn (setq pt (getpoint "\\n[块] 插入点: "))(if (tblsearch "BLOCK" "${blk}")(progn (entmake (list '(0 . "INSERT") (cons 2 "${blk}") (cons 10 pt)(cons 41 ${scale}) (cons 42 ${scale}) (cons 43 ${scale}) (cons 50 (/ (* ${rot} pi) 180.0)) (cons 8 "${layer}")))(princ (strcat "\\n已插入块 " "${blk}")))(princ "\\n块不存在，请先定义该块")))`;
    }
};