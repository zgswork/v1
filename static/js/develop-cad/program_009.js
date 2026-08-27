// —— 模块：LED 结构设计（由 led246 DCL 对话框转换而来）——
// 所有字段 key 与原 DCL 一致；buildLisp 把参数以同名全局变量写入，再调 (ZWGEN-LED-DRAW)
const program_009 = {
    title: '结构设计',
    fields: [
        // —— 基本参数 1 ——
        [{ id: 'edit_led_snhw', label: '室内户外', type: 'popup', def: '室内' },
        { id: 'edit_led_cpxl', label: '产品系列', type: 'popup', def: '室内固装' },
        { id: 'edit_led_cpxh', label: '产品型号', type: 'popup', def: 'P3' },
        { id: 'edit_led_pdjj', label: '屏点间距', type: 'text', def: '3' }],
        // —— 基本参数 2（单元尺寸）——
        [{ id: 'edit_led_dycd', label: '单元长度', type: 'text', def: '320' },
        { id: 'edit_led_dygd', label: '单元高度', type: 'text', def: '160' },
        { id: 'edit_led_bbsb', label: '包边上边', type: 'text', def: '0' },
        { id: 'edit_led_bbzb', label: '包边左边', type: 'text', def: '0' }],
        // —— 排列 / 包边 ——
        [{ id: 'edit_led_plls', label: '排列列数', type: 'text', def: '10' },
        { id: 'edit_led_plhs', label: '排列行数', type: 'text', def: '6' },
        { id: 'edit_led_bbxb', label: '包边下边', type: 'text', def: '0' },
        { id: 'edit_led_bbyb', label: '包边右边', type: 'text', def: '0' }],
        // —— 厚度 / 标高 ——
        [{ id: 'edit_led_dyhd', label: '单元厚度', type: 'text', def: '80' },
        { id: 'edit_led_pthd', label: '屏体厚度', type: 'text', def: '120' },
        { id: 'edit_led_ldgd', label: '离地高度', type: 'text', def: '500' },
        { id: 'edit_led_hyxj', label: '弧圆心角', type: 'text', def: '0' }],
        // —— 风 / 震 / 长度 ——
        [{ id: 'edit_led_dbbg', label: '底部标高', type: 'text', def: '0' },
        { id: 'edit_led_jbfy', label: '基本风压', type: 'text', def: '0.35' },
        { id: 'edit_led_sfld', label: '设防烈度', type: 'text', def: '7' },
        { id: 'edit_led_jbcd', label: '基本长度', type: 'text', def: '0' }],
        // —— 显示 / 夹角 / 带载 ——
        [{ id: 'edit_led_xscd', label: '显示长度', type: 'text', def: '0' },
        { id: 'edit_led_xsgd', label: '显示高度', type: 'text', def: '0' },
        { id: 'edit_led_zgdp', label: '中固定片', type: 'text', def: '0' },
        { id: 'edit_led_jbjj', label: '基本夹角', type: 'text', def: '0' }],
        // —— 带载 / 间隙 ——
        [{ id: 'edit_led_jsdz', label: '接收带载', type: 'text', def: '0' },
        { id: 'edit_led_dydz', label: '电源带载', type: 'text', def: '0' },
        { id: 'edit_led_lkjx', label: '留空间隙', type: 'text', def: '0' },
        { id: 'edit_led_hxbj', label: '弧形半径', type: 'text', def: '0' }],
        // —— 组合 ——
        [{ id: 'edit_led_dycz', label: '单元长度组合(左→右)', type: 'text', def: '320*10' },
        { id: 'edit_led_dygz', label: '单元高度组合(下→上)', type: 'text', def: '160*6' }],
        // —— 类型 / 样式 ——
        [{ id: 'edit_led_dylx', label: '单元类型', type: 'popup', def: '模组' },
        { id: 'edit_led_clcz', label: '材料材质', type: 'popup', def: '铝型材' },
        { id: 'edit_led_xsfx', label: '显示方向', type: 'popup', def: '内显示' },
        { id: 'edit_led_pmys', label: '屏面样式', type: 'popup', def: '平面' }],
        [{ id: 'edit_led_azys', label: '安装样式', type: 'popup', def: '立柱' },
        { id: 'edit_led_whfs', label: '维护方式', type: 'popup', def: '后维护', options: ['前维护', '后维护'] },
        { id: 'edit_led_azfs', label: '安装方式', type: 'popup', def: '固定', options: ['固定', '活动'] },
        { id: 'edit_led_sjht', label: '设计绘图', type: 'popup', def: '是', options: ['是', '否'] }],
        // —— 开关项 1 ——
        [{ id: 'edit_led_bbxd', label: '包边相等', type: 'toggle', def: 0 },
        { id: 'edit_led_jxm', label: '屏检修门', type: 'toggle', def: 0 },
        { id: 'edit_led_jxpt', label: '检修爬梯', type: 'toggle', def: 0 },
        { id: 'edit_led_pdx', label: '屏配电箱', type: 'toggle', def: 0 }],
        // —— 开关项 2 ——
        [{ id: 'edit_led_yxyx', label: '音响音箱', type: 'toggle', def: 0 },
        { id: 'edit_led_zmdj', label: '照明灯具', type: 'toggle', def: 0 },
        { id: 'edit_led_fj', label: '轴流风机', type: 'toggle', def: 0 },
        { id: 'edit_led_fjsl', label: '风机数量', type: 'text', def: '0' }],
        // —— 开关项 3 ——
        [{ id: 'edit_led_zddf', label: '走道对缝', type: 'toggle', def: 0 },
        { id: 'edit_led_inibl', label: 'INI保留', type: 'toggle', def: 0 },
        { id: 'edit_led_xlb', label: '删除列表', type: 'toggle', def: 0 },
        { id: 'edit_led_smb', label: '删除模板', type: 'toggle', def: 0 }],
        // —— 开关项 4 ——
        [{ id: 'edit_led_slogo', label: '删除LOGO', type: 'toggle', def: 0 },
        { id: 'edit_led_sczz', label: '删除作者', type: 'toggle', def: 0 },
        { id: 'edit_led_kt', label: '挂式空调', type: 'toggle', def: 0 },
        { id: 'edit_led_ktsl', label: '空调数量', type: 'text', def: '0' }],
        // —— 开关项 5 ——
        [{ id: 'edit_led_kwjj', label: '开文件夹', type: 'toggle', def: 0 },
        { id: 'edit_led_cgdz', label: '长高倒装', type: 'toggle', def: 0 },
        { id: 'edit_led_xsmj', label: '显示面积', type: 'text', def: '0' }],
        // —— 项目信息 1 ——
        [{ id: 'edit_led_xmqy', label: '项目区域', type: 'popup', def: '华东' },
        { id: 'edit_led_xmds', label: '项目地市', type: 'text', def: '' },
        { id: 'edit_led_sjxs', label: '省经销商', type: 'popup', def: 'A经销商', options: ['A经销商', 'B经销商'] },
        { id: 'edit_led_xjxs', label: '县经销商', type: 'text', def: '' }],
        // —— 项目信息 2 ——
        [{ id: 'edit_led_xmmc', label: '项目名称', type: 'text', def: '' },
        { id: 'edit_led_sjwj', label: '数据文件', type: 'text', def: '' },
        { id: 'edit_led_xmbh', label: '项目编号', type: 'text', def: '' },
        { id: 'edit_led_bbbh', label: '文本(编号)', type: 'text', def: '' }],
        // —— 项目区域内容 ——
        [{ id: 'edit_led_qynr', label: '项目区域内容', type: 'textarea', def: '' }],
        // —— 背部 / 走道 / 地基结构 1 ——
        [{ id: 'edit_led_dybt', label: '第一背条', type: 'text', def: '0' },
        { id: 'edit_led_debt', label: '第二背条', type: 'text', def: '0' },
        { id: 'edit_led_bbsg', label: '背部竖杆', type: 'text', def: '0' },
        { id: 'edit_led_bgjj', label: '背杆间距', type: 'text', def: '0' }],
        // —— 走道结构 ——
        [{ id: 'edit_led_zdqg', label: '走道前杆', type: 'text', def: '0' },
        { id: 'edit_led_zdlg', label: '走道连杆', type: 'text', def: '0' },
        { id: 'edit_led_zdhg', label: '走道后杆', type: 'text', def: '0' },
        { id: 'edit_led_bbxg', label: '背部斜杆', type: 'text', def: '0' }],
        // —— 顶部结构 ——
        [{ id: 'edit_led_dbqg', label: '顶部前杆', type: 'text', def: '0' },
        { id: 'edit_led_dblg', label: '顶部连杆', type: 'text', def: '0' },
        { id: 'edit_led_dbhg', label: '顶部后杆', type: 'text', def: '0' },
        { id: 'edit_led_zdtg', label: '走道踏杆', type: 'text', def: '0' }],
        // —— 底部结构 ——
        [{ id: 'edit_led_ibqg', label: '底部前杆', type: 'text', def: '0' },
        { id: 'edit_led_iblg', label: '底部连杆', type: 'text', def: '0' },
        { id: 'edit_led_ibhg', label: '底部后杆', type: 'text', def: '0' },
        { id: 'edit_led_zdxg', label: '走道斜杆', type: 'text', def: '0' }],
        // —— 斜拉 / 水平 ——
        [{ id: 'edit_led_hxlg', label: '后斜拉杆', type: 'text', def: '0' },
        { id: 'edit_led_xllg', label: '斜拉连杆', type: 'text', def: '0' },
        { id: 'edit_led_sphg', label: '水平横杆', type: 'text', def: '0' },
        { id: 'edit_led_fljj', label: '法兰间距', type: 'text', def: '0' }],
        // —— 立柱 ——
        [{ id: 'edit_led_wblz', label: '外部立柱', type: 'text', def: '0' },
        { id: 'edit_led_nblz', label: '内部立柱', type: 'text', def: '0' },
        { id: 'edit_led_lzsl', label: '立柱数量', type: 'text', def: '0' },
        { id: 'edit_led_flmj', label: '法兰埋件', type: 'text', def: '0' }],
        // —— 地基 ——
        [{ id: 'edit_led_djhk', label: '地基横宽', type: 'text', def: '0' },
        { id: 'edit_led_djzk', label: '地基纵宽', type: 'text', def: '0' },
        { id: 'edit_led_djsd', label: '地基深度', type: 'text', def: '0' },
        { id: 'edit_led_djjl', label: '地基距离', type: 'text', def: '0' }],
        // —— 出图开关 1 ——
        [{ id: 'edit_led_psyt', label: '屏示意图', type: 'toggle', def: 0 },
        { id: 'edit_led_pggt', label: '屏钢构图', type: 'toggle', def: 0 },
        { id: 'edit_led_pxht', label: '屏信号图', type: 'toggle', def: 0 },
        { id: 'edit_led_ppdt', label: '屏配电图', type: 'toggle', def: 0 }],
        // —— 出图开关 2 ——
        [{ id: 'edit_led_pxtt', label: '屏系统图', type: 'toggle', def: 0 },
        { id: 'edit_led_zdtj', label: '自动推荐', type: 'toggle', def: 0 },
        { id: 'edit_led_zdbc', label: '自动保存', type: 'toggle', def: 0 },
        { id: 'edit_led_cltj', label: '材料统计', type: 'toggle', def: 0 }],
        // —— 出图开关 3 ——
        [{ id: 'edit_led_swmx', label: '三维模型', type: 'toggle', def: 0 },
        { id: 'edit_led_gjxt', label: '杆件相同', type: 'toggle', def: 0 },
        { id: 'edit_led_gzqk', label: '规则全开', type: 'toggle', def: 0 },
        { id: 'edit_led_szqd', label: '设自启动', type: 'toggle', def: 0 }],
        // —— 出图开关 4 ——
        [{ id: 'edit_led_sbyj', label: '鼠标右键', type: 'toggle', def: 0 },
        { id: 'edit_led_cslx', label: '测试列项', type: 'toggle', def: 0 },
        { id: 'edit_led_lsjl', label: '历史记录', type: 'popup', def: '无', options: ['无'] }]
    ],
    buildLisp(v) {
        let body = '';
        flatFields(this).forEach(f => {
            const raw = (v[f.id] != null) ? v[f.id] : '';
            if (f.type === 'toggle') { body += `(setq ${f.id} ${raw ? 1 : 0})\n  `; }
            else if (f.type === 'textarea') { body += `(setq ${f.id} "${q(String(raw).replace(/\n/g, '\\n'))}")\n  `; }
            else { body += `(setq ${f.id} "${q(String(raw))}")\n  `; }
        });
        return `(progn\n  ${body}(ZWGEN-LED-DRAW)\n  (princ "\\n[LED] 参数已提交"))`;
    }
};

