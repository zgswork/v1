(function () {
    'use strict';

    if (typeof FILE_NAMES === 'undefined') {
        console.error('请确保 index.js 已正确加载并定义了 FILE_NAMES 数组。');
        return;
    }

    // ---- DOM 引用 ----
    const grid = document.getElementById('fileGrid');
    const searchInput = document.getElementById('searchInput');
    const totalCountEl = document.getElementById('totalCount');
    const visibleCountEl = document.getElementById('visibleCount');
    const overlay = document.getElementById('overlay');
    const backBtn = document.getElementById('backBtn');
    const contentFrame = document.getElementById('contentFrame');
    const overlayTitle = document.getElementById('overlayTitle');

    // ---- 状态 ----
    let allValidFiles = []; // 所有有效原始名称（含 *），按发现顺序
    let isSearching = false;

    // ---- 工具函数 ----

    function buildCheckPath(raw) {
        let path = raw.startsWith('*') ? raw.slice(1) : raw;
        if (!/\.html$/i.test(path)) {
            path += '.html';
        }
        return path;
    }

    function getDisplayName(raw) {
        let base = raw.split('/').pop();
        base = base.replace(/^\*/, '');
        base = base.replace(/\.[^.]+$/, '');
        const parts = base.split(/[-_]/);
        return parts[0] && parts[0].trim() ? parts[0].trim() : base;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async function checkFileExists(url) {
        try {
            let resp = await fetch(url, { method: 'HEAD' });
            if (resp.ok) return true;
            if (resp.status === 405 || resp.status === 404) {
                const getResp = await fetch(url, {
                    method: 'GET',
                    headers: { 'Range': 'bytes=0-0' }
                });
                return getResp.status === 200 || getResp.status === 206;
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    // ---- 渲染（搜索模式） ----

    function renderFiltered(files) {
        if (files.length === 0) {
            grid.innerHTML =
                `<div class="empty-state"><span class="emoji">🔍</span>没有匹配的应用</div>`;
            return;
        }
        let html = '';
        for (const raw of files) {
            const display = getDisplayName(raw);
            const isStarred = raw.startsWith('*');
            const actualPath = buildCheckPath(raw);
            const cardClass = isStarred ? 'file-card visible starred' : 'file-card visible';
            html += `<div class="${cardClass}" data-filename="${escapeHtml(actualPath)}">
                                <a href="#" title="${escapeHtml(raw)}">
                                    <span class="filename">${escapeHtml(display)}</span>
                                </a>
                            </div>`;
        }
        grid.innerHTML = html;
    }

    // ---- 增量添加卡片（无闪烁） ----

    function appendCard(raw) {
        const display = getDisplayName(raw);
        const isStarred = raw.startsWith('*');
        const actualPath = buildCheckPath(raw);
        const card = document.createElement('div');
        card.className = isStarred ? 'file-card visible starred' : 'file-card visible';
        card.dataset.filename = actualPath;
        card.innerHTML = `<a href="#" title="${escapeHtml(raw)}">
                                    <span class="filename">${escapeHtml(display)}</span>
                                </a>`;
        // 追加到网格末尾
        grid.appendChild(card);
        // 更新统计
        updateStats(allValidFiles.length, allValidFiles.length);
    }

    // ---- 统计更新 ----

    function updateStats(total, visible) {
        totalCountEl.textContent = total;
        if (visible === total) {
            visibleCountEl.textContent = '';
        } else {
            visibleCountEl.textContent = `(已搜索 ${visible} 个应用)`;
        }
    }

    // ---- 排序（按原始顺序） ----

    function sortGridByOrder() {
        // 获取所有卡片，按原始索引排序
        const cards = Array.from(grid.children);
        // 建立 raw -> 索引映射
        const indexMap = new Map();
        allValidFiles.forEach((raw, idx) => indexMap.set(raw, idx));
        cards.sort((a, b) => {
            const rawA = a.querySelector('a')?.getAttribute('title') || '';
            const rawB = b.querySelector('a')?.getAttribute('title') || '';
            return (indexMap.get(rawA) ?? Infinity) - (indexMap.get(rawB) ?? Infinity);
        });
        // 重新挂载
        for (const card of cards) {
            grid.appendChild(card);
        }
    }

    // ---- 搜索过滤 ----

    function filterFiles(query) {
        const q = query.trim().toLowerCase();
        let filtered;
        if (!q) {
            // 显示全部（若 allValidFiles 为空，显示空状态）
            if (allValidFiles.length === 0) {
                grid.innerHTML =
                    `<div class="empty-state"><span class="emoji">📭</span>暂无可用应用</div>`;
            } else {
                // 重新渲染全部（但为了保持一致，使用 renderFiltered）
                renderFiltered(allValidFiles);
            }
            updateStats(allValidFiles.length, allValidFiles.length);
        } else {
            filtered = allValidFiles.filter(raw => {
                const display = getDisplayName(raw);
                return display.toLowerCase().includes(q) || raw.toLowerCase().includes(q);
            });
            renderFiltered(filtered);
            updateStats(allValidFiles.length, filtered.length);
        }
    }

    // ---- 覆盖层控制 ----

    function openFile(path) {
        overlay.classList.add('active');
        overlayTitle.textContent = path;
        contentFrame.src = encodeURI(path);
    }

    function closeOverlay() {
        overlay.classList.remove('active');
        contentFrame.src = 'about:blank';
        overlayTitle.textContent = '正在加载…';
    }

    // ---- 事件绑定 ----

    grid.addEventListener('click', function (e) {
        const card = e.target.closest('.file-card');
        if (!card) return;
        const path = card.dataset.filename;
        if (path) {
            e.preventDefault();
            openFile(path);
        }
    });

    backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeOverlay();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeOverlay();
        }
    });

    searchInput.addEventListener('input', function (e) {
        filterFiles(this.value);
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            this.value = '';
            filterFiles('');
            this.blur();
        }
    });

    // ---- 初始化（后台静默检测，逐个追加） ----

    async function init() {
        // 禁用搜索框
        searchInput.disabled = true;

        // 初始空网格
        grid.innerHTML = `<div class="empty-state"><span class="emoji">⏳</span>正在扫描应用…</div>`;

        // 去重（检测路径唯一，保留首次出现）
        const uniqueItems = [];
        const seen = new Set();
        for (const raw of FILE_NAMES) {
            const checkPath = buildCheckPath(raw);
            if (!seen.has(checkPath)) {
                seen.add(checkPath);
                uniqueItems.push({ raw, checkPath });
            }
        }

        const total = uniqueItems.length;
        if (total === 0) {
            grid.innerHTML =
                `<div class="empty-state"><span class="emoji">📭</span>未检测到任何 HTML 文件</div>`;
            searchInput.disabled = false;
            return;
        }

        // 清理空状态，准备追加卡片
        grid.innerHTML = '';

        const queue = [...uniqueItems];
        let active = 0;
        const concurrency = 12;
        let foundCount = 0;

        // 检测完成回调
        function onValid(raw) {
            allValidFiles.push(raw);
            foundCount++;
            appendCard(raw);
        }

        return new Promise((resolve) => {
            async function worker() {
                while (queue.length > 0) {
                    const item = queue.shift();
                    const { raw, checkPath } = item;
                    const exists = await checkFileExists(checkPath);
                    if (exists) {
                        onValid(raw);
                    }
                }
                active--;
                if (active === 0 && queue.length === 0) {
                    // 全部检测完成
                    // 排序卡片（按原始顺序）
                    sortGridByOrder();
                    // 更新统计（已由 append 更新，无需再更新）
                    // 如果没有任何文件，显示空状态
                    if (foundCount === 0) {
                        grid.innerHTML =
                            `<div class="empty-state"><span class="emoji">📭</span>未检测到任何有效的 HTML 文件<br><span style="font-size:0.8rem;color:#94a3b8;">请确保文件与当前页面在同一目录（或子目录）下</span></div>`;
                    } else {
                        // 确保全部显示（可能搜索框有残留？检测前搜索框禁用，所以不会有）
                        // 但为了安全，重新渲染全部
                        renderFiltered(allValidFiles);
                    }
                    // 启用搜索框
                    searchInput.disabled = false;
                    // 更新统计（最终）
                    updateStats(allValidFiles.length, allValidFiles.length);
                    resolve();
                }
            }

            const workerCount = Math.min(concurrency, total);
            for (let i = 0; i < workerCount; i++) {
                active++;
                worker();
            }
        });
    }

    init();
})();