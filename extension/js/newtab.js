// Card Tab - 浏览器扩展版本
// 本地存储版本，无需服务端

let isEditMode = false;
let isAppLayout = localStorage.getItem('appLayout') === 'true';
const categories = {};
let categoryOrder = []; // 明确的分类顺序数组
let currentEngine;
let initialDragState = { category: null, index: -1 };

// 多个公开的 favicon API（按优先级排序）
const faviconApis = [
    (hostname) => `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`,
    (hostname) => `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
    (hostname) => `https://${hostname}/favicon.ico`
];

// ===== Favicon 缓存 (IndexedDB) =====
const FAVICON_DB_NAME = 'favicon-cache';
const FAVICON_STORE_NAME = 'favicons';
const FAVICON_CACHE_EXPIRY_DAYS = 7;

let faviconDB = null;

async function openFaviconDB() {
    if (faviconDB) return faviconDB;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(FAVICON_DB_NAME, 1);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            faviconDB = request.result;
            resolve(faviconDB);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(FAVICON_STORE_NAME)) {
                db.createObjectStore(FAVICON_STORE_NAME, { keyPath: 'hostname' });
            }
        };
    });
}

async function getCachedFavicon(hostname) {
    try {
        const db = await openFaviconDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(FAVICON_STORE_NAME, 'readonly');
            const store = transaction.objectStore(FAVICON_STORE_NAME);
            const request = store.get(hostname);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    // 检查是否过期
                    const now = Date.now();
                    const expiryTime = FAVICON_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
                    if (now - result.timestamp < expiryTime) {
                        resolve(result.dataUrl);
                        return;
                    }
                }
                resolve(null);
            };

            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function setCachedFavicon(hostname, dataUrl) {
    try {
        const db = await openFaviconDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(FAVICON_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(FAVICON_STORE_NAME);
            store.put({
                hostname: hostname,
                dataUrl: dataUrl,
                timestamp: Date.now()
            });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

async function fetchAndCacheFavicon(url, apiIndex = 0) {
    const hostname = getHostname(url);

    // 尝试从缓存获取
    const cached = await getCachedFavicon(hostname);
    if (cached) {
        return cached;
    }

    // 从网络获取并缓存
    const faviconUrl = getFaviconUrl(url, apiIndex);

    try {
        const response = await fetch(faviconUrl);
        if (!response.ok) throw new Error('Fetch failed');

        const blob = await response.blob();
        const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        // 缓存成功获取的 favicon
        await setCachedFavicon(hostname, dataUrl);
        return dataUrl;
    } catch {
        // 如果还有备用 API，返回 null 让调用方尝试下一个
        return null;
    }
}

function getHostname(url) {
    try {
        return new URL(url.startsWith('http') ? url : 'http://' + url).hostname;
    } catch {
        return url;
    }
}

function getFaviconUrl(url, apiIndex = 0) {
    const hostname = getHostname(url);
    if (apiIndex < faviconApis.length) {
        return faviconApis[apiIndex](hostname);
    }
    return faviconApis[0](hostname);
}


// 搜索引擎配置
const searchEngines = {
    baidu: "https://www.baidu.com/s?wd=",
    bing: "https://www.bing.com/search?q=",
    google: "https://www.google.com/search?q=",
    site: ""
};

const searchEngineLabels = { baidu: "百度", bing: "必应", google: "谷歌", site: "本站" };

const searchEngineIcons = {
    site: '<svg width="16" height="16" fill="#FFD700" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>',
    baidu: '<svg width="16" height="16" viewBox="0 0 32 32"><path fill="#4285F4" d="M5.749 16.864c3.48-.744 3-4.911 2.901-5.817c-.172-1.401-1.823-3.853-4.057-3.656c-2.812.249-3.224 4.323-3.224 4.323c-.385 1.88.907 5.901 4.38 5.151zm6.459-6.984c1.923 0 3.475-2.213 3.475-4.948C15.683 2.213 14.136 0 12.214 0c-1.916 0-3.479 2.197-3.479 4.932s1.557 4.948 3.479 4.948z"/></svg>',
    bing: '<svg width="16" height="16" viewBox="0 0 32 32"><path fill="#008373" d="m4.807 0l6.391 2.25v22.495l9.005-5.193l-4.411-2.073l-2.786-6.932l14.188 4.984v7.245L11.204 32l-6.396-3.563z"/></svg>',
    google: '<svg width="16" height="16" viewBox="0 0 256 262"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>'
};

const engineList = ['site', 'baidu', 'bing', 'google'];

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    initializeUIComponents();
    renderSearchEngineMenu();
    await loadLinks();
});

function initializeUIComponents() {
    const elements = {
        themeSwitchCheckbox: document.getElementById('theme-switch-checkbox'),
        layoutSwitchCheckbox: document.getElementById('layout-switch-checkbox'),
        savePrefCheckbox: document.getElementById('save-preference-checkbox'),
        searchButton: document.getElementById('search-button'),
        searchInput: document.getElementById('search-input'),
        clearSearchButton: document.getElementById('clear-search-button'),
        menuToggleBtn: document.getElementById('profile-menu-toggle'),
        dropdown: document.getElementById('profile-dropdown'),
        dropdownWrapper: document.getElementById('profile-dropdown-wrapper'),
        backToTopBtn: document.getElementById('back-to-top-btn')
    };

    elements.themeSwitchCheckbox.checked = document.documentElement.classList.contains('dark');
    elements.themeSwitchCheckbox.addEventListener('change', (e) => {
        const isDark = e.target.checked;
        window.isDarkTheme = isDark;
        applyTheme(isDark);
        if (elements.savePrefCheckbox.checked) {
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }
    });

    if (elements.layoutSwitchCheckbox) {
        elements.layoutSwitchCheckbox.checked = isAppLayout;
    }

    const savedPref = localStorage.getItem('savePreferences') === 'true';
    elements.savePrefCheckbox.checked = savedPref;
    currentEngine = (savedPref && localStorage.getItem('searchEngine')) || 'site';
    updateSearchEngineUI(currentEngine);

    // 搜索引擎下拉
    const searchWrapper = document.getElementById('search-engine-wrapper');
    const searchBtn = document.getElementById('search-engine-btn');
    const searchMenu = document.getElementById('search-engine-menu');

    searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        searchMenu.classList.toggle('hidden');
    });

    // 分类选择下拉
    const catWrapper = document.getElementById('category-select-wrapper');
    const catBtn = document.getElementById('category-select-btn');
    const catMenu = document.getElementById('category-select-menu');

    catBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        catMenu.classList.toggle('hidden');
    });

    // 设置下拉菜单
    elements.menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.dropdown.classList.toggle('hidden');
    });

    // 点击外部关闭下拉
    document.addEventListener('click', (e) => {
        if (!elements.dropdownWrapper.contains(e.target)) {
            elements.dropdown.classList.add('hidden');
        }
        if (!searchWrapper.contains(e.target)) {
            searchMenu.classList.add('hidden');
        }
        if (!catWrapper.contains(e.target)) {
            catMenu.classList.add('hidden');
        }
    });

    elements.dropdown.addEventListener('click', (e) => e.stopPropagation());

    elements.savePrefCheckbox.addEventListener('change', () => {
        const enabled = elements.savePrefCheckbox.checked;
        localStorage.setItem('savePreferences', enabled);
        if (!enabled) {
            localStorage.removeItem('searchEngine');
            localStorage.removeItem('theme');
        } else {
            localStorage.setItem('searchEngine', currentEngine);
            localStorage.setItem('theme', window.isDarkTheme ? 'dark' : 'light');
        }
    });

    elements.searchButton.addEventListener('click', async () => {
        const query = elements.searchInput.value.trim();
        if (query) {
            if (currentEngine === 'site') {
                await searchLinks(query);
            } else {
                window.open(searchEngines[currentEngine] + encodeURIComponent(query), '_blank');
            }
        }
    });

    if (elements.clearSearchButton) {
        elements.clearSearchButton.addEventListener('click', () => {
            elements.searchInput.value = '';
            loadSections();
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') elements.searchButton.click();
        });
        elements.searchInput.addEventListener('input', (e) => {
            if (e.target.value) elements.clearSearchButton.classList.remove('hidden');
            else elements.clearSearchButton.classList.add('hidden');
        });
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            elements.backToTopBtn.classList.remove('hidden');
        } else {
            elements.backToTopBtn.classList.add('hidden');
        }
    });

    // 绑定按钮事件 (替代 HTML 内联 onclick)
    const editModeBtn = document.getElementById('edit-mode-btn');
    if (editModeBtn) editModeBtn.addEventListener('click', toggleEditMode);

    const exportDataBtn = document.getElementById('export-data-btn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);

    const importDataBtn = document.getElementById('import-data-btn');
    if (importDataBtn) importDataBtn.addEventListener('click', importData);

    const layoutSwitchCheckbox = document.getElementById('layout-switch-checkbox');
    if (layoutSwitchCheckbox) layoutSwitchCheckbox.addEventListener('change', toggleAppLayout);

    const addCategoryBtn = document.getElementById('add-category-btn');
    if (addCategoryBtn) addCategoryBtn.addEventListener('click', addCategory);

    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) backToTopBtn.addEventListener('click', scrollToTop);

    setupScrollSpy();
    setupTooltipDelegation();
}

