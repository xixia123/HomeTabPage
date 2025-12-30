# Favicon 缓存功能测试指南

## 测试环境准备

### Chrome/Edge
1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension` 目录

### Firefox
1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击"临时载入附加组件"
3. 选择 `extension/manifest.json`

## 测试项目

### ✅ 测试 1: 首次加载性能
**目的**: 验证图标并行加载，无阻塞

**步骤**:
1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 打开新标签页
4. 观察 favicon 请求

**预期结果**:
- ✅ 所有 favicon 请求应该**并行发起**（几乎同时）
- ✅ 不应该有明显的串行等待
- ✅ 页面应该在 1-3 秒内显示所有图标

**失败标志**:
- ❌ 图标一个一个慢慢出现
- ❌ Network 中看到请求是串行的（一个结束才发起下一个）

---

### ✅ 测试 2: 缓存命中
**目的**: 验证 IndexedDB 缓存工作正常

**步骤**:
1. 首次加载新标签页（等待所有图标加载完成）
2. 打开开发者工具 → Application → IndexedDB
3. 查看 `favicon-cache` 数据库
4. 刷新页面 (F5)
5. 观察 Network 标签

**预期结果**:
- ✅ IndexedDB 中应该有 `favicons` 存储
- ✅ 每个成功加载的图标都应该有缓存记录
- ✅ 刷新后，Network 中**不应该有** favicon 请求（从缓存加载）
- ✅ 图标应该**瞬间显示**

**验证缓存数据**:
```javascript
// 在控制台运行
const request = indexedDB.open('favicon-cache', 1);
request.onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction('favicons', 'readonly');
  const store = tx.objectStore('favicons');
  const getAll = store.getAll();
  getAll.onsuccess = () => {
    console.log('缓存的 favicon 数量:', getAll.result.length);
    console.log('缓存详情:', getAll.result);
  };
};
```

---

### ✅ 测试 3: API 回退机制
**目的**: 验证多个 API 的回退逻辑

**步骤**:
1. 打开开发者工具 → Network
2. 添加一个测试链接（使用不常见的域名，如 `example-test-domain-12345.com`）
3. 观察 Network 请求

**预期结果**:
- ✅ 应该依次尝试以下 API（按顺序）:
  1. `https://www.google.com/s2/favicons?sz=64&domain=...`
  2. `https://icons.duckduckgo.com/ip3/....ico`
  3. `https://example-test-domain-12345.com/favicon.ico`
- ✅ 如果所有 API 都失败，显示默认图标（圆形感叹号）

---

### ✅ 测试 4: 缓存过期
**目的**: 验证 7 天过期机制

**步骤**:
1. 打开开发者工具 → Console
2. 运行以下代码修改缓存时间戳（模拟 8 天前）:

```javascript
const request = indexedDB.open('favicon-cache', 1);
request.onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction('favicons', 'readwrite');
  const store = tx.objectStore('favicons');
  const getAll = store.getAll();
  
  getAll.onsuccess = () => {
    const items = getAll.result;
    items.forEach(item => {
      // 设置为 8 天前
      item.timestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      store.put(item);
    });
    console.log('已将所有缓存设置为 8 天前');
  };
};
```

3. 刷新页面
4. 观察 Network 标签

**预期结果**:
- ✅ 应该重新发起 favicon 请求（缓存已过期）
- ✅ 新的缓存应该更新时间戳

---

### ✅ 测试 5: 编辑模式功能
**目的**: 验证分类管理功能

**步骤**:
1. 点击右上角设置 → "进入编辑"
2. 测试以下功能:
   - 添加新分类
   - 重命名分类
   - 上移/下移分类
   - 置顶分类
   - 删除分类
   - 拖拽卡片到不同分类

**预期结果**:
- ✅ 所有操作应该正常工作
- ✅ 刷新后顺序应该保持
- ✅ 不应该有控制台错误

---

### ✅ 测试 6: 清除缓存
**目的**: 验证缓存可以被清除

**步骤**:
1. 打开开发者工具 → Application → IndexedDB
2. 右键点击 `favicon-cache` → Delete database
3. 刷新页面

**预期结果**:
- ✅ 图标重新从网络加载
- ✅ 新的缓存数据库被创建

---

## 性能基准

### 首次加载（无缓存）
- **20 个链接**: 应在 2-5 秒内全部显示
- **50 个链接**: 应在 5-10 秒内全部显示

### 缓存加载
- **任意数量**: 应在 0.5 秒内全部显示

---

## 常见问题排查

### 问题 1: 图标不显示
**检查**:
- 打开 Console 查看是否有错误
- 检查 Network 是否有 CORS 错误
- 验证 URL 格式是否正确

### 问题 2: 缓存不工作
**检查**:
- IndexedDB 是否被浏览器禁用
- 是否在隐私模式下（某些浏览器会限制 IndexedDB）
- 检查 Console 是否有 IndexedDB 错误

### 问题 3: 性能仍然慢
**检查**:
- 打开 Network → 查看是否有请求串行
- 检查是否有大量 404 错误导致超时
- 验证网络连接速度

---

## 调试命令

### 查看所有缓存
```javascript
const request = indexedDB.open('favicon-cache', 1);
request.onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction('favicons', 'readonly');
  const store = tx.objectStore('favicons');
  const getAll = store.getAll();
  getAll.onsuccess = () => console.table(getAll.result);
};
```

### 清除所有缓存
```javascript
indexedDB.deleteDatabase('favicon-cache');
console.log('缓存已清除，请刷新页面');
```

### 手动测试单个 favicon
```javascript
async function testFavicon(url) {
  const hostname = new URL(url.startsWith('http') ? url : 'http://' + url).hostname;
  const apis = [
    `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`,
    `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
    `https://${hostname}/favicon.ico`
  ];
  
  for (let i = 0; i < apis.length; i++) {
    try {
      const res = await fetch(apis[i]);
      console.log(`API ${i+1} (${apis[i]}):`, res.ok ? '✅ 成功' : '❌ 失败');
    } catch (e) {
      console.log(`API ${i+1} (${apis[i]}): ❌ 错误 -`, e.message);
    }
  }
}

// 使用示例
testFavicon('github.com');
```
