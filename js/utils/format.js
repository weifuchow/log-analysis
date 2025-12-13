/**
 * 格式化工具函数
 */

/**
 * 格式化日期为输入框格式
 */
export function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取状态文本
 */
export function getStatusText(status) {
    switch (status) {
        case 'processing': return '预处理中...';
        case 'ready': return '已就绪';
        case 'error': return '处理失败';
        default: return '未知状态';
    }
}

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 高亮关键词
 */
export function highlightKeywords(content, keywords) {
    let highlighted = content;
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
        highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
    });
    return highlighted;
}
