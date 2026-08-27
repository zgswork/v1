// Code Navigator - 离线代码导航工具
class CodeNavigator {
    constructor() {
        this.files = {};
        this.directoryStructure = {};
        this.symbolIndex = [];
        this.bookmarks = this.loadFromLocalStorage('bookmarks', []);
        this.recentFiles = this.loadFromLocalStorage('recentFiles', []);
        this.currentFile = null;
        this.ignoredDirectories = ['node_modules', 'dist', 'build', '.git', '__pycache__', 'vendor', '.idea', '.vscode'];
        this.fileTypes = {
            js: { name: 'JavaScript', extensions: ['.js', '.mjs', '.cjs'] },
            ts: { name: 'TypeScript', extensions: ['.ts', '.tsx'] },
            py: { name: 'Python', extensions: ['.py'] },
            java: { name: 'Java', extensions: ['.java'] },
            kt: { name: 'Kotlin', extensions: ['.kt', '.kts'] },
            cpp: { name: 'C++', extensions: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'] },
            go: { name: 'Go', extensions: ['.go'] },
            rs: { name: 'Rust', extensions: ['.rs'] },
            php: { name: 'PHP', extensions: ['.php'] },
            html: { name: 'HTML', extensions: ['.html', '.htm'] },
            css: { name: 'CSS', extensions: ['.css'] },
            sql: { name: 'SQL', extensions: ['.sql'] }
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.renderBookmarks();
        this.renderRecentFiles();
    }

    setupEventListeners() {
        // 文件上传
        const uploadBtn = document.getElementById('upload-btn');
        const fileInput = document.getElementById('file-input');

        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // 拖拽上传
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                this.handleFileUpload({ target: { files: e.dataTransfer.files } });
            }
        });

        // 清除数据
        document.getElementById('clear-data-btn').addEventListener('click', () => this.clearData());

