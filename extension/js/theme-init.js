// 主题初始化脚本 - 必须在页面加载前执行以避免闪烁
(function () {
    let isDark;
    const savePreferences = localStorage.getItem('savePreferences');
    if (savePreferences === 'true') {
        const savedTheme = localStorage.getItem('theme');
        isDark = savedTheme === 'dark';
    } else {
        const hour = new Date().getHours();
        isDark = (hour >= 21 || hour < 6);
    }
    window.isDarkTheme = isDark;
    if (isDark) document.documentElement.classList.add('dark');
})();
