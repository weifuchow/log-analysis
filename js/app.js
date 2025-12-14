/**
 * 主应用入口
 * 初始化所有模块并设置全局事件监听器
 */

import { state } from './core/state.js';
import { TIME_RANGE_TYPES } from './core/constants.js';
import { formatDateForInput } from './utils/format.js';
import { initFileManager, setSearchTimeRange } from './modules/fileManager.js';
import { initSearchEngine } from './modules/searchEngine.js';
import { initWorkspace } from './modules/workspace.js';
import { initTemplates } from './modules/templates.js';
import { initRemoteLog } from './modules/remoteLog.js';
import { initSettings } from './modules/settings.js';
import { initAiSummary } from './modules/aiSummary.js';

/**
 * 应用初始化
 */
function initializeApp() {
    console.log('应用初始化开始...');

    // 设置默认时间范围（最近1小时）
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const beginDate = document.getElementById('beginDate');
    const endDate = document.getElementById('endDate');
    const searchBeginDate = document.getElementById('searchBeginDate');
    const searchEndDate = document.getElementById('searchEndDate');

    if (beginDate) beginDate.value = formatDateForInput(oneHourAgo);
    if (endDate) endDate.value = formatDateForInput(now);
    if (searchBeginDate) searchBeginDate.value = formatDateForInput(oneHourAgo);
    if (searchEndDate) searchEndDate.value = formatDateForInput(now);

    console.log('应用初始化完成');
}

/**
 * 设置全局事件监听器
 */
function setupGlobalEventListeners() {
    console.log('设置全局事件监听器...');

    // 时间范围快捷按钮
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.addEventListener('click', function() {
            setSearchTimeRange(this.dataset.range);
        });
    });

    // 模态框关闭按钮
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        });
    });

    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    console.log('全局事件监听器设置完成');
}

/**
 * 页面清理
 */
function setupCleanup() {
    window.addEventListener('beforeunload', () => {
        // 清理内存中的大对象
        state.fileList = [];
        state.remoteLogData = null;
        state.searchResults = [];
        console.log('应用资源已清理');
    });
}

/**
 * DOMContentLoaded 事件处理
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化应用...');

    try {
        // 初始化应用基础设置
        initializeApp();

        // 初始化各个功能模块
        initFileManager();
        initSearchEngine();
        initWorkspace();
        initTemplates();
        initRemoteLog();
        initSettings();
        initAiSummary();

        // 设置全局事件监听器
        setupGlobalEventListeners();

        // 设置清理函数
        setupCleanup();

        console.log('✓ 所有模块初始化完成！');
    } catch (error) {
        console.error('应用初始化失败:', error);
        alert('应用初始化失败，请刷新页面重试。错误信息: ' + error.message);
    }
});

// 导出供调试使用
window.appState = state;