        // 搜索
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('search-results').classList.remove('show');
            }
        });

        // 主题切换
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // 书签按钮
        document.getElementById('toggle-bookmark').addEventListener('click', () => this.toggleBookmark());
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        const themeToggle = document.getElementById('theme-toggle');
        const icon = themeToggle.querySelector('i');
        const span = themeToggle.querySelector('span');

        if (newTheme === 'dark') {
            icon.className = 'fas fa-sun';
            span.textContent = '亮色模式';
        } else {
            icon.className = 'fas fa-moon';
            span.textContent = '暗黑模式';
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) { // 50MB 限制
            alert('文件大小超过 50MB 限制，请选择较小的文件');
            return;
        }

        this.showProgress('正在解析 ZIP 文件...');

        const zip = new JSZip();
        zip.loadAsync(file)
            .then(zip => this.processZip(zip))
            .then(() => this.hideProgress())
            .catch(error => {
                this.hideProgress();
                console.error('解析 ZIP 文件失败:', error);
                alert('解析 ZIP 文件失败，请确保文件格式正确');
            });
    }

    async processZip(zip) {
        this.files = {};
        this.directoryStructure = {};
        this.symbolIndex = [];

        const entries = Object.entries(zip.files);
        const totalFiles = entries.filter(([path]) => !path.endsWith('/')).length;
        let processedFiles = 0;

        for (const [path, zipEntry] of entries) {
            if (zipEntry.dir) continue;

            // 检查是否在忽略目录中
            const shouldIgnore = this.ignoredDirectories.some(dir =>
                path.startsWith(dir + '/') || path === dir
            );
            if (shouldIgnore) continue;

            try {
                const content = await zipEntry.async('string');
                this.files[path] = {
                    content: content,
                    size: zipEntry._data.uncompressedSize,
                    path: path
                };

                // 更新目录结构
                this.updateDirectoryStructure(path);

                // 提取符号
                this.extractSymbols(path, content);

                processedFiles++;
                this.updateProgress((processedFiles / totalFiles) * 100, `正在解析: ${processedFiles}/${totalFiles} 个文件`);

            } catch (error) {
                console.warn(`无法读取文件 ${path}:`, error);
            }
        }

        // 渲染目录树
        this.renderDirectoryTree();

        // 显示欢迎信息
        this.showEmptyState('文件解析完成，开始浏览代码');
    }

    updateDirectoryStructure(path) {
        const parts = path.split('/');
        let current = this.directoryStructure;

        for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i];
            if (!current[dirName]) {
                current[dirName] = { type: 'directory', children: {} };
            }
            current = current[dirName].children;
        }

        const fileName = parts[parts.length - 1];
        current[fileName] = { type: 'file', path: path };
    }

    renderDirectoryTree() {
        const treeContainer = document.getElementById('directory-tree');
        treeContainer.innerHTML = this.renderTreeNode('', this.directoryStructure);
    }

    renderTreeNode(parentPath, node) {
        let html = '';

        Object.entries(node).forEach(([name, item]) => {
            const currentPath = parentPath ? `${parentPath}/${name}` : name;

            if (item.type === 'directory') {
                const hasChildren = Object.keys(item.children).length > 0;
                html += `
                    <div class="tree-node">
                        <div class="tree-node-header" onclick="codeNavigator.toggleTreeNode('${currentPath}')">
                            <span class="toggle">${hasChildren ? '▼' : ' '}</span>
                            <i class="fas fa-folder"></i>
                            <span>${name}</span>
                        </div>
                        <div class="tree-node-children" id="tree-node-${currentPath}">
                            ${this.renderTreeNode(currentPath, item.children)}
                        </div>
                    </div>
                `;
            } else {
                const fileType = this.getFileType(item.path);
                const icon = this.getFileIcon(fileType);
                html += `
                    <div class="tree-node-file" onclick="codeNavigator.openFile('${item.path}')">
                        <i class="${icon}"></i>
                        <span>${name}</span>
                    </div>
                `;
            }
        });

        return html;
    }

    toggleTreeNode(path) {
        const childrenDiv = document.getElementById(`tree-node-${path}`);
        if (!childrenDiv) return;

        childrenDiv.classList.toggle('show');

        const header = childrenDiv.parentElement.querySelector('.tree-node-header .toggle');
        if (header) {
            header.textContent = childrenDiv.classList.contains('show') ? '▼' : '▶';
        }
    }

    getFileType(filePath) {
        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        for (const [type, config] of Object.entries(this.fileTypes)) {
            if (config.extensions.includes(ext)) {
                return type;
            }
        }
        return 'unknown';
    }

    getFileIcon(fileType) {
        const icons = {
            js: 'fab fa-js',
            ts: 'fab fa-js',
            py: 'fab fa-python',
            java: 'fab fa-java',
            kt: 'fas fa-code',
            cpp: 'fas fa-code',
            go: 'fas fa-code',
            rs: 'fas fa-code',
            php: 'fab fa-php',
            html: 'fab fa-html5',
            css: 'fab fa-css3-alt',
            sql: 'fas fa-database',
            unknown: 'fas fa-file'
        };
        return icons[fileType] || icons.unknown;
    }

    extractSymbols(filePath, content) {
        const fileType = this.getFileType(filePath);
        const lines = content.split('\n');

        // 符号提取规则
        const symbolPatterns = {
            js: [
                { regex: /function\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /(?:const|let|var)\s+(\w+)\s*=/g, type: 'variable' },
                { regex: /class\s+(\w+)/g, type: 'class' }
            ],
            ts: [
                { regex: /function\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /(?:const|let|var)\s+(\w+)\s*=/g, type: 'variable' },
                { regex: /class\s+(\w+)/g, type: 'class' },
                { regex: /interface\s+(\w+)/g, type: 'interface' }
            ],
            py: [
                { regex: /def\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /class\s+(\w+)\s*\(/g, type: 'class' },
                { regex: /(\w+)\s*=/g, type: 'variable' }
            ],
            java: [
                { regex: /(?:public|private|protected|static|final|abstract|synchronized|native|transient|volatile|strictfp)\s+[\w<>\[\]]+\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /class\s+(\w+)/g, type: 'class' },
                { regex: /interface\s+(\w+)/g, type: 'interface' },
                { regex: /(?:public|private|protected|static|final|transient|volatile)\s+[\w<>\[\]]+\s+(\w+)\s*;/g, type: 'variable' }
            ],
            cpp: [
                { regex: /[\w<>\[\]]+\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /class\s+(\w+)/g, type: 'class' },
                { regex: /struct\s+(\w+)/g, type: 'struct' }
            ],
            go: [
                { regex: /func\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /type\s+(\w+)\s+(struct|interface)/g, type: 'type' }
            ],
            rs: [
                { regex: /fn\s+(\w+)\s*\(/g, type: 'function' },
                { regex: /struct\s+(\w+)/g, type: 'struct' },
                { regex: /enum\s+(\w+)/g, type: 'enum' }
            ]
        };

        const patterns = symbolPatterns[fileType] || [];

        lines.forEach((line, lineNumber) => {
            patterns.forEach(pattern => {
                const matches = [...line.matchAll(pattern.regex)];
                matches.forEach(match => {
                    if (match[1]) {
                        this.symbolIndex.push({
                            name: match[1],
                            type: pattern.type,
                            filePath: filePath,
                            lineNumber: lineNumber + 1 // 行号从 1 开始
                        });
                    }
                });
            });
        });
    }

    openFile(filePath) {
        const file = this.files[filePath];
        if (!file) return;

        this.currentFile = filePath;

        // 更新最近文件
        this.updateRecentFiles(filePath);

        // 渲染代码
        this.renderCode(file);

        // 更新 UI 状态
        this.updateFileTreeActive(filePath);
        this.updateBookmarkButton();
        this.updateStatusBar(filePath);

        // 隐藏搜索结果
        document.getElementById('search-results').classList.remove('show');
    }

    renderCode(file) {
        const codeContainer = document.getElementById('code-container');
        const fileName = file.path.split('/').pop();

        document.getElementById('current-file-name').textContent = fileName;

        const fileType = this.getFileType(file.path);
        const highlightedCode = this.highlightCode(file.content, fileType);

        codeContainer.innerHTML = `
            <div class="code-content">
                ${highlightedCode}
            </div>
        `;
    }

    highlightCode(content, fileType) {
        let lines = content.split('\n');
        let html = '';

        lines.forEach((line, index) => {
            let highlightedLine = this.highlightLine(line, fileType);
            html += `
                <div class="code-line">
                    <span class="line-number">${index + 1}</span>
                    <span class="line-content">${highlightedLine}</span>
                </div>
            `;
        });

        return html;
    }

    highlightLine(line, fileType) {
        let result = line;

        // 基础高亮规则
        const rules = [
            // 注释
            { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/g, class: 'code-comment' },
            // 字符串
            { regex: /(['"])(?:(?=(\\?))\2.)*?\1/g, class: 'code-string' },
            // 数字
            { regex: /\b\d+(\.\d+)?\b/g, class: 'code-number' }
        ];

        // 根据文件类型添加特定规则
        const languageSpecificRules = {
            js: [
                { regex: /\b(function|const|let|var|if|else|for|while|do|switch|case|break|continue|return|class|extends|import|export|from|as|new|this|that|true|false|null|undefined|typeof|instanceof)\b/g, class: 'code-keyword' },
                { regex: /(\w+)\s*(?=\()/g, class: 'code-function' }
            ],
            ts: [
                { regex: /\b(function|const|let|var|if|else|for|while|do|switch|case|break|continue|return|class|extends|import|export|from|as|new|this|that|true|false|null|undefined|typeof|instanceof|interface|type|namespace|public|private|protected|static|readonly)\b/g, class: 'code-keyword' },
                { regex: /(\w+)\s*(?=\()/g, class: 'code-function' }
            ],
            py: [
                { regex: /\b(def|class|if|else|elif|for|while|break|continue|return|import|from|as|pass|True|False|None|and|or|not|in|is|lambda|with|yield|try|except|finally|raise|assert|global|nonlocal|del)\b/g, class: 'code-keyword' },
                { regex: /(\w+)\s*(?=\()/g, class: 'code-function' }
            ],
            java: [
                { regex: /\b(public|private|protected|static|final|abstract|synchronized|native|transient|volatile|strictfp|class|interface|extends|implements|if|else|for|while|do|switch|case|break|continue|return|import|package|new|this|super|true|false|null|try|catch|finally|throw|throws|instanceof|typeof|void|int|long|short|byte|float|double|char|boolean|String|Object)\b/g, class: 'code-keyword' },
                { regex: /(\w+)\s*(?=\()/g, class: 'code-function' }
            ],
            html: [
                { regex: /(&lt;\/?\w+.*?&gt;)/g, class: 'code-keyword' },
                { regex: /(\w+)=(&quot;.*?&quot;|'.*?'|\w+)/g, class: 'code-string' }
            ],
            css: [
                { regex: /(\.|\#)\w+/g, class: 'code-function' },
                { regex: /(\w+):/g, class: 'code-keyword' },
                { regex: /(\".*?\"|'.*?'|\d+px|\d+%|\d+em)/g, class: 'code-string' }
            ]
        };

        const specificRules = languageSpecificRules[fileType] || [];
        const allRules = [...rules, ...specificRules];

        // 应用所有高亮规则
        allRules.forEach(rule => {
            result = result.replace(rule.regex, (match) => {
                return `<span class="${rule.class}">${match}</span>`;
            });
        });

        return result;
    }

    handleSearch(query) {
        if (!query.trim()) {
            document.getElementById('search-results').classList.remove('show');
            return;
        }

        const results = this.symbolIndex.filter(symbol =>
            symbol.name.toLowerCase().includes(query.toLowerCase())
        );

        this.renderSearchResults(results);
    }

    renderSearchResults(results) {
        const resultsContainer = document.getElementById('search-results');

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item">没有找到匹配的结果</div>';
        } else {
            resultsContainer.innerHTML = results.map(symbol => `
                <div class="search-result-item" onclick="codeNavigator.openFile('${symbol.filePath}')">
                    <div class="search-result-symbol">${symbol.name} <span style="color: var(--color-text-secondary); font-size: 12px;">(${symbol.type})</span></div>
                    <div class="search-result-path">${symbol.filePath}:${symbol.lineNumber}</div>
                </div>
            `).join('');
        }

        resultsContainer.classList.add('show');
    }

    updateRecentFiles(filePath) {
        // 移除旧的条目
        this.recentFiles = this.recentFiles.filter(f => f !== filePath);

        // 添加到开头
        this.recentFiles.unshift(filePath);

        // 最多保留 5 个
        if (this.recentFiles.length > 5) {
            this.recentFiles = this.recentFiles.slice(0, 5);
        }

        this.saveToLocalStorage('recentFiles', this.recentFiles);
        this.renderRecentFiles();
    }

    renderRecentFiles() {
        const recentContainer = document.getElementById('recent-files');

        if (this.recentFiles.length === 0) {
            recentContainer.innerHTML = '<div class="recent-item" style="color: var(--color-text-tertiary); cursor: default;">暂无最近打开的文件</div>';
        } else {
            recentContainer.innerHTML = this.recentFiles.map(filePath => {
                const fileName = filePath.split('/').pop();
                const fileType = this.getFileType(filePath);
                const icon = this.getFileIcon(fileType);
                return `
                    <div class="recent-item" onclick="codeNavigator.openFile('${filePath}')">
                        <i class="${icon}"></i>
                        <span>${fileName}</span>
                    </div>
                `;
            }).join('');
        }
    }

    toggleBookmark() {
        if (!this.currentFile) return;

        const index = this.bookmarks.indexOf(this.currentFile);

        if (index > -1) {
            // 移除书签
            this.bookmarks.splice(index, 1);
        } else {
            // 添加书签
            this.bookmarks.push(this.currentFile);
        }

        this.saveToLocalStorage('bookmarks', this.bookmarks);
        this.renderBookmarks();
        this.updateBookmarkButton();
    }

    updateBookmarkButton() {
        const bookmarkBtn = document.getElementById('toggle-bookmark');
        const icon = bookmarkBtn.querySelector('i');

        if (this.currentFile && this.bookmarks.includes(this.currentFile)) {
            icon.className = 'fas fa-star';
            bookmarkBtn.classList.add('active');
        } else {
            icon.className = 'far fa-star';
            bookmarkBtn.classList.remove('active');
        }
    }

    renderBookmarks() {
        const bookmarksContainer = document.getElementById('bookmarks');

        if (this.bookmarks.length === 0) {
            bookmarksContainer.innerHTML = '<div class="bookmark-item" style="color: var(--color-text-tertiary); cursor: default;">暂无书签</div>';
        } else {
            bookmarksContainer.innerHTML = this.bookmarks.map(filePath => {
                const fileName = filePath.split('/').pop();
                const fileType = this.getFileType(filePath);
                const icon = this.getFileIcon(fileType);
                return `
                    <div class="bookmark-item" onclick="codeNavigator.openFile('${filePath}')">
                        <i class="${icon}"></i>
                        <span>${fileName}</span>
                    </div>
                `;
            }).join('');
        }
    }

    updateFileTreeActive(filePath) {
        // 移除所有 active 类
        document.querySelectorAll('.tree-node-file').forEach(el => {
            el.classList.remove('active');
        });

        // 为当前文件添加 active 类
        // 这里需要更精确的选择器匹配
    }

    updateStatusBar(filePath) {
        const file = this.files[filePath];
        if (!file) return;

        const fileType = this.getFileType(filePath);
        const fileTypeConfig = this.fileTypes[fileType];
        const languageName = fileTypeConfig ? fileTypeConfig.name : '未知';
        const sizeKB = (file.size / 1024).toFixed(2);

        document.getElementById('status-file-path').textContent = filePath;
        document.getElementById('status-language').textContent = `语言: ${languageName}`;
        document.getElementById('status-file-size').textContent = `大小: ${sizeKB} KB`;

        // 行/列信息
        document.addEventListener('click', (e) => {
            if (e.target.closest('.code-content')) {
                // 这里可以实现更精确的行/列检测
            }
        });
    }

    showProgress(text) {
        const progressOverlay = document.getElementById('progress-overlay');
        const progressText = document.getElementById('progress-text');
        progressText.textContent = text;
        progressOverlay.style.display = 'flex';
    }

    hideProgress() {
        const progressOverlay = document.getElementById('progress-overlay');
        progressOverlay.style.display = 'none';
    }

    updateProgress(percent, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        progressFill.style.width = `${percent}%`;
        progressText.textContent = text;
    }

    clearData() {
        if (confirm('确定要清除所有数据吗？这将删除当前加载的文件、书签和最近打开记录。')) {
            this.files = {};
            this.directoryStructure = {};
            this.symbolIndex = [];
            this.currentFile = null;

            // 清空 UI
            document.getElementById('directory-tree').innerHTML = '';
            document.getElementById('bookmarks').innerHTML = '<div class="bookmark-item" style="color: var(--color-text-tertiary); cursor: default;">暂无书签</div>';
            document.getElementById('recent-files').innerHTML = '<div class="recent-item" style="color: var(--color-text-tertiary); cursor: default;">暂无最近打开的文件</div>';

            this.showEmptyState('数据已清除，请上传新的 ZIP 文件');

            // 清空搜索框
            document.getElementById('search-input').value = '';
            document.getElementById('search-results').classList.remove('show');
        }
    }

    showEmptyState(message) {
        const codeContainer = document.getElementById('code-container');
        codeContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-code"></i>
                <p>${message}</p>
            </div>
        `;
    }

    saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`无法保存到 localStorage (${key}):`, error);
        }
    }

    loadFromLocalStorage(key, defaultValue) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.warn(`无法从 localStorage 加载 (${key}):`, error);
            return defaultValue;
        }
    }
}

// 初始化应用
const codeNavigator = new CodeNavigator();

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + F: 聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('search-input').focus();
    }

    // Ctrl/Cmd + B: 切换书签
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.getElementById('toggle-bookmark').click();
    }

    // ESC: 关闭搜索结果
    if (e.key === 'Escape') {
        document.getElementById('search-results').classList.remove('show');
    }
});