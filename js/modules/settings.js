/**
 * 设置管理模块
 * 处理应用设置的保存和加载
 */

import { getStorageValue, setStorageValue } from '../utils/storage.js';
import { showStatusMessage, closeModal, openModal } from '../utils/ui.js';

/**
 * 初始化设置模块
 */
export function initSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettings);
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }

    // 加载设置
    loadSettings();
}

/**
 * 显示设置对话框
 */
export function showSettings() {
    openModal('settingsModal');
}

/**
 * 保存设置
 */
export async function saveSettings() {
    const token = document.getElementById('apiToken').value.trim();
    if (token) {
        await setStorageValue('apiToken', token);
        showStatusMessage('设置已保存', 'success');
    }
    closeModal('settingsModal');
}

/**
 * 加载设置
 */
export async function loadSettings() {
    const token = await getStorageValue('apiToken');
    const apiTokenInput = document.getElementById('apiToken');
    if (token && apiTokenInput) {
        apiTokenInput.value = token;
    }
}
