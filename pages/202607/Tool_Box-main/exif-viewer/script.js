const exifr = window.exifr;
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileDim = document.getElementById('fileDim');
const result = document.getElementById('result');
const actions = document.getElementById('actions');
const exportBtn = document.getElementById('exportBtn');
const sampleBtn = document.getElementById('sampleBtn');

let lastData = null;
let lastFileName = '';
let lastObjectURL = null;

const keyLabels = {
    Make: '厂商', Model: '型号', LensModel: '镜头型号', Software: '软件', Artist: '艺术家',
    FNumber: '光圈', ExposureTime: '快门速度', ISO: '感光度', FocalLength: '焦距',
    ExposureCompensation: '曝光补偿', MeteringMode: '测光模式', Flash: '闪光灯',
    WhiteBalance: '白平衡', ColorSpace: '色彩空间', ExposureProgram: '拍摄模式',
    latitude: '纬度', longitude: '经度', GPSAltitude: '海拔',
    DateTimeOriginal: '拍摄时间', DateTimeDigitized: '数字化时间', DateTime: '修改时间',
    OffsetTimeOriginal: '时区偏移',
    ImageWidth: '宽度', ImageHeight: '高度', Orientation: '方向', Compression: '压缩格式',
    XResolution: 'X 分辨率', YResolution: 'Y 分辨率', ResolutionUnit: '分辨率单位',
    headline: '标题', description: '描述', creator: '作者', copyright: '版权',
    keywords: '关键词', source: '来源', usageTerms: '使用条款',
    Rating: '评分', DocumentID: '文档 ID', InstanceID: '实例 ID',
    YCbCrPositioning: 'YCbCr 定位', SensitivityType: '感光度类型',
    RecommendedExposureIndex: '推荐曝光指数', ExifVersion: 'EXIF 版本',
    OffsetTime: '时区偏移', OffsetTimeDigitized: '数字化时区偏移',
    CompressedBitsPerPixel: '压缩位深', BrightnessValue: '亮度值',
    MaxApertureValue: '最大光圈值', LightSource: '光源',
    SubSecTime: '子秒时间', SubSecTimeOriginal: '原始子秒时间',
    SubSecTimeDigitized: '数字化子秒时间', FlashpixVersion: 'Flashpix 版本',
    ExifImageWidth: 'EXIF 图像宽度', ExifImageHeight: 'EXIF 图像高度',
    FileSource: '文件来源', SceneType: '场景类型', CustomRendered: '自定义渲染',
    ExposureMode: '曝光模式', DigitalZoomRatio: '数码变焦比',
    FocalLengthIn35mmFormat: '等效 35mm 焦距', SceneCaptureType: '场景拍摄类型',
    Contrast: '对比度', Saturation: '饱和度', Sharpness: '锐度',
    ShutterSpeedValue: '快门速度值', ApertureValue: '光圈值',
    SubjectDistance: '拍摄距离', ShootingMode: '拍摄模式', SelfTimer: '自拍',
    ImageUniqueID: '图像唯一 ID', LensMake: '镜头厂商', LensSerialNumber: '镜头序列号',
    BodySerialNumber: '机身序列号', OwnerName: '所有者', LensInfo: '镜头信息',
    GPSLatitudeRef: '纬度参考', GPSLongitudeRef: '经度参考', GPSAltitudeRef: '海拔参考',
    GPSSpeedRef: '速度参考', GPSImgDirectionRef: '方向参考',
    GPSTimeStamp: 'GPS 时间戳', GPSDateStamp: 'GPS 日期',
    Firmware: '固件版本', ExposureIndex: '曝光指数',
    ISOSpeedRatings: 'ISO 感光度', PhotographicSensitivity: '摄影感光度',
    PixelXDimension: '像素宽度', PixelYDimension: '像素高度',
    InteropOffset: '互操作偏移', FlashEnergy: '闪光灯能量',
    FocalPlaneXResolution: '焦平面 X 分辨率', FocalPlaneYResolution: '焦平面 Y 分辨率',
    FocalPlaneResolutionUnit: '焦平面分辨率单位',
    SubjectLocation: '主体位置', ExposureProgram: '曝光程序',
    SpectralResponse: '光谱响应', OECF: '光电转换函数',
    SpatialFrequencyResponse: '空间频率响应', FocalLengthIn35mmFilm: '等效 35mm 焦距',
    SensingMethod: '传感方式', CFAPattern: 'CFA 模式',
    GainControl: '增益控制',
    SubjectDistanceRange: '主体距离范围',
};

// SAMPLE IMAGE (contains EXIF data)
const SAMPLE_URL = 'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/Canon_40D.jpg';

// ---------- Upload ----------
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) processFile(fileInput.files[0]); });

sampleBtn.addEventListener('click', e => {
    e.stopPropagation();
    processURL(SAMPLE_URL, 'Canon_40D.jpg');
});

