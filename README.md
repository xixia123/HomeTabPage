# HomeTabPage

一个自定义的浏览器新标签页导航扩展，支持分类管理、拖拽排序、深色模式。

## 项目结构

```
HomeTabPage/
├── extension/           # 浏览器扩展
│   ├── manifest.json    # 扩展配置 (Manifest V3)
│   ├── newtab.html      # 新标签页 HTML
│   ├── css/
│   │   └── styles.css   # 预编译 Tailwind CSS
│   ├── js/
│   │   ├── newtab.js    # 主要逻辑
│   │   └── theme-init.js # 主题初始化
│   └── icons/
│       └── icon.svg     # 扩展图标
└── worker/
    └── worker.js     # Cloudflare Worker 版本 (原始)
```

## 功能特性

- ✅ 自定义分类和链接管理
- ✅ 拖拽排序
- ✅ 深色/浅色模式（自动/手动切换）
- ✅ 本站搜索 + 外部搜索引擎
- ✅ 数据导入/导出（JSON 格式）
- ✅ APP 视图 / 卡片视图切换
- ✅ 响应式设计

## 安装方式

### 🚀 快速安装（推荐）

**Chrome / Edge:**
1. 前往 [Releases 页面](https://github.com/xixia123/HomeTabPage/releases) 下载最新版本
2. 解压下载的 ZIP 文件
3. 打开浏览器，访问 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）
4. 开启右上角的 **开发者模式**
5. 点击 **加载已解压的扩展程序**
6. 选择解压后的 `extension` 文件夹
7. 打开新标签页即可使用

**Firefox:**
- 直接访问 [Firefox 扩展商店](https://addons.mozilla.org/zh-CN/firefox/addon/card-tab-%E6%88%91%E7%9A%84%E5%AF%BC%E8%88%AA/) 安装

### 开发者安装

如果你想参与开发或修改代码：

1. 克隆本仓库：`git clone https://github.com/xixia123/HomeTabPage.git`
2. 打开浏览器，访问 `chrome://extensions/`（或 `edge://extensions/`）
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择 `extension` 文件夹
6. 打开新标签页即可使用

### Firefox

1. 访问 `about:debugging#/runtime/this-firefox`
2. 点击 **加载临时附加组件**
3. 选择 `extension/manifest.json` 文件

## 使用说明

1. **进入编辑模式**：点击右上角设置菜单 → 编辑模式
2. **添加分类**：编辑模式下，点击页面顶部的"新建分类"按钮
3. **添加链接**：编辑模式下，点击分类中的 + 按钮
4. **拖拽排序**：编辑模式下，拖拽卡片调整顺序
5. **导入配置**：设置菜单 → 导入配置，选择 JSON 文件

## 数据存储

所有数据存储在浏览器本地（`chrome.storage.local`），不会上传到任何服务器。

## 兼容性

- Chrome 88+
- Edge 88+
- Firefox 109+
- Brave（基于 Chromium）

## 许可证

MIT License
