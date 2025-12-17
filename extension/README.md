# Card Tab 浏览器扩展

一个自定义新标签页导航扩展，支持分类管理、拖拽排序、深色模式。

## 安装方式

### Chrome / Edge

1. 打开浏览器，访问 `chrome://extensions/`（或 `edge://extensions/`）
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `extension` 文件夹
5. 打开新标签页即可看到自定义导航页

### Firefox

1. 打开浏览器，访问 `about:debugging#/runtime/this-firefox`
2. 点击 **加载临时附加组件**
3. 选择 `extension/manifest.json` 文件
4. 打开新标签页即可看到自定义导航页

## 功能特性

- ✅ 自定义分类和链接管理
- ✅ 拖拽排序
- ✅ 深色模式（自动/手动切换）
- ✅ 本站搜索 + 外部搜索引擎
- ✅ 数据导入/导出（JSON 格式）
- ✅ APP 视图 / 卡片视图切换
- ✅ 响应式设计

## 使用说明

1. **进入编辑模式**：点击右上角设置菜单 → 编辑模式
2. **添加分类**：编辑模式下，点击页面顶部的"新建分类"按钮
3. **添加链接**：编辑模式下，点击分类中的 + 按钮
4. **拖拽排序**：编辑模式下，拖拽卡片调整顺序
5. **导入配置**：设置菜单 → 导入配置，选择之前导出的 JSON 文件

## 从 Cloudflare Worker 迁移数据

1. 在原 Worker 页面，使用"导出配置"功能导出 JSON 文件
2. 安装本扩展后，使用"导入配置"功能导入该文件
3. 所有分类和链接将自动恢复

## 文件结构

```
extension/
├── manifest.json      # 扩展配置
├── newtab.html        # 新标签页 HTML
├── css/
│   └── styles.css     # 预编译的 Tailwind CSS
├── js/
│   └── newtab.js      # 主要逻辑
└── icons/
    └── icon.svg       # 扩展图标
```

## 数据存储

所有数据存储在浏览器本地（`chrome.storage.local`），不会上传到任何服务器。

## 兼容性

- Chrome 88+
- Firefox 109+
- Edge 88+
- Brave（基于 Chromium）
