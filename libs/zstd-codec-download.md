## zstd-codec@0.1.5 本地镜像说明

在当前环境无法直接访问外部 CDN（403 / CONNECT 受限），`libs/zstd-codec.min.js` 仅提供占位实现，依赖浏览器原生的 `DecompressionStream('zstd')`。若要启用完整的 Zstandard 解码能力，请在网络可用时手动下载官方构建并替换本地文件。

### 获取方式（推荐 jsDelivr）
1. 打开 https://www.jsdelivr.com/package/npm/zstd-codec
2. 下载 `dist/zstd-codec.min.js` 与对应的 `dist/zstd-codec.wasm`
   * 直接链接示例：  
     - `https://cdn.jsdelivr.net/npm/zstd-codec@0.1.5/dist/zstd-codec.min.js`  
     - `https://cdn.jsdelivr.net/npm/zstd-codec@0.1.5/dist/zstd-codec.wasm`
3. 将上述文件放入项目 `libs/` 目录（覆盖占位文件，并确保 `.wasm` 与 `.js` 同目录可供加载）。

### 备用来源
- UNPKG: `https://unpkg.com/zstd-codec@0.1.5/dist/zstd-codec.min.js`

### 注意
- jsdelivr 首页展示的 `index.js` 仅包含 CommonJS 导出入口，真正的浏览器构建位于 `dist/` 目录。
- 仍然保留 CDN 加载顺序：优先本地 `libs/zstd-codec.min.js`，失败时尝试 CDN。

