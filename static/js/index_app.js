// ===================== DOM 引用 =====================
const navMenu = document.getElementById('navMenu');
const frame = document.getElementById('pageFrame');
const titleEl = document.getElementById('current-page-title');
const subtitleEl = document.getElementById('current-page-subtitle');
const mainContent = document.querySelector('.main-content');
const userInfo = document.getElementById('userInfo');
const userAvatar = document.getElementById('userAvatar');
const userDisplayName = document.getElementById('userDisplayName');
const userRole = document.getElementById('userRole');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const loggedInInfo = document.getElementById('loggedInInfo');
const loggedInUser = document.getElementById('loggedInUser');
const loggedInRole = document.getElementById('loggedInRole');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const switchAccountBtn = document.getElementById('switchAccountBtn');
const logoutBtn = document.getElementById('logoutBtn');
const modalTitle = document.getElementById('modalTitle');
// ===================== 全局状态 =====================
let currentMenus = [];
let isLoggedIn = false;
let currentUsername = '';
let menuMap = {};
// ===================== 用户信息更新 =====================
function updateUserUI(username, menus) {
    if (username && menus) {
        isLoggedIn = true;
        currentUsername = username;
        userAvatar.textContent = username.charAt(0).toUpperCase();
        userDisplayName.textContent = username;
        const role = menus.includes('welcome') ? '管理员' : '普通用户';
        userRole.textContent = role;
    } else {
        isLoggedIn = false;
        currentUsername = '';
        userAvatar.textContent = '游客';
        userDisplayName.textContent = '游客';
        userRole.textContent = '未登录';
    }
}
// ===================== 获取用户信息 =====================
async function fetchUser() {
    try {
        const res = await fetch('/auth/user');
        const data = await res.json();
        if (data.logged_in) {
            currentMenus = data.menus || [];
            updateUserUI(data.username, data.menus);
        } else {
            currentMenus = data.menus || [];
            updateUserUI(null, null);
        }
        return data;
    } catch (e) {
        console.error('获取用户信息失败', e);
        currentMenus = [];
        updateUserUI(null, null);
        return { logged_in: false, menus: [] };
    }
}
// ===================== 获取菜单数据（完整对象） =====================
async function fetchMenus() {
    try {
        const res = await fetch('/auth/menus');
        const data = await res.json();
        window._menuItems = data;
        menuMap = {};
        data.forEach(item => { menuMap[item.id] = item; });
        return data;
    } catch (e) {
        console.error('获取菜单失败', e);
        window._menuItems = [];
        return [];
    }
}
// ===================== 构建菜单导航（按权限过滤） =====================
function buildMenu(allMenuItems, allowedIds) {
    // 只保留用户有权限的菜单项
    const allowedItems = allMenuItems.filter(item => allowedIds.includes(item.id));
    navMenu.innerHTML = allowedItems.map(item => `<a href="#" class="nav-item" data-id="${item.id}"><span class="nav-icon"><i class="fas ${item.icon}"></i></span><span class="nav-text">${item.title}</span></a>`).join('');
    // 存储当前用户允许的 ID 列表（用于切换页面时的判断）
    window._allowedIds = allowedIds;
}
// ===================== 登录逻辑 =====================
async function login(username, password) {
    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentMenus = data.menus || [];
            updateUserUI(username, data.menus);
            loginModal.style.display = 'none';
            const menuItems = await fetchMenus();
            buildMenu(menuItems, data.menus || []);   // 传入登录返回的权限列表
            const allowed = window._allowedIds || [];
            let saved = localStorage.getItem('currentPage');
            if (!saved || !allowed.includes(saved)) { saved = allowed.length > 0 ? allowed[0] : '' }
            if (saved) switchPage(saved);
            loginError.textContent = '';
            return true;
        } else {
            loginError.textContent = data.message || '登录失败';
            return false;
        }
    } catch (e) {
        loginError.textContent = '网络错误';
        return false;
    }
}
// ===================== 登出逻辑 =====================
async function logout(autoReload = true) {
    try {
        await fetch('/auth/logout', { method: 'POST' });
    } catch (e) { }
    if (autoReload) {
        const userData = await fetchUser();          // 获取游客信息（含 guest 权限）
        const menuItems = await fetchMenus();
        buildMenu(menuItems, userData.menus || []);  // 传入游客权限
        const allowed = window._allowedIds || [];
        const saved = allowed.length > 0 ? allowed[0] : '';
        if (saved) switchPage(saved);
    } else {
        // 手动登出（不自动刷新）可以复用上面的逻辑或保留原样
        // 这里为了保持一致性，也执行相同的刷新
        const userData = await fetchUser();
        const menuItems = await fetchMenus();
        buildMenu(menuItems, userData.menus || []);
        const allowed = window._allowedIds || [];
        const saved = allowed.length > 0 ? allowed[0] : '';
        if (saved) switchPage(saved);
    }
}
// ===================== 模态框控制 =====================
function showLoginModal() {
    loginModal.style.display = 'flex';
    if (isLoggedIn) {
        loginForm.style.display = 'none';
        loggedInInfo.style.display = 'block';
        loggedInUser.textContent = currentUsername;
        const role = currentMenus.includes('welcome') ? '管理员' : '普通用户';
        loggedInRole.textContent = role;
        modalTitle.textContent = '用户信息';
    } else {
        loginForm.style.display = 'block';
        loggedInInfo.style.display = 'none';
        modalTitle.textContent = '会员登录';
        loginError.textContent = '';
        loginUsername.value = '';
        loginPassword.value = '';
    }
}
function hideLoginModal() { loginModal.style.display = 'none' }
userInfo.addEventListener('click', showLoginModal);
closeLoginModal.addEventListener('click', hideLoginModal);
loginModal.addEventListener('click', function (e) { if (e.target === loginModal) hideLoginModal() });
loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) { loginError.textContent = '请输入用户名和密码'; return }
    await login(username, password);
});
loginPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click() });
switchAccountBtn.addEventListener('click', () => { logout(false).then(() => { showLoginModal() }) });
logoutBtn.addEventListener('click', () => { logout(true).then(() => { hideLoginModal() }) });
// ===================== 切换页面 =====================
function switchPage(pageId) {
    // 优先从 menuMap 查找，若没有则从 window._menuItems 查找
    let item = menuMap[pageId];
    if (!item && window._menuItems) {
        item = window._menuItems.find(i => i.id === pageId);
        if (item) menuMap[pageId] = item; // 缓存
    }
    if (!item) {
        console.warn('页面未找到或无权访问:', pageId);
        // 显示无权限占位页面（如果存在 placeholder.html 则加载，否则显示空白）
        titleEl.textContent = '无权限';
        subtitleEl.textContent = '您没有访问该页面的权限';
        frame.src = 'pages/placeholder.html';  // 确保 pages/ 下有该文件
        return;
    }
    /*
    // 判断是否为外部链接（http:// 或 https:// 开头）
    const isExternal = item.page && (item.page.startsWith('http://') || item.page.startsWith('https://'));
    if (isExternal) {
        // 外部链接：在新窗口打开，并保持 iframe 显示提示页（或保持不变）
        window.open(item.page, '_blank');
        // 可选：在 iframe 中显示一个提示信息，表示已打开外部链接
        titleEl.textContent = item.title;
        subtitleEl.textContent = '已在新窗口打开外部链接';
        frame.src = 'pages/external-hint.html';  // 可创建一个简单的提示页
        // 或者保持当前页面不变（注释掉上面两行即可）
        // 为避免用户混淆，这里我们显示一个提示页
        return;
    }
    */
    document.querySelectorAll('.nav-item').forEach(el => { el.classList.toggle('active', el.dataset.id === pageId) });
    titleEl.textContent = item.title;
    subtitleEl.textContent = item.subtitle || '';
    frame.src = item.page;
    frame.onload = null;
    frame.onload = function () { applyWhiteBg(item.whiteBg) };
    localStorage.setItem('currentPage', pageId);
}
// ===================== 应用白色背景 =====================
function applyWhiteBg(whiteBg) {
    if (whiteBg) { mainContent.style.backgroundColor = '#ffffff' } else { mainContent.style.backgroundColor = '' }
    try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        if (!doc) return;
        if (whiteBg) {
            doc.body.style.backgroundColor = '#fdfcfc';
            doc.body.style.color = '#000102';
        } else {
            doc.body.style.backgroundColor = '';
            doc.body.style.color = '';
            const container = doc.getElementById('content-container');
            if (container) { container.style.backgroundColor = ''; container.style.color = '' }
        }
    } catch (e) { }
}
// ===================== 初始化 =====================
async function init() {
    const userData = await fetchUser();          // 获取用户信息及权限列表
    const menuItems = await fetchMenus();        // 获取完整菜单
    buildMenu(menuItems, userData.menus || []);  // 传入权限列表
    navMenu.addEventListener('click', function (e) {
        const link = e.target.closest('.nav-item');
        if (link) {
            e.preventDefault();
            const pageId = link.dataset.id;
            if (window._allowedIds && window._allowedIds.includes(pageId)) { switchPage(pageId) }
        }
    });
    const allowed = window._allowedIds || [];
    let saved = localStorage.getItem('currentPage');
    if (!saved || !allowed.includes(saved)) { saved = allowed.length > 0 ? allowed[0] : '' }
    if (saved) {
        switchPage(saved);
    } else {
        titleEl.textContent = '无权限';
        subtitleEl.textContent = '您没有任何页面权限，请联系管理员';
        frame.src = 'pages/placeholder.html';
    }
}
init();
window.switchPage = switchPage;