// ===== 数据存储 =====
async function loadLinks() {
    try {
        const result = await chrome.storage.local.get(['categories', 'categoryOrder']);
        if (result.categories) {
            Object.keys(categories).forEach(key => delete categories[key]);
            Object.assign(categories, result.categories);
            // 加载分类顺序，如果不存在则使用当前键顺序
            categoryOrder = result.categoryOrder || Object.keys(categories);
        }
        loadSections();
        updateCategorySelect();
        updateUIState();
    } catch (error) {
        console.error('加载数据失败:', error);
    } finally {
        // 隐藏加载遮罩
        const loadingMask = document.getElementById('loading-mask');
        if (loadingMask) {
            loadingMask.classList.add('hidden');
        }
    }
}

async function saveLinks() {
    try {
        await chrome.storage.local.set({
            categories: categories,
            categoryOrder: categoryOrder
        });
        console.log('数据已保存');
    } catch (error) {
        console.error('保存失败:', error);
        await customAlert('保存失败，请重试');
    }
}

// ===== 搜索引擎 =====
function renderSearchEngineMenu() {
    const container = document.getElementById('search-engine-list');
    const title = container.querySelector('div');
    container.innerHTML = '';
    container.appendChild(title);

    engineList.forEach(key => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-600 transition-colors flex items-center gap-3";
        btn.onclick = () => selectSearchEngine(key, searchEngineLabels[key]);
        btn.innerHTML = `${searchEngineIcons[key]}<span>${searchEngineLabels[key]}</span>`;
        container.appendChild(btn);
    });
}

