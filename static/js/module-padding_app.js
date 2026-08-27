// ════════════════════════════════════════════════════════
//  shapes.js — 移植自 shapes.ts
// ════════════════════════════════════════════════════════
function d2r(deg) { return deg * Math.PI / 180; }
function pointInConvexPolygon(px, py, verts) {
    const n = verts.length;
    let side = 0;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = verts[i];
        const [x2, y2] = verts[(i + 1) % n];
        const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
        if (Math.abs(cross) < 1e-10) continue;
        const s = cross > 0 ? 1 : -1;
        if (side === 0) side = s;
        else if (side !== s) return false;
    }
    return true;
}
function triangleVertices(a, b, c) {
    if (a <= 0 || b <= 0 || c <= 0) return null;
    if (a + b <= c || a + c <= b || b + c <= a) return null;
    const cosB = (c * c + a * a - b * b) / (2 * c * a);
    if (cosB < -1 || cosB > 1) return null;
    const sinB = Math.sqrt(Math.max(0, 1 - cosB * cosB));
    const Bx = -a / 2, By = 0;
    const Cx = a / 2, Cy = 0;
    const Ax = Bx + c * cosB;
    const Ay = By - c * sinB;
    const gx = (Ax + Bx + Cx) / 3;
    const gy = (Ay + By + Cy) / 3;
    return [[Ax - gx, Ay - gy], [Bx - gx, By - gy], [Cx - gx, Cy - gy]];
}
function regularPolygonVertices(n, R) {
    return Array.from({ length: n }, (_, k) => [
        R * Math.sin((2 * Math.PI * k) / n),
        -R * Math.cos((2 * Math.PI * k) / n),
    ]);
}
function trapezoidVertices(a, b, h, la, ra) {
    const laR = d2r(la), raR = d2r(ra);
    const bl = [-b / 2, h / 2];
    const br = [b / 2, h / 2];
    const tlx = -b / 2 + h / Math.tan(laR);
    const trx = b / 2 - h / Math.tan(raR);
    const tl = [tlx, -h / 2];
    const tr = [trx, -h / 2];
    const cx = (bl[0] + br[0] + tl[0] + tr[0]) / 4;
    const cy = (bl[1] + br[1] + tl[1] + tr[1]) / 4;
    return [
        [bl[0] - cx, bl[1] - cy],
        [br[0] - cx, br[1] - cy],
        [tr[0] - cx, tr[1] - cy],
        [tl[0] - cx, tl[1] - cy],
    ];
}
function isPointInShape(px, py, s) {
    switch (s.type) {
        case 'circle': {
            const R = s.radius ?? 1;
            return px * px + py * py <= R * R;
        }
        case 'ellipse': {
            const a = s.semiMajor ?? 1, b = s.semiMinor ?? 1;
            return (px / a) ** 2 + (py / b) ** 2 <= 1;
        }
        case 'triangle': {
            const verts = triangleVertices(s.sideA ?? 1, s.sideB ?? 1, s.sideC ?? 1);
            if (!verts) return false;
            return pointInConvexPolygon(px, py, verts);
        }
        case 'sector': {
            const R = s.radius ?? 1;
            const half = d2r((s.centralAngle ?? 90) / 2);
            if (px * px + py * py > R * R) return false;
            return Math.abs(Math.atan2(px, -py)) <= half;
        }
        case 'segment': {
            const R = s.radius ?? 1;
            const half = d2r((s.centralAngle ?? 90) / 2);
            const chordY = -R * Math.cos(half);
            return px * px + py * py <= R * R && py <= chordY;
        }
        case 'annulus': {
            const ro = s.outerRadius ?? 2, ri = s.innerRadius ?? 1;
            const r2 = px * px + py * py;
            return r2 >= ri * ri && r2 <= ro * ro;
        }
        case 'sector-annulus': {
            const ro = s.outerRadius ?? 2, ri = s.innerRadius ?? 1;
            const half = d2r((s.centralAngle ?? 90) / 2);
            const r2 = px * px + py * py;
            if (r2 < ri * ri || r2 > ro * ro) return false;
            return Math.abs(Math.atan2(px, -py)) <= half;
        }
        case 'regular-polygon': {
            const n = Math.max(3, Math.round(s.sides ?? 6));
            const sLen = s.sideLength ?? 1;
            const R = sLen / (2 * Math.sin(Math.PI / n));
            return pointInConvexPolygon(px, py, regularPolygonVertices(n, R));
        }
        case 'trapezoid': {
            const a = s.topBase ?? 1, b = s.bottomBase ?? 2;
            const h = s.height ?? 1;
            const la = s.leftAngle ?? 60, ra = s.rightAngle ?? 60;
            return pointInConvexPolygon(px, py, trapezoidVertices(a, b, h, la, ra));
        }
        default: return false;
    }
}
function getShapeBounds(s) {
    switch (s.type) {
        case 'circle': {
            const R = s.radius ?? 1;
            return { minX: -R, maxX: R, minY: -R, maxY: R };
        }
        case 'ellipse': {
            const a = s.semiMajor ?? 1, b = s.semiMinor ?? 1;
            return { minX: -a, maxX: a, minY: -b, maxY: b };
        }
        case 'triangle': {
            const verts = triangleVertices(s.sideA ?? 1, s.sideB ?? 1, s.sideC ?? 1);
            if (!verts) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
            return {
                minX: Math.min(...verts.map(v => v[0])),
                maxX: Math.max(...verts.map(v => v[0])),
                minY: Math.min(...verts.map(v => v[1])),
                maxY: Math.max(...verts.map(v => v[1])),
            };
        }
        case 'sector': {
            const R = s.radius ?? 1;
            const edgeY = -R * Math.cos(d2r((s.centralAngle ?? 90) / 2));
            return { minX: -R, maxX: R, minY: -R, maxY: Math.max(0, edgeY) };
        }
        case 'segment': {
            const R = s.radius ?? 1;
            const half = d2r((s.centralAngle ?? 90) / 2);
            const chordY = -R * Math.cos(half);
            return { minX: -R * Math.sin(half), maxX: R * Math.sin(half), minY: -R, maxY: chordY };
        }
        case 'annulus': {
            const ro = s.outerRadius ?? 2;
            return { minX: -ro, maxX: ro, minY: -ro, maxY: ro };
        }
        case 'sector-annulus': {
            const ro = s.outerRadius ?? 2;
            const edgeY = -ro * Math.cos(d2r((s.centralAngle ?? 90) / 2));
            return { minX: -ro, maxX: ro, minY: -ro, maxY: Math.max(0, edgeY) };
        }
        case 'regular-polygon': {
            const n = Math.max(3, Math.round(s.sides ?? 6));
            const R = (s.sideLength ?? 1) / (2 * Math.sin(Math.PI / n));
            return { minX: -R, maxX: R, minY: -R, maxY: R };
        }
        case 'trapezoid': {
            const verts = trapezoidVertices(
                s.topBase ?? 1, s.bottomBase ?? 2, s.height ?? 1,
                s.leftAngle ?? 60, s.rightAngle ?? 60);
            return {
                minX: Math.min(...verts.map(v => v[0])),
                maxX: Math.max(...verts.map(v => v[0])),
                minY: Math.min(...verts.map(v => v[1])),
                maxY: Math.max(...verts.map(v => v[1])),
            };
        }
        default: return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    }
}
function getShapeSymmetry(s) {
    switch (s.type) {
        case 'circle': case 'ellipse': case 'annulus':
            return { xSym: true, ySym: true };
        case 'sector': case 'segment': case 'sector-annulus':
            return { xSym: true, ySym: false };
        case 'triangle':
            return { xSym: false, ySym: false };
        case 'regular-polygon': {
            const n = Math.max(3, Math.round(s.sides ?? 6));
            return { xSym: true, ySym: n % 2 === 0 };
        }
        case 'trapezoid': {
            const la = s.leftAngle ?? 60, ra = s.rightAngle ?? 60;
            return { xSym: Math.abs(la - ra) < 0.5, ySym: false };
        }
        default: return { xSym: false, ySym: false };
    }
}
function getShapeCharacteristicRadius(s) {
    const b = getShapeBounds(s);
    return Math.max(Math.abs(b.minX), b.maxX, Math.abs(b.minY), b.maxY);
}
function distanceToShapeBoundary(px, py, s) {
    const r = Math.sqrt(px * px + py * py);
    switch (s.type) {
        case 'circle':
            return Math.max(0, (s.radius ?? 1) - r);
        case 'annulus': {
            const ri = s.innerRadius ?? 1, ro = s.outerRadius ?? 2;
            return Math.max(0, Math.min(r - ri, ro - r));
        }
        case 'sector': {
            const R = s.radius ?? 1;
            const half = d2r((s.centralAngle ?? 90) / 2);
            const cosH = Math.cos(half), sinH = Math.sin(half);
            const dArc = R - r;
            const dRight = -(px * cosH + py * sinH);
            const dLeft = px * cosH - py * sinH;
            return Math.max(0, Math.min(dArc, dRight, dLeft));
        }
        case 'segment': {
            const R = s.radius ?? 1;
            const half = d2r((s.centralAngle ?? 90) / 2);
            const chordY = -R * Math.cos(half);
            const dArc = R - r;
            const dChord = chordY - py;
            return Math.max(0, Math.min(dArc, dChord));
        }
        case 'sector-annulus': {
            const ri = s.innerRadius ?? 1, ro = s.outerRadius ?? 2;
            const half = d2r((s.centralAngle ?? 90) / 2);
            const cosH = Math.cos(half), sinH = Math.sin(half);
            const dInner = r - ri;
            const dOuter = ro - r;
            const dRight = -(px * cosH + py * sinH);
            const dLeft = px * cosH - py * sinH;
            return Math.max(0, Math.min(dInner, dOuter, dRight, dLeft));
        }
        default: {
            const charR = getShapeCharacteristicRadius(s);
            const ndx = r < 1e-9 ? 1 : px / r;
            const ndy = r < 1e-9 ? 0 : py / r;
            let lo = 0, hi = charR * 3;
            for (let i = 0; i < 64; i++) {
                const mid = (lo + hi) / 2;
                if (isPointInShape(px + mid * ndx, py + mid * ndy, s)) lo = mid;
                else hi = mid;
            }
            return lo;
        }
    }
}
// ════════════════════════════════════════════════════════
//  fillAlgorithm.js — 移植自 fillAlgorithm.ts
// ════════════════════════════════════════════════════════
function shouldKeepRect(rx, ry, w, h, shape, allowance) {
    if (allowance <= 0) return true;
    const N = 20;
    let insidePoints = [];
    for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
            const px = rx + (i / N) * w;
            const py = ry + (j / N) * h;
            if (isPointInShape(px, py, shape)) {
                insidePoints.push({ x: px, y: py });
            }
        }
    }
    if (insidePoints.length === 0) return false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of insidePoints) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    const innerW = maxX - minX;
    const innerH = maxY - minY;
    const shortSide = Math.min(innerW, innerH);
    return shortSide >= allowance;
}
function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
function rectFullyInShape(rx, ry, w, h, s) {
    return isPointInShape(rx, ry, s) && isPointInShape(rx + w, ry, s) &&
        isPointInShape(rx, ry + h, s) && isPointInShape(rx + w, ry + h, s);
}
function rectOverlapsShape(rx, ry, w, h, s) {
    const N = 4;
    for (let i = 0; i <= N; i++)
        for (let j = 0; j <= N; j++)
            if (isPointInShape(rx + (i / N) * w, ry + (j / N) * h, s)) return true;
    return false;
}
function getSearchOffsets(w, h, s) {
    const { xSym, ySym } = getShapeSymmetry(s);
    const N = 10;
    const oxList = xSym ? [0, w / 2] : Array.from({ length: N }, (_, i) => i * w / N);
    const oyList = ySym ? [0, h / 2] : Array.from({ length: N }, (_, i) => i * h / N);
    const result = [];
    for (const ox of oxList) for (const oy of oyList) result.push([ox, oy]);
    return result;
}
function scanBounds(s, w, h, ox, oy) {
    const b = getShapeBounds(s);
    const xMin = b.minX - w, yMin = b.minY - h;
    const xMax = b.maxX + w, yMax = b.maxY + h;
    const col0 = ox + Math.ceil((xMin - ox) / w) * w;
    const row0 = oy + Math.ceil((yMin - oy) / h) * h;
    return { col0, row0, xMax, yMax };
}
function solveShapeContainsRects(shape, w, h) {
    let best = [];
    for (const [ox, oy] of getSearchOffsets(w, h, shape)) {
        const { col0, row0, xMax, yMax } = scanBounds(shape, w, h, ox, oy);
        const rects = [];
        for (let rx = col0; rx < xMax; rx += w)
            for (let ry = row0; ry < yMax; ry += h)
                if (rectFullyInShape(rx, ry, w, h, shape)) rects.push({ x: rx, y: ry, w, h });
        if (rects.length > best.length) best = rects;
    }
    return best;
}
function solveRectsSurroundShape(shape, w, h, allowance = 0) {
    let best = null;
    for (const [ox, oy] of getSearchOffsets(w, h, shape)) {
        const { col0, row0, xMax, yMax } = scanBounds(shape, w, h, ox, oy);
        const rects = [];
        for (let rx = col0; rx < xMax; rx += w) {
            for (let ry = row0; ry < yMax; ry += h) {
                if (rectOverlapsShape(rx, ry, w, h, shape) &&
                    shouldKeepRect(rx, ry, w, h, shape, allowance)) {
                    rects.push({ x: rx, y: ry, w, h });
                }
            }
        }
        if (best === null || rects.length < best.length) best = rects;
    }
    return best ?? [];
}
// ════════════════════════════════════════════════════════
//  Mixed fill: fill with small rects first, then replace with large rects
// ════════════════════════════════════════════════════════
// Check if a k×m block of small rects exists at grid position (baseGx, baseGy)
function checkGrid(smallMap, baseGx, baseGy, k, m) {
    const cells = [];
    for (let dr = 0; dr < m; dr++) {
        for (let dc = 0; dc < k; dc++) {
            const key = (baseGx + dc) + ',' + (baseGy + dr);
            if (!smallMap.has(key)) return null;
            cells.push(key);
        }
    }
    return cells;
}
// 尝试用小矩形网格合并成大矩形，必须与大矩形网格对齐
function tryReplaceWithLarge(small, w1, h1, w2, h2, k, m, col0, row0) {
    if (small.length < k * m) return { large: [], small: small };
    // 建立网格索引 → 小矩形映射（相对 col0,row0）
    const smallMap = new Map();
    for (const r of small) {
        const gx = Math.round((r.x - col0) / w2);
        const gy = Math.round((r.y - row0) / h2);
        const key = gx + ',' + gy;
        smallMap.set(key, r);
    }
    // 只考虑可以作为大矩形起点的网格位置（对齐到大矩形网格）
    const positions = [];
    for (const [key] of smallMap) {
        const [gx, gy] = key.split(',').map(Number);
        if (gx % k === 0 && gy % m === 0) {
            positions.push({ gx, gy });
        }
    }
    // 按行优先排序（保证大矩形尽量连续）
    positions.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
    // 收集所有可能的完整大矩形块
    const candidates = [];
    for (const { gx, gy } of positions) {
        const cells = [];
        let allExist = true;
        for (let dr = 0; dr < m; dr++) {
            for (let dc = 0; dc < k; dc++) {
                const key = (gx + dc) + ',' + (gy + dr);
                if (!smallMap.has(key)) {
                    allExist = false;
                    break;
                }
                cells.push(key);
            }
            if (!allExist) break;
        }
        if (allExist) {
            candidates.push({
                gx, gy,
                x: col0 + (gx / k) * w1,   // 大矩形左上角 x
                y: row0 + (gy / m) * h1,   // 大矩形左上角 y
                cells: new Set(cells)
            });
        }
    }
    if (candidates.length === 0) return { large: [], small: small };
    // 贪心选取（行优先），移除已被合并的小矩形
    const removed = new Set();
    const large = [];
    for (const c of candidates) {
        let conflict = false;
        for (const cell of c.cells) {
            if (removed.has(cell)) { conflict = true; break; }
        }
        if (conflict) continue;
        for (const cell of c.cells) removed.add(cell);
        large.push({ x: c.x, y: c.y, w: w1, h: h1 });
    }
    // 剩余小矩形
    const remaining = [];
    for (const [key, r] of smallMap) {
        if (!removed.has(key)) remaining.push(r);
    }
    return { large, small: remaining };
}
// ===== 形状包围矩形（混合） =====
function solveMixedShapeContains(shape, w1, h1, w2, h2) {
    const k = Math.round(w1 / w2), m = Math.round(h1 / h2);
    let bestResult = { large: [], small: [] };
    let bestArea = -Infinity;   // 取面积最大
    for (const [ox, oy] of getSearchOffsets(w1, h1, shape)) {
        const { col0, row0, xMax, yMax } = scanBounds(shape, w1, h1, ox, oy);
        // 填充所有可能的小矩形
        const small = [];
        for (let rx = col0; rx < xMax; rx += w1) {
            for (let ry = row0; ry < yMax; ry += h1) {
                for (let p = 0; p < k; p++) {
                    for (let q = 0; q < m; q++) {
                        const sx = rx + p * w2, sy = ry + q * h2;
                        if (rectFullyInShape(sx, sy, w2, h2, shape))
                            small.push({ x: sx, y: sy, w: w2, h: h2 });
                    }
                }
            }
        }
        const result = small.length >= k * m
            ? tryReplaceWithLarge(small, w1, h1, w2, h2, k, m, col0, row0)
            : { large: [], small };
        // 计算该方案的总面积
        let area = 0;
        for (const r of result.large) area += r.w * r.h;
        for (const r of result.small) area += r.w * r.h;
        if (area > bestArea) {
            bestArea = area;
            bestResult = result;
        }
    }
    return bestResult;
}
// ===== 矩形包围形状（混合） =====
function solveMixedRectsSurroundShape(shape, w1, h1, w2, h2, allowance = 0) {
    const k = Math.round(w1 / w2), m = Math.round(h1 / h2);
    let bestResult = { large: [], small: [] };
    let bestArea = Infinity;    // 取面积最小
    for (const [ox, oy] of getSearchOffsets(w1, h1, shape)) {
        const { col0, row0, xMax, yMax } = scanBounds(shape, w1, h1, ox, oy);
        const small = [];
        for (let rx = col0; rx < xMax; rx += w1) {
            for (let ry = row0; ry < yMax; ry += h1) {
                if (!rectOverlapsShape(rx, ry, w1, h1, shape)) continue;
                for (let p = 0; p < k; p++) {
                    for (let q = 0; q < m; q++) {
                        const sx = rx + p * w2, sy = ry + q * h2;
                        if (rectOverlapsShape(sx, sy, w2, h2, shape) &&
                            shouldKeepRect(sx, sy, w2, h2, shape, allowance)) {
                            small.push({ x: sx, y: sy, w: w2, h: h2 });
                        }
                    }
                }
            }
        }
        const result = small.length >= k * m
            ? tryReplaceWithLarge(small, w1, h1, w2, h2, k, m, col0, row0)
            : { large: [], small };
        let area = 0;
        for (const r of result.large) area += r.w * r.h;
        for (const r of result.small) area += r.w * r.h;
        if (area < bestArea) {
            bestArea = area;
            bestResult = result;
        }
    }
    return bestResult ?? { large: [], small: [] };
}
function computeCircumscribedRadius(rects) {
    if (!rects.length) return 0;
    let maxDist = 0;
    for (const r of rects)
        for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]])
            maxDist = Math.max(maxDist, Math.sqrt(cx * cx + cy * cy));
    return maxDist;
}
// ════════════════════════════════════════════════════════
//  SVG 形状绘制辅助
// ════════════════════════════════════════════════════════
function svgArcPath(cx, cy, r, startAngle, endAngle, sweep) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = Math.abs(endAngle - startAngle) >= Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}
function shapeToSvgPath(s) {
    switch (s.type) {
        case 'circle': {
            const R = s.radius ?? 1;
            return `M ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0 Z`;
        }
        case 'ellipse': {
            const a = s.semiMajor ?? 1, b = s.semiMinor ?? 1;
            return `M ${-a} 0 A ${a} ${b} 0 1 1 ${a} 0 A ${a} ${b} 0 1 1 ${-a} 0 Z`;
        }
        case 'annulus': {
            const ro = s.outerRadius ?? 2, ri = s.innerRadius ?? 1;
            return `M ${-ro} 0 A ${ro} ${ro} 0 1 1 ${ro} 0 A ${ro} ${ro} 0 1 1 ${-ro} 0 Z ` +
                `M ${-ri} 0 A ${ri} ${ri} 0 1 0 ${ri} 0 A ${ri} ${ri} 0 1 0 ${-ri} 0 Z`;
        }
        case 'sector': {
            const R = s.radius ?? 1;
            const angle = s.centralAngle ?? 90;
            const half = d2r(angle / 2);
            const x1 = R * Math.sin(-half), y1 = -R * Math.cos(-half);
            const x2 = R * Math.sin(half), y2 = -R * Math.cos(half);
            const large = angle >= 180 ? 1 : 0;
            return `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
        }
        case 'segment': {
            const R = s.radius ?? 1;
            const angle = s.centralAngle ?? 90;
            const half = d2r(angle / 2);
            const x1 = -R * Math.sin(half), y1 = -R * Math.cos(half);
            const x2 = R * Math.sin(half), y2 = -R * Math.cos(half);
            const large = angle >= 180 ? 1 : 0;
            return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
        }
        case 'sector-annulus': {
            const ro = s.outerRadius ?? 2, ri = s.innerRadius ?? 1;
            const angle = s.centralAngle ?? 90;
            const half = d2r(angle / 2);
            const ox1 = ro * Math.sin(-half), oy1 = -ro * Math.cos(-half);
            const ox2 = ro * Math.sin(half), oy2 = -ro * Math.cos(half);
            const ix1 = ri * Math.sin(half), iy1 = -ri * Math.cos(half);
            const ix2 = ri * Math.sin(-half), iy2 = -ri * Math.cos(-half);
            const large = angle >= 180 ? 1 : 0;
            return `M ${ox1} ${oy1} A ${ro} ${ro} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${ri} ${ri} 0 ${large} 0 ${ix2} ${iy2} Z`;
        }
        case 'triangle': {
            const verts = triangleVertices(s.sideA ?? 1, s.sideB ?? 1, s.sideC ?? 1);
            if (!verts) return '';
            return `M ${verts.map(v => v.join(' ')).join(' L ')} Z`;
        }
        case 'regular-polygon': {
            const n = Math.max(3, Math.round(s.sides ?? 6));
            const R = (s.sideLength ?? 1) / (2 * Math.sin(Math.PI / n));
            const verts = regularPolygonVertices(n, R);
            return `M ${verts.map(v => v.join(' ')).join(' L ')} Z`;
        }
        case 'trapezoid': {
            const verts = trapezoidVertices(
                s.topBase ?? 1, s.bottomBase ?? 2, s.height ?? 1,
                s.leftAngle ?? 60, s.rightAngle ?? 60);
            return `M ${verts.map(v => v.join(' ')).join(' L ')} Z`;
        }
        default: return '';
    }
}
// ════════════════════════════════════════════════════════
//  UI 控制器
// ════════════════════════════════════════════════════════
const SHAPE_PARAMS_CONFIG = {
    circle: [{ id: 'radius', label: '半径 (mm)', def: 2000 }],
    ellipse: [{ id: 'semiMajor', label: '长轴半径', def: 2000 },
    { id: 'semiMinor', label: '短轴半径', def: 1000 }],
    sector: [{ id: 'radius', label: '半径 (mm)', def: 2000 },
    { id: 'centralAngle', label: '圆心角 (°)', def: 90 }],
    segment: [{ id: 'radius', label: '半径 (mm)', def: 2000 },
    { id: 'centralAngle', label: '圆心角 (°)', def: 90 }],
    annulus: [{ id: 'outerRadius', label: '外半径 (mm)', def: 2000 },
    { id: 'innerRadius', label: '内半径 (mm)', def: 1000 }],
    'sector-annulus': [{ id: 'outerRadius', label: '外半径 (mm)', def: 2000 },
    { id: 'innerRadius', label: '内半径 (mm)', def: 1000 },
    { id: 'centralAngle', label: '圆心角 (°)', def: 90 }],
    triangle: [{ id: 'sideA', label: '边 a (mm)', def: 2000 },
    { id: 'sideB', label: '边 b (mm)', def: 3000 },
    { id: 'sideC', label: '边 c (mm)', def: 2000 }],
    'regular-polygon': [{ id: 'sides', label: '边数', def: 6 },
    { id: 'sideLength', label: '边长 (mm)', def: 2000 }],
    trapezoid: [{ id: 'topBase', label: '上底 (mm)', def: 2000 },
    { id: 'bottomBase', label: '下底 (mm)', def: 5000 },
    { id: 'height', label: '高 (mm)', def: 4000 },
    { id: 'leftAngle', label: '左底角 (°)', def: 90 },
    { id: 'rightAngle', label: '右底角 (°)', def: 70 }],
};
// ── 参数变更标记：任何输入改动都禁用导出按钮 ──
function markParamsChanged() {
    expJpg.disabled = true;
    expPdf.disabled = true;
    expDxf.disabled = true;
}
function getShapeParamsLines(shape) {
    const config = SHAPE_PARAMS_CONFIG[shape.type] || [];
    const lines = [];
    for (const f of config) {
        const val = shape[f.id];
        if (val !== undefined) {
            lines.push(`${f.label}: ${val}`);
        }
    }
    return lines;
}
let currentMode = 'contains';
let lastResult = null;
let lastShape = null;
let lastW1 = 320, lastH1 = 160;
// ── DOM 引用
const shapeTypeEl = document.getElementById('shape-type');
const shapeParamsEl = document.getElementById('shape-params');
const w1El = document.getElementById('w1');
const h1El = document.getElementById('h1');
const w2El = document.getElementById('w2');
const h2El = document.getElementById('h2');
const btnGenerate = document.getElementById('btn-generate');
const errorMsg = document.getElementById('error-msg');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const statsPanel = document.getElementById('stats-panel');
const statsContent = document.getElementById('stats-content');
const drawLayer = document.getElementById('draw-layer');
const emptyHint = document.getElementById('empty-hint');
const mainSvg = document.getElementById('main-svg');
const sbShape = document.getElementById('sb-shape');
const sbMode = document.getElementById('sb-mode');
const sbCount = document.getElementById('sb-count');
const expJpg = document.getElementById('exp-jpg');
const expPdf = document.getElementById('exp-pdf');
const expDxf = document.getElementById('exp-dxf');
// 更新形状参数输入区
function renderShapeParams() {
    const type = shapeTypeEl.value;
    const fields = SHAPE_PARAMS_CONFIG[type] || [];
    shapeParamsEl.innerHTML = '<div class="section-title">形状参数</div>';
    const useGrid = fields.length >= 2;
    if (useGrid) {
        const grid = document.createElement('div');
        grid.className = fields.length === 3 ? 'row3' : 'row2';
        fields.forEach(f => {
            const div = document.createElement('div');
            div.className = 'field';
            div.innerHTML = `<label>${f.label}</label>
        <input type="number" id="sp-${f.id}" value="${f.def}" min="1" step="any">`;
            grid.appendChild(div);
        });
        shapeParamsEl.appendChild(grid);
    } else {
        fields.forEach(f => {
            const div = document.createElement('div');
            div.className = 'field';
            div.innerHTML = `<label>${f.label}</label>
        <input type="number" id="sp-${f.id}" value="${f.def}" min="1" step="any">`;
            shapeParamsEl.appendChild(div);
        });
    }
}
function updateModeButtonTexts() {
    const type = shapeTypeEl.value;
    let shapeName;
    // 特殊处理正多边形：显示边数+边形
    if (type === 'regular-polygon') {
        const sidesInput = document.getElementById('sp-sides');
        const sides = sidesInput ? parseInt(sidesInput.value) || 6 : 6;
        // 3–10 用中文数字，其余仍用阿拉伯数字
        const chineseNumbers = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
        shapeName = (sides >= 3 && sides <= 10)
            ? '正' + chineseNumbers[sides] + '边形'
            : '正' + sides + '边形';
    } else {
        const shapeNames = {
            circle: '圆',
            trapezoid: '梯形',
            triangle: '三角形',
            ellipse: '椭圆',
            sector: '扇形',
            segment: '弓形',
            annulus: '圆环',
            'sector-annulus': '扇环'
        };
        shapeName = shapeNames[type] || type;
    }
    const containsBtn = document.querySelector('.mode-btn[data-mode="contains"]');
    const surroundBtn = document.querySelector('.mode-btn[data-mode="surround"]');
    if (containsBtn) { containsBtn.textContent = `${shapeName}包围矩形`; }
    if (surroundBtn) { surroundBtn.textContent = `矩形包围${shapeName}`; }
}
function getShapeParams() {
    const type = shapeTypeEl.value;
    const fields = SHAPE_PARAMS_CONFIG[type] || [];
    const s = { type };
    for (const f of fields) {
        const el = document.getElementById(`sp-${f.id}`);
        if (el) s[f.id] = parseFloat(el.value) || f.def;
    }
    return s;
}
// 模式按钮
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        const allowanceContainer = document.getElementById('allowance-container');
        if (currentMode === 'surround') {
            allowanceContainer.style.display = 'block';
        } else {
            allowanceContainer.style.display = 'none';
        }
    });
});
shapeTypeEl.addEventListener('change', renderShapeParams);
shapeTypeEl.addEventListener('change', updateModeButtonTexts);
renderShapeParams();
updateModeButtonTexts(); // 初始化时设置正确的按钮文本
// 十字准线跟随
const canvasWrap = document.getElementById('canvas-wrap');
const chV = document.getElementById('ch-v');
const chH = document.getElementById('ch-h');
canvasWrap.addEventListener('mousemove', e => {
    const rect = canvasWrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    chV.setAttribute('x1', x); chV.setAttribute('x2', x);
    chH.setAttribute('y1', y); chH.setAttribute('y2', y);
});
// ── 参数变更监听：任何修改都禁用导出按钮 ──
function bindParamsChange() {
    shapeTypeEl.addEventListener('change', markParamsChanged);
    shapeParamsEl.addEventListener('input', markParamsChanged);
    shapeParamsEl.addEventListener('change', markParamsChanged);
    w1El.addEventListener('input', markParamsChanged);
    w1El.addEventListener('change', markParamsChanged);
    h1El.addEventListener('input', markParamsChanged);
    h1El.addEventListener('change', markParamsChanged);
    w2El.addEventListener('input', markParamsChanged);
    w2El.addEventListener('change', markParamsChanged);
    h2El.addEventListener('input', markParamsChanged);
    h2El.addEventListener('change', markParamsChanged);
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => { markParamsChanged(); });
    });
    const allowanceEl = document.getElementById('allowance');
    if (allowanceEl) {
        allowanceEl.addEventListener('input', markParamsChanged);
        allowanceEl.addEventListener('change', markParamsChanged);
    }
    // ✅ 新增：监听正多边形边数变化，实时更新按钮文本
    shapeParamsEl.addEventListener('input', (e) => {
        if (e.target.id === 'sp-sides' && shapeTypeEl.value === 'regular-polygon') {
            updateModeButtonTexts();
        }
    });
    shapeParamsEl.addEventListener('change', (e) => {
        if (e.target.id === 'sp-sides' && shapeTypeEl.value === 'regular-polygon') {
            updateModeButtonTexts();
        }
    });
}
bindParamsChange();
// ── 验证
function validate() {
    const type = shapeTypeEl.value;
    const sp = getShapeParams();
    const w1 = parseFloat(w1El.value), h1 = parseFloat(h1El.value);
    const w2str = w2El.value.trim(), h2str = h2El.value.trim();
    const hasSmall = w2str !== '' && h2str !== '';
    if (!w1 || w1 <= 0) return '大矩形宽 w1 必须大于 0';
    if (!h1 || h1 <= 0) return '大矩形高 h1 必须大于 0';
    if (type === 'triangle') {
        const { sideA: a, sideB: b, sideC: c } = sp;
        if (a + b <= c || a + c <= b || b + c <= a) return '三边长不满足三角形成立条件';
    }
    if (type === 'regular-polygon') {
        if ((sp.sides ?? 3) < 3) return '正多边形边数必须 ≥ 3';
    }
    if (type === 'annulus' || type === 'sector-annulus') {
        if ((sp.innerRadius ?? 0) >= (sp.outerRadius ?? 1)) return '内半径必须小于外半径';
    }
    if (type === 'trapezoid') {
        const la = sp.leftAngle ?? 0, ra = sp.rightAngle ?? 0;
        if (la <= 0 || la >= 180 || ra <= 0 || ra >= 180) return '底角必须在 0°~180° 之间';
        if (la + ra > 180) return '底角之和不能大于 180°';
    }
    if (hasSmall) {
        const w2 = parseFloat(w2str), h2 = parseFloat(h2str);
        if (!w2 || w2 <= 0) return '小矩形宽 w2 必须大于 0';
        if (!h2 || h2 <= 0) return '小矩形高 h2 必须大于 0';
        const kw = w1 / w2, kh = h1 / h2;
        if (Math.abs(kw - Math.round(kw)) > 1e-6) return 'w1 必须是 w2 的整数倍';
        if (Math.abs(kh - Math.round(kh)) > 1e-6) return 'h1 必须是 h2 的整数倍';
    }
    return null;
}
// ── 生成方案
btnGenerate.addEventListener('click', async () => {
    const err = validate();
    if (err) { errorMsg.textContent = err; return; }
    errorMsg.textContent = '';
    const shape = getShapeParams();
    const w1 = parseFloat(w1El.value);
    const h1 = parseFloat(h1El.value);
    const w2str = w2El.value.trim(), h2str = h2El.value.trim();
    const hasSmall = w2str !== '' && h2str !== '';
    const w2 = hasSmall ? parseFloat(w2str) : 0;
    const h2 = hasSmall ? parseFloat(h2str) : 0;
    let allowance = 0;
    if (currentMode === 'surround') {
        const allowanceEl = document.getElementById('allowance');
        allowance = parseFloat(allowanceEl.value) || 0;
        if (allowance < 0) {
            errorMsg.textContent = '允许留空不能为负数';
            return;
        }
    }
    loading.classList.add('show');
    loadingText.textContent = 'COMPUTING...';
    btnGenerate.disabled = true;
    await new Promise(r => setTimeout(r, 30));
    let result;
    try {
        if (hasSmall) {
            if (currentMode === 'contains') {
                result = solveMixedShapeContains(shape, w1, h1, w2, h2);
            } else {
                result = solveMixedRectsSurroundShape(shape, w1, h1, w2, h2, allowance);
            }
        } else {
            if (currentMode === 'contains') {
                const rects = solveShapeContainsRects(shape, w1, h1);
                result = { large: rects, small: [] };
            } else {
                const rects = solveRectsSurroundShape(shape, w1, h1, allowance);
                result = { large: rects, small: [] };
            }
        }
    } catch (e) {
        loading.classList.remove('show');
        btnGenerate.disabled = false;
        errorMsg.textContent = '计算出错：' + e.message;
        return;
    }
    lastResult = result;
    lastShape = shape;
    lastW1 = w1;
    lastH1 = h1;
    renderResult(shape, result, w1, h1, currentMode);
    loading.classList.remove('show');
    btnGenerate.disabled = false;
    expJpg.disabled = false;
    expPdf.disabled = false;
    expDxf.disabled = false;
    const SHAPE_NAMES = {
        circle: '圆', trapezoid: '梯形', triangle: '三角形', ellipse: '椭圆',
        sector: '扇形', segment: '弓形', annulus: '圆环', 'sector-annulus': '扇环', 'regular-polygon': '正多边形'
    };
    sbShape.textContent = SHAPE_NAMES[shape.type] || shape.type;
    sbMode.textContent = currentMode === 'contains' ? '形状包围矩形' : '矩形包围形状';
    if (result.small.length > 0) {
        sbCount.textContent = '大' + result.large.length + ' + 小' + result.small.length;
    } else {
        sbCount.textContent = '大' + result.large.length;
    }
});
// ════════════════════════════════════════════════════════
//  结果渲染
// ════════════════════════════════════════════════════════
function renderResult(shape, result, w1, h1, mode) {
    const allRects = [...result.large, ...result.small];
    if (allRects.length === 0 && mode === 'contains') {
        errorMsg.textContent = '矩形尺寸过大，无法在形状内填充任何矩形';
        emptyHint.style.display = 'flex';
        statsPanel.style.display = 'none';
        drawLayer.innerHTML = '';
        return;
    }
    emptyHint.style.display = 'none';
    const stats = computeStats(shape, result, w1, h1, mode);
    const canvasW = canvasWrap.clientWidth || 800;
    const canvasH = canvasWrap.clientHeight || 600;
    const b = getShapeBounds(shape);
    let viewMinX = b.minX, viewMinY = b.minY, viewMaxX = b.maxX, viewMaxY = b.maxY;
    for (const r of allRects) {
        viewMinX = Math.min(viewMinX, r.x);
        viewMaxX = Math.max(viewMaxX, r.x + r.w);
        viewMinY = Math.min(viewMinY, r.y);
        viewMaxY = Math.max(viewMaxY, r.y + r.h);
    }
    const pad = Math.max(viewMaxX - viewMinX, viewMaxY - viewMinY) * 0.08;
    viewMinX -= pad; viewMinY -= pad; viewMaxX += pad; viewMaxY += pad;
    const scale = Math.min(canvasW / (viewMaxX - viewMinX), canvasH / (viewMaxY - viewMinY));
    const tx = canvasW / 2 - (viewMinX + viewMaxX) / 2 * scale;
    const ty = canvasH / 2 - (viewMinY + viewMaxY) / 2 * scale;
    const ns = 'http://www.w3.org/2000/svg';
    drawLayer.innerHTML = '';
    drawLayer.setAttribute('transform', `translate(${tx}, ${ty}) scale(${scale})`);
    // 原点十字
    const cross = document.createElementNS(ns, 'g');
    cross.setAttribute('opacity', '0.3');
    const cl = document.createElementNS(ns, 'line');
    cl.setAttribute('x1', String(-viewMaxX)); cl.setAttribute('x2', String(viewMaxX));
    cl.setAttribute('y1', '0'); cl.setAttribute('y2', '0');
    cl.setAttribute('stroke', '#38BDF8'); cl.setAttribute('stroke-width', String(1 / scale));
    cl.setAttribute('stroke-dasharray', String(8 / scale) + ' ' + String(8 / scale));
    const cv = document.createElementNS(ns, 'line');
    cv.setAttribute('y1', String(-viewMaxY)); cv.setAttribute('y2', String(viewMaxY));
    cv.setAttribute('x1', '0'); cv.setAttribute('x2', '0');
    cv.setAttribute('stroke', '#38BDF8'); cv.setAttribute('stroke-width', String(1 / scale));
    cv.setAttribute('stroke-dasharray', String(8 / scale) + ' ' + String(8 / scale));
    cross.appendChild(cl); cross.appendChild(cv);
    drawLayer.appendChild(cross);
    // 大矩形
    for (const r of result.large) {
        const el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', r.x); el.setAttribute('y', r.y);
        el.setAttribute('width', r.w); el.setAttribute('height', r.h);
        el.setAttribute('fill', 'rgba(16,185,129,0.18)');
        el.setAttribute('stroke', '#10B981');
        el.setAttribute('stroke-width', String(1.5 / scale));
        drawLayer.appendChild(el);
    }
    // 小矩形
    for (const r of result.small) {
        const el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', r.x); el.setAttribute('y', r.y);
        el.setAttribute('width', r.w); el.setAttribute('height', r.h);
        el.setAttribute('fill', 'rgba(56,189,248,0.14)');
        el.setAttribute('stroke', '#38BDF8');
        el.setAttribute('stroke-width', String(1.2 / scale));
        drawLayer.appendChild(el);
    }
    // 形状轮廓
    const pathD = shapeToSvgPath(shape);
    if (pathD) {
        const shEl = document.createElementNS(ns, 'path');
        shEl.setAttribute('d', pathD);
        shEl.setAttribute('fill', 'rgba(245,158,11,0.05)');
        shEl.setAttribute('stroke', '#FFFFFF');
        shEl.setAttribute('stroke-width', '2');
        shEl.setAttribute('vector-effect', 'non-scaling-stroke');
        shEl.setAttribute('fill-rule', 'evenodd');
        drawLayer.appendChild(shEl);
    }
    renderStats(stats);
}
// ── 统计计算
function computeStats(shape, result, w1, h1, mode) {
    const allRects = [...result.large, ...result.small];
    const largeCount = result.large.length;
    const smallCount = result.small.length;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of allRects) {
        minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w);
        minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y + r.h);
    }
    const totalW = allRects.length ? maxX - minX : 0;
    const totalH = allRects.length ? maxY - minY : 0;
    let areaLarge = 0;
    for (const r of result.large) {
        areaLarge += r.w * r.h;
    }
    let areaSmall = 0;
    for (const r of result.small) {
        areaSmall += r.w * r.h;
    }
    const totalArea = (areaLarge + areaSmall) / 1e6;
    let cols = null, rows = null;
    if (allRects.length > 0) {
        const allW = allRects.map(r => r.w);
        const allH = allRects.map(r => r.h);
        const wEq = allW.every(v => Math.abs(v - allW[0]) < 0.5);
        const hEq = allH.every(v => Math.abs(v - allH[0]) < 0.5);
        if (wEq) {
            const xs = [...new Set(allRects.map(r => Math.round(r.x * 10) / 10))];
            cols = xs.length;
        }
        if (hEq) {
            const ys = [...new Set(allRects.map(r => Math.round(r.y * 10) / 10))];
            rows = ys.length;
        }
    }
    let gap = 0;
    if (allRects.length > 0) {
        if (mode === 'contains') {
            const cornerCount = new Map();
            for (const r of allRects) {
                for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
                    const key = `${cx.toFixed(3)},${cy.toFixed(3)}`;
                    cornerCount.set(key, (cornerCount.get(key) ?? 0) + 1);
                }
            }
            let maxGap = 0;
            for (const r of allRects) {
                for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
                    const key = `${cx.toFixed(3)},${cy.toFixed(3)}`;
                    if ((cornerCount.get(key) ?? 0) < 4) {
                        const d = distanceToShapeBoundary(cx, cy, shape);
                        if (d > maxGap) maxGap = d;
                    }
                }
            }
            gap = maxGap;
        } else {
            const ccR = computeCircumscribedRadius(allRects);
            const charR = getShapeCharacteristicRadius(shape);
            gap = Math.max(0, ccR - charR);
        }
    }
    return { largeCount, smallCount, totalW, totalH, totalArea, cols, rows, gap };
}
function renderStats(stats) {
    statsPanel.style.display = 'block';
    let html = '';
    if (stats.cols !== null)
        html += `<div class="stat-row"><span class="stat-key">列数</span><span class="stat-val">${stats.cols}</span></div>`;
    if (stats.rows !== null)
        html += `<div class="stat-row"><span class="stat-key">行数</span><span class="stat-val">${stats.rows}</span></div>`;
    html += `<div class="stat-row"><span class="stat-key">包围盒</span><span class="stat-val yellow">${stats.totalW.toFixed(0)} \u00d7 ${stats.totalH.toFixed(0)} mm</span></div>`;
    html += `<div class="stat-row"><span class="stat-key">大矩形数</span><span class="stat-val">${stats.largeCount}</span></div>`;
    if (stats.smallCount > 0) {
        html += `<div class="stat-row"><span class="stat-key">小矩形数</span><span class="stat-val cyan">${stats.smallCount}</span></div>`;
    }
    html += `<div class="stat-row"><span class="stat-key">总面积</span><span class="stat-val">${stats.totalArea.toFixed(4)} m\u00b2</span></div>`;
    // ── 新增：最大边距 ──
    if (stats.gap !== undefined) {
        html += `<div class="stat-row"><span class="stat-key">最大边距</span><span class="stat-val">${stats.gap.toFixed(1)} mm</span></div>`;
    }
    statsContent.innerHTML = html;
}
// ════════════════════════════════════════════════════════
//  导出功能
// ════════════════════════════════════════════════════════
function getSvgForExport() {
    const canvasW = canvasWrap.clientWidth || 1920;
    const canvasH = canvasWrap.clientHeight || 1080;
    const svgClone = mainSvg.cloneNode(true);
    svgClone.setAttribute('width', canvasW);
    svgClone.setAttribute('height', canvasH);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const allPaths = svgClone.querySelectorAll('path');
    allPaths.forEach(path => {
        path.style.animation = 'none';
        path.removeAttribute('stroke-dasharray');
        path.removeAttribute('stroke-dashoffset');
    });
    if (lastResult && lastShape) {
        const stats = computeStats(lastShape, lastResult, lastW1, lastH1, currentMode);
        const lines = [];
        const paramLines = getShapeParamsLines(lastShape);
        lines.push('\u7b3c-\u58f0\u660e\uff1a');
        lines.push('\u6b64\u56fe\u4ec5\u4f9b\u53c2\u8003');
        lines.push('--------------------');
        for (const line of paramLines) lines.push(line);
        lines.push('--------------------');
        lines.push('\u5217\u6570: ' + (stats.cols !== null ? stats.cols : '--'));
        lines.push('\u884c\u6570: ' + (stats.rows !== null ? stats.rows : '--'));
        lines.push('\u5305\u56f4\u76d2: ' + stats.totalW.toFixed(0) + ' \u00d7 ' + stats.totalH.toFixed(0) + ' mm');
        lines.push('\u5927\u77e9\u5f62\u6570: ' + stats.largeCount);
        if (stats.smallCount > 0) lines.push('\u5c0f\u77e9\u5f62\u6570: ' + stats.smallCount);
        lines.push('\u603b\u9762\u79ef: ' + stats.totalArea.toFixed(4) + ' m\u00b2');
        const allowance = parseFloat(document.getElementById('allowance')?.value) || 0;
        if (currentMode === 'surround' && allowance > 0) {
            const allRectsNow = [...lastResult.large, ...lastResult.small];
            const noAllowRects = solveRectsSurroundShape(lastShape, lastW1, lastH1, 0);
            if (noAllowRects.length > allRectsNow.length) {
                lines.push('\u5b9e\u9645\u8fb9\u6cbf\u7559\u7a7a: ' + allowance + ' mm (\u8fc7\u6ee4 ' + (noAllowRects.length - allRectsNow.length) + ' \u4e2a\u77e9\u5f62)');
            }
        }
        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const fontSize = 14;
        const lineHeight = fontSize * 1.5;
        const margin = 20;
        let xPos = canvasW - margin;
        let yPos = canvasH - margin;
        for (let i = lines.length - 1; i >= 0; i--) {
            const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textEl.setAttribute('x', xPos);
            textEl.setAttribute('y', yPos);
            textEl.setAttribute('text-anchor', 'end');
            textEl.setAttribute('font-family', 'SimSun, sans-serif');
            textEl.setAttribute('font-size', fontSize);
            textEl.setAttribute('fill', '#FFFFFF');
            textEl.textContent = lines[i];
            textGroup.appendChild(textEl);
            yPos -= lineHeight;
        }
        svgClone.appendChild(textGroup);
    }
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', canvasW);
    bgRect.setAttribute('height', canvasH);
    bgRect.setAttribute('fill', '#0f1a2b');
    svgClone.insertBefore(bgRect, svgClone.firstChild);
    return new XMLSerializer().serializeToString(svgClone);
}
function getShapeParamsString(shape) {
    const config = SHAPE_PARAMS_CONFIG[shape.type] || [];
    const parts = config.map(f => {
        const val = shape[f.id];
        if (val !== undefined) return `${f.label}${val}`;
        return '';
    }).filter(s => s);
    return parts.join(', ');
}
function generateFileName(shape, w1, h1, smallW, smallH, totalW, totalH) {
    const shapeNames = {
        circle: '\u5706', trapezoid: '\u68af\u5f62', triangle: '\u4e09\u89d2\u5f62', ellipse: '\u692d\u5706',
        sector: '\u6247\u5f62', segment: '\u5f13\u5f62', annulus: '\u5706\u73af', 'sector-annulus': '\u6247\u73af', 'regular-polygon': '\u6b63\u591a\u8fb9\u5f62'
    };
    const type = shape.type;
    const name = shapeNames[type] || type;
    const config = SHAPE_PARAMS_CONFIG[type] || [];
    const paramValues = config.map(f => {
        const val = shape[f.id];
        return val !== undefined ? Math.round(val) : '';
    }).filter(v => v !== '');
    const paramStr = paramValues.join('x');
    const shapePart = `${name}(${paramStr})`;
    const bigRect = `${Math.round(w1)}x${Math.round(h1)}`;
    const smallPart = (smallW > 0 && smallH > 0) ? `(${Math.round(smallW)}x${Math.round(smallH)})` : '';
    const bbox = `${Math.round(totalW)}x${Math.round(totalH)}`;
    const now = new Date();
    const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    return `${shapePart}-${bigRect}${smallPart}-${bbox}-${dateStr}`;
}
// ════════════════════════════════════════════════════════
//  JPG 导出
// ════════════════════════════════════════════════════════
expJpg.addEventListener('click', () => {
    if (!lastResult || !lastShape) {
        alert('\u8bf7\u5148\u751f\u6210\u586b\u5145\u65b9\u6848');
        return;
    }
    const stats = computeStats(lastShape, lastResult, lastW1, lastH1, currentMode);
    const { totalW, totalH, smallCount } = stats;
    const smallW = (smallCount > 0) ? lastResult.small[0].w : 0;
    const smallH = (smallCount > 0) ? lastResult.small[0].h : 0;
    const fileName = generateFileName(lastShape, lastW1, lastH1, smallW, smallH, totalW, totalH);
    const svgStr = getSvgForExport();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const canvasW = canvasWrap.clientWidth || 1920, canvasH = canvasWrap.clientHeight || 1080;
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.max(canvasW, 1920) * 2;
        c.height = Math.round(c.width * (canvasH / canvasW));
        const ctx = c.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = '#0f1a2b';
        ctx.fillRect(0, 0, c.width / 2, c.height / 2);
        ctx.drawImage(img, 0, 0, c.width / 2, c.height / 2);
        URL.revokeObjectURL(url);
        const link = document.createElement('a');
        link.href = c.toDataURL('image/jpeg', 0.95);
        link.download = fileName + '.jpg';
        link.click();
    };
    img.src = url;
});
// ════════════════════════════════════════════════════════
//  PDF 导出
// ════════════════════════════════════════════════════════
expPdf.addEventListener('click', () => {
    if (!lastResult || !lastShape) {
        alert('\u8bf7\u5148\u751f\u6210\u586b\u5145\u65b9\u6848');
        return;
    }
    const stats = computeStats(lastShape, lastResult, lastW1, lastH1, currentMode);
    const { totalW, totalH, smallCount } = stats;
    const smallW = (smallCount > 0) ? lastResult.small[0].w : 0;
    const smallH = (smallCount > 0) ? lastResult.small[0].h : 0;
    const fileName = generateFileName(lastShape, lastW1, lastH1, smallW, smallH, totalW, totalH);
    const svgStr = getSvgForExport();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const canvasW = canvasWrap.clientWidth || 1920, canvasH = canvasWrap.clientHeight || 1080;
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.max(canvasW, 1920) * 2;
        c.height = Math.round(c.width * (canvasH / canvasW));
        const ctx = c.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = '#0f1a2b';
        ctx.fillRect(0, 0, c.width / 2, c.height / 2);
        ctx.drawImage(img, 0, 0, c.width / 2, c.height / 2);
        URL.revokeObjectURL(url);
        const imgData = c.toDataURL('image/jpeg', 0.92);
        try {
            const { jsPDF } = window.jspdf;
            const orient = canvasW > canvasH ? 'landscape' : 'portrait';
            const pdfW = Math.max(canvasW, 1920);
            const pdfH = Math.round(pdfW * (canvasH / canvasW));
            const pdf = new jsPDF({ orientation: orient, unit: 'px', format: [pdfW, pdfH] });
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
            pdf.save(fileName + '.pdf');
        } catch (e) {
            alert('\u0050\u0044\u0046 \u5bfc\u51fa\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4 \u006a\u0073\u0050\u0044\u0046 \u5df2\u52a0\u8f7d\uff1a' + e.message);
        }
    };
    img.src = url;
});
// ════════════════════════════════════════════════════════
//  DXF 导出
// ════════════════════════════════════════════════════════
expDxf.addEventListener('click', () => {
    if (!lastResult || !lastShape) {
        alert('\u8bf7\u5148\u751f\u6210\u586b\u5145\u65b9\u6848');
        return;
    }
    const shape = lastShape;
    const allRects = [...lastResult.large, ...lastResult.small];
    const allowance = parseFloat(document.getElementById('allowance')?.value) || 0;
    const stats = computeStats(shape, lastResult, lastW1, lastH1, currentMode);
    const { largeCount, smallCount, totalW, totalH, totalArea, cols, rows } = stats;
    let filtered = false;
    let noAllowanceCount = 0;
    if (currentMode === 'surround' && allowance > 0) {
        const noAllowRects = solveRectsSurroundShape(shape, lastW1, lastH1, 0);
        noAllowanceCount = noAllowRects.length;
        if (noAllowanceCount > allRects.length) filtered = true;
    }
    const lines = [];
    lines.push(
        '0', 'SECTION', '2', 'HEADER',
        '9', '$ACADVER', '1', 'AC1009',
        '9', '$DWGCODEPAGE', '3', 'ANSI_936',
        '0', 'ENDSEC',
        '0', 'SECTION', '2', 'TABLES',
        '0', 'TABLE', '2', 'LAYER', '70', '4',
        '0', 'LAYER', '2', 'LARGE_RECT', '70', '0', '62', '3',
        '0', 'LAYER', '2', 'SMALL_RECT', '70', '0', '62', '4',
        '0', 'LAYER', '2', 'SHAPE', '70', '0', '62', '7',
        '0', 'LAYER', '2', 'TEXT_LAYER', '70', '0', '62', '7',
        '0', 'ENDTAB',
        '0', 'TABLE', '2', 'STYLE', '70', '1',
        '0', 'STYLE', '2', 'CNSTYLE', '70', '0', '40', '0',
        '3', 'simsun.ttf', '4', '',
        '0', 'ENDTAB', '0', 'ENDSEC',
        '0', 'SECTION', '2', 'ENTITIES'
    );
    function rectLines(r, layer) {
        const x1 = r.x, y1 = -r.y;
        const x2 = r.x + r.w, y2 = -r.y;
        const x3 = r.x + r.w, y3 = -(r.y + r.h);
        const x4 = r.x, y4 = -(r.y + r.h);
        const pts = [
            [x1, y1, x2, y2],
            [x2, y2, x3, y3],
            [x3, y3, x4, y4],
            [x4, y4, x1, y1]
        ];
        const result = [];
        for (const [ax, ay, bx, by] of pts) {
            result.push('0\nLINE\n8\n' + layer + '\n10\n' + ax.toFixed(3) + '\n20\n' + ay.toFixed(3) + '\n11\n' + bx.toFixed(3) + '\n21\n' + by.toFixed(3));
        }
        return result;
    }
    for (const r of lastResult.large) lines.push(...rectLines(r, 'LARGE_RECT'));
    for (const r of lastResult.small) lines.push(...rectLines(r, 'SMALL_RECT'));
    const shapeLayer = 'SHAPE';
    function addLine(x1, y1, x2, y2) {
        lines.push('0\nLINE\n8\n' + shapeLayer + '\n10\n' + x1.toFixed(3) + '\n20\n' + y1.toFixed(3) + '\n11\n' + x2.toFixed(3) + '\n21\n' + y2.toFixed(3));
    }
    function arcPoints(cx, cy, r, startAngle, endAngle, segments) {
        segments = segments || 80;
        const pts = [];
        const angleStep = (endAngle - startAngle) / segments;
        for (let i = 0; i <= segments; i++) {
            const a = startAngle + i * angleStep;
            pts.push([cx + r * Math.cos(a), -cy - r * Math.sin(a)]);
        }
        return pts;
    }
    switch (shape.type) {
        case 'circle': {
            const R = shape.radius || 1;
            const N = 120;
            const pts = [];
            for (let i = 0; i < N; i++) {
                const a = (2 * Math.PI * i) / N;
                pts.push([R * Math.cos(a), -R * Math.sin(a)]);
            }
            for (let i = 0; i < pts.length - 1; i++) { addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) }
            addLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
            break;
        }
        case 'ellipse': {
            const a = shape.semiMajor || 1;
            const b = shape.semiMinor || 1;
            const N = 120;
            const pts = [];
            for (let i = 0; i < N; i++) {
                const angle = (2 * Math.PI * i) / N;
                pts.push([a * Math.cos(angle), -b * Math.sin(angle)]);
            }
            for (let i = 0; i < pts.length - 1; i++) { addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) }
            addLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
            break;
        }
        case 'annulus': {
            const ro = shape.outerRadius || 1;
            const ri = shape.innerRadius || 0;
            const N = 120;
            let pts = [];
            for (let i = 0; i < N; i++) {
                const a = (2 * Math.PI * i) / N;
                pts.push([ro * Math.cos(a), -ro * Math.sin(a)]);
            }
            for (let i = 0; i < pts.length - 1; i++) addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
            addLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
            if (ri > 0) {
                pts = [];
                for (let i = 0; i < N; i++) {
                    const a = (2 * Math.PI * i) / N;
                    pts.push([ri * Math.cos(a), -ri * Math.sin(a)]);
                }
                for (let i = 0; i < pts.length - 1; i++) addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
                addLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
            }
            break;
        }
        case 'sector': {
            const R = shape.radius || 1;
            const angle = shape.centralAngle || 90;
            const half = d2r(angle / 2);
            const x1 = R * Math.sin(-half), y1 = -R * Math.cos(-half);
            const x2 = R * Math.sin(half), y2 = -R * Math.cos(half);
            addLine(0, 0, x1, y1);
            addLine(x2, y2, 0, 0);
            const pts = arcPoints(0, 0, R, -half, half, 80);
            for (let i = 0; i < pts.length - 1; i++) { addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) }
            break;
        }
        case 'segment': {
            const R = shape.radius || 1;
            const angle = shape.centralAngle || 90;
            const half = d2r(angle / 2);
            const x1 = -R * Math.sin(half), y1 = -R * Math.cos(half);
            const x2 = R * Math.sin(half), y2 = -R * Math.cos(half);
            addLine(x1, y1, x2, y2);
            const pts = arcPoints(0, 0, R, -half, half, 80);
            for (let i = 0; i < pts.length - 1; i++) { addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) }
            break;
        }
        case 'sector-annulus': {
            const ro = shape.outerRadius || 1;
            const ri = shape.innerRadius || 1;
            const angle = shape.centralAngle || 90;
            const half = d2r(angle / 2);
            const outerPts = arcPoints(0, 0, ro, -half, half, 80);
            const innerPts = arcPoints(0, 0, ri, half, -half, 80);
            addLine(outerPts[0][0], outerPts[0][1], innerPts[0][0], innerPts[0][1]);
            for (let i = 0; i < outerPts.length - 1; i++) { addLine(outerPts[i][0], outerPts[i][1], outerPts[i + 1][0], outerPts[i + 1][1]) }
            const lastOuter = outerPts.length - 1;
            const lastInner = innerPts.length - 1;
            addLine(outerPts[lastOuter][0], outerPts[lastOuter][1], innerPts[lastInner][0], innerPts[lastInner][1]);
            for (let i = 0; i < innerPts.length - 1; i++) { addLine(innerPts[i][0], innerPts[i][1], innerPts[i + 1][0], innerPts[i + 1][1]) }
            break;
        }
        case 'triangle': {
            const verts = triangleVertices(shape.sideA || 1, shape.sideB || 1, shape.sideC || 1);
            if (verts && verts.length === 3) {
                for (let i = 0; i < 3; i++) {
                    const [x1, y1] = verts[i];
                    const [x2, y2] = verts[(i + 1) % 3];
                    addLine(x1, -y1, x2, -y2);
                }
            }
            break;
        }
        case 'regular-polygon': {
            const n = Math.max(3, Math.round(shape.sides || 6));
            const R = (shape.sideLength || 1) / (2 * Math.sin(Math.PI / n));
            const verts = regularPolygonVertices(n, R);
            for (let i = 0; i < verts.length; i++) {
                const [x1, y1] = verts[i];
                const [x2, y2] = verts[(i + 1) % verts.length];
                addLine(x1, -y1, x2, -y2);
            }
            break;
        }
        case 'trapezoid': {
            const verts = trapezoidVertices(
                shape.topBase || 1, shape.bottomBase || 2, shape.height || 1,
                shape.leftAngle || 60, shape.rightAngle || 60
            );
            if (verts && verts.length === 4) {
                for (let i = 0; i < 4; i++) {
                    const [x1, y1] = verts[i];
                    const [x2, y2] = verts[(i + 1) % 4];
                    addLine(x1, -y1, x2, -y2);
                }
            }
            break;
        }
        default: {
            const pts = [];
            for (let i = 0; i < 36; i++) {
                const a = (2 * Math.PI * i) / 36;
                pts.push([10 * Math.cos(a), -10 * Math.sin(a)]);
            }
            for (let i = 0; i < pts.length - 1; i++) addLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
            addLine(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
            break;
        }
    }
    // ---- 统计信息 ----
    const textLayer = 'TEXT_LAYER';
    const textColor = 7;
    const styleName = 'CNSTYLE';
    const textHeight = 50;
    const b = getShapeBounds(shape);
    const startX = 0;
    let yPos = Math.min(b.minY, -100) - 150;
    function encodeDxfText(value) {
        return Array.from(value).map(function (char) {
            var code = char.codePointAt(0);
            if (code < 128) { return char }
            return '\\U+' + code.toString(16).toUpperCase().padStart(4, '0');
        }).join('');
    }
    function addTextLine(text) {
        lines.push(
            '0\nTEXT\n8\n' + textLayer + '\n62\n' + textColor + '\n7\n' + styleName,
            '10\n' + startX.toFixed(3) + '\n20\n' + yPos.toFixed(3) + '\n40\n' + textHeight,
            '1\n' + encodeDxfText(text) + '\n72\n1\n11\n' + startX.toFixed(3) + '\n21\n' + yPos.toFixed(3)
        );
        yPos -= textHeight * 1.5;
    }
    const paramLines = getShapeParamsLines(shape);
    for (const line of paramLines) addTextLine(line);
    addTextLine('--------------------');
    addTextLine('\u5217\u6570: ' + (cols !== null ? cols : '--'));
    addTextLine('\u884c\u6570: ' + (rows !== null ? rows : '--'));
    addTextLine('\u5305\u56f4\u76d2: ' + totalW.toFixed(0) + ' x ' + totalH.toFixed(0) + ' mm');
    addTextLine('\u5927\u77e9\u5f62\u6570: ' + largeCount);
    if (smallCount > 0) addTextLine('\u5c0f\u77e9\u5f62\u6570: ' + smallCount);
    addTextLine('\u603b\u9762\u79ef: ' + totalArea.toFixed(4) + ' m2');
    if (currentMode === 'surround' && allowance > 0 && filtered) {
        addTextLine('\u5b9e\u9645\u8fb9\u6cbf\u7559\u7a7a: ' + allowance + ' mm (\u8fc7\u6ee4 ' + (noAllowanceCount - allRects.length) + ' \u4e2a\u77e9\u5f62)');
    }
    lines.push('0', 'ENDSEC', '0', 'EOF');
    const smallW = (smallCount > 0) ? lastResult.small[0].w : 0;
    const smallH = (smallCount > 0) ? lastResult.small[0].h : 0;
    const fileName = generateFileName(shape, lastW1, lastH1, smallW, smallH, totalW, totalH);
    const dxfStr = lines.join('\n');
    const blob = new Blob([dxfStr], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName + '.dxf';
    link.click();
    URL.revokeObjectURL(url);
});
// 窗口缩放时重绘
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (lastResult && lastShape) { renderResult(lastShape, lastResult, lastW1, lastH1, currentMode) } }, 150);
});
/* ==========================================================
   侧边栏折叠 + 画布隐藏(400px)
   ========================================================== */
function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const scroll = document.getElementById('sidebar-scroll');
    const toggle = document.getElementById('sidebar-toggle');
    const collapse = document.getElementById('sidebar-collapse');
    // 上下折叠
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        scroll.classList.toggle('collapsed');
        sidebar.classList.toggle('collapsed-y');
    });
    // 左右折叠
    collapse.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('collapsed-x');
        // 重新计算画布尺寸
        setTimeout(() => {
            const wrap = document.getElementById('canvas-wrap');
            if (wrap) wrap.dispatchEvent(new Event('resize'));
        }, 260);
    });
}
function checkCanvasVisibility() {
    const wrap = document.getElementById('canvas-wrap');
    if (!wrap) return;
    wrap.classList.toggle('canvas-hidden', wrap.clientWidth < 400);
}
// ── 初始化 ───────────────────────────
(function init() {
    initSidebarToggle();
    const update = () => {
        const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
        mainSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        document.querySelector('#grid-rect').setAttribute('width', w);
        document.querySelector('#grid-rect').setAttribute('height', h);
        chV.setAttribute('y1', 0); chV.setAttribute('y2', h);
        chH.setAttribute('x1', 0); chH.setAttribute('x2', w);
        checkCanvasVisibility();
    };
    update();
    window.addEventListener('resize', () => {
        update();
        if (lastResult && lastShape) { renderResult(lastShape, lastResult, lastW1, lastH1, currentMode) }
    });
})();