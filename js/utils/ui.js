/**
 * UI 工具函数
 * 处理模态框、消息提示等UI相关功能
 */

/**
 * 显示状态消息
 */
export function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('searchStatus');
    if (!statusDiv) return;

    statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, 5000);
}

/**
 * 关闭模态框
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 打开模态框
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

/**
 * 设置按钮加载状态
 */
export function setButtonLoading(buttonId, isLoading, loadingText = '处理中...') {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

/**
 * 显示/隐藏元素
 */
export function toggleElement(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

/**
 * 更新进度条
 */
export function updateProgressBar(progressBarId, progressTextId, percent, text = '') {
    const progressBar = document.getElementById(progressBarId);
    const progressText = document.getElementById(progressTextId);

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = `${percent}%`;
    }

    if (progressText && text) {
        progressText.textContent = text;
    }
}