/* ============================================================
   program_009 数据源（由 date.txt 转换而来，id 与字段一一对应）
   ============================================================ */
const LED_CPXH_INDOOR = {
    'Q系列-E': ['Q2.5', 'Q3', 'Q3.0', 'Q4'],
    'Q系列-H': ['Q1.2', 'Q1.3', 'Q1.5', 'Q1.6', 'Q1.8', 'Q2', 'Q2.5', 'Q3', 'Q3.0', 'Q4'],
    'Q系列-Pro': ['Q0.8', 'Q0.9', 'Q1', 'Q1.2', 'Q1.3', 'Q1.5', 'Q1.6', 'Q1.8', 'Q2', 'Q2.5', 'Q3', 'Q3.0', 'Q4'],
    'Q系列-Pro Max': ['Q0.8', 'Q1', 'Q1.2', 'Q1.3', 'Q1.5', 'Q2.5'],
    'Q系列 Plus': ['Q0.8', 'Q1', 'Q1.2', 'Q1.3', 'Q1.5', 'Q1.6', 'Q1.8', 'Q2'],
    'S系列': ['S0.8', 'S1', 'S1.2', 'S1.3', 'S1.5', 'S1.6', 'S1.8', 'S2', 'S2.5', 'S3', 'S3.0', 'S4'],
    '标准系列': ['P2.8-Pro', 'P3.9-Pro', 'P3.9-E'],
    '软模组': ['R1.2', 'R1.2Pro', 'R1.5H', 'R1.5Pro', 'R1.8Pro', 'R1.8H', 'R2H', 'R2Pro', 'R2.5H', 'R2.5Pro', 'R3.0H'],
    '两边斜角': ['Q2', 'Q2.5'],
    '四边斜角': ['Q1.2', 'Q1.3', 'Q1.5', 'Q1.6', 'Q1.8', 'Q2', 'Q2.5'],
    'CC系列': ['CC1.2', 'CC1.5', 'CC1.8', 'CC2', 'CC2.5'],
    'CS系列': ['CS1.2', 'CS1.5', 'CS1.8', 'CS2', 'CS2.5'],
    'G系列-H': ['G1.2', 'G1.5', 'G1.8', 'G2', 'G2.5', 'G3.0'],
    'G系列-Pro': ['G1.2', 'G1.5', 'G1.8', 'G2', 'G2.5', 'G3.0'],
    'VK系列': ['VKO.9', 'VK1.2', 'VK1.5', 'VK1.8'],
    'YK系列': ['YKO.9', 'YK1.2', 'YK1.5'],
    'XC系列': ['XC0.7', 'XC0.9', 'XC1.2', 'XC1.5'],
    'HY系列': ['HY2.6', 'HY2.8H', 'HY2.9H', 'HY3.9H'],
    'XS系列': ['XS1.2', 'XS1.5', 'XS1.8', 'XS2', 'XS2.5'],
    '明锐系列': ['TS3.9', 'UTS3.9'],
    'LY系列': ['LY2.9', 'LY3.9'],
    'DM系列': ['DM2.6', 'DM3.9'],
    'DW系列': ['DW1.2', 'DW1.5', 'DW1.9', 'DW2.3'],
    'N系列': ['N1.2', 'N1.5', 'N1.8', 'N2', 'DW2.5']
};
const LED_CPXH_OUTDOOR = {
    'Q系列-E': ['Q2.5', 'Q3.0', 'Q4', 'Q5', 'Q6(大)', 'Q8'],
    'Q系列-H': ['Q2.5', 'Q2.5H', 'Q3.0', 'Q3.0H', 'Q4', 'Q5', 'Q6', 'Q6H', 'Q6(大)', 'Q6(大)H', 'Q8', 'Q8H'],
    'Q系列-Pro': ['Q2', 'Q2.5', 'Q3.0', 'Q4', 'Q5', 'Q6', 'Q6(大)', 'Q8', 'Q10'],
    'Q系列-Pro W': ['Q2.5', 'Q3.0', 'Q4'],
    'Q系列 Plus': ['Q2.5', 'Q3.0', 'Q4', 'Q5', 'Q6(大)', 'Q8', 'Q10'],
    'S系列': ['S2.5', 'S3.0', 'S4', 'S5', 'S6(大)', 'S8', 'S10'],
    '标准系列': ['P3.9-Pro', 'P4.8-Pro', 'P5.9-Pro'],
    '软模组': ['R4'],
    '两边斜角': ['Q4', 'Q5', 'Q8'],
    '四边斜角': ['Q2.5', 'Q3.0', 'Q4', 'Q5', 'Q6', 'Q8'],
    'CC系列': ['CC2.5', 'CC3.0', 'CC4', 'CC5', 'CC6(大板)'],
    'VK系列': ['VK2.5', 'VK2.5(小)', 'VK3.0', 'VK3.0(小)', 'VK4', 'VK4(小)', 'VK5', 'VK5(小)', 'VK6', 'VK8', 'VK10'],
    'HY系列': ['HY2.9H', 'HY3.9H', 'HY4.8H'],
    'XS系列': ['XS2.5', 'XS3.0', 'XS4', 'XS5'],
    'CG系列': ['CG3.9'],
    'EM系列': ['EM3.9'],
    '小模组': ['Q2.5H', 'Q2.5Pro', 'Q4E', 'Q4H', 'Q4Pro', 'Q5E', 'Q5H', 'Q5Pro'],
    '明锐系列': ['GS10.4'],
    'ZK-D系列': ['ZK-D6.6', 'ZK-D8', 'ZK-D10'],
    'LY系列': ['LY2.9', 'LY3.9'],
    'DM系列': ['DM2.9', 'DM3.9', 'DM4.8'],
    'C系列': ['C2.5', 'C3.0', 'C4', 'C5', 'C6', 'C8', 'C10']
};
const LED_DATA = {
    edit_led_snhw: ['室内', '户外'],
    edit_led_cpxl: { '室内': Object.keys(LED_CPXH_INDOOR), '户外': Object.keys(LED_CPXH_OUTDOOR) },
    edit_led_cpxh: (function () {
        const m = {};
        for (const k in LED_CPXH_INDOOR) m[k] = (m[k] || []).concat(LED_CPXH_INDOOR[k]);
        for (const k in LED_CPXH_OUTDOOR) m[k] = (m[k] || []).concat(LED_CPXH_OUTDOOR[k]);
        return m;
    })(),
    edit_led_dylx: ['模组', '简易箱体', '带门箱体', '压铸铝箱', '镁丽III箱体', '镁固箱体', '睽丽箱体', 'DW箱体', '格栅箱体', '透明箱体'],
    edit_led_clcz: ['铝型材', '热镀锌钢', '铝钢混用'],
    edit_led_xsfx: ['内显示', '外显示'],
    edit_led_pmys: ['平面', '弧形', '折角', '三角', '双面'],
    edit_led_azys: ['落地', '落地拉墙', '壁挂', '吊装', '嵌入', '立柱'],
    edit_led_xmqy: ['西南', '西北', '华南', '黄河', '华东', '渤海', '长江', '东北', '海外区域', '售前部门', '售中部门', '工程项目']
};
/* LED 级联：室内/户外 决定 产品系列，产品系列 决定 产品型号 */
function setupLedCascade(id) {
    const snhw = document.getElementById('f_' + id + '_edit_led_snhw');
    const cpxl = document.getElementById('f_' + id + '_edit_led_cpxl');
    const cpxh = document.getElementById('f_' + id + '_edit_led_cpxh');
    if (!snhw || !cpxl) return;
    function fillCpxl() {
        const env = snhw.value;
        const list = (LED_DATA.edit_led_cpxl[env] || []);
        cpxl.innerHTML = '';
        list.forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; cpxl.appendChild(op); });
        if (list.length) cpxl.value = list[0];
        fillCpxh();
    }
    function fillCpxh() {
        if (!cpxh) return;
        const models = LED_DATA.edit_led_cpxh[cpxl.value] || [];
        cpxh.innerHTML = '';
        models.forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; cpxh.appendChild(op); });
        if (models.length) cpxh.value = models[0];
    }
    snhw.addEventListener('change', fillCpxl);
    cpxl.addEventListener('change', fillCpxh);
    fillCpxl();
}