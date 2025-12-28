# TAR包文件过滤问题修复说明

## ✅ 问题已修复

### 问题描述

上传包含 ROS 日志的 TAR 包时，某些日志文件没有被识别和显示，例如：

**被过滤掉的文件**：
```
sros.rk3399-yocto.root.log.INFO.20251031-113748.54407
sros.rk3399-yocto.root.log.INFO.20251031-143358.125029
sros.rk3399-yocto.root.log.INFO.20251031-170220.511723
sros.rk3399-yocto.root.log.INFO.20251101-105459.1534
srtos.20251031-113755.714308
srtos.20251031-143347.346741
srtos.20251031-143406.043826
srtos.20251031-170227.585797
srtos.20251101-105506.444049
```

### 根本原因

这些文件遵循 **GLOG（Google Logging）命名规范**：

```
<程序名>.<主机名>.<用户名>.log.<级别>.<日期>-<时间>.<进程ID>
```

例如：
```
sros.rk3399-yocto.root.log.INFO.20251031-113748.54407
│    │             │    │    │    │               │
│    │             │    │    │    │               └─ 进程ID
│    │             │    │    │    └─ 日期时间
│    │             │    │    └─ 日志级别
│    │             │    └─ "log" 标识
│    │             └─ 用户名
│    └─ 主机名
└─ 程序名
```

**原代码的过滤条件太严格**：
```javascript
// 旧的过滤逻辑
if (entry.name.endsWith('.gz') ||
    entry.name.endsWith('.log') ||
    entry.name.endsWith('.zst')) {
    // 处理文件
}
```

因为这些文件以**进程ID数字**结尾（如 `.54407`），不是标准扩展名，所以被过滤掉了。

---

## 🔧 修复方案

### 新的文件识别逻辑

现在支持**多种日志文件命名模式**：

```javascript
const isLogFile =
    // 标准扩展名
    entry.name.endsWith('.gz') ||
    entry.name.endsWith('.log') ||
    entry.name.endsWith('.zst') ||

    // ROS/GLOG 程序名
    entry.name.includes('sros.') ||
    entry.name.includes('srtos.') ||

    // GLOG 日志级别
    entry.name.includes('.INFO.') ||
    entry.name.includes('.WARN.') ||
    entry.name.includes('.ERROR.') ||
    entry.name.includes('.FATAL.') ||

    // 通用日志文件
    entry.name.toLowerCase().includes('log');
```

### 支持的文件命名模式

✅ **标准扩展名**
```
application.log
system.log.gz
data.log.zst
```

✅ **GLOG 格式（以进程ID结尾）**
```
sros.host.user.log.INFO.20251031-113748.54407
program.host.user.log.WARN.20251031-143358.125029
app.server.root.log.ERROR.20251031-170220.511723
```

✅ **ROS 日志**
```
sros.rk3399-yocto.root.log.INFO.20251031-113748.54407
srtos.20251031-113755.714308
```

✅ **其他包含 log 的文件**
```
system_log_20251031
application-log-file
debug.log.backup
```

---

## 📋 测试验证

### 测试步骤

1. **重新加载扩展**
   ```
   Chrome扩展页面 → 点击"重新加载"
   ```

2. **上传包含这些文件的TAR包**
   ```
   拖拽或选择您的 .tar 或 .tar.zst 文件
   ```

3. **查看文件列表**
   ```
   现在应该能看到所有日志文件，包括：
   ✓ sros.rk3399-yocto.root.log.INFO.20251031-113748.54407
   ✓ srtos.20251031-113755.714308
   ✓ 以及其他所有 GLOG 格式的文件
   ```

### 预期结果

**上传 TAR 包后，文件列表显示**：

```
✓ your-archive.tar
  状态：就绪
  时间范围：2025-10-31 11:37:48 ~ 2025-11-01 13:25:00

  包含的子文件：

  ├─ sros.rk3399-yocto.root.log.INFO.20251031-113748.54407
  │  大小：9.0 MB
  │  时间：2025-10-31 11:37:48 ~ 2025-10-31 14:30:00
  │
  ├─ sros.rk3399-yocto.root.log.INFO.20251031-143358.125029
  │  大小：9.6 MB
  │  时间：2025-10-31 14:33:58 ~ 2025-10-31 17:02:15
  │
  ├─ sros.rk3399-yocto.root.log.INFO.20251031-170220.511723
  │  大小：5.6 MB
  │  时间：2025-10-31 17:02:20 ~ 2025-10-31 19:56:30
  │
  ├─ sros.rk3399-yocto.root.log.INFO.20251101-105459.1534
  │  大小：4.6 MB
  │  时间：2025-11-01 10:54:59 ~ 2025-11-01 13:36:00
  │
  ├─ srtos.20251031-113755.714308
  │  大小：132 KB
  │  时间：2025-10-31 11:37:55 ~ 2025-10-31 14:33:00
  │
  └─ ... 其他文件
```