function selectSearchEngine(value, label) {
    currentEngine = value;
    updateSearchEngineUI(value);
    if (document.getElementById('save-preference-checkbox').checked) {
        localStorage.setItem('searchEngine', value);
    }
    document.getElementById('search-engine-menu').classList.add('hidden');
}

function updateSearchEngineUI(value) {
    document.getElementById('current-engine-label').textContent = searchEngineLabels[value] || "本站";
    document.getElementById('current-engine-icon').innerHTML = searchEngineIcons[value] || searchEngineIcons['site'];
}

// ===== 布局切换 =====
function toggleAppLayout() {
    isAppLayout = !isAppLayout;
    localStorage.setItem('appLayout', isAppLayout);
    const checkbox = document.getElementById('layout-switch-checkbox');
    if (checkbox) checkbox.checked = isAppLayout;
    loadSections();
}

// ===== 主题 =====
function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 编辑模式 =====
function toggleEditMode() {
    document.getElementById('profile-dropdown').classList.add('hidden');
    isEditMode = !isEditMode;
    updateUIState();
    renderCategories();
}

function updateUIState() {
    const editModeBtn = document.getElementById('edit-mode-btn');
    const addCategoryContainer = document.getElementById('add-category-container');

    if (isEditMode) {
        editModeBtn.innerHTML = '<span class="text-red-500 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>退出编辑</span>';
        document.body.classList.add('edit-mode');
        if (addCategoryContainer) addCategoryContainer.classList.remove('hidden');
    } else {
        editModeBtn.innerHTML = '<span class="flex items-center gap-3"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>进入编辑</span>';
        document.body.classList.remove('edit-mode');
        if (addCategoryContainer) addCategoryContainer.classList.add('hidden');
    }
}

// ===== 分类管理 =====
async function addCategory() {
    const categoryName = await showCategoryDialog('请输入新分类名称');
    if (!categoryName) return;
    if (categories[categoryName]) {
        await customAlert('该分类已存在');
        return;
    }
    categories[categoryName] = { isHidden: false, links: [] };
    categoryOrder.push(categoryName); // 添加到顺序数组
    updateCategorySelect();
    renderCategories();
    await saveLinks();
}

async function editCategoryName(oldName) {
    const newName = await showCategoryDialog('请输入新的分类名称', oldName);
    if (!newName || newName === oldName) return;
    if (categories[newName]) {
        await customAlert('该名称已存在');
        return;
    }
    const keys = Object.keys(categories);
    const newCategories = {};
    keys.forEach(key => {
        if (key === oldName) {
            const data = categories[oldName];
            data.links.forEach(item => item.category = newName);
            newCategories[newName] = data;
        } else {
            newCategories[key] = categories[key];
        }
    });
    Object.keys(categories).forEach(k => delete categories[k]);
    Object.assign(categories, newCategories);
    renderCategories();
    renderCategoryButtons();
    updateCategorySelect();
    await saveLinks();
}

async function deleteCategory(category) {
    if (await customConfirm(`确定删除 "${category}" 分类及其所有链接吗？`)) {
        delete categories[category];
        // 从顺序数组中移除
        const index = categoryOrder.indexOf(category);
        if (index > -1) {
            categoryOrder.splice(index, 1);
        }
        updateCategorySelect();
        renderCategories();
        renderCategoryButtons();
        await saveLinks();
    }
}

async function moveCategory(categoryName, direction) {
    console.log('moveCategory called:', categoryName, 'direction:', direction);
    console.log('Current order:', categoryOrder);
    const index = categoryOrder.indexOf(categoryName);
    if (index < 0) {
        console.log('Category not found');
        return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= categoryOrder.length) {
        console.log('Invalid move: newIndex out of bounds');
        return;
    }
    // 直接在 categoryOrder 数组中交换位置
    [categoryOrder[index], categoryOrder[newIndex]] = [categoryOrder[newIndex], categoryOrder[index]];
    console.log('New order:', categoryOrder);

    renderCategories();
    renderCategoryButtons();
    await saveLinks();
}

