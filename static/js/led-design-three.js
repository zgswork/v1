import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeBufferGeometries } from 'three/addons/utils/BufferGeometryUtils.js';//将几何体合并为一个几何体
// ===== DOM 引用 =====
const container = document.getElementById('threeContainer');
const viewInfo = document.getElementById('modelStatus');
// ===== 场景、相机、渲染器 =====
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
// 覆盖层独立组（不受 mainGroup 清空影响）
//
const overlayGroup = new THREE.Group();
scene.add(overlayGroup);
let overlayTexture = null;      // 当前纹理对象
let overlayVideo = null;        // 修订：当前视频元素引用（视频贴图时保留，避免被回收导致黑屏）
// 修订：文字覆盖独立组（3D贴面方案，文字绘制在Canvas上作为纹理贴在模型显示面）
const textOverlayGroup = new THREE.Group();
scene.add(textOverlayGroup);
//
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
// 修订：支持极限缩小（哪怕是缩小到一个点）—— 放宽 near/far 范围，避免模型缩到很小后被裁剪消失
camera.near = 1e-4;
camera.far = 1e9;
camera.updateProjectionMatrix();
camera.position.set(8, 6, 12);
camera.lookAt(0, 0, 0);
// ---- 新增：正交相机 ----
const orthoCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
// 修订：正交相机同样放宽 near/far，并允许 near 为负，避免显示不全
orthoCamera.near = -1e7;
orthoCamera.far = 1e7;
orthoCamera.position.copy(camera.position);
orthoCamera.lookAt(0, 0, 0);
let activeCamera = camera;   // 当前激活的相机
// WebGL渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;   // 修订：启用局部剖切，供截面视图使用
container.appendChild(renderer.domElement);
// 修订：截面剖切平面（过原点，法向随视角更新）
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let sectionEnabled = false;
// CSS2渲染器（用于文字标签，可选）
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(container.clientWidth, container.clientHeight);
// 修订：CSS2渲染器覆盖层定位改用CSS类 .css2d-label-layer（原内联style）
labelRenderer.domElement.classList.add('css2d-label-layer');
container.appendChild(labelRenderer.domElement);
// ===== 控制器 =====
const controls = new OrbitControls(activeCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = false;
controls.autoRotateSpeed = 2.0;   // 修订：与转速滑块默认值一致
controls.target.set(0, 0, 0);
// 修订：限制滚轮缩放范围，防止模型缩小到消失或无限放大
//   透视相机：OrbitControls 滚轮改变 position 距离，设极宽范围配合 near=1e-4/far=1e9
//   正交相机：OrbitControls 滚轮改变 zoom，必须限制下限否则 zoom→0 内容缩成不可见
controls.minDistance = 1e-3;
controls.maxDistance = 1e7;
controls.minZoom = 1e-3;
controls.maxZoom = 1e4;
// 修订：禁用 OrbitControls 自带滚轮缩放（指数缩放，单次跳变过大），
//       改用下方自定义 wheel 监听器，固定比例线性缩放，流畅可控。
controls.enableZoom = false;
controls.update();
// 修订：自定义滚轮缩放，替代 OrbitControls 默认指数缩放，使每次滚动变化均匀流畅
//   透视：距离按固定比例(×0.9 / ×1.1)增减，每次滚动变化一致
//   正交：zoom 按固定比例(×0.9 / ×1.1)增减，每次滚动变化一致
renderer.domElement.addEventListener('wheel', function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();   // 阻止 OrbitControls 默认滚轮处理
    if (_updatingView) return;
    const delta = Math.sign(e.deltaY);   // +1 向下滚(缩小)，-1 向上滚(放大)
    const factor = delta > 0 ? 0.9 : 1.1; // 每次滚动 10% 变化
    if (activeCamera.isPerspectiveCamera) {
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
        let dist = offset.length();
        dist = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist * factor));
        offset.normalize();
        camera.position.copy(controls.target).add(offset.multiplyScalar(dist));
        controls.update();
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
    } else {
        // 修订：正交缩放统一用"投影半宽 half"机制（与缩放滑块一致）。
        //   原因：OrbitControls.update() 会把 orthoCamera.zoom 重置为内部 _zoomEnd(=1)，
        //         导致滚轮改 zoom 后立即被还原 → 模型不变、滑块点与数字不同步。改 frustum half 不受 update() 影响。
        const curHalf = Math.abs(orthoCamera.top) || baseFitHalfSize || 5;
        let half = Math.max(1e-4, curHalf * factor);   // factor 0.9→half变小(放大)，1.1→half变大(缩小)
        const aspect = container.clientWidth / container.clientHeight;
        if (aspect > 1) {
            orthoCamera.left = -half * aspect; orthoCamera.right = half * aspect;
            orthoCamera.top = half; orthoCamera.bottom = -half;
        } else {
            orthoCamera.left = -half; orthoCamera.right = half;
            orthoCamera.top = half / aspect; orthoCamera.bottom = -half / aspect;
        }
        orthoCamera.zoom = 1;
        orthoCamera.updateProjectionMatrix();
        controls.update();
        camera.position.copy(orthoCamera.position);
        camera.lookAt(controls.target);
    }
    // 同步缩放滑块显示
    syncZoomSlider();
}, { passive: false });
// 修订：根据当前相机状态同步缩放滑块（点+数字）—— 透视=距离比，正交=投影半宽比
function syncZoomSlider() {
    const zoomSlider = document.getElementById('zoomLevel');
    const zoomValDisplay = document.getElementById('zoomVal');
    if (!zoomSlider || _updatingView) return;
    let factor = 1;
    if (activeCamera.isPerspectiveCamera) {
        const dist = activeCamera.position.distanceTo(controls.target);
        if (baseFitDist > 0 && dist > 0) factor = baseFitDist / dist;  // 距离越小→放大倍率越大
    } else {
        // 修订：正交缩放 factor = baseFitHalfSize / 当前半宽(=|top|)
        const curHalf = Math.abs(orthoCamera.top) || baseFitHalfSize || 5;
        factor = (baseFitHalfSize || curHalf) / curHalf;
    }
    // 反推滑块值：factor = 10^(v/100) → v = log10(factor)*100
    let sliderVal = Math.log10(Math.max(factor, 1e-6)) * 100;
    sliderVal = Math.max(-100, Math.min(100, sliderVal));
    zoomSlider.value = sliderVal;
    if (zoomValDisplay) zoomValDisplay.textContent = factor.toFixed(2) + 'x';
}
// 修订：根据当前相机位置同步旋转滑块（X方位角/Y俯仰角）—— 鼠标拖动旋转时数字跟随更新
function syncRotationSliders() {
    if (_updatingView) return;
    const offset = new THREE.Vector3().subVectors(activeCamera.position, controls.target);
    const dist = offset.length();
    if (dist < 1e-6) return;
    // 与 newRotX/newRotY 的球坐标一致：az=atan2(x,z)，elev=asin(y/dist)
    const az = Math.atan2(offset.x, offset.z) * 180 / Math.PI;
    const elev = Math.asin(Math.max(-1, Math.min(1, offset.y / dist))) * 180 / Math.PI;
    const rotXEl = document.getElementById('rotX');
    const rotYEl = document.getElementById('rotY');
    const rotXVal = document.getElementById('rotXVal');
    const rotYVal = document.getElementById('rotYVal');
    if (rotXEl) rotXEl.value = az;
    if (rotYEl) rotYEl.value = elev;
    if (rotXVal) rotXVal.textContent = Math.round(az) + '°';
    if (rotYVal) rotYVal.textContent = Math.round(elev) + '°';
}
// 修订：相机变化时同步缩放与旋转滑块（滚轮缩放 / 鼠标拖动旋转均触发）
controls.addEventListener('change', function () { syncZoomSlider(); syncRotationSliders(); });
// ===== 灯光 =====
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
const d = 15;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 30;
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
fillLight.position.set(-10, 0, 10);
scene.add(fillLight);
const backLight = new THREE.DirectionalLight(0x4488ff, 0.3);
backLight.position.set(0, -5, -15);
scene.add(backLight);
// ===== 辅助：网格、坐标轴 =====
// 修订：改为 let 以便根据模型尺寸动态重建
let gridHelper = new THREE.GridHelper(20, 20, 0x88ccff, 0x446688);
gridHelper.position.y = -0.01;
scene.add(gridHelper);
let axesHelper = new THREE.AxesHelper(6);
scene.add(axesHelper);
// 修订：创建加粗坐标轴（Mesh圆柱+圆锥，替代细线 AxesHelper）
function createThickAxes(size) {
    const group = new THREE.Group();
    const radius = Math.max(size * 0.008, 1);   // 圆柱半径，确保有粗度
    const headLen = size * 0.15;
    const headRad = Math.max(size * 0.04, 2);
    const colors = [0xff0000, 0x00ff00, 0x0000ff];   // X红 Y绿 Z蓝
    const axes = [
        { rot: { z: -Math.PI / 2 }, pos: [size / 2, 0, 0], headRot: { z: -Math.PI / 2 }, headPos: [size + headLen / 2, 0, 0] },
        { rot: {}, pos: [0, size / 2, 0], headRot: {}, headPos: [0, size + headLen / 2, 0] },
        { rot: { x: Math.PI / 2 }, pos: [0, 0, size / 2], headRot: { x: Math.PI / 2 }, headPos: [0, 0, size + headLen / 2] }
    ];
    axes.forEach((ax, i) => {
        const cyl = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, size, 12),
            new THREE.MeshBasicMaterial({ color: colors[i] })
        );
        if (ax.rot.z !== undefined) cyl.rotation.z = ax.rot.z;
        if (ax.rot.x !== undefined) cyl.rotation.x = ax.rot.x;
        cyl.position.set(...ax.pos);
        group.add(cyl);
        const head = new THREE.Mesh(
            new THREE.ConeGeometry(headRad, headLen, 12),
            new THREE.MeshBasicMaterial({ color: colors[i] })
        );
        if (ax.headRot.z !== undefined) head.rotation.z = ax.headRot.z;
        if (ax.headRot.x !== undefined) head.rotation.x = ax.headRot.x;
        head.position.set(...ax.headPos);
        group.add(head);
    });
    return group;
}
// 修订：根据模型尺寸重建网格和坐标轴
function updateHelpers(modelW, modelH) {
    // 网格：按模型长度铺满，间隔为单元宽度（自定增大）
    const gridSize = Math.max(modelW, modelH) * 1.3;
    const interval = Math.max(currentParams.dycd || 320, 100);   // 间隔可自定增大，默认取单元宽度
    const divisions = Math.max(Math.round(gridSize / interval), 4);
    scene.remove(gridHelper);
    gridHelper.geometry?.dispose();
    gridHelper = new THREE.GridHelper(gridSize, divisions, 0x88ccff, 0x446688);
    gridHelper.position.y = -0.01;
    gridHelper.visible = !!(document.getElementById('showGrid')?.checked);
    scene.add(gridHelper);
    // 坐标轴：长度约为模型长高最小值的 1/4，加粗方便看到
    const axesSize = Math.max(Math.min(modelW, modelH) / 4, 10);
    scene.remove(axesHelper);
    axesHelper.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) obj.material.dispose(); });
    axesHelper = createThickAxes(axesSize);
    axesHelper.visible = !!(document.getElementById('showAxes')?.checked);
    scene.add(axesHelper);
}
// ===== 状态变量 =====
let mainGroup = new THREE.Group();
scene.add(mainGroup);
//ProfileLib — 通用型材杆件生成库 (内嵌)
(function (global) {
    'use strict';
    //解析截面字符串为数字数组
    function parseSpec(spec) { return spec.toLowerCase().split(/[x×*,;|]/).map(Number) }
    //角度 → 弧度，Three.js 的旋转全是弧度制
    function rad(deg) { return deg * Math.PI / 180; }
    //==================== 截面形状生成函数 ====================//
    //方管squareTubeShape  p：[外边长, 壁厚]
    function squareTubeShape(p) {
        const s = p[0], t = p[1] || s * 0.08, o = s / 2;//t：壁厚（没给就默认 8%）
        const shape = new THREE.Shape();
        shape.moveTo(-o, -o); shape.lineTo(o, -o); shape.lineTo(o, o); shape.lineTo(-o, o); shape.closePath();
        const hole = new THREE.Shape();
        const i = o - t;
        hole.moveTo(-i, -i); hole.lineTo(i, -i); hole.lineTo(i, i); hole.lineTo(-i, i); hole.closePath();
        return { shape, hole, label: `□${s}×${t}`, area: s * s - (s - 2 * t) * (s - 2 * t) };
    }
    //圆管 roundTubeShape  p：[外径, 壁厚]
    function roundTubeShape(p) {
        const D = p[0], t = p[1] || D * 0.08, segs = 48;
        const shape = new THREE.Shape();
        for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2, r = D / 2; i === 0 ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        const hole = new THREE.Shape();
        for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2, r = D / 2 - t; i === 0 ? hole.moveTo(Math.cos(a) * r, Math.sin(a) * r) : hole.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        return { shape, hole, label: `∅${D}×${t}`, area: Math.PI * (D * D - (D - 2 * t) * (D - 2 * t)) / 4 };
    }
    //H 型钢 / 工字钢 hBeamShape  p：[H, B, tw, tf]
    function hBeamShape(p) {
        const H = p[0], B = p[1] || H * 0.6, tw = p[2] || H * 0.04, tf = p[3] || H * 0.06;
        const hw = H / 2, bw = B / 2, tw2 = tw / 2;
        const shape = new THREE.Shape();
        shape.moveTo(-bw, -hw); shape.lineTo(bw, -hw); shape.lineTo(bw, -hw + tf);
        shape.lineTo(tw2, -hw + tf); shape.lineTo(tw2, hw - tf); shape.lineTo(bw, hw - tf);
        shape.lineTo(bw, hw); shape.lineTo(-bw, hw); shape.lineTo(-bw, hw - tf);
        shape.lineTo(-tw2, hw - tf); shape.lineTo(-tw2, -hw + tf); shape.lineTo(-bw, -hw + tf); shape.closePath();
        return { shape, hole: null, label: `H${H}×${B}×${tw}×${tf}`, area: 2 * B * tf + tw * (H - 2 * tf) };
    }
    //槽钢 channelShape  p：[H, B, tw, tf]
    function channelShape(p) {
        const H = p[0], B = p[1] || H * 0.5, tw = p[2] || H * 0.04, tf = p[3] || H * 0.06;
        const hw = H / 2, tw2 = tw / 2;
        const shape = new THREE.Shape();
        shape.moveTo(0, -hw); shape.lineTo(B, -hw); shape.lineTo(B, -hw + tf);
        shape.lineTo(tw2, -hw + tf); shape.lineTo(tw2, hw - tf); shape.lineTo(B, hw - tf);
        shape.lineTo(B, hw); shape.lineTo(0, hw); shape.closePath();
        return { shape, hole: null, label: `C${H}×${B}×${tw}×${tf}`, area: 2 * B * tf + tw * (H - 2 * tf) };
    }
    //角钢 angleShape  p：[L, t]
    function angleShape(p) {
        const L = p[0], t = p[1] || L * 0.08;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(L, 0); shape.lineTo(L, t); shape.lineTo(t, t); shape.lineTo(t, L); shape.lineTo(0, L); shape.closePath();
        return { shape, hole: null, label: `L${L}×${t}`, area: L * t + (L - t) * t };
    }
    //矩形管 rectTubeShape  p：[W, H, t]
    function rectTubeShape(p) {
        const W = p[0], H = p[1] || W * 0.6, t = p[2] || Math.min(W, H) * 0.08;
        const shape = new THREE.Shape();
        shape.moveTo(-W / 2, -H / 2); shape.lineTo(W / 2, -H / 2); shape.lineTo(W / 2, H / 2); shape.lineTo(-W / 2, H / 2); shape.closePath();
        const hole = new THREE.Shape();
        hole.moveTo(-W / 2 + t, -H / 2 + t); hole.lineTo(W / 2 - t, -H / 2 + t); hole.lineTo(W / 2 - t, H / 2 - t); hole.lineTo(-W / 2 + t, H / 2 - t); hole.closePath();
        return { shape, hole, label: `□${W}×${H}×${t}`, area: W * H - (W - 2 * t) * (H - 2 * t) };
    }
    //圆钢 roundBarShape  p：[D]
    function roundBarShape(p) {
        const D = p[0], segs = 32;
        const shape = new THREE.Shape();
        for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2, r = D / 2; i === 0 ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        return { shape, hole: null, label: `●${D}`, area: Math.PI * D * D / 4 };
    }
    //方钢 squareBarShape  p：[边长]
    function squareBarShape(p) {
        const s = p[0], o = s / 2;
        const shape = new THREE.Shape();
        shape.moveTo(-o, -o); shape.lineTo(o, -o); shape.lineTo(o, o); shape.lineTo(-o, o); shape.closePath();
        return { shape, hole: null, label: `■${s}`, area: s * s };
    }
    //T型钢 tBeamShape  p：[H, B, tw, tf]
    function tBeamShape(p) {
        const H = p[0], B = p[1] || H * 0.6, tw = p[2] || H * 0.04, tf = p[3] || H * 0.06;
        const hw = H / 2, bw = B / 2, tw2 = tw / 2;
        const shape = new THREE.Shape();
        shape.moveTo(-bw, hw); shape.lineTo(bw, hw); shape.lineTo(bw, hw - tf);
        shape.lineTo(tw2, hw - tf); shape.lineTo(tw2, -hw); shape.lineTo(-tw2, -hw);
        shape.lineTo(-tw2, hw - tf); shape.lineTo(-bw, hw - tf); shape.closePath();
        return { shape, hole: null, label: `T${H}×${B}×${tw}×${tf}`, area: B * tf + tw * (H - tf) };
    }
    const PROFILES = {
        square_tube: { name: '方管', fn: squareTubeShape, defColor: 0x8899aa, sides: 4 },
        round_tube: { name: '圆管', fn: roundTubeShape, defColor: 0x8899aa, sides: 24 },
        rect_tube: { name: '矩形管', fn: rectTubeShape, defColor: 0x8899aa, sides: 4 },
        h_beam: { name: 'H型钢', fn: hBeamShape, defColor: 0x99aabb, sides: 12 },
        i_beam: { name: '工字钢', fn: hBeamShape, defColor: 0x99aabb, sides: 12 },
        channel: { name: '槽钢', fn: channelShape, defColor: 0x99aabb, sides: 12 },
        angle: { name: '角钢', fn: angleShape, defColor: 0xaa9988, sides: 8 },
        t_beam: { name: 'T型钢', fn: tBeamShape, defColor: 0x99aabb, sides: 12 },
        round_bar: { name: '圆钢', fn: roundBarShape, defColor: 0xbbbbbb, sides: 16 },
        square_bar: { name: '方钢', fn: squareBarShape, defColor: 0xbbbbbb, sides: 4 },
    };
    //核心函数：createMember
    //type：型材 key（如 h_beam）、spec：规格字符串、start/end：[x,y,z] 起点终点、options：颜色、金属度、粗糙度等
    function createMember(type, spec, start, end, options) {
        options = options || {};//防止未传参报错
        const profile = PROFILES[type];
        if (!profile) throw new Error('未知截面: ' + type);
        const params = Array.isArray(spec) ? spec : parseSpec(spec);
        const { shape, hole, label, area } = profile.fn(params);
        const len = Math.sqrt((start[0] - end[0]) ** 2 + (start[1] - end[1]) ** 2 + (start[2] - end[2]) ** 2);
        if (len < 0.001) throw new Error('起点终点不能重合');//防止零长度杆件
        const extrudeSettings = { depth: len, bevelEnabled: false, curveSegments: profile.sides };//depth：拉伸长度 = 杆长、bevelEnabled:false：不要倒角（工业构件）、curveSegments：圆滑度
        if (hole) shape.holes = [hole];//有内孔就挖洞（方管、圆管）
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);//把二维截面拉伸成三维几何体
        geom.computeVertexNormals();
        const color = options.color !== undefined ? options.color : profile.defColor;
        const metal = options.metalness !== undefined ? options.metalness : 0.75;
        const rough = options.roughness !== undefined ? options.roughness : 0.35;
        // 修订：显式设为不透明，确保钢结构实体全部不透明
        // 修订：side 改为 FrontSide —— DoubleSide 会导致从前面能看到后面内壁，看起来透光
        //       FrontSide 只渲染外表面，配合 depthWrite:true 实现正确的实体遮挡效果
        const mat = new THREE.MeshStandardMaterial({
            color,
            metalness: metal,
            roughness: rough,
            side: THREE.FrontSide,
            transparent: false,
            opacity: 1.0,
            depthWrite: true,
            depthTest: true,
        });
        const mesh = new THREE.Mesh(geom, mat);//几何 + 材质 = Mesh
        if (options.showEdges !== false) {
            const edges = new THREE.EdgesGeometry(geom, 25);
            const el = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: options.edgeColor || 0x222222, linewidth: 1 }));//EdgesGeometry：提取硬边、LineSegments：画线、让杆件看起来像 CAD / BIM
            mesh.add(el);
        }
        const group = new THREE.Group();
        group.add(mesh);//用 Group 包裹 Mesh
        group.position.set(start[0], start[1], start[2]);;//把起点放到世界坐标
        const zAxis = new THREE.Vector3(0, 0, 1);//Three.js 中，ExtrudeGeometry 默认沿 Z 轴拉伸
        const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize();//计算杆件方向向量、normalize()：单位向量
        const quat = new THREE.Quaternion().setFromUnitVectors(zAxis, dir);//四元数旋转、把 Z 轴“掰”到杆件方向
        group.quaternion.copy(quat);//应用到 Group
        if (options.rotation) {
            const angle = rad(options.rotation);
            const axis = new THREE.Vector3(0, 0, 1);
            group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
        }//绕杆自身轴线旋转、用于角钢、槽钢的“朝向”
        // 修订：重量按"截面延米重"计算 —— 延米重(kg/m)=area(mm²)×0.00785；重量(kg)=延米重×(len/1000)=area×len×7.85e-6
        const weightPerMeter = area * 0.00785;          // 延米重 kg/m（工程公式 W=0.00785·F，F 为截面积 mm²）
        const weight = weightPerMeter * (len / 1000);   // 实际重量 kg
        group.userData = Object.assign({ type, profileName: profile.name, spec: label, length: len, area, weightPerMeter, weight, start, end }, options.userData || {});//存储所有工程数据、weightPerMeter：延米重、weight：实际重量、用于：UI 列表统计
        mesh.userData.parent = group;//双向引用，方便拾取
        return group;//返回可直接加入 scene 的对象
    }
    const ProfileLib = { createMember, PROFILES, version: '1.0.0' };//暴露 API对外接口
    if (typeof module !== 'undefined' && module.exports) module.exports = ProfileLib;//Node.js / 浏览器兼容、浏览器下：window.ProfileLib
    else global.ProfileLib = ProfileLib;
})(typeof window !== 'undefined' ? window : this);//IIFE 结束
// ========== MODIFIED: 解析型材规格字符串 ==========
function parseProfile(str) {
    if (!str || !str.trim()) return null;
    const s = str.trim();
    const nums = s.match(/\d+\.?\d*/g)?.map(Number) || [];// 提取所有数字（包括小数）
    if (nums.length === 0) return null;
    let type = null;
    // 根据关键词判断类型
    const map = { '矩形管': 'rect_tube', '圆管': 'round_tube', 'H型钢|H钢': 'h_beam', '工字钢': 'i_beam', '槽钢': 'channel', '角钢': 'angle', 'T型钢': 't_beam', '圆钢': 'round_bar', '方钢': 'square_bar', '埋件': 'steel_plate', };
    for (const [k, v] of Object.entries(map)) { if (new RegExp(k).test(s)) { type = v; break; } }
    if (s.includes('方管')) { type = nums.length === 2 ? 'square_tube' : 'rect_tube'; }
    else if (!type) { if (nums.length === 2) type = 'square_tube'; else if (nums.length === 3) type = 'rect_tube'; else return null; }
    return { type, spec: nums };
}
// 当前参数缓存
let currentParams = { plls: 10, plhs: 10, dycd: 320, dygd: 160, dyhd: 80, bbsb: 50, bbxb: 50, bbcb: 50, pthd: 100, ldgd: 0, jlwd: 0, lkjx: 0, mjhj: 0, mjsj: 0, steelColor: '#cccccc', moduleColor: '#aaccff', frameColor: '#555555', azys: '壁挂', dybt: '', bthg: '', ntlg: '', sphg: '', zcsg: '', flmj: '200*200*10埋件' };
// 修订：记录“全部显示”时的基础距离/半宽，缩放滑块以中间0=全部显示(1x)为基准
//       滑块左负=缩小(模型变小)，右正=放大(模型变大)，factor = 10^(slider/100)
let baseFitDist = 12;        // 透视相机：全部显示时的相机距离
let baseFitHalfSize = 5;     // 正交相机：全部显示时的半宽
function fitModelToView() {
    if (!mainGroup || mainGroup.children.length === 0) return;
    const box = new THREE.Box3().setFromObject(mainGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim < 0.001) return; // 防止模型为空或尺寸极小
    if (activeCamera.isPerspectiveCamera) {
        const fovRad = activeCamera.fov * Math.PI / 180;
        const dist = maxDim / (2 * Math.tan(fovRad / 2)) * 1.2;
        baseFitDist = dist;   // 修订：记录全部显示时的基础距离
        const direction = new THREE.Vector3().copy(activeCamera.position).sub(controls.target).normalize();
        if (direction.length() < 0.001) direction.set(0, 0, 1).normalize();
        activeCamera.position.copy(center).add(direction.multiplyScalar(dist));
        controls.target.copy(center);
        controls.update();
        // 同步另一个相机（为切换做准备）
        orthoCamera.position.copy(activeCamera.position);
        orthoCamera.lookAt(center);
    } else if (activeCamera.isOrthographicCamera) {
        const margin = 1.2;
        const halfSize = maxDim / 2 * margin;
        baseFitHalfSize = halfSize;   // 修订：记录全部显示时的基础半宽
        const aspect = container.clientWidth / container.clientHeight;
        if (aspect > 1) {
            activeCamera.left = -halfSize * aspect;
            activeCamera.right = halfSize * aspect;
            activeCamera.top = halfSize;
            activeCamera.bottom = -halfSize;
        } else {
            activeCamera.left = -halfSize;
            activeCamera.right = halfSize;
            activeCamera.top = halfSize / aspect;
            activeCamera.bottom = -halfSize / aspect;
        }
        // 调整远近平面，确保模型在深度范围内
        activeCamera.near = -1e7;
        activeCamera.far = 1e7;
        activeCamera.zoom = 1;          // 修订：重置 zoom，避免 OrbitControls 残留缩放导致显示不全
        activeCamera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.update();
        // 修订：正交相机显式朝向模型中心，确保六视图角度正确（controls.update 已处理，此处双保险）
        activeCamera.lookAt(center);
        camera.position.copy(activeCamera.position);
        camera.lookAt(center);
    }
    // 修订：缩放滑块归零 = 全部显示(1x)，位于滑动条中间
    const zoomSlider = document.getElementById('zoomLevel');
    if (zoomSlider) {
        zoomSlider.value = 0;
        const zoomValDisplay = document.getElementById('zoomVal');
        if (zoomValDisplay) zoomValDisplay.textContent = '1.00x';
    }
}
// ===== 构建模型 =====
let remindstr = "";
function buildLEDModel(params) {
    // 清除旧模型
    // 递归释放对象及其子对象的 GPU 资源
    function disposeObject(obj) {
        if (!obj) return;
        if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose() }
        }
        if (obj.children) { for (let i = obj.children.length - 1; i >= 0; i--) { disposeObject(obj.children[i]) } }
    }
    while (mainGroup.children.length > 0) { const child = mainGroup.children[0]; disposeObject(child); mainGroup.remove(child) }// 清空主模型组
    while (overlayGroup.children.length > 0) { const child = overlayGroup.children[0]; disposeObject(child); overlayGroup.remove(child) }// 清空覆盖层独立组（如果存在）
    // 修订：清空文字覆盖组
    while (textOverlayGroup.children.length > 0) { const child = textOverlayGroup.children[0]; disposeObject(child); textOverlayGroup.remove(child) }
    const { plls, plhs, dycd, dygd, dyhd, bbsb, bbxb, bbcb, pthd, ldgd, jlwd, lkjx, mjhj, mjsj, steelColor, moduleColor, frameColor, colorCheckbox, azys, dybt, bthg, ntlg, sphg, zcsg, flmj, moduleEdgesCheckbox, showFrameCheckbox, pggtCheckbox } = params;
    const xscd = plls * dycd, xsgd = plhs * dygd, ptcd = xscd + bbcb * 2, ptgd = xsgd + bbsb + bbxb;
    const moduleMat = new THREE.MeshStandardMaterial({//模组
        color: moduleColor,
        roughness: 0.9,//粗糙度
        metalness: 0.0,//金属感
        emissive: new THREE.Color(moduleColor).multiplyScalar(0.05),
        side: THREE.FrontSide,   // 修订：仅正面可见，确保实体不透光
        transparent: false,   // 强制不透明
        opacity: 1.0,         // 完全不透明
        depthWrite: true,     // 写入深度缓冲，防止后物穿透
        // 修订：模组表面 polygonOffset 推后，配合 overlay 的 polygonOffset 前移，彻底消除共面斜纹
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    // 修订：标记模组数量，供材料清单统计
    const moduleCount = plls * plhs;
    if (1 == 1) {
        const moduleGeo = new THREE.BoxGeometry(xscd, xsgd, dyhd);
        const module = new THREE.Mesh(moduleGeo, moduleMat);
        module.position.set(0, 0, dyhd * -0.5);
        module.userData.isModule = true;          // 修订：标记为模组，用于材料清单统计
        module.userData.moduleCount = moduleCount;// 整块代表 plls*plhs 个模组
        mainGroup.add(module);
        // 修订："模组边线"改为"显示边线"——始终创建边线，通过 updateAllEdgesVisibility() 统一控制可见性
        if (moduleEdgesCheckbox) {
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x888888 });
            // 竖向线（列分隔）
            for (let c = 1; c < plls; c++) {
                const x = -xscd / 2 + c * dycd;
                const pts = [new THREE.Vector3(x, -xsgd / 2, 0.05), new THREE.Vector3(x, xsgd / 2, 0.05)];
                const g = new THREE.BufferGeometry().setFromPoints(pts);
                mainGroup.add(new THREE.Line(g, edgeMat));
            }
            // 横向线（行分隔）
            for (let r = 1; r < plhs; r++) {
                const y = xsgd / 2 - r * dygd;
                const pts = [new THREE.Vector3(-xscd / 2, y, 0.05), new THREE.Vector3(xscd / 2, y, 0.05)];
                const g = new THREE.BufferGeometry().setFromPoints(pts);
                mainGroup.add(new THREE.Line(g, edgeMat));
            }
            // 外框
            const outerPts = [
                new THREE.Vector3(-xscd / 2, -xsgd / 2, 0.05),
                new THREE.Vector3(xscd / 2, -xsgd / 2, 0.05),
                new THREE.Vector3(xscd / 2, xsgd / 2, 0.05),
                new THREE.Vector3(-xscd / 2, xsgd / 2, 0.05),
                new THREE.Vector3(-xscd / 2, -xsgd / 2, 0.05)
            ];
            const og = new THREE.BufferGeometry().setFromPoints(outerPts);
            mainGroup.add(new THREE.Line(og, edgeMat));
        }
    } else {
        const moduleGeo = new THREE.BoxGeometry(dycd, dygd, dyhd);
        const startX = -xscd / 2 + dycd / 2;
        const startY = xsgd / 2 - dygd / 2;
        const totalModules = plls * plhs;
        if (totalModules > 200) {// 阈值可调整
            // 实例化方式
            const dummy = new THREE.Object3D();
            const instanceMesh = new THREE.InstancedMesh(moduleGeo, moduleMat, totalModules);
            instanceMesh.castShadow = true;
            instanceMesh.receiveShadow = true;
            let index = 0;
            for (let r = 0; r < plhs; r++) {
                for (let c = 0; c < plls; c++) {
                    dummy.position.set(startX + c * dycd, startY - r * dygd, dyhd * -0.5);
                    dummy.updateMatrix();
                    instanceMesh.setMatrixAt(index, dummy.matrix);
                    index++;
                }
            }
            instanceMesh.instanceMatrix.needsUpdate = true;
            mainGroup.add(instanceMesh);
        } else {// 独立 Mesh（数量少时保持原有方式）
            for (let r = 0; r < plhs; r++) {
                for (let c = 0; c < plls; c++) {
                    const module = new THREE.Mesh(moduleGeo, moduleMat);
                    module.position.set(startX + c * dycd, startY - r * dygd, dyhd * -0.5);
                    module.castShadow = true;
                    module.receiveShadow = true;
                    // 边框
                    if (1 == 2) {
                        const edges = new THREE.EdgesGeometry(moduleGeo);
                        const lineMat = new THREE.LineBasicMaterial({ color: 0x444444 });
                        const lineSegments = new THREE.LineSegments(edges, lineMat);
                        module.add(lineSegments);
                    };
                    mainGroup.add(module);
                }
            }
        }
    }
    // ---- 贴图覆盖层（透明面，位于模组前表面处） ----
    // 修订：修复旋转产生斜纹 / 上传照片产生斜纹问题
    //       原因：overlay 平面与模组前表面（Z=0）距离仅 0.1mm，旋转时产生 z-fighting（斜纹/闪烁）。
    //       方案：① 增大偏移到 1mm；② 启用 polygonOffset 让 overlay 始终在模组表面之上；
    //             ③ 模组材质同样启用 polygonOffset 推后，彻底消除共面闪烁。
    if (overlayTexture) {
        //overlayTexture.flipY = false;
        overlayTexture.minFilter = THREE.LinearMipmapLinearFilter;
        overlayTexture.magFilter = THREE.LinearFilter;
        overlayTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); // 使用设备最高各向异性
        overlayTexture.wrapS = THREE.ClampToEdgeWrapping;
        overlayTexture.wrapT = THREE.ClampToEdgeWrapping;
        overlayTexture.needsUpdate = true;
        const overlayGeo = new THREE.PlaneGeometry(xscd, xsgd);
        // 修订：overlay 启用 polygonOffset，确保绘制在模组表面之上，消除斜纹
        // 修订：side 改为 FrontSide —— 贴图/视频只在正面（模组显示面）不透明显示，
        //       背面透明，旋转到模型后方时可看到钢结构
        // 修订：side=FrontSide（正面不透明显示，背面透明可看钢结构）；toneMapped=false 避免色调映射导致画面异常/黑屏（参考 Lonely-html）
        const overlayMat = new THREE.MeshBasicMaterial({ map: overlayTexture, transparent: true, opacity: 1.0, side: THREE.FrontSide, depthWrite: false, depthTest: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, });
        const mesh = new THREE.Mesh(overlayGeo, overlayMat);
        mesh.position.set(0, 0, 1);   // 修订：偏移 1mm，避免与模组前表面共面 z-fighting
        overlayGroup.add(mesh);
    }
    // ---- 边框（包边） ----
    if (((bbsb > 0 || bbxb > 0 || bbcb > 0) && showFrameCheckbox && showFrameCheckbox.checked) || !(pggtCheckbox && pggtCheckbox.checked)) {
        const xsCheckboxes = ['moduleEdges', 'showFrame',].map(id => document.getElementById(id));
        if (!(pggtCheckbox && pggtCheckbox.checked)) { xsCheckboxes.forEach(cb => { if (cb) cb.checked = true; }); }
        // 修订：包边材质设为完全不透明，消除半透明排序导致的闪烁
        //       原 transparent:true, opacity:0.9, depthWrite:false 会导致闪烁（半透明不写深度缓冲）
        //       改为 transparent:false, opacity:1.0, depthWrite:true，写入深度缓冲确保正确遮挡
        const material = new THREE.MeshBasicMaterial({
            color: frameColor,          // 使用外观面板的包边颜色
            side: THREE.FrontSide,      // FrontSide只渲染正面（默认）、BackSide只渲染背面、DoubleSide双面渲染
            transparent: false,         // 作用：是否开启透明渲染，默认值：false，关键点：false → 忽略 opacity、true → 启用 Alpha 混合（性能 + 排序问题）
            opacity: 1.0,               // 作用：透明度（0–1），生效前提：transparent === true
            depthWrite: true,           // 修订：写入深度缓冲，防止闪烁
        });
        const shape = new THREE.Shape();// 一次性环
        shape.moveTo(-ptcd * 0.5, -xsgd * 0.5 - bbxb);
        shape.lineTo(ptcd * 0.5, -xsgd * 0.5 - bbxb);
        shape.lineTo(ptcd * 0.5, xsgd * 0.5 + bbsb);
        shape.lineTo(-ptcd * 0.5, xsgd * 0.5 + bbsb);
        shape.closePath();
        const hole = new THREE.Path();// 挖孔（内路径方向需相反）
        hole.moveTo(-xscd * 0.5, -xsgd * 0.5);
        hole.lineTo(-xscd * 0.5, xsgd * 0.5);
        hole.lineTo(xscd * 0.5, xsgd * 0.5);
        hole.lineTo(xscd * 0.5, -xsgd * 0.5);
        hole.closePath();
        shape.holes.push(hole);
        // 辅助函数：从 ExtrudeGeometry 中提取侧面
        function extractFrontAndOuterSides(geometry, innerW, innerH) {
            const pos = geometry.toNonIndexed().attributes.position;
            const count = pos.count;
            const newPos = [];
            const eps = 1e-4; // 容差
            const halfIW = innerW / 2;
            const halfIH = innerH / 2;
            // 自动获取顶面和底面的 Z 值
            let maxZ = -Infinity, minZ = Infinity;
            for (let i = 0; i < pos.count; i++) {
                const z = pos.getZ(i);
                if (z > maxZ) maxZ = z;
                if (z < minZ) minZ = z;
            }
            const topZ = maxZ;
            const bottomZ = minZ;
            for (let i = 0; i < count; i += 3) {// 获取三个顶点
                const p0 = [pos.getX(i), pos.getY(i), pos.getZ(i)];
                const p1 = [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)];
                const p2 = [pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)];
                const zAvg = (p0[2] + p1[2] + p2[2]) / 3;
                if (Math.abs(zAvg - topZ) < eps) { newPos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]); continue; }// 1. 保留顶面（正面环）
                if (Math.abs(zAvg - bottomZ) < eps) continue;// 2. 丢弃底面（背面环）
                // 3. 侧面：判断三个顶点是否全部位于内孔矩形内部（包括边界）
                if ((p0[0] >= -halfIW - eps && p0[0] <= halfIW + eps && p0[1] >= -halfIH - eps && p0[1] <= halfIH + eps) && (p1[0] >= -halfIW - eps && p1[0] <= halfIW + eps && p1[1] >= -halfIH - eps && p1[1] <= halfIH + eps) && (p2[0] >= -halfIW - eps && p2[0] <= halfIW + eps && p2[1] >= -halfIH - eps && p2[1] <= halfIH + eps)) { continue; }
                newPos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);// 外壁侧面 → 保留
            }
            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
            newGeo.computeVertexNormals();
            return newGeo;
        }
        const mergedGeo = extractFrontAndOuterSides(new THREE.ExtrudeGeometry(shape, { depth: pthd, bevelEnabled: false }), xscd, xsgd);
        const mesh = new THREE.Mesh(mergedGeo, material);
        mesh.position.set(0, 0, -pthd);
        mainGroup.add(mesh);
        const wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(mergedGeo), new THREE.LineBasicMaterial({ color: 0x000000 }));
        wireframe.position.copy(mesh.position);// 位置与 mesh 相同
        mainGroup.add(wireframe);
    };
    // ---- 钢结构示意（使用真实型材） ----    
    function addMember(type, spec, start, end, extraOpts) {// 辅助函数：创建杆件并添加到场景
        try {
            let strColor = null;
            // 修订：原代码 if (colorCheckbox) 判断的是 DOM 元素本身（恒为真），导致未勾选时仍按尺寸着色。
            //       正确逻辑：只有勾选“材料着色”时才按尺寸区分颜色；未勾选时统一使用钢材颜色。
            if (colorCheckbox && colorCheckbox.checked) {
                if ((spec[0] <= 50 && spec[1] <= 30) || (spec[0] <= 30 && spec[1] <= 50)) { strColor = '#ffbf7f' }
                else if ((spec[0] == 40 && spec[1] == 40)) { strColor = '#00ffff' }
                else if ((spec[0] == 50 && spec[1] == 50) || (spec[0] == 60 && spec[1] == 60)) { strColor = '#00ff00' }
                else { strColor = '#ffff00' }
            } else { strColor = steelColor };
            const steelMatColor = new THREE.Color(strColor);
            const memberOptions = { color: steelMatColor, metalness: 0.6, roughness: 0.4, showEdges: true, edgeColor: 0x444444 };
            const opts = Object.assign({}, memberOptions, extraOpts || {});
            const group = ProfileLib.createMember(type, spec, start, end, opts);
            mainGroup.add(group);
            return group;
        } catch (e) {
            console.warn('创建杆件失败:', e.message);
            return null;
        }
    }
    function findClosest(arr, target) {//元素最接近列表中的哪个元素
        if (!arr || arr.length === 0) return null;
        return arr.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev - target);
            const currDiff = Math.abs(curr - target);
            return currDiff < prevDiff ? curr : prev;// 如果差值相等，优先保留先遇到的（可根据需求改成返回较大的或较小的）
        });
    }
    if (pggtCheckbox && pggtCheckbox.checked) {
        const dybtparsed = parseProfile(dybt),
            bthgparsed = parseProfile(bthg),
            ntlgparsed = parseProfile(ntlg),
            sphgparsed = parseProfile(sphg),
            zcsgparsed = parseProfile(zcsg),
            flmjparsed = parseProfile(flmj);
        if (dybt && dybtparsed) {//单元背条 (dybt) —— 竖直，每个单元边位置
            for (let c = 0; c <= plls; c++) {
                let x = -ptcd / 2 + bbcb + dycd / 2 + (c - 0.5) * dycd;
                if (c == 0 && bbcb < dybtparsed.spec[0] * 0.5) { x = -ptcd * 0.5 + dybtparsed.spec[0] * 0.5 };
                if (c == plls && bbcb < dybtparsed.spec[0] * 0.5) { x = ptcd * 0.5 - dybtparsed.spec[0] * 0.5 };
                let start = [x, -xsgd / 2 - bbxb - ldgd, -dyhd - dybtparsed.spec[1] * 0.5];
                let end = [x, xsgd / 2 + bbsb + jlwd, -dyhd - dybtparsed.spec[1] * 0.5];
                addMember(dybtparsed.type, dybtparsed.spec, start, end);
            }
        }
        if (sphg && sphgparsed && dyhd >= sphgparsed.spec[0] && (bbxb + ldgd) >= sphgparsed.spec[1]) {//水平横杆 (sphg) —— 水平方向，从左到右，均匀分布
            addMember(sphgparsed.type, sphgparsed.spec, [ptcd * -0.5, xsgd * -0.5 - sphgparsed.spec[1] * 0.5, -dyhd + sphgparsed.spec[0] * 0.5], [ptcd * 0.5, xsgd * -0.5 - sphgparsed.spec[1] * 0.5, -dyhd + sphgparsed.spec[0] * 0.5]);
        }

        if (bthg && bthgparsed) {//背条横杆 (bthg) —— 水平，连接背条，每行布置一根
            let dyylst = [];
            for (let r = 0; r <= plhs; r++) { let y = dygd * plhs * -0.5 + r * dygd; dyylst.push(y) };
            let qylst = [];
            if (dycd == 600 && (bthgparsed.spec[1] - bbsb - jlwd) < 0) { qylst.push(xsgd * 0.5 + bbsb - dygd * 0.5) }
            else { qylst.push(xsgd * 0.5 + bbsb + jlwd - bthgparsed.spec[1] * 0.5) };
            if (dycd == 600 && (bthgparsed.spec[1] - bbxb - ldgd) < 0) { qylst.push(-xsgd * 0.5 - bbxb + dygd * 0.5) }
            else { qylst.push(-xsgd * 0.5 - bbxb - ldgd + bthgparsed.spec[1] * 0.5) }
            let n = Math.round((ptgd + ldgd + jlwd) / (Math.max(mjsj, 1000)) + 0.1, 0) - 1;
            for (let r = 0; r < n; r++) {
                let y = qylst.at(-1) + (ptgd + ldgd + jlwd) / (n + 1);
                if (dycd == 600 && (Math.abs(findClosest(dyylst, y) - y)) < 100) { y = findClosest(dyylst, y) + dygd * 0.5; if (y > xsgd * 0.5 + bbsb + jlwd) { y = y - dygd } };
                qylst.push(y)
            };
            qylst = [...new Set(qylst)];
            qylst.sort((a, b) => a - b);
            let l0 = 0, l1 = 0, l2 = 0;
            if ((azys.includes('嵌')) && flmj && flmjparsed) {
                l0 = flmjparsed.spec[1] * 0.5;
                l1 = xsgd * 0.5 + bbsb + jlwd;
                l2 = xsgd * 0.5 + bbxb + ldgd
                if (Math.abs(qylst[qylst.length - 1] - l1) < l0) { qylst[qylst.length - 1] = l1 - l0 };
                if (Math.abs(qylst[0] + l2) < l0) { qylst[0] = -l2 + l0 };
            };
            qylst.forEach(y => { addMember(bthgparsed.type, bthgparsed.spec, [-ptcd / 2, y, -dyhd - dybtparsed.spec[1] - bthgparsed.spec[0] * 0.5], [ptcd / 2, y, -dyhd - dybtparsed.spec[1] - bthgparsed.spec[0] * 0.5]) });
            let m = Math.floor((Math.max(mjhj, dycd)) / dycd) * dycd;
            let qxlst = [];
            for (let r = 0; r <= Math.round(xscd / m); r++) {
                let x = xscd * -0.5 + (xscd % m) * 0.5 + m * r
                if (x >= ptcd * -0.5 && x <= ptcd * 0.5) { qxlst.push(x) }
            };
            qxlst = [...new Set(qxlst)];
            qxlst.sort((a, b) => a - b);
            if ((azys.includes('嵌')) && flmj && flmjparsed) {
                l0 = flmjparsed.spec[0] * 0.5;
                l1 = ptcd * 0.5;
                if (Math.abs(qxlst[qxlst.length - 1] - l1) < l0) { qxlst[qxlst.length - 1] = l1 - l0 };
                if (Math.abs(qxlst[0] + l1) < l0) { qxlst[0] = -l1 + l0 };
            };
            //remindstr = qxlst;指定内容提示
            // (牛腿连杆 ntlg 暂不实现，可留作扩展)
            if (ntlg && ntlgparsed) {
                let ntlg_s = -dyhd - dybtparsed.spec[1] - bthgparsed.spec[0]
                let ntlg_e = -pthd + (zcsgparsed ? zcsgparsed.spec[1] : 0)
                if (ntlg_s - ntlg_e > 0) {
                    qxlst.forEach(x => { qylst.forEach(y => { if (!((azys.includes('地')) && y == qylst[0])) { addMember(ntlgparsed.type, ntlgparsed.spec, [x, y, ntlg_s], [x, y, ntlg_e]) }; }); });
                }
            }
            if (flmj && flmjparsed) {
                // 修订：法兰埋件材质显式设为不透明 + FrontSide，确保实体不透光
                let flmjc = new THREE.MeshStandardMaterial({ color: 'red', roughness: 0.5, metalness: 0.1, emissive: new THREE.Color('red').multiplyScalar(0.1), side: THREE.FrontSide, transparent: false, opacity: 1.0, depthWrite: true });
                let flmjt = new THREE.BoxGeometry(flmjparsed.spec[0], flmjparsed.spec[1], flmjparsed.spec[2]);//法兰板
                let flmjx = [flmjt];
                let flmjm = new THREE.CylinderGeometry((flmjparsed.spec[2] + 2) * 0.5, (flmjparsed.spec[2] + 2) * 0.5, (flmjparsed.spec[2] + 2) * 12, 16); //螺栓           
                if (flmjm) {
                    let lx = flmjparsed.spec[0] * 0.5 - flmjparsed.spec[2] * 3;
                    let ly = flmjparsed.spec[1] * 0.5 - flmjparsed.spec[2] * 3;
                    [[-lx, -ly], [-lx, ly], [lx, ly], [lx, -ly]].forEach(([x, y]) => {
                        let clonedCyl = flmjm.clone();// 必须克隆，因为每个螺栓位置不同，不能共享同一个几何体实例 
                        clonedCyl.rotateX(Math.PI * 0.5);
                        clonedCyl.translate(x, y, (flmjparsed.spec[2] + 2) * -4);
                        flmjx.push(clonedCyl);
                    });
                    flmjm.dispose();
                }
                let mergedGeometry = mergeBufferGeometries(flmjx);// 5. 合并所有几何体为一个
                // 修订：预计算法兰埋件重量（法兰板重 + 4个螺栓重），供材料清单统计
                //       钢材密度 7.85e-6 kg/mm³；法兰板 = W×H×T×密度；螺栓 = π×(D/2)²×L×密度×4
                const flmjPlateW = flmjparsed.spec[0] * flmjparsed.spec[1] * flmjparsed.spec[2] * 7.85e-6;
                const flmjBoltD = (flmjparsed.spec[2] + 2);
                const flmjBoltL = (flmjparsed.spec[2] + 2) * 12;
                const flmjBoltW = Math.PI * (flmjBoltD / 2) ** 2 * flmjBoltL * 7.85e-6 * 4;
                const flmjUnitW = flmjPlateW + flmjBoltW;
                qxlst.forEach(x => {
                    qylst.forEach(y => {
                        let p = false, rotx = 0;
                        if (['壁挂', '嵌入', '落地拉墙'].includes(azys)) { if (!((azys.includes('地')) && y == Math.min(...qylst))) { p = [x, y, -pthd - flmjparsed.spec[2] * 0.5] }; };
                        if ((azys.includes('地')) && y == Math.min(...qylst)) {
                            p = [x, y - bthgparsed.spec[1] * 0.5 - flmjparsed.spec[2] * 0.5, (zcsg && zcsgparsed) ? -pthd + (zcsgparsed.spec[1]) * 0.5 : -dyhd - (dybtparsed.spec[1] + bthgparsed.spec[0]) * 0.5];
                            rotx = -Math.PI / 2;
                        };
                        if (((azys.includes('顶')) || (azys.includes('吊'))) && y == Math.max(...qylst)) {
                            p = [x, y + bthgparsed.spec[1] * 0.5 + flmjparsed.spec[2] * 0.5, (zcsg && zcsgparsed) ? -pthd + (zcsgparsed.spec[1]) * 0.5 : -dyhd - (dybtparsed.spec[1] + bthgparsed.spec[0]) * 0.5];
                            rotx = Math.PI / 2;
                        };
                        if (p) {
                            let flmjk = new THREE.Mesh(mergedGeometry, flmjc);
                            flmjk.position.set(p[0], p[1], p[2]);
                            flmjk.rotation.x = rotx;
                            flmjk.castShadow = true;
                            flmjk.receiveShadow = true;
                            // 修订：法兰埋件单重=钢板重量(plate)，总重=单重×数量（螺栓不计入重量，单独可视化）
                            flmjk.userData = { isFlange: true, profileName: '法兰埋件', spec: flmj, count: 1, unitWeight: flmjPlateW, length: 0 };
                            mainGroup.add(flmjk);
                        };
                    });
                });
                flmjt.dispose();
                flmjx.forEach(geom => { if (geom !== flmjt) geom.dispose() });
            }
            if (zcsg && zcsgparsed) {//主承竖杆 (zcsg)
                qxlst.forEach(x => { addMember(zcsgparsed.type, zcsgparsed.spec, [x, -xsgd * 0.5 - bbxb - ldgd, (zcsgparsed.spec[1]) * 0.5 - pthd], [x, xsgd * 0.5 + bbsb + jlwd, (zcsgparsed.spec[1]) * 0.5 - pthd]) });
            }
        }
    };
    // ---- 标注尺寸（可选文字） ----
    // 使用CSS2DRenderer添加简单标签
    if (1 == 2) {
        const labelDiv = document.createElement('div');
        labelDiv.textContent = `${(ptcd / 1).toFixed(1)}mm×${(ptgd / 1).toFixed(1)}mm`;
        labelDiv.style.cssText = `color: #88ccff; font-size: 14px; font-weight: bold;text-shadow: 0 0 8px rgba(0,0,0,0.8);background: rgba(0,0,0,0.5); padding: 4px 12px;border-radius: 12px; border: 1px solid rgba(136,204,255,0.3);`;
        const labelObj = new CSS2DObject(labelDiv);
        labelObj.position.set(0, ptgd * -0.5 - ldgd - 100, 0);
        mainGroup.add(labelObj);
    }
    // ---- 调整阴影相机 ----
    const maxDim = Math.max(ptcd, ptgd, pthd);
    dirLight.shadow.camera.left = -maxDim * 1.2;
    dirLight.shadow.camera.right = maxDim * 1.2;
    dirLight.shadow.camera.top = maxDim * 1.2;
    dirLight.shadow.camera.bottom = -maxDim * 1.2;
    dirLight.shadow.camera.far = maxDim * 2;
    dirLight.shadow.camera.updateProjectionMatrix();
    mainGroup.position.set(0, 0, 0);
    viewInfo.textContent = `已更新 (${plls}列×${plhs}行)`;
    setTimeout(() => fitModelToView(), 50);
    // 修订：模型构建后更新网格和坐标轴尺寸（网格铺满模型长度，坐标轴=模型长高最小值的1/4并加粗）
    updateHelpers(ptcd, ptgd);
    // 修订：模型构建后更新材料清单
    setTimeout(() => updateMaterialList(), 60);
    // 修订：模型重建后材质是新的，需重新应用剖切平面
    setTimeout(() => applySectionToMaterials(), 55);
}
function getNumberOrDefault(elementId, defaultValue) {
    const val = document.getElementById(elementId)?.value;
    if (val === undefined || val === null || val === '') return defaultValue;
    const num = parseFloat(val);
    return isNaN(num) ? defaultValue : num;
}
// ===== 从DOM读取参数并构建 =====
function fetchParamsAndBuild() {
    const plls = parseInt(document.getElementById('plls')?.value) || 10;
    const plhs = parseInt(document.getElementById('plhs')?.value) || 10;
    const dycd = parseFloat(document.getElementById('dycd')?.value) || 320;
    const dygd = parseFloat(document.getElementById('dygd')?.value) || 160;
    const dyhd = parseFloat(document.getElementById('dyhd')?.value) || 80;
    const bbsb = getNumberOrDefault('bbsb', 50);
    const bbxb = getNumberOrDefault('bbxb', 50);
    const bbcb = getNumberOrDefault('bbcb', 50);
    const pthd = parseFloat(document.getElementById('pthd')?.value) || 100;
    const ldgd = parseFloat(document.getElementById('ldgd')?.value) || 0;
    const jlwd = parseFloat(document.getElementById('jlwd')?.value) || 0;
    const lkjx = parseFloat(document.getElementById('lkjx')?.value) || 0;
    const mjhj = parseFloat(document.getElementById('mjhj')?.value) || 0;
    const mjsj = parseFloat(document.getElementById('mjsj')?.value) || 0;
    // 读取颜色（外观面板）
    const steelColor = document.getElementById('steelColor')?.value || '#6b8cae';
    const moduleColor = document.getElementById('moduleColor')?.value || '#2d4a7a';
    const frameColor = document.getElementById('frameColor')?.value || '#4a7a9c';
    const bgColor = document.getElementById('bgColor')?.value || '#1a2332';
    const colorCheckbox = document.getElementById('Materialcoloring');
    const moduleEdgesCheckbox = document.getElementById('moduleEdges');   // 修订：模组边线复选框
    const showFrameCheckbox = document.getElementById('showFrame');
    const pggtCheckbox = document.getElementById('pggt');
    // 更新场景背景
    scene.background = new THREE.Color(bgColor);
    const azys = document.getElementById('azys')?.value || '壁挂';
    // MODIFIED: 读取型材规格
    const dybt = document.getElementById('dybt')?.value || '';
    const bthg = document.getElementById('bthg')?.value || '';
    const ntlg = document.getElementById('ntlg')?.value || '';
    const sphg = document.getElementById('sphg')?.value || '';
    const zcsg = document.getElementById('zcsg')?.value || '';
    const flmj = document.getElementById('flmj')?.value || '';
    currentParams = { plls, plhs, dycd, dygd, dyhd, bbsb, bbxb, bbcb, pthd, ldgd, jlwd, lkjx, mjhj, mjsj, steelColor, moduleColor, frameColor, colorCheckbox, azys, dybt, bthg, ntlg, sphg, zcsg, flmj, moduleEdgesCheckbox, showFrameCheckbox, pggtCheckbox };
    pggtCheckbox?.addEventListener('change', function () {
        const colorInput = document.getElementById('steelColor');
        if (!colorInput) return;
        // 如果复选框被选中（勾选），则禁用颜色框；否则启用
        const isChecked = pggtCheckbox ? pggtCheckbox.checked : false;
        colorInput.disabled = isChecked;
        if (!isChecked) { colorInput.disabled = true; colorInput.classList.toggle('color-disabled', isChecked); };
    });
    colorCheckbox?.addEventListener('change', function () {
        const colorInput = document.getElementById('steelColor');
        if (!colorInput) return;
        // 如果复选框被选中（勾选），则禁用颜色框；否则启用
        const isChecked = colorCheckbox ? colorCheckbox.checked : false;
        colorInput.disabled = isChecked;
        // 修订：用CSS类 .color-disabled 替代内联style.opacity/cursor
        colorInput.classList.toggle('color-disabled', isChecked);
    });
    buildLEDModel(currentParams);
    // 修订：模型构建后统一更新所有实体边线可见性
    updateAllEdgesVisibility();
    // 修订：模型构建后更新3D文字覆盖（需要模型尺寸）
    updateTextOverlay3D();
    const remindEl = document.getElementById('remind');
    if (remindEl && remindstr != '') { remindEl.innerHTML = '<span style="color: #e53935;">提示：<p>' + remindstr + '</span>'; }
}
// ===== 监听表单变化 =====
document.addEventListener('input', ({ target: t }) => {
    if (t.closest('#designForm') || t.closest('#steelForm') || ['steelColor', 'moduleColor', 'frameColor', 'bgColor'].includes(t.id)) {
        clearTimeout(window._buildTimeout); window._buildTimeout = setTimeout(fetchParamsAndBuild, 300);
    }
});
// 也监听select变化
document.addEventListener('change', e => {
    const t = e.target;
    // 修订：'moduleEdges' 从重建列表中移除，改为独立切换边线可见性（无需重建模型）
    if (t.closest('#designForm') || t.closest('#steelForm') || ['steelColor', 'moduleColor', 'frameColor', 'bgColor', 'Materialcoloring', 'sectionView', 'showFrame', 'pggt'].includes(t.id)) { clearTimeout(window._buildTimeout); window._buildTimeout = setTimeout(fetchParamsAndBuild, 300); }
});
// 修订："显示边线"复选框——独立切换所有实体边线可见性，不触发模型重建
document.getElementById('moduleEdges')?.addEventListener('change', updateAllEdgesVisibility);
// ===== 外观控件联动 =====
// 颜色同步到模型
document.querySelectorAll('#steelColor, #moduleColor, #frameColor, #bgColor').forEach(el => el.addEventListener('input', fetchParamsAndBuild));
// 修订：重置颜色按钮 —— 恢复到默认颜色并刷新模型
document.getElementById('resetColorBtn')?.addEventListener('click', function () {
    // 修订：增加 textColor 默认值
    const defaults = { steelColor: '#cccccc', bgColor: '#ffffff', moduleColor: '#aaccff', frameColor: '#555555', textColor: '#ffffff' };
    Object.keys(defaults).forEach(id => { const el = document.getElementById(id); if (el) el.value = defaults[id]; });
    fetchParamsAndBuild();
    updateTextOverlay3D();
});
// 视角控制（滑块）
// 修订说明：以下 rotX / rotY / zoomLevel 的监听器绑定在原始元素上，
//           文件末尾会通过 cloneNode(true) 替换元素以移除重复监听，
//           替换后这里的监听器不再触发（保留代码以备参考，勿删）。
// 旋转X
document.getElementById('rotX')?.addEventListener('input', function () {
    if (_updatingView) return;
    const x = parseFloat(this.value);
    const radius = 12;
    const fixedElev = 30 * Math.PI / 180;
    if (activeCamera.isPerspectiveCamera) {
        camera.position.x = radius * Math.sin(x * Math.PI / 180) * Math.cos(fixedElev);
        camera.position.z = radius * Math.cos(x * Math.PI / 180) * Math.cos(fixedElev);
        camera.position.y = radius * Math.sin(fixedElev);
        controls.target.set(0, 0, 0);
        controls.update();
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
    } else {
        // 正交模式下旋转相机（绕Y轴）
        const dir = new THREE.Vector3(0, 0, 1);
        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, x * Math.PI / 180, 0));
        dir.applyQuaternion(quat);
        const dist = orthoCamera.position.distanceTo(controls.target);
        orthoCamera.position.copy(controls.target).add(dir.multiplyScalar(dist));
        orthoCamera.lookAt(controls.target);
        controls.update();
        camera.position.copy(orthoCamera.position);
        camera.lookAt(controls.target);
    }
});
// 旋转Y
document.getElementById('rotY')?.addEventListener('input', function () {
    if (_updatingView) return;
    const y = parseFloat(this.value);
    const radius = 12;
    const fixedElev = 30 * Math.PI / 180;
    if (activeCamera.isPerspectiveCamera) {
        camera.position.x = radius * Math.cos(y * Math.PI / 180) * Math.cos(fixedElev);
        camera.position.z = radius * Math.sin(y * Math.PI / 180) * Math.cos(fixedElev);
        camera.position.y = radius * Math.sin(fixedElev);
        controls.target.set(0, 0, 0);
        controls.update();
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
    } else {
        // 正交模式下旋转相机（绕X轴）
        const dir = new THREE.Vector3(0, 0, 1);
        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(y * Math.PI / 180, 0, 0));
        dir.applyQuaternion(quat);
        const dist = orthoCamera.position.distanceTo(controls.target);
        orthoCamera.position.copy(controls.target).add(dir.multiplyScalar(dist));
        orthoCamera.lookAt(controls.target);
        controls.update();
        camera.position.copy(orthoCamera.position);
        camera.lookAt(controls.target);
    }
});
// 缩放
document.getElementById('zoomLevel')?.addEventListener('input', function () {
    if (_updatingView) return;
    const percent = parseFloat(this.value);
    if (activeCamera.isPerspectiveCamera) {
        const baseDist = 12;
        const dist = baseDist / (percent / 100);
        const dir = new THREE.Vector3().copy(camera.position).sub(controls.target).normalize();
        if (dir.length() < 0.001) dir.set(0, 0, 1);
        camera.position.copy(controls.target).add(dir.multiplyScalar(dist));
        controls.update();
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
    } else {
        // 正交缩放：改变投影范围
        const baseHalf = 5; // 对应100%时的半宽
        const factor = 100 / percent;
        const half = baseHalf * factor;
        const aspect = container.clientWidth / container.clientHeight;
        if (aspect > 1) {
            orthoCamera.left = -half * aspect;
            orthoCamera.right = half * aspect;
            orthoCamera.top = half;
            orthoCamera.bottom = -half;
        } else {
            orthoCamera.left = -half;
            orthoCamera.right = half;
            orthoCamera.top = half / aspect;
            orthoCamera.bottom = -half / aspect;
        }
        orthoCamera.updateProjectionMatrix();
        controls.update();
        camera.position.copy(orthoCamera.position);
        camera.lookAt(controls.target);
    }
    const valSpan = document.getElementById('zoomVal');
    if (valSpan) valSpan.textContent = percent + '%';
});
document.getElementById('autoRotate')?.addEventListener('change', function () {
    controls.autoRotate = this.checked;
    // 修订：用CSS类 .visible 替代内联style.display（原 speedGroup.style.display = ...）
    const speedGroup = document.getElementById('rotateSpeedGroup');
    if (speedGroup) speedGroup.classList.toggle('visible', this.checked);
});// 自动旋转
// 修订：转速滑块控制 autoRotateSpeed
document.getElementById('rotateSpeed')?.addEventListener('input', function () {
    const v = parseFloat(this.value) || 1;
    controls.autoRotateSpeed = v;
    const valSpan = document.getElementById('rotateSpeedVal');
    if (valSpan) valSpan.textContent = v.toFixed(1);
});
document.getElementById('showGrid')?.addEventListener('change', function () { gridHelper.visible = this.checked });// 网格/坐标轴可见性
document.getElementById('showAxes')?.addEventListener('change', function () { axesHelper.visible = this.checked });
// 修订：材料统计复选框 —— 勾选显示材料清单(含标题)，取消则整组隐藏
function syncMaterialListVisibility() {
    const cltj = document.getElementById('cltj');
    const pggt = document.getElementById('pggt');
    const ml = document.getElementById('materialList');
    if (!cltj || !pggt || !ml) return;
    const group = ml.closest('.appearance-group');
    const show = cltj.checked;
    if (group) group.style.display = show ? '' : 'none';
    else ml.style.display = show ? '' : 'none';
}
document.getElementById('cltj')?.addEventListener('change', syncMaterialListVisibility);
document.getElementById('pggt')?.addEventListener('change', syncMaterialListVisibility);
syncMaterialListVisibility();   // 修订：按默认勾选状态(checked)初始化显示
// 修订：截面视图 —— 根据当前相机方向更新剖切面法向（过原点），切掉远侧，显示截面
function updateSectionPlane() {
    if (!sectionEnabled) return;
    // 法向 = 从原点(target)指向相机的方向，保留相机侧，切掉远侧
    const dir = new THREE.Vector3().subVectors(activeCamera.position, controls.target).normalize();
    if (dir.length() < 0.001) dir.set(0, 0, 1);
    sectionPlane.normal.copy(dir);
    sectionPlane.constant = 0;   // 过原点
}
function applySectionToMaterials() {
    const planes = sectionEnabled ? [sectionPlane] : null;
    mainGroup.traverse(obj => {
        if (obj.isMesh && obj.material) { const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach(m => { m.clippingPlanes = planes; }); }
    });
}
document.getElementById('sectionView')?.addEventListener('change', function () {
    sectionEnabled = this.checked;
    renderer.clippingPlanes = sectionEnabled ? [sectionPlane] : [];
    if (sectionEnabled) updateSectionPlane();
    applySectionToMaterials();
});
// 修订：根据复选框初始状态同步网格/坐标轴可见性（默认未勾选则不显示）
gridHelper.visible = !!(document.getElementById('showGrid')?.checked);
axesHelper.visible = !!(document.getElementById('showAxes')?.checked);
document.getElementById('resetViewBtn')?.addEventListener('click', function () {//重置视角
    const pos = { x: 8, y: 6, z: 12 };
    activeCamera.position.set(pos.x, pos.y, pos.z);
    controls.target.set(0, 0, 0);
    controls.update();
    if (activeCamera === camera) { orthoCamera.position.copy(camera.position); orthoCamera.lookAt(controls.target); }
    else { camera.position.copy(orthoCamera.position); camera.lookAt(controls.target); }
    document.getElementById('rotX').value = -20;
    document.getElementById('rotXVal').textContent = '-20°';
    document.getElementById('rotY').value = 30;
    document.getElementById('rotYVal').textContent = '30°';
    const zoomSlider = document.getElementById('zoomLevel');
    if (zoomSlider) { zoomSlider.value = 0; document.getElementById('zoomVal').textContent = '1.00x'; }   // 修订：中间0=全部显示
    fitModelToView();
});
function onResize() {//窗口自适应
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
function animate() {//动画循环
    requestAnimationFrame(animate);
    if (overlayVideo && overlayTexture) {
        // 修订：视频自动播放，仅在格式不支持时显示黑底并提示
        if (overlayVideo.readyState >= 2 && !overlayVideo.error) {
            // 自动播放视频
            if (overlayVideo.paused) overlayVideo.play().catch(() => { });
            overlayTexture.needsUpdate = true;
            // 恢复材质贴图
            overlayGroup.children.forEach(mesh => {
                if (mesh.material.map !== overlayTexture) { mesh.material.map = overlayTexture; mesh.material.needsUpdate = true; }
            })
        } else if (overlayVideo.error) {
            // 修订：视频格式不支持，显示黑底，不更新纹理
            overlayGroup.children.forEach(mesh => { mesh.material.map = null; mesh.material.needsUpdate = true; })
        } else {
            // 无可用帧，临时移除贴图，防止texImage2D报错
            overlayGroup.children.forEach(mesh => { mesh.material.map = null; mesh.material.needsUpdate = true; })
        }
    }
    controls.update();
    renderer.render(scene, activeCamera);
    labelRenderer.render(scene, activeCamera);
}
animate();
setTimeout(() => { fetchParamsAndBuild() }, 200);//初始构建
window.updateThreeModel = fetchParamsAndBuild;// 更新函数
document.getElementById('drawBtn')?.addEventListener('click', function () { setTimeout(fetchParamsAndBuild, 100) });// 监听原有“绘图”按钮点击，也刷新模型
console.log('Three.js LED 3D 模块已加载');
// ---- 贴图上传与清除 ----
const textureInput = document.getElementById('textureUpload');
const clearTextureBtn = document.getElementById('clearTextureBtn');
// 修订：已取消 textureStatus 元素；元素不存在时用空对象避免赋值报错
const textureStatus = document.getElementById('textureStatus') || { textContent: '' };
if (textureInput) {
    textureInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        // 清除旧纹理
        if (overlayTexture) { overlayTexture.dispose(); overlayTexture = null }
        if (overlayVideo) { overlayVideo.pause(); overlayVideo.removeAttribute('src'); overlayVideo.load(); if (overlayVideo.parentNode) overlayVideo.parentNode.removeChild(overlayVideo); overlayVideo = null }   // 修订：清理旧 video 并移出 DOM
        textureStatus.textContent = `加载中: ${file.name}`;
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            const blobUrl = URL.createObjectURL(file);
            // 修订：自动播放配置 —— muted+loop+playsInline+preload=auto，满足浏览器自动播放策略
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.src = blobUrl;
            // 修订：将 video 挂到 DOM(隐藏) —— 部分浏览器未挂 DOM 的 video 不会解码/播放，导致 VideoTexture 黑屏
            video.style.display = 'none';
            document.body.appendChild(video);
            video.load();
            let videoReady = false;   // 防止 loadeddata/canplay 重复初始化
            // 修订：首帧就绪即创建纹理并启动播放，避免上传后黑屏
            function initVideoTexture() {
                if (videoReady) return;
                if (video.readyState < 2) return;   // 至少 HAVE_CURRENT_DATA
                videoReady = true;
                overlayVideo = video;
                if (overlayTexture) overlayTexture.dispose();
                overlayTexture = new THREE.VideoTexture(video);
                overlayTexture.minFilter = THREE.LinearMipmapLinearFilter;
                overlayTexture.magFilter = THREE.LinearFilter;
                overlayTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                overlayTexture.wrapS = THREE.ClampToEdgeWrapping;
                overlayTexture.wrapT = THREE.ClampToEdgeWrapping;
                if (overlayTexture.encoding !== undefined) overlayTexture.encoding = THREE.sRGBEncoding;
                overlayTexture.needsUpdate = true;
                fetchParamsAndBuild();
                textureStatus.textContent = `视频: ${file.name}`;
                // 修订：纹理就绪后启动播放（animate 循环也会在 paused 时重试）
                video.play().then(() => { console.log('视频播放启动成功'); }).catch(err => {
                    console.error('视频播放失败：', err);
                    textureStatus.textContent = `视频(点击播放): ${file.name}`;
                });
            }
            // 监听视频加载错误
            video.addEventListener('error', (e) => {
                console.error('视频加载失败：', video.error);
                textureStatus.textContent = `格式不支持(黑底): ${file.name}`;
            });
            // 首帧就绪即创建纹理并播放
            video.addEventListener('loadeddata', initVideoTexture);
            // 兼容兜底：部分浏览器 loadeddata 不触发，canplay 时再试
            video.addEventListener('canplay', initVideoTexture);
        } else {
            const img = new Image();
            img.onload = () => {
                overlayTexture = new THREE.Texture(img);
                overlayTexture.minFilter = THREE.LinearMipmapLinearFilter;
                overlayTexture.magFilter = THREE.LinearFilter;
                overlayTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                overlayTexture.wrapS = THREE.ClampToEdgeWrapping;
                overlayTexture.wrapT = THREE.ClampToEdgeWrapping;
                // 修订：图片也用 sRGB 编码，与视频一致
                if (overlayTexture.encoding !== undefined) overlayTexture.encoding = THREE.sRGBEncoding;
                overlayTexture.needsUpdate = true;
                fetchParamsAndBuild();
                textureStatus.textContent = `图片: ${file.name}`;
                // 修订：不再禁用"显示边线"复选框，边线可独立于贴图控制
            };
            img.onerror = () => { textureStatus.textContent = '图片加载失败'; alert('图片加载失败，请检查文件') };
            img.src = url;
        }
    });
}
// 修订："模组边线"改为"显示边线"——统一控制所有实体边线可见性（模组网格线、钢构件边线、包边线框）
//   遍历 mainGroup 中所有 LineSegments / Line，根据复选框状态设置 .visible
function updateAllEdgesVisibility() {
    const cb = document.getElementById('moduleEdges');
    const visible = cb ? cb.checked : false;
    mainGroup.traverse(obj => { if (obj.isLineSegments || obj.isLine) { obj.visible = visible; } });
}
if (clearTextureBtn) {
    clearTextureBtn.addEventListener('click', function () {
        if (overlayTexture) { overlayTexture.dispose(); overlayTexture = null }
        if (overlayVideo) {
            overlayVideo.pause();
            // 释放blob url
            const src = overlayVideo.src;
            if (src.startsWith('blob:')) URL.revokeObjectURL(src);
            overlayVideo.removeAttribute('src');
            overlayVideo.load();
            if (overlayVideo.parentNode) overlayVideo.parentNode.removeChild(overlayVideo);
            overlayVideo = null
        }
        if (textureInput) textureInput.value = '';
        textureStatus.textContent = '未加载';
        // 修订：不再调用 setModuleEdgesDisabled，边线始终可独立控制
        fetchParamsAndBuild();
    });
}
// ===== 修订：文字覆盖功能（3D贴面方案） =====
//   文字绘制在 Canvas 上，作为 CanvasTexture 贴在模型显示面前的平面上（z=2），
//   与贴图/视频同时可见时文字在最上层。文字不透明，背景透明。
const overlayTextInput = document.getElementById('overlayText');
const overlayFontSelect = document.getElementById('overlayFont');
const textColorInput = document.getElementById('textColor');
const textScaleSlider = document.getElementById('textScale');
const textScaleValSpan = document.getElementById('textScaleVal');
// 修订：新增"字体宽度"滑块（字宽倍率，默认1倍）
const textWidthSlider = document.getElementById('textWidth');
const textWidthValSpan = document.getElementById('textWidthVal');
const textControlsGroup = document.getElementById('textControlsGroup');
// 文字位置偏移（相对于中心，单位为模型坐标 mm）
let textOffsetX = 0;
let textOffsetY = 0;
let textCanvas = null;
let textCtx = null;
let textTexture = null;
function updateTextOverlay3D() {
    // 清除旧文字平面
    while (textOverlayGroup.children.length > 0) {
        const child = textOverlayGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) { if (child.material.map) child.material.map.dispose(); child.material.dispose(); }
        textOverlayGroup.remove(child);
    }
    if (!overlayTextInput) return;
    const text = overlayTextInput.value.trim();
    if (!text) {
        // 无内容时隐藏控件
        if (textControlsGroup) textControlsGroup.classList.remove('visible');
        return;
    }
    // 有内容时显示控件
    if (textControlsGroup) textControlsGroup.classList.add('visible');
    // 计算模型显示面尺寸
    const xscd = currentParams.plls * currentParams.dycd;
    const xsgd = currentParams.plhs * currentParams.dygd;
    // 创建/获取 canvas（固定分辨率 1024×1024，按模型比例调整）
    const cw = 1024, ch = 1024;
    if (!textCanvas) { textCanvas = document.createElement('canvas'); textCanvas.width = cw; textCanvas.height = ch; }
    textCtx = textCanvas.getContext('2d');
    textCtx.clearRect(0, 0, cw, ch);
    // 绘制文字
    const font = overlayFontSelect ? overlayFontSelect.value : 'Microsoft YaHei';
    const color = textColorInput ? textColorInput.value : '#ffffff';
    const fontSize = textScaleSlider ? parseInt(textScaleSlider.value) : 48;
    // 修订：字体宽度倍率（默认1倍），通过 canvas 水平缩放实现字宽拉伸/压缩
    const textWidth = textWidthSlider ? parseFloat(textWidthSlider.value) || 1 : 1;
    textCtx.font = `bold ${fontSize * 4}px ${font}`;   // ×4 放大以匹配高分辨率 canvas
    textCtx.fillStyle = color;
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';
    // 文字位置：中心 + 偏移（偏移量从模型坐标映射到 canvas 坐标）
    const cx = cw / 2 + (textOffsetX / xscd) * cw;
    const cy = ch / 2 - (textOffsetY / xsgd) * ch;   // Y 轴翻转（canvas Y 向下）
    // 修订：以 cx 为轴水平缩放 textWidth 倍，实现字体宽度调整
    textCtx.save();
    textCtx.translate(cx, 0);
    textCtx.scale(textWidth, 1);
    textCtx.translate(-cx, 0);
    // 支持多行文字
    const lines = text.split('\n');
    const lineHeight = fontSize * 4 * 1.2;
    lines.forEach((line, i) => {
        textCtx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * lineHeight);
    });
    textCtx.restore();   // 修订：恢复变换，避免影响后续绘制
    // 创建/更新纹理
    if (textTexture) textTexture.dispose();
    textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.minFilter = THREE.LinearMipmapLinearFilter;
    textTexture.magFilter = THREE.LinearFilter;
    textTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textTexture.needsUpdate = true;
    // 创建平面（与模型显示面同尺寸，位于 z=2 在贴图层前方）
    const planeGeo = new THREE.PlaneGeometry(xscd, xsgd);
    const planeMat = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,       // 背景透明
        opacity: 1.0,            // 文字像素不透明
        side: THREE.FrontSide,   // 仅正面可见
        depthWrite: false,       // 不写深度，避免遮挡贴图
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -4, // 比贴图层(-2)更靠前
        polygonOffsetUnits: -4
    });
    const textPlane = new THREE.Mesh(planeGeo, planeMat);
    textPlane.position.set(0, 0, 2);   // z=2，在贴图层(z=1)前方
    textOverlayGroup.add(textPlane);
}
// 文字输入实时更新
overlayTextInput?.addEventListener('input', updateTextOverlay3D);
overlayFontSelect?.addEventListener('change', updateTextOverlay3D);
textColorInput?.addEventListener('input', updateTextOverlay3D);
textScaleSlider?.addEventListener('input', function () {
    if (textScaleValSpan) textScaleValSpan.textContent = this.value + 'px';
    updateTextOverlay3D();
});
// 修订：字体宽度滑块实时更新
textWidthSlider?.addEventListener('input', function () {
    if (textWidthValSpan) textWidthValSpan.textContent = parseFloat(this.value).toFixed(1) + 'x';
    updateTextOverlay3D();
});
// 方向箭头：控制文字位置（每次移动模型尺寸的 5%）
document.querySelectorAll('.arrow-pad button').forEach(btn => {
    btn.addEventListener('click', function () {
        const dir = this.dataset.dir;
        const xscd = currentParams.plls * currentParams.dycd;
        const xsgd = currentParams.plhs * currentParams.dygd;
        const stepX = xscd * 0.01;   // 修订：方向键每次调整量减小为 1%（原 5%）
        const stepY = xsgd * 0.01;
        switch (dir) {
            case 'up': textOffsetY += stepY; break;
            case 'down': textOffsetY -= stepY; break;
            case 'left': textOffsetX -= stepX; break;
            case 'right': textOffsetX += stepX; break;
            case 'center': textOffsetX = 0; textOffsetY = 0; break;
        }
        updateTextOverlay3D();
    });
});
// ===== 六视图 & 轴测图 =====
let _updatingView = false;
function switchView(view) {// 切换视角函数
    _updatingView = true;
    const dist = 12;
    let pos = { x: 0, y: 0, z: 0 };
    let rotX = 0, rotY = 0; // 用于滑块显示
    switch (view) {
        case 'front': pos = { x: 0, y: 0, z: dist }; rotX = 0; rotY = 0; break;
        case 'back': pos = { x: 0, y: 0, z: -dist }; rotX = 180; rotY = 0; break;
        case 'left': pos = { x: -dist, y: 0, z: 0 }; rotX = -90; rotY = 0; break;
        case 'right': pos = { x: dist, y: 0, z: 0 }; rotX = 90; rotY = 0; break;
        case 'top': pos = { x: 0, y: dist, z: 0.001 }; rotX = 0; rotY = 90; break;
        case 'bottom': pos = { x: 0, y: -dist, z: 0.001 }; rotX = 0; rotY = -90; break;
        case 'axo': pos = { x: 8, y: 6, z: 12 }; rotX = -20; rotY = 30; break;
        default: pos = { x: 8, y: 6, z: 12 }; rotX = -20; rotY = 30;
    }
    // 修订：正交模式下六视图/轴测图朝向更新不可靠，采用用户建议的方案——
    //       执行前临时切到透视模式，完成视角变换后再恢复原正交模式。
    const perspectiveToggle = document.getElementById('perspectiveToggle');
    const wasOrtho = perspectiveToggle ? perspectiveToggle.checked : (activeCamera.isOrthographicCamera);
    if (wasOrtho) {
        // 临时切透视
        camera.position.copy(orthoCamera.position);
        camera.lookAt(controls.target);
        activeCamera = camera;
        controls.object = activeCamera;
    }
    // 在（临时）透视模式下执行视角变换
    activeCamera.position.set(pos.x, pos.y, pos.z);
    controls.target.set(0, 0, 0);
    activeCamera.lookAt(controls.target);
    controls.update();
    // 同步两个相机位置（为恢复做准备）
    orthoCamera.position.copy(camera.position);
    orthoCamera.lookAt(controls.target);
    // 适配全部可见（在透视下完成）
    fitModelToView();
    // 恢复原正交模式
    if (wasOrtho) {
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
        activeCamera = orthoCamera;
        controls.object = activeCamera;
        controls.update();
        // 正交模式下重新适配（基于正交投影）
        fitModelToView();
    }
    // 更新滑块显示
    document.getElementById('rotX').value = rotX;
    document.getElementById('rotXVal').textContent = rotX + '°';
    document.getElementById('rotY').value = rotY;
    document.getElementById('rotYVal').textContent = rotY + '°';
    _updatingView = false;
    updateSectionPlane();   // 修订：视角切换后更新剖切面方向
}
// 六视图按钮菜单
const viewSixBtn = document.getElementById('viewSixBtn');
const viewSixMenu = document.getElementById('viewSixMenu');
if (viewSixBtn && viewSixMenu) {
    viewSixBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // 修订：用CSS类 .visible 替代内联style.display
        const isVisible = viewSixMenu.classList.contains('visible');
        viewSixMenu.classList.toggle('visible', !isVisible);
        // 修订：激活时按钮文字变红，再次点击恢复
        viewSixBtn.classList.toggle('active', !isVisible);
    });
    // 菜单项点击
    viewSixMenu.querySelectorAll('[data-view]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const view = e.target.dataset.view;
            switchView(view);
            // 修订：选择方向后隐藏菜单并恢复按钮颜色
            viewSixMenu.classList.remove('visible');
            viewSixBtn.classList.remove('active');
        });
    });
    // 点击其他地方关闭菜单并恢复按钮颜色
    // 修订：用CSS类 .visible 替代内联style.display
    document.addEventListener('click', () => {
        viewSixMenu.classList.remove('visible');
        viewSixBtn.classList.remove('active');
    });
}
document.getElementById('viewAxoBtn')?.addEventListener('click', () => { switchView('axo') });// 轴测图按钮
const rotXSlider = document.getElementById('rotX');
const rotYSlider = document.getElementById('rotY');
// 移除旧监听（如果有），然后绑定新监听（含保护）
rotXSlider?.replaceWith(rotXSlider.cloneNode(true));
rotYSlider?.replaceWith(rotYSlider.cloneNode(true));
// 重新获取元素
const newRotX = document.getElementById('rotX');
const newRotY = document.getElementById('rotY');
// 修订：rotX/rotY 用球坐标重写，透视/正交统一处理，正交模式显式 lookAt 确保朝向变化生效
//   原问题：正交模式下 controls.update() 对朝向更新不完整，导致拖动滑块模型几乎不动。
newRotX?.addEventListener('input', function () {
    if (_updatingView) return;
    _updatingView = true;   // 修订：滑块驱动期间禁止 'change' 回写，避免数字跳动
    try {
        const x = parseFloat(this.value);   // 绕 Y 轴方位角
        const rotYEl = document.getElementById('rotY');
        const y = rotYEl ? parseFloat(rotYEl.value) : 0;   // 取当前俯仰角，联动
        const rotXVal = document.getElementById('rotXVal');
        if (rotXVal) rotXVal.textContent = Math.round(x) + '°';   // 修订：同步数字显示
        const target = controls.target;
        const offset = new THREE.Vector3().subVectors(activeCamera.position, target);
        const dist = offset.length() || baseFitDist || 12;
        // 球坐标：azimuth(x, 绕Y) + polar(y, 俯仰)
        const az = x * Math.PI / 180;
        const pol = (90 - y) * Math.PI / 180;   // y=0→极角90°(水平)，y=90→极角0°(顶)
        const sinPol = Math.sin(pol);
        const newX = dist * sinPol * Math.sin(az);
        const newY = dist * Math.cos(pol);
        const newZ = dist * sinPol * Math.cos(az);
        activeCamera.position.set(target.x + newX, target.y + newY, target.z + newZ);
        activeCamera.lookAt(target);   // 修订：显式朝向，正交模式必需
        controls.update();
        if (activeCamera === camera) { orthoCamera.position.copy(camera.position); orthoCamera.lookAt(target); }
        else { camera.position.copy(orthoCamera.position); camera.lookAt(target); }
    } finally { _updatingView = false; }
});
newRotY?.addEventListener('input', function () {
    if (_updatingView) return;
    _updatingView = true;   // 修订：滑块驱动期间禁止 'change' 回写，避免数字跳动
    try {
        const y = parseFloat(this.value);   // 俯仰角
        const rotXEl = document.getElementById('rotX');
        const x = rotXEl ? parseFloat(rotXEl.value) : 0;   // 取当前方位角，联动
        const rotYVal = document.getElementById('rotYVal');
        if (rotYVal) rotYVal.textContent = Math.round(y) + '°';   // 修订：同步数字显示
        const target = controls.target;
        const offset = new THREE.Vector3().subVectors(activeCamera.position, target);
        const dist = offset.length() || baseFitDist || 12;
        const az = x * Math.PI / 180;
        const pol = (90 - y) * Math.PI / 180;
        const sinPol = Math.sin(pol);
        const newX = dist * sinPol * Math.sin(az);
        const newY = dist * Math.cos(pol);
        const newZ = dist * sinPol * Math.cos(az);
        activeCamera.position.set(target.x + newX, target.y + newY, target.z + newZ);
        activeCamera.lookAt(target);   // 修订：显式朝向，正交模式必需
        controls.update();
        if (activeCamera === camera) { orthoCamera.position.copy(camera.position); orthoCamera.lookAt(target); }
        else { camera.position.copy(orthoCamera.position); camera.lookAt(target); }
        updateSectionPlane();   // 修订：旋转后更新剖切面方向
    } finally { _updatingView = false; }
});
// 修订：缩放滑块改为对称区间，中间0=全部显示(1x)，左负缩小右正放大
//       factor = 10^(slider/100)：0→1x，+100→10x，-100→0.1x
//       修复正交模式下原监听只处理透视相机导致六视图定住、显示不全的问题
const zoomSlider = document.getElementById('zoomLevel');
zoomSlider?.replaceWith(zoomSlider.cloneNode(true));
const newZoom = document.getElementById('zoomLevel');
newZoom?.addEventListener('input', function () {
    if (_updatingView) return;
    _updatingView = true;   // 修订：滑块驱动期间禁止 'change' 回写，避免滑块/数字跳动
    try {
        const sliderVal = parseFloat(this.value);
        const factor = Math.pow(10, sliderVal / 100); // 0→1，+100→10，-100→0.1
        if (activeCamera.isPerspectiveCamera) {
            const dist = baseFitDist / factor;
            const dir = new THREE.Vector3().copy(camera.position).sub(controls.target).normalize();
            if (dir.length() < 0.001) dir.set(0, 0, 1).normalize();
            camera.position.copy(controls.target).add(dir.multiplyScalar(dist));
            controls.update();
            orthoCamera.position.copy(camera.position);
            orthoCamera.lookAt(controls.target);
        } else {
            // 修订：正交相机缩放——改变投影范围 half，而非百分比
            const half = baseFitHalfSize / factor;
            const aspect = container.clientWidth / container.clientHeight;
            if (aspect > 1) {
                orthoCamera.left = -half * aspect;
                orthoCamera.right = half * aspect;
                orthoCamera.top = half;
                orthoCamera.bottom = -half;
            } else {
                orthoCamera.left = -half;
                orthoCamera.right = half;
                orthoCamera.top = half / aspect;
                orthoCamera.bottom = -half / aspect;
            }
            orthoCamera.zoom = 1;
            orthoCamera.updateProjectionMatrix();
            controls.update();
            camera.position.copy(orthoCamera.position);
            camera.lookAt(controls.target);
        }
        const valSpan = document.getElementById('zoomVal');
        if (valSpan) valSpan.textContent = factor.toFixed(2) + 'x';
    } finally { _updatingView = false; }
});
// ---- 正交模式切换（原"近大远小"，现语义反转：勾选=正交，未勾选=透视）----
document.getElementById('perspectiveToggle')?.addEventListener('change', function () {
    const useOrtho = this.checked;   // 修订：勾选=正交模式
    // 同步位置（保持视觉连续性）
    if (useOrtho) {
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
        activeCamera = orthoCamera;
    } else {
        camera.position.copy(orthoCamera.position);
        camera.lookAt(controls.target);
        activeCamera = camera;
    }
    controls.object = activeCamera;
    controls.update();
    fitModelToView();
    renderer.render(scene, activeCamera);
    labelRenderer.render(scene, activeCamera);
});
// 修订：正交模式默认开启 —— 若复选框默认勾选，初始化即切换到正交相机（否则首帧仍是透视）
(function initDefaultCameraMode() {
    const pt = document.getElementById('perspectiveToggle');
    if (pt && pt.checked && activeCamera !== orthoCamera) {
        orthoCamera.position.copy(camera.position);
        orthoCamera.lookAt(controls.target);
        activeCamera = orthoCamera;
        controls.object = activeCamera;
        controls.update();
    }
})();
// ===== 修订：截图保存（点击弹出格式菜单：PNG / JPG / WebP）=====
//   点击"截图保存"展开格式菜单，选择格式即下载对应图片（与六视图弹出菜单同风格）。
const screenshotBtn = document.getElementById('screenshotBtn');
const shotMenu = document.getElementById('shotMenu');
function takeScreenshot(fmt) {
    const canvas = container.querySelector('canvas');
    if (!canvas) { alert('3D场景尚未加载完成，请稍后再试。'); return; }
    let dataUrl, ext;
    if (fmt === 'jpg') {
        // 修订：JPG 不支持透明通道，先白底合成再导出，避免透明区域变黑底
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = '#ffffff';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(canvas, 0, 0);
        dataUrl = tmp.toDataURL('image/jpeg', 0.92);
        ext = 'jpg';
    } else {
        const mime = fmt === 'webp' ? 'image/webp' : 'image/png';
        dataUrl = canvas.toDataURL(mime, fmt === 'webp' ? 0.92 : undefined);
        ext = fmt;
    }
    const link = document.createElement('a');
    link.download = `led-3d-screenshot.${ext}`;
    link.href = dataUrl;
    link.click();
}
if (screenshotBtn && shotMenu) {
    screenshotBtn.addEventListener('click', (e) => {
        e.stopPropagation();   // 修订：阻止冒泡，避免触发 document 关闭菜单
        const isVisible = shotMenu.classList.contains('visible');
        shotMenu.classList.toggle('visible', !isVisible);
    });
    shotMenu.querySelectorAll('[data-fmt]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            takeScreenshot(e.target.dataset.fmt);
            shotMenu.classList.remove('visible');
        });
    });
}
// ===== 修订：录制视频（点击弹出格式菜单：WebM / MP4，选格式即开始录制）=====
//   录制画布中的模型动作或播放的视频；录制中再次点击"录制视频"按钮停止并下载；浏览器不支持所选格式时自动回退到受支持格式。
let mediaRecorder = null;
let recordedChunks = [];
const recordVideoBtn = document.getElementById('recordVideoBtn');
const recordMenu = document.getElementById('recordMenu');
function startRecording(mimeType) {
    const canvas = container.querySelector('canvas');
    if (!canvas) { alert('3D场景尚未加载完成，请稍后再试。'); return; }
    // 捕获画布流，30fps
    let stream;
    try { stream = canvas.captureStream(30); }
    catch (err) { alert('当前浏览器不支持画布录制：' + err.message); return; }
    recordedChunks = [];
    try { mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
    catch (err) { alert('无法创建录制器：' + err.message); return; }
    mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = function () {
        const blob = new Blob(recordedChunks, { type: mimeType || 'video/webm' });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date();
        const pad = n => String(n).padStart(2, '0');
        a.href = url;
        a.download = `led-3d-record-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        recordedChunks = [];
        recordVideoBtn.textContent = '录制视频';
        // 修订：用CSS类 .recording 替代内联style.color
        recordVideoBtn.classList.remove('recording');
    };
    mediaRecorder.start(100);   // 每 100ms 采集一帧数据
    recordVideoBtn.textContent = '■ 停止录制';
    // 修订：用CSS类 .recording 替代内联style.color
    recordVideoBtn.classList.add('recording');
}
if (recordVideoBtn && recordMenu) {
    recordVideoBtn.addEventListener('click', (e) => {
        e.stopPropagation();   // 修订：阻止冒泡，避免触发 document 关闭菜单
        // 录制中：再次点击直接停止并下载
        if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); return; }
        // 未录制：展开格式菜单
        const isVisible = recordMenu.classList.contains('visible');
        recordMenu.classList.toggle('visible', !isVisible);
    });
    recordMenu.querySelectorAll('[data-fmt]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 修订：按所选格式挑选浏览器支持的 mimeType（MP4 优先 avc1，否则回退 webm 等）
            const fmt = e.target.dataset.fmt;
            const candidates = fmt === 'mp4'
                ? ['video/mp4;codecs=avc1', 'video/mp4']
                : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
            let mimeType = '';
            if (window.MediaRecorder) {
                for (const mt of candidates) { if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; } }
                // 修订：所选格式均不支持时，回退到任一浏览器支持的格式
                if (!mimeType) {
                    const fallbacks = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
                    for (const mt of fallbacks) { if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; } }
                }
            }
            startRecording(mimeType);
            recordMenu.classList.remove('visible');
        });
    });
}
// 修订：点击空白处关闭"截图/录制"两个格式菜单（六视图菜单由各自监听关闭）
document.addEventListener('click', () => {
    if (shotMenu) shotMenu.classList.remove('visible');
    if (recordMenu) recordMenu.classList.remove('visible');
});
// ===== 修订：材料清单统计 =====
//   遍历 mainGroup 中所有杆件（ProfileLib.createMember 生成的 group，含 userData.spec/length/weight），
//   按规格归一化（40*20*2 与 20*40*2 视为同种）汇总数量、总长、总重；并统计模组数量。
//   修订：新增法兰埋件（flmj）统计——遍历 isFlange 标记的网格，按规格汇总件数和重量。
//   修订：所有内联style改为CSS类（.ml-table / .ml-summary / .ml-placeholder）。
function normalizeSpecLabel(label) {
    // 提取前缀（非数字部分）与数字数组
    const m = label.match(/^([^\d]*)([\d\.\×xX\*]+.*)$/);
    if (!m) return label;
    const prefix = m[1];
    const rest = m[2];
    const nums = rest.split(/[×xX\*]/).map(s => parseFloat(s)).filter(n => !isNaN(n));
    // 修订：仅"矩形管"(□ 前缀且≥3个数：W×H×t)才排序前两维归一化(40×20×2 ≡ 20×40×2)。
    //   其它型材(H/C/L/T 的 H×B、方管 □s×t 等)前两维不可交换，排序会改变规格含义并合并不同规格，导致统计错误。
    if (prefix === '□' && nums.length >= 3) {
        const sorted = [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
        const remaining = nums.slice(2);
        return prefix + sorted.concat(remaining).join('×');
    }
    return label;
}
function updateMaterialList() {
    const listEl = document.getElementById('materialList');
    if (!listEl) return;
    const toNum = (val) => parseFloat(val) || 0;
    const dyhd = toNum(document.getElementById('dyhd')?.value);
    const dybt = parseProfile(document.getElementById('dybt')?.value);
    const bthg = parseProfile(document.getElementById('bthg')?.value);
    const zcsg = parseProfile(document.getElementById('zcsg')?.value);
    const pthd = toNum(document.getElementById('pthd')?.value);
    const getSpec = (profile, index) => Array.isArray(profile?.spec) ? (profile.spec[index] || 0) : 0;
    const totalThickness = dyhd + getSpec(dybt, 1) + getSpec(bthg, 0) + getSpec(zcsg, 1);
    if (totalThickness > pthd) { listEl.innerHTML = '<span style="color: #e53935;">当前材料模型存在干涉，屏体厚度至少为' + totalThickness + 'mm,请修正数据</span>'; return; }
    // 修订：内联style改为CSS类 .ml-placeholder
    if (!mainGroup || mainGroup.children.length === 0) { listEl.innerHTML = '<span class="ml-placeholder">模型构建后将显示材料统计…</span>'; return; }
    const stats = {};     // key: 归一化规格 → { count, length, weightPerMeter, unitWeight, name, isPlate, spec }
    let moduleCount = 0;
    mainGroup.traverse(obj => {
        // 模组统计
        if (obj.userData && obj.userData.isModule) { moduleCount += obj.userData.moduleCount || 1; return; }
        // 修订：法兰埋件统计 —— 单重=钢板重量(unitWeight)，总重=单重×数量
        if (obj.userData && obj.userData.isFlange) {
            const key = obj.userData.spec;
            if (!stats[key]) { stats[key] = { count: 0, length: 0, weightPerMeter: 0, unitWeight: 0, name: obj.userData.profileName || '法兰埋件', spec: key, isPlate: true }; }
            stats[key].count += 1;
            // 修订：单重取首个即可（同规格一致）；不累加 weight，总重由 单重×数量 推导
            if (obj.userData.unitWeight) stats[key].unitWeight = obj.userData.unitWeight;
            return;
        }
        // 杆件统计（userData 含 spec/length/weightPerMeter/profileName）
        const ud = obj.userData;
        if (ud && ud.spec && typeof ud.length === 'number' && ud.length > 0) {
            const key = normalizeSpecLabel(ud.spec);
            //console.table(ud)
            if (!stats[key]) { stats[key] = { count: 0, length: 0, weightPerMeter: 0, unitWeight: 0, name: ud.profileName || '', spec: key }; }
            stats[key].count += 1;
            stats[key].length += ud.length;   // 修订：累加总长(mm)，后续总重=延米重×总长(m)
            // 修订：同规格截面相同，延米重一致，取首个即可
            if (ud.weightPerMeter) stats[key].weightPerMeter = ud.weightPerMeter;
        }
    });
    // 生成 HTML 表格
    let rows = '';
    let totalWeight = 0;
    const keys = Object.keys(stats).sort((a, b) => a - b);
    keys.forEach(k => {
        const s = stats[k];
        // 修订：杆件 重量 = 延米重(kg/m) × 总长(m)；法兰 重量 = 单重(kg) × 数量
        let weight = 0;
        if (s.isPlate) { weight = (s.unitWeight || 0) * s.count; }            // 法兰：单重 × 数量
        else { weight = (s.weightPerMeter || 0) * (s.length / 1000); } // 杆件：延米重 × 总长(m)
        totalWeight += weight;
        // 修订：总长统一以米显示（便于核对 重量=延米重×总长）
        const lenStr = s.isPlate ? '—' : parseFloat((s.length / 1000).toFixed(3)) + ' m';
        const wtStr = weight >= 1 ? weight.toFixed(2) + ' kg' : weight.toFixed(4) + ' kg';
        // 修订：列序精简为4列 —— 规格 / 单重(kg) / 数量 / 重量
        //   单重列单位：法兰埋件 /件，杆件(方管) /m
        //   数量列：方管去掉根数仅显示总长(m)，埋件去掉"—"仅显示件数(件)
        const singleWStr = s.isPlate ? (s.unitWeight || 0).toFixed(3) + ' /件' : (s.weightPerMeter || 0).toFixed(3) + ' /m';
        const qtyStr = s.isPlate ? (s.count + ' 件') : lenStr;
        rows += `<tr><td>${s.spec}</td><td>${singleWStr}</td><td>${qtyStr}</td><td>${wtStr}</td></tr>`;
    });
    const totalWtStr = totalWeight >= 1 ? totalWeight.toFixed(2) + ' kg' : totalWeight.toFixed(4) + ' kg';
    // 修订：所有内联style改为CSS类（.ml-table / .ml-summary / strong样式）
    listEl.innerHTML = '<table class="ml-table">' + '<thead><tr>' + '<th>规格</th>' + '<th>单重(kg)</th>' + '<th>数量</th>' + '<th>重量</th>' + '</tr></thead><tbody>' + rows + '</tbody></table>' + '<div class="ml-table">' + '<div>模组数量：<strong>' + moduleCount + '</strong> 块</div>' + '<div>钢结构总重：<strong>' + totalWtStr + '</strong></div>' + '</div>';//模组数量ml-summary改为ml-table 
}