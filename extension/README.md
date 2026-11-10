# 漫书助手 (MangaBook Chrome/Arc 扩展插件)

无需发布应用商店，直接在本地浏览器中「以开发者模式加载」即可使用。

---

## 🚀 安装步骤（只需 10 秒）

### 适用于 Google Chrome / Microsoft Edge / Brave
1. 在浏览器地址栏输入并回车：
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
2. 打开页面右上角的 **「开发者模式」(Developer mode)** 开关；
3. 点击左上角的 **「加载已解压的扩展程序」(Load unpacked)**；
4. 在弹出的文件选择器中，选择本项目中的 **`extension`** 目录：
   ```
   /Users/kevin/Developer/Code/manga-book/extension
   ```
5. 完成！浏览器扩展栏会出现「📚 漫书助手」图标。

### 适用于 Arc 浏览器
1. 访问 `arc://extensions/`；
2. 开启右上角 **「Developer mode」**；
3. 点击 **「Load unpacked」** 选中 `extension` 文件夹即可。

---

## 💡 使用方法

1. **一键下载**：
   在 `hitomi.la` 打开任意漫画（如 `/doujinshi/...` 或 `/reader/...`），页面会自动注入紫色的 **`📥 下载到漫书`** 按钮。
2. **免守候、全自动**：
   点击按钮后，本地 `MangaBook` 客户端会自动在后台：
   - 动态获取最新 CDN 分流地址；
   - 逐页并发下载原图；
   - 自动按照作者名创建目录（如 `Authors/作者名/漫画名/`）；
   - 自动提取并录入全部分类标签（Tags）；
   - 下载完成后发送系统通知，书架自动刷新并展示 3D 单行本封面！
3. **扩展栏控制台**：
   在任何时候点击浏览器右上角「漫书助手」图标，都可以查看本地客户端连接状态、当前正在下载的进度及最近下载历史。