async function toggleCategoryHidden(category, isHidden) {
    categories[category].isHidden = isHidden;
    await saveLinks();
}

async function pinCategory(categoryName) {
    console.log('pinCategory called:', categoryName);
    console.log('Current order:', categoryOrder);
    const index = categoryOrder.indexOf(categoryName);
    if (index < 0) {
        console.log('Category not found');
        return;
    }
    // 从当前位置移除，添加到开头
    categoryOrder.splice(index, 1);
    categoryOrder.unshift(categoryName);
    console.log('New order after pin:', categoryOrder);

    renderCategories();
    renderCategoryButtons();
    await saveLinks();
}

// ===== 渲染 =====
function loadSections() {
    document.getElementById('clear-search-button').classList.add('hidden');
    document.getElementById('search-input').value = '';
    renderCategorySections({ renderButtons: true });
}

function renderCategories() {
    renderCategorySections({ renderButtons: false });
}

function getFilteredCategoriesByKeyword(query) {
    const lowerQuery = query.toLowerCase();
    const result = {};
    Object.keys(categories).forEach(category => {
        const categoryData = categories[category];
        const matchedLinks = (categoryData.links || []).filter(link => {
            const nameMatch = link.name && link.name.toLowerCase().includes(lowerQuery);
            const tipsMatch = link.tips && link.tips.toLowerCase().includes(lowerQuery);
            const urlMatch = link.url && link.url.toLowerCase().includes(lowerQuery);
            return nameMatch || tipsMatch || urlMatch;
        });
        if (matchedLinks.length > 0) {
            result[category] = { ...categoryData, links: matchedLinks };
        }
    });
    return result;
}

async function searchLinks(query) {
    const clearBtn = document.getElementById('clear-search-button');
    const filteredData = getFilteredCategoriesByKeyword(query);
    const hasMatchingLinks = Object.values(filteredData).some(c => c.links.length > 0);
    if (!hasMatchingLinks) {
        await customAlert('没有找到相关站点。');
        return;
    }
    clearBtn.classList.remove('hidden');
    renderCategorySections({ renderButtons: true, searchMode: true, filteredCategories: filteredData });
}