// ---------- Process File ----------
async function processFile(file) {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(cr2|cr3|nef|arw|dng|raf|rw2|orf|srw|pef|mrw|dcr|raw|rwl|3fr|kdc|mdc|mef|mos|nrw|sr2|srf|x3f)$/i)) {
        showError('请选择图片文件');
        return;
    }
    if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
    const url = URL.createObjectURL(file);
    lastObjectURL = url;
    lastFileName = file.name;
    showPreview(url, file.name, file.size);
    try {
        const buf = await file.arrayBuffer();
        await parseMetadata(buf, file.name);
    } catch (e) {
        showError('解析失败: ' + e.message);
    }
}

async function processURL(url, name) {
    lastFileName = name;
    showPreview(url, name, 0);
    try {
        const output = await exifr.parse(url);
        if (!output || Object.keys(output).length === 0) {
            showEmpty('未找到 EXIF / IPTC / XMP 元数据');
            lastData = null;
            actions.style.display = 'none';
            return;
        }
        renderResult(output, name);
        lastData = output;
        actions.style.display = 'flex';
    } catch (e) {
        showError('加载示例图片失败: ' + e.message);
    }
}

// ---------- Show Preview ----------
function showPreview(url, name, size) {
    preview.classList.add('visible');
    fileName.textContent = name;
    fileSize.textContent = size ? `大小: ${(size / 1024).toFixed(1)} KB` : '';
    const isRaw = /\.(cr2|cr3|nef|arw|dng|raf|rw2|orf|srw|pef|mrw|dcr|raw|rwl|3fr|kdc|mdc|mef|mos|nrw|sr2|srf|x3f)$/i.test(name);
    if (isRaw) {
        previewImg.src = '';
        previewImg.alt = 'RAW file';
        previewImg.style.display = 'none';
        fileDim.textContent = 'RAW 格式 · 无法预览图像';
    } else {
        previewImg.style.display = '';
        previewImg.src = url;
        previewImg.onload = () => {
            fileDim.textContent = `尺寸: ${previewImg.naturalWidth} × ${previewImg.naturalHeight}`;
        };
    }
}

// ---------- Parse Metadata ----------
async function parseMetadata(buf, name) {
    try {
        const output = await exifr.parse(buf, true);
        if (!output || Object.keys(output).length === 0) {
            showEmpty('未找到 EXIF / IPTC / XMP 元数据');
            lastData = null;
            actions.style.display = 'none';
            return;
        }
        renderResult(output, name);
        lastData = output;
        actions.style.display = 'flex';
    } catch (e) {
        showError('元数据解析失败: ' + e.message);
    }
}

