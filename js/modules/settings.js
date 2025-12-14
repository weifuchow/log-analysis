/**
 * 设置管理模块
 * 处理应用设置的保存和加载
 */

import { getStorageValue, setStorageValue, getLocalStorage, setLocalStorage } from '../utils/storage.js';
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
    const aiToken = document.getElementById('aiToken')?.value.trim();
    const aiModelList = document.getElementById('aiModelList')?.value || '';
    const defaultModel = document.getElementById('aiModel')?.value.trim();

    const poeModels = aiModelList
        .split(/\n|,/)
        .map(m => m.trim())
        .filter(Boolean);

    if (defaultModel && !poeModels.includes(defaultModel)) {
        poeModels.unshift(defaultModel);
    }

    await setStorageValue('apiToken', token || '');
    await setStorageValue('aiConfig', {
        provider: 'poe',
        token: aiToken || '',
        model: defaultModel || poeModels[0] || ''
    });

    // Poe 配置存入 localStorage，便于前端直接读取
    setLocalStorage('poeToken', aiToken || '');
    setLocalStorage('poeModels', poeModels);
    setLocalStorage('poeDefaultModel', defaultModel || poeModels[0] || '');

    showStatusMessage('设置已保存', 'success');
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

    const aiConfig = await getStorageValue('aiConfig') || {};
    const storedToken = getLocalStorage('poeToken', aiConfig.token || '');
    const storedModels = getLocalStorage('poeModels', []);
    const defaultModel = getLocalStorage('poeDefaultModel', aiConfig.model || storedModels[0] || '');

    const aiToken = document.getElementById('aiToken');
    const aiModel = document.getElementById('aiModel');
    const aiModelList = document.getElementById('aiModelList');

    if (aiToken) aiToken.value = storedToken;
    if (aiModel) aiModel.value = defaultModel;
    if (aiModelList) aiModelList.value = storedModels.join('\n');
}