function renderCategorySections({ renderButtons = false, searchMode = false, filteredCategories = null } = {}) {
    const container = document.getElementById('sections-container');
    container.innerHTML = '';
    const sourceCategories = searchMode && filteredCategories ? filteredCategories : categories;

    // 使用 categoryOrder 来确定渲染顺序
    const orderedKeys = searchMode ? Object.keys(sourceCategories) : categoryOrder.filter(key => sourceCategories[key]);

    orderedKeys.forEach(category => {
        const { links, isHidden } = sourceCategories[category];
        if (!isEditMode && isHidden && !searchMode) return;

        const section = document.createElement('div');
        section.className = 'section section-anchor';
        section.id = category;

        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center gap-3 mb-5 pb-2 border-b border-slate-200/60 dark:border-slate-700/60';

        const title = document.createElement('h2');
        title.className = 'text-lg font-bold text-slate-700 dark:text-slate-100 flex items-center gap-2';
        title.innerHTML = `<span class="w-1.5 h-5 bg-emerald-500 rounded-full inline-block shadow-sm"></span> ${category}`;
        titleContainer.appendChild(title);

        if (isEditMode) {
            const controls = document.createElement('div');
            controls.className = 'flex items-center gap-1 ml-auto bg-slate-300/50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm';
            const btnBase = "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95";

            // 重命名按钮
            const renameBtn = document.createElement('button');
            renameBtn.className = `${btnBase} text-slate-500 hover:text-blue-600 hover:bg-blue-100 dark:text-slate-400 dark:hover:bg-blue-900/30`;
            renameBtn.title = "重命名";
            renameBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>';
            renameBtn.addEventListener('click', () => editCategoryName(category));
            controls.appendChild(renameBtn);

            // 上移按钮
            const moveUpBtn = document.createElement('button');
            moveUpBtn.className = `${btnBase} text-slate-500 hover:text-emerald-600 hover:bg-emerald-100 dark:text-slate-400`;
            moveUpBtn.title = "上移";
            moveUpBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>';
            moveUpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                moveCategory(category, -1);
            });
            controls.appendChild(moveUpBtn);

            // 下移按钮
            const moveDownBtn = document.createElement('button');
            moveDownBtn.className = `${btnBase} text-slate-500 hover:text-emerald-600 hover:bg-emerald-100 dark:text-slate-400`;
            moveDownBtn.title = "下移";
            moveDownBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
            moveDownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                moveCategory(category, 1);
            });
            controls.appendChild(moveDownBtn);

            // 置顶按钮
            const pinBtn = document.createElement('button');
            pinBtn.className = `${btnBase} text-slate-500 hover:text-amber-600 hover:bg-amber-100 dark:text-slate-400`;
            pinBtn.title = "置顶";
            pinBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3h14M18 13l-6-6l-6 6M12 7v14"></path></svg>';
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                pinCategory(category);
            });
            controls.appendChild(pinBtn);

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = `${btnBase} text-slate-400 hover:text-red-600 hover:bg-red-100 dark:text-slate-500`;
            deleteBtn.title = "删除";
            deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
            deleteBtn.addEventListener('click', () => deleteCategory(category));
            controls.appendChild(deleteBtn);

            titleContainer.appendChild(controls);
        }

        const cardContainer = document.createElement('div');
        const gridClasses = isAppLayout
            ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-6'
            : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4';

        cardContainer.className = `grid ${gridClasses} card-container relative`;
        cardContainer.id = category;

        section.appendChild(titleContainer);
        section.appendChild(cardContainer);
        container.appendChild(section);

        links.forEach(link => createCard(link, cardContainer));

        if (isEditMode) {
            const addCardPlaceholder = document.createElement('div');
            const sizeClasses = isAppLayout
                ? 'w-16 h-16 rounded-[1.2rem] mx-auto'
                : 'min-h-[100px] p-4 rounded-2xl w-full';

            addCardPlaceholder.className = `add-card-placeholder group flex flex-col h-full w-full ${sizeClasses} rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all cursor-pointer flex items-center justify-center`;
            addCardPlaceholder.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 flex items-center justify-center transition-colors pointer-events-none">
                    <svg class="w-6 h-6 text-slate-400 group-hover:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </div>
            `;

            addCardPlaceholder.onclick = () => {
                showAddDialog();
                document.getElementById('category-select-value').value = category;
                document.getElementById('category-select-text').textContent = category;
            };
            cardContainer.appendChild(addCardPlaceholder);
        }
    });

    if (renderButtons) renderCategoryButtons();
    setupScrollSpy();
}

function renderCategoryButtons() {
    const container = document.getElementById('category-buttons-container');
    container.innerHTML = '';
    const visibleCategories = Object.keys(categories).filter(c =>
        (categories[c].links || []).length > 0 &&
        (!categories[c].isHidden || isEditMode)
    );

    if (visibleCategories.length === 0) return;

    visibleCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-button whitespace-nowrap px-4 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-600 transition-all active:scale-95 shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-700';
        btn.textContent = cat;
        btn.dataset.target = cat;
        btn.onclick = () => scrollToCategory(cat);
        container.appendChild(btn);
    });
}

function scrollToCategory(catId) {
    const section = document.getElementById(catId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function setupScrollSpy() {
    const sections = document.querySelectorAll('.section');
    const buttons = document.querySelectorAll('.category-button');
    if (!sections.length || !buttons.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                highlightButton(entry.target.id);
            }
        });
    }, { rootMargin: '-100px 0px -70% 0px', threshold: 0 });

    sections.forEach(section => observer.observe(section));
}

function highlightButton(id) {
    const buttons = document.querySelectorAll('.category-button');
    buttons.forEach(btn => {
        if (btn.dataset.target === id) {
            btn.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
            btn.classList.add('bg-emerald-500', 'text-white', 'shadow-md', 'dark:bg-emerald-600');
        } else {
            btn.classList.remove('bg-emerald-500', 'text-white', 'shadow-md', 'dark:bg-emerald-600');
            btn.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        }
    });
}

function updateCategorySelect() {
    const menu = document.getElementById('category-select-menu');
    menu.innerHTML = '';
    Object.keys(categories).forEach(cat => {
        const item = document.createElement('div');
        item.className = 'px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer transition-colors';
        item.textContent = cat;
        item.onclick = () => {
            document.getElementById('category-select-value').value = cat;
            document.getElementById('category-select-text').textContent = cat;
            menu.classList.add('hidden');
        };
        menu.appendChild(item);
    });
}

// 异步加载 favicon，优先从缓存获取
async function loadFaviconWithCache(imgElement, url) {
    // 尝试通过 fetch 获取并缓存（按优先级尝试所有 API）
    for (let i = 0; i < faviconApis.length; i++) {
        const dataUrl = await fetchAndCacheFavicon(url, i);
        if (dataUrl) {
            imgElement.src = dataUrl;
            return;
        }
    }

    // 如果 fetch 全部失败（例如 CORS 限制），退回到直接加载（无法缓存，但能显示）
    const loadDirectly = (index) => {
        if (index >= faviconApis.length) {
            // 所有 API 都失败，使用默认图标
            imgElement.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='12'/%3E%3Cline x1='12' y1='16' x2='12.01' y2='16'/%3E%3C/svg%3E";
            return;
        }

        imgElement.src = getFaviconUrl(url, index);
        imgElement.onerror = () => loadDirectly(index + 1);
        // 直接加载时不使用 onload 缓存，因为跨域图片画入 canvas 会报错
        imgElement.onload = null;
    };

    loadDirectly(0);
}

// ===== 卡片创建 =====
function createCard(link, container) {
    const card = document.createElement('div');

    let cardBaseClass = isAppLayout
        ? 'flex flex-col items-center justify-start py-1 gap-1.5 hover:z-10'
        : 'flex flex-col p-4 bg-white/90 dark:bg-[#1e293b]/60 backdrop-blur-md border border-gray-200 dark:border-slate-700/50 hover:border-emerald-500/50 shadow-sm hover:shadow-lg hover:-translate-y-1.5';

    card.className = `group relative h-full w-full rounded-2xl transition-all duration-300 cursor-pointer select-none ${cardBaseClass}`;

    if (isEditMode) {
        card.setAttribute('draggable', 'true');
        card.classList.add('card', 'cursor-move');
    }

    card.setAttribute('data-url', link.url);

    const header = document.createElement('div');
    header.className = isAppLayout
        ? 'flex flex-col items-center justify-center w-full relative'
        : 'flex items-center gap-3 mb-2.5 w-full';

    const icon = document.createElement('img');
    icon.setAttribute('loading', 'lazy');

    let iconClass = isAppLayout
        ? 'w-14 h-14 sm:w-16 sm:h-16 rounded-[1.2rem] object-contain bg-white dark:bg-slate-600 p-2 shadow-md hover:shadow-lg transition-transform duration-300 group-hover:scale-105 z-10'
        : 'w-9 h-9 rounded-lg object-contain bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 transition-transform group-hover:scale-105 pointer-events-none';

    icon.className = iconClass;

    // 设置初始 API 索引
    icon.dataset.apiIndex = '0';
    icon.dataset.linkUrl = link.url;

    // 如果用户设置了自定义图标，优先使用
    if (link.icon?.startsWith('http')) {
        icon.src = link.icon;
    } else {
        // 异步加载 favicon，优先从缓存获取
        loadFaviconWithCache(icon, link.url);
    }

    const title = document.createElement('div');
    const titleAlign = isAppLayout
        ? 'text-center text-xs sm:text-sm font-medium mt-1 w-full truncate px-1 text-slate-700 dark:text-slate-200'
        : 'font-semibold text-sm flex-1 truncate text-slate-700 dark:text-slate-100 group-hover:text-emerald-600 transition-colors pointer-events-none';

    title.className = `card-title pointer-events-none ${titleAlign}`;
    title.textContent = link.name;

    header.appendChild(icon);
    header.appendChild(title);
    card.appendChild(header);

    if (!isAppLayout) {
        const desc = document.createElement('div');
        desc.className = 'text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[1.25rem] leading-relaxed pointer-events-none w-full';
        desc.textContent = link.tips || '';
        card.appendChild(desc);
    }

    if (isEditMode) {
        const actionWrapper = document.createElement('div');
        actionWrapper.className = isAppLayout ? 'absolute top-[-4px] right-[-4px] z-30' : 'absolute top-2 right-2 z-30';

        const menuBtn = document.createElement('button');
        const btnStyle = isAppLayout
            ? 'w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-emerald-500 hover:text-white'
            : 'w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/80';

        menuBtn.className = `${btnStyle} flex items-center justify-center transition-all duration-200`;
        menuBtn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';

        const dropdown = document.createElement('div');
        dropdown.className = 'absolute right-0 top-6 w-28 bg-white dark:bg-[#1e293b] rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden z-50 p-1 card-menu-dropdown';
        dropdown.style.display = 'none';  // 默认隐藏

        dropdown.innerHTML = `
            <button class="menu-edit w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700/50 hover:text-emerald-600 transition-colors flex items-center gap-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                编辑
            </button>
            <button class="menu-delete w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors flex items-center gap-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                删除
            </button>
        `;

        menuBtn.onclick = (e) => {
            e.stopPropagation();
            // 关闭其他所有菜单
            document.querySelectorAll('.card-menu-dropdown').forEach(el => {
                if (el !== dropdown) el.style.display = 'none';
            });
            // 切换当前菜单
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };

        dropdown.querySelector('.menu-edit').onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = 'none';
            showEditDialog(link);
        };

        dropdown.querySelector('.menu-delete').onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = 'none';
            removeCard(card);
        };

        actionWrapper.appendChild(menuBtn);
        actionWrapper.appendChild(dropdown);
        card.appendChild(actionWrapper);
    }

    if (!isEditMode) {
        card.onclick = () => {
            let url = link.url.startsWith('http') ? link.url : 'http://' + link.url;
            window.open(url, '_blank');
        };
    }

    card.addEventListener('dragstart', dragStart);
    card.addEventListener('dragover', dragOver);
    card.addEventListener('dragend', dragEnd);
    card.addEventListener('drop', drop);

    if (!isEditMode && link.tips) {
        card.classList.add('has-tooltip');
        card.setAttribute('data-tooltip', link.tips);
    }

    container.appendChild(card);
}

// ===== 拖拽 =====
let draggedCard = null;

function getCardState(card) {
    if (!card) return { category: null, index: -1 };
    const section = card.closest('.section');
    const index = Array.from(section.querySelectorAll('.card')).indexOf(card);
    return { category: section.id, index: index };
}

function dragStart(e) {
    if (!isEditMode) { e.preventDefault(); return; }
    draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = "move";
    initialDragState = getCardState(this);
}

function dragOver(e) {
    if (!isEditMode) return;
    e.preventDefault();
    const target = e.target.closest('.card');
    if (target && target !== draggedCard) {
        const container = target.parentElement;
        const rect = target.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            container.insertBefore(draggedCard, target);
        } else {
            container.insertBefore(draggedCard, target.nextSibling);
        }
    }
}

function dragEnd() {
    this.classList.remove('dragging');
}

async function drop(e) {
    if (!isEditMode) return;
    e.preventDefault();
    if (draggedCard) {
        const newState = getCardState(draggedCard);
        if (newState.category !== initialDragState.category || newState.index !== initialDragState.index) {
            updateCardCategory(draggedCard, newState.category);
            await saveCardOrder();
        }
        draggedCard = null;
    }
}

function updateCardCategory(card, newCategory) {
    const url = card.getAttribute('data-url');
    let item = null;
    for (const cat in categories) {
        const idx = categories[cat].links.findIndex(l => l.url === url);
        if (idx !== -1) {
            item = categories[cat].links.splice(idx, 1)[0];
            break;
        }
    }
    if (item) {
        item.category = newCategory;
        categories[newCategory].links.push(item);
    }
}

async function saveCardOrder() {
    const newCategories = {};
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => {
        const catName = sec.id;
        const oldCat = categories[catName];
        newCategories[catName] = { isHidden: oldCat ? oldCat.isHidden : false, links: [] };

        const cards = sec.querySelectorAll('.card');
        cards.forEach(c => {
            const url = c.getAttribute('data-url');
            const original = Object.values(categories).flatMap(x => x.links).find(l => l.url === url);
            if (original) {
                original.category = catName;
                newCategories[catName].links.push(original);
            }
        });
    });

    Object.keys(categories).forEach(k => delete categories[k]);
    Object.assign(categories, newCategories);
    await saveLinks();
}

// ===== 卡片 CRUD =====
async function addCard() {
    const name = document.getElementById('name-input').value.trim();
    const url = document.getElementById('url-input').value.trim();
    const category = document.getElementById('category-select-value').value;

    if (!name || !url || !category) {
        await customAlert('请填写必要信息 (名称, URL, 分类)');
        return;
    }

    const newLink = {
        name, url, category,
        tips: document.getElementById('tips-input').value.trim(),
        icon: document.getElementById('icon-input').value.trim(),
        isPrivate: document.getElementById('private-checkbox').checked
    };

    categories[category].links.push(newLink);
    await saveLinks();
    renderCategories();
    hideAddDialog();
}

async function updateCard(oldLink) {
    const updatedLink = {
        name: document.getElementById('name-input').value.trim(),
        url: document.getElementById('url-input').value.trim(),
        tips: document.getElementById('tips-input').value.trim(),
        icon: document.getElementById('icon-input').value.trim(),
        category: document.getElementById('category-select-value').value,
        isPrivate: document.getElementById('private-checkbox').checked
    };

    for (const cat in categories) {
        const idx = categories[cat].links.findIndex(l => l.url === oldLink.url);
        if (idx !== -1) {
            if (cat === updatedLink.category) {
                categories[cat].links[idx] = updatedLink;
            } else {
                categories[cat].links.splice(idx, 1);
                if (!categories[updatedLink.category]) {
                    categories[updatedLink.category] = { isHidden: false, links: [] };
                }
                categories[updatedLink.category].links.push(updatedLink);
            }
            break;
        }
    }

    await saveLinks();
    renderCategories();
    hideAddDialog();
}

async function removeCard(card) {
    const url = card.getAttribute('data-url');
    for (const cat in categories) {
        const idx = categories[cat].links.findIndex(l => l.url === url);
        if (idx !== -1) {
            categories[cat].links.splice(idx, 1);
            break;
        }
    }
    card.remove();
    await saveLinks();
}

// ===== 对话框 =====
function toggleOverlay(id, show) {
    const overlay = document.getElementById(id);
    const box = overlay.querySelector('div[id$="-box"]');

    if (show) {
        overlay.classList.remove('hidden');
        void overlay.offsetWidth;
        overlay.classList.remove('overlay-hidden');
        overlay.classList.add('overlay-visible');
        if (box) {
            box.classList.remove('dialog-scale-hidden');
            box.classList.add('dialog-scale-visible');
        }
    } else {
        overlay.classList.remove('overlay-visible');
        overlay.classList.add('overlay-hidden');
        if (box) {
            box.classList.remove('dialog-scale-visible');
            box.classList.add('dialog-scale-hidden');
        }
        setTimeout(() => {
            if (overlay.classList.contains('overlay-hidden')) {
                overlay.classList.add('hidden');
            }
        }, 300);
    }
}

function showAddDialog() {
    toggleOverlay('dialog-overlay', true);
    document.getElementById('name-input').value = '';
    document.getElementById('url-input').value = '';
    document.getElementById('tips-input').value = '';
    document.getElementById('icon-input').value = '';
    document.getElementById('private-checkbox').checked = false;
    document.getElementById('category-select-value').value = '';
    document.getElementById('category-select-text').textContent = '请选择分类';

    const btn = document.getElementById('dialog-confirm-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = addCard;

    document.getElementById('dialog-cancel-btn').onclick = hideAddDialog;
}

function showEditDialog(link) {
    toggleOverlay('dialog-overlay', true);
    document.getElementById('name-input').value = link.name;
    document.getElementById('url-input').value = link.url;
    document.getElementById('tips-input').value = link.tips || '';
    document.getElementById('icon-input').value = link.icon || '';
    document.getElementById('private-checkbox').checked = link.isPrivate;
    document.getElementById('category-select-value').value = link.category;
    document.getElementById('category-select-text').textContent = link.category;

    const btn = document.getElementById('dialog-confirm-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => updateCard(link);

    document.getElementById('dialog-cancel-btn').onclick = hideAddDialog;
}

function hideAddDialog() {
    toggleOverlay('dialog-overlay', false);
}

function showCategoryDialog(title, defaultVal = '') {
    return new Promise(resolve => {
        toggleOverlay('category-dialog', true);
        document.getElementById('category-dialog-title').innerText = title;
        const input = document.getElementById('category-name-input');
        input.value = defaultVal;
        input.focus();

        const close = (val) => {
            toggleOverlay('category-dialog', false);
            resolve(val);
        };

        document.getElementById('category-confirm-btn').onclick = () => close(input.value.trim());
        document.getElementById('category-cancel-btn').onclick = () => close(null);
    });
}

function customConfirm(msg) {
    return new Promise(resolve => {
        toggleOverlay('custom-confirm-overlay', true);
        document.getElementById('custom-confirm-message').innerText = msg;

        const close = (val) => {
            toggleOverlay('custom-confirm-overlay', false);
            resolve(val);
        };
        document.getElementById('custom-confirm-ok').onclick = () => close(true);
        document.getElementById('custom-confirm-cancel').onclick = () => close(false);
    });
}

function customAlert(msg) {
    return new Promise(resolve => {
        toggleOverlay('custom-alert-overlay', true);
        document.getElementById('custom-alert-content').innerText = msg;
        document.getElementById('custom-alert-confirm').onclick = () => {
            toggleOverlay('custom-alert-overlay', false);
            resolve();
        };
    });
}

// ===== Tooltip =====
function setupTooltipDelegation() {
    const tooltip = document.getElementById('custom-tooltip');
    let activeTarget = null;

    document.body.addEventListener('mousemove', (e) => {
        const target = e.target.closest('.has-tooltip');
        if (target) {
            const text = target.getAttribute('data-tooltip');
            if (text) {
                activeTarget = target;
                showTooltip(e, text);
            } else {
                hideTooltip();
            }
        } else {
            if (activeTarget) {
                hideTooltip();
                activeTarget = null;
            }
        }
    });

    window.addEventListener('scroll', hideTooltip, { passive: true });
}

function showTooltip(e, text) {
    const tooltip = document.getElementById('custom-tooltip');
    tooltip.textContent = text;
    tooltip.classList.remove('hidden');

    const offset = 12;
    let left = e.clientX + offset;
    let top = e.clientY + offset;

    const tooltipRect = tooltip.getBoundingClientRect();

    if (left + tooltipRect.width > window.innerWidth) {
        left = e.clientX - tooltipRect.width - offset;
    }
    if (top + tooltipRect.height > window.innerHeight) {
        top = e.clientY - tooltipRect.height - offset;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip && !tooltip.classList.contains('hidden')) {
        tooltip.classList.add('hidden');
    }
}

// ===== 导入导出 =====
async function exportData() {
    const data = { categories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nav_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function importData() {
    if (!await customConfirm("导入将覆盖现有数据！确定要继续吗？")) return;

    const fileInput = document.getElementById('import-file-input');
    fileInput.value = '';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.categories) {
                Object.keys(categories).forEach(k => delete categories[k]);
                Object.assign(categories, data.categories);
                await saveLinks();
                loadSections();
                updateCategorySelect();
                await customAlert('导入成功！');
            } else {
                await customAlert('文件格式错误，请检查文件内容！');
            }
        } catch (error) {
            console.error("导入失败:", error);
            await customAlert('导入失败，请检查文件格式！');
        }
    };
    fileInput.click();
}

// 关闭菜单的全局事件
document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu-dropdown') && !e.target.closest('button')) {
        document.querySelectorAll('.card-menu-dropdown').forEach(el => el.style.display = 'none');
    }
});

// ===== 暴露函数到全局作用域（用于 HTML 内联 onclick 调用）=====
window.editCategoryName = editCategoryName;
window.moveCategory = moveCategory;
window.pinCategory = pinCategory;
window.deleteCategory = deleteCategory;
window.toggleCategoryHidden = toggleCategoryHidden;