// ---------- Render ----------
function renderResult(data, name) {
    const sections = [];

    // Camera
    const camRows = [
        ['相机厂商 (Make)', data.Make],
        ['相机型号 (Model)', data.Model],
        ['镜头型号 (LensModel)', data.LensModel],
        ['软件 (Software)', data.Software],
        ['艺术家 (Artist)', data.Artist],
    ].filter(r => r[1] != null && r[1] !== '');
    if (camRows.length) sections.push({ title: '📷 相机信息 Camera Info', rows: camRows });

    // Shooting
    const shootRows = [
        ['光圈 (FNumber)', data.FNumber != null ? `f/${data.FNumber}` : null],
        ['快门速度 (ExposureTime)', data.ExposureTime != null ? formatShutter(data.ExposureTime) : null],
        ['ISO', data.ISO != null ? data.ISO : null],
        ['焦距 (FocalLength)', data.FocalLength != null ? `${data.FocalLength} mm` : null],
        ['曝光补偿 (ExposureComp.)', data.ExposureCompensation != null ? `${data.ExposureCompensation} EV` : null],
        ['测光模式 (MeteringMode)', data.MeteringMode],
        ['闪光灯 (Flash)', data.Flash != null ? (data.Flash.Fired ? '开启 Yes' : '未开启 No') : null],
        ['白平衡 (WhiteBalance)', data.WhiteBalance],
        ['色彩空间 (ColorSpace)', data.ColorSpace],
        ['拍摄模式 (ExposureProgram)', data.ExposureProgram],
    ].filter(r => r[1] != null && r[1] !== '');
    if (shootRows.length) sections.push({ title: '⚙ 拍摄参数 Shooting Params', rows: shootRows });

    // GPS
    const gpsRows = [];
    if (data.latitude != null && data.longitude != null) {
        const latStr = toDMS(data.latitude, 'lat');
        const lngStr = toDMS(data.longitude, 'lng');
        gpsRows.push(['纬度 (Latitude)', latStr]);
        gpsRows.push(['经度 (Longitude)', lngStr]);
        if (data.GPSAltitude != null) gpsRows.push(['海拔 (Altitude)', `${data.GPSAltitude} m`]);
        gpsRows.push(['查看地图 (Map)', `
            <a class="map-link" href="https://uri.amap.com/marker?position=${data.longitude},${data.latitude}&src=exif-viewer" target="_blank" rel="noopener">📍 高德地图 ↗</a>
            <a class="map-link" href="https://www.bing.com/maps?cp=${data.latitude}~${data.longitude}&lvl=16&sp=point.${data.latitude}_${data.longitude}" target="_blank" rel="noopener">📍 必应地图 ↗</a>
            <a class="map-link" href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" target="_blank" rel="noopener">📍 Google Maps ↗</a>
        `]);
    }
    if (gpsRows.length) sections.push({ title: '🗺 GPS 位置 Location', rows: gpsRows });

    // Time
    const timeRows = [
        ['拍摄时间 (DateTimeOriginal)', formatDate(data.DateTimeOriginal)],
        ['数字化时间 (DateTimeDigitized)', formatDate(data.DateTimeDigitized)],
        ['修改时间 (DateTime)', formatDate(data.DateTime)],
        ['时区偏移 (OffsetTime)', data.OffsetTimeOriginal],
    ].filter(r => r[1] != null && r[1] !== '');
    if (timeRows.length) sections.push({ title: '📅 时间信息 DateTime', rows: timeRows });

    // Image
    const imgRows = [
        ['宽度 (ImageWidth)', data.ImageWidth != null ? `${data.ImageWidth} px` : null],
        ['高度 (ImageHeight)', data.ImageHeight != null ? `${data.ImageHeight} px` : null],
        ['方向 (Orientation)', data.Orientation != null ? formatOrientation(data.Orientation) : null],
        ['压缩格式 (Compression)', data.Compression],
        ['X 分辨率 (XResolution)', data.XResolution],
        ['Y 分辨率 (YResolution)', data.YResolution],
        ['分辨率单位 (ResolutionUnit)', data.ResolutionUnit],
    ].filter(r => r[1] != null && r[1] !== '');
    if (imgRows.length) sections.push({ title: '🖼 图像信息 Image', rows: imgRows });

    // IPTC
    const iptcRows = [
        ['标题 (Headline)', data.headline],
        ['描述 (Description)', data.description],
        ['作者 (Creator)', data.creator],
        ['版权 (Copyright)', data.copyright],
        ['关键词 (Keywords)', data.keywords ? (Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords) : null],
        ['来源 (Source)', data.source],
        ['使用条款 (UsageTerms)', data.usageTerms],
    ].filter(r => r[1] != null && r[1] !== '');
    if (iptcRows.length) sections.push({ title: '📝 IPTC / XMP', rows: iptcRows });

    // Others (aggregate remaining)
    const knownKeys = new Set([
        'Make','Model','LensModel','Software','Artist',
        'FNumber','ExposureTime','ISO','FocalLength','ExposureCompensation',
        'MeteringMode','Flash','WhiteBalance','ColorSpace','ExposureProgram',
        'latitude','longitude','GPSAltitude','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef',
        'DateTimeOriginal','DateTimeDigitized','DateTime','OffsetTimeOriginal',
        'ImageWidth','ImageHeight','Orientation','Compression','XResolution','YResolution','ResolutionUnit',
        'headline','description','creator','copyright','keywords','source','usageTerms',
    ]);
    const other = {};
    for (const k of Object.keys(data)) {
        if (!knownKeys.has(k) && data[k] != null && typeof data[k] !== 'object') {
            other[k] = data[k];
        }
    }
    const otherArr = Object.entries(other).slice(0, 30)
        .map(([k, v]) => {
            const label = keyLabels[k] ? `${keyLabels[k]} (${k})` : k;
            return [label, v];
        });
    if (otherArr.length) {
        sections.push({ title: `🔍 其他元数据 Other (${Object.keys(other).length})`, rows: otherArr });
    }

    // Render
    result.innerHTML = sections.map(s => `
        <div class="section">
            <div class="section-title">${s.title}</div>
            <div class="table-wrap">
                <table>${s.rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table>
            </div>
        </div>
    `).join('');
}

function showEmpty(msg) {
    result.innerHTML = `<div class="empty">${msg}</div>`;
}

function showError(msg) {
    preview.classList.remove('visible');
    actions.style.display = 'none';
    result.innerHTML = `<div class="empty" style="color:var(--err)">${msg}</div>`;
}

// ---------- Helpers ----------
function formatShutter(t) {
    if (t < 1) return `1/${Math.round(1/t)}`;
    return `${t}s`;
}

function formatOrientation(v) {
    const map = { 1: '正常', 3: '旋转 180°', 6: '顺时针 90°', 8: '逆时针 90°' };
    return map[v] || `${v}`;
}

function formatDate(v) {
    if (!v) return null;
    try { return new Date(v).toLocaleString('zh-CN'); } catch { return v; }
}

function toDMS(v, type) {
    const d = Math.floor(Math.abs(v));
    const m = Math.floor((Math.abs(v) - d) * 60);
    const s = ((Math.abs(v) - d - m / 60) * 3600).toFixed(2);
    const dir = type === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
    return `${d}°${m}'${s}" ${dir}`;
}

// ---------- Export JSON ----------
exportBtn.addEventListener('click', () => {
    if (!lastData) return;
    const payload = { file: lastFileName, metadata: lastData };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = `${lastFileName.replace(/\.[^.]+$/, '')}_metadata.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
});