**文件名完整显示**（自动换行）

**所有文件都可以被搜索**

---

## 🎯 实际使用示例

### 场景：分析包含 GLOG 文件的 TAR 包

1. **上传 TAR 包**
   ```bash
   # 您的 TAR 包包含：
   - sros.rk3399-yocto.root.log.INFO.20251031-113748.54407 (9.0 MB)
   - sros.rk3399-yocto.root.log.INFO.20251031-143358.125029 (9.6 MB)
   - srtos.20251031-113755.714308 (132 KB)
   - ... 其他文件
   ```

2. **查看所有子文件**
   ```
   ✓ 所有文件都会被识别和显示
   ✓ 每个文件显示时间范围
   ✓ 文件名完整可见（自动换行）
   ```

3. **搜索所有文件**
   ```
   关键词：error
   逻辑：OR
   时间：全部

   → 搜索会包含所有子文件
   → 结果按时间排序
   → 显示来源文件名
   ```

4. **查看搜索结果**
   ```
   找到 145 条匹配日志

   2025-10-31 11:50:23.456 [ERROR] Connection timeout
   来源：sros.rk3399-yocto.root.log.INFO.20251031-113748.54407

   2025-10-31 14:35:12.789 [ERROR] Device unavailable
   来源：sros.rk3399-yocto.root.log.INFO.20251031-143358.125029

   2025-10-31 11:48:30.123 [ERROR] Network error
   来源：srtos.20251031-113755.714308

   ...
   ```

---

## 📊 支持的日志格式总结

| 格式类型 | 文件名示例 | 识别规则 | 支持状态 |
|---------|-----------|---------|---------|
| 标准日志 | `app.log` | 以 `.log` 结尾 | ✅ 支持 |
| Gzip压缩 | `app.log.gz` | 以 `.gz` 结尾 | ✅ 支持 |
| Zstd压缩 | `app.log.zst` | 以 `.zst` 结尾 | ✅ 支持 |
| GLOG格式 | `app.host.user.log.INFO.20251031.12345` | 包含 `.INFO.` 等 | ✅ **新增支持** |
| ROS日志 | `sros.host.user.log.INFO.20251031.12345` | 包含 `sros.` | ✅ **新增支持** |
| ROS简短 | `srtos.20251031.12345` | 包含 `srtos.` | ✅ **新增支持** |
| 自定义 | `system_log_file` | 包含 `log` | ✅ 支持 |

---

## 🔍 GLOG 日志格式说明

### GLOG 命名规范

Google Logging Library (GLOG) 使用的日志文件命名格式：

```
<program>.<hostname>.<user>.log.<severity>.<date>-<time>.<pid>
```

**字段说明**：
- `program`: 程序名（如 `sros`、`srtos`）
- `hostname`: 主机名（如 `rk3399-yocto`）
- `user`: 用户名（如 `root`）
- `log`: 固定字符串
- `severity`: 日志级别（`INFO`、`WARN`、`ERROR`、`FATAL`）
- `date`: 日期（`YYYYMMDD`）
- `time`: 时间（`HHMMSS`）
- `pid`: 进程ID（如 `54407`）

### GLOG 日志级别

| 级别 | 含义 | 文件名包含 |
|------|------|-----------|
| INFO | 信息 | `.INFO.` |
| WARN | 警告 | `.WARN.` 或 `.WARNING.` |
| ERROR | 错误 | `.ERROR.` |
| FATAL | 致命 | `.FATAL.` |

### 实际示例

```bash
# 标准 GLOG 文件
sros.rk3399-yocto.root.log.INFO.20251031-113748.54407

# 解析：
程序名: sros
主机名: rk3399-yocto
用户: root
级别: INFO
日期时间: 2025年10月31日 11:37:48
进程ID: 54407

# 简短格式
srtos.20251031-113755.714308

# 解析：
程序名: srtos
日期时间: 2025年10月31日 11:37:55
进程ID: 714308
```

---

## 🎉 总结

### 修复内容

✅ **扩展了文件识别逻辑**
- 支持 GLOG 命名规范
- 支持以进程ID数字结尾的文件
- 支持 ROS 日志文件

✅ **现在可以识别的文件**
- 所有标准扩展名（.log, .gz, .zst）
- GLOG 格式文件（含 .INFO., .WARN., .ERROR., .FATAL.）
- ROS 日志（含 sros., srtos.）
- 任何包含 "log" 的文件

✅ **用户体验改善**
- TAR 包中的所有日志文件都会显示
- 文件名完整可见（自动换行）
- 所有文件都可以被搜索

### 使用建议

1. **重新加载扩展**以应用修复
2. **上传您的 TAR 包**
3. **查看文件列表**，确认所有日志文件都显示了
4. **正常使用搜索、标记、导出功能**

---

**修复版本**：已推送到 `claude/explain-log-files-gvRCL` 分支

**现在您可以完整分析所有 ROS/GLOG 日志文件了！** 🎯
