/**
 * 工作区管理模块
 * 处理日志标记、标签管理和工作区导出
 */

import { state } from '../core/state.js';
import { TAG_COLORS } from '../core/constants.js';
import { getStorageValue, setStorageValue } from '../utils/storage.js';
import { showStatusMessage } from '../utils/ui.js';

/**
 * 初始化工作区
 */
export function initWorkspace() {
    const exportBtn = document.getElementById('exportBtn');
    const clearWorkspaceBtn = document.getElementById('clearWorkspaceBtn');
    const generatePromptBtn = document.getElementById('generatePromptBtn');
    const copyPromptBtn = document.getElementById('copyPromptBtn');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportWorkspace);
    }

    if (clearWorkspaceBtn) {
        clearWorkspaceBtn.addEventListener('click', clearWorkspace);
    }

    if (generatePromptBtn) {
        generatePromptBtn.addEventListener('click', generateWorkspacePrompt);
    }

    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', copyWorkspacePrompt);
    }

    // 加载工作区数据
    loadWorkspace();
}

export function generateWorkspacePrompt() {
    const descriptionInput = document.getElementById('issueDescription');
    const promptOutput = document.getElementById('aiPromptOutput');

    if (!descriptionInput || !promptOutput) return;

    const description = descriptionInput.value.trim();

    if (!description) {
        showStatusMessage('请先描述问题现象', 'error');
        return;
    }

    if (state.workspace.length === 0) {
        showStatusMessage('请先在工作区标记相关日志', 'error');
        return;
    }

    const sortedWorkspace = [...state.workspace].sort((a, b) => a.timestamp - b.timestamp);
    const timeline = sortedWorkspace.map((item, index) => {
        const firstLine = item.content.split('\n')[0] || item.content;
        const tagText = item.tags && item.tags.length > 0
            ? ` 标签: ${item.tags.map(tag => tag.name).join(', ')}`
            : '';
        return `${index + 1}. ${item.timestamp.toLocaleString()} | ${item.source || '日志'}${tagText}\n   ${firstLine}`;
    }).join('\n');

    const prompt = [
        '请作为工业自动化日志分析助手，结合以下信息完成故障研判：',
        `- 问题现象: ${description}`,
        '- 处理要求: 先梳理时间线，再提炼现象特征，分析可能原因并给出排查建议。',
        '- 日志时间线（按标记顺序）:',
        timeline,
        '',
        '请输出：',
        '1) 关键时间节点与事件串联（按时间线归纳）',
        '2) 对问题现象的分析与推测原因',
        '3) 需要重点关注的设备/订单/车辆或字段',
        '4) 可进一步验证或收集的日志/指标建议'
    ].join('\n');

    promptOutput.value = prompt;
    showStatusMessage('AI 提示词已生成，可直接复制到大模型', 'success');
}

export async function copyWorkspacePrompt() {
    const promptOutput = document.getElementById('aiPromptOutput');
    if (!promptOutput || !promptOutput.value.trim()) {
        showStatusMessage('请先生成提示词', 'info');
        return;
    }

    try {
        await navigator.clipboard.writeText(promptOutput.value);
        showStatusMessage('提示词已复制到剪贴板', 'success');
    } catch (error) {
        console.warn('Clipboard API 不可用，尝试回退复制。', error);
        promptOutput.select();
        document.execCommand('copy');
        showStatusMessage('提示词已复制', 'success');
    }
}

/**
 * 标记日志到工作区（通过索引）
 */
export function markLog(index) {
    const log = state.searchResults[index];
    if (!log) return;

    markLogById(log);
}

/**
 * 标记日志到工作区（通过日志对象）
 */
export function markLogById(log) {
    if (!log) return;

    // 检查是否已经标记
    if (state.workspace.find(item => item.id === log.id)) {
        showStatusMessage('该日志已经在工作区中', 'info');
        return;
    }

    state.workspace.push({
        ...log,
        markedAt: new Date(),
        tags: []
    });

    saveWorkspace();
    displayWorkspace();
    showStatusMessage('日志已标记到工作区', 'success');
}

/**
 * 显示工作区
 */
export function displayWorkspace() {
    const container = document.getElementById('workspace');
    if (!container) return;

    if (state.workspace.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #7f8c8d;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                <div>标记的日志将在这里显示</div>
            </div>
        `;
        return;
    }

    // 按时间戳排序
    const sortedWorkspace = [...state.workspace].sort((a, b) => a.timestamp - b.timestamp);

    container.innerHTML = sortedWorkspace.map((item, index) => `
        <div class="workspace-item">
            <div class="workspace-item-header">
                <div class="workspace-timestamp">${item.timestamp.toLocaleString()}</div>
                <div class="workspace-actions">
                    <input type="text" class="tag-input" placeholder="添加标签" data-workspace-index="${index}">
                    <button class="remove-btn" data-workspace-index="${index}">删除</button>
                </div>
            </div>
            <div class="tags">
                ${item.tags.map(tag => `
                    <span class="tag" style="background-color: ${tag.color}">
                        ${tag.name}
                        <span class="tag-remove" data-workspace-index="${index}" data-tag-name="${tag.name}" style="cursor: pointer; margin-left: 5px;">&times;</span>
                    </span>
                `).join('')}
            </div>
            <div class="workspace-log-content">${item.content}</div>
        </div>
    `).join('');

    // 为标签输入框添加事件监听器
    container.querySelectorAll('.tag-input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const index = parseInt(this.dataset.workspaceIndex);
                addTag(index, this.value);
                this.value = '';
            }
        });
    });

    // 为删除按钮添加事件监听器
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.workspaceIndex);
            removeFromWorkspace(index);
        });
    });

    // 为标签删除按钮添加事件监听器
    container.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.workspaceIndex);
            const tagName = this.dataset.tagName;
            removeTag(index, tagName);
        });
    });
}

/**
 * 添加标签
 */
export function addTag(workspaceIndex, tagName) {
    if (!tagName.trim()) return;

    const item = state.workspace[workspaceIndex];
    if (item.tags.find(tag => tag.name === tagName.trim())) return;

    const color = TAG_COLORS[state.nextTagColorIndex % TAG_COLORS.length];
    state.nextTagColorIndex++;

    item.tags.push({
        name: tagName.trim(),
        color: color
    });

    saveWorkspace();
    displayWorkspace();
}

/**
 * 删除标签
 */
export function removeTag(workspaceIndex, tagName) {
    const item = state.workspace[workspaceIndex];
    item.tags = item.tags.filter(tag => tag.name !== tagName);
    saveWorkspace();
    displayWorkspace();
}

/**
 * 从工作区删除日志
 */
export function removeFromWorkspace(index) {
    state.workspace.splice(index, 1);
    saveWorkspace();
    displayWorkspace();
}

/**
 * 清空工作区
 */
export function clearWorkspace() {
    if (confirm('确定要清空工作区吗？')) {
        state.workspace = [];
        saveWorkspace();
        displayWorkspace();
        showStatusMessage('工作区已清空', 'info');
    }
}

/**
 * 导出工作区
 */
export function exportWorkspace() {
    if (state.workspace.length === 0) {
        showStatusMessage('工作区为空，无法导出', 'info');
        return;
    }

    const content = state.workspace.map(item => {
        const tags = item.tags.map(tag => `[${tag.name}]`).join(' ');
        return `${tags}\n${item.timestamp.toLocaleString()}\n${item.content}\n${'='.repeat(80)}\n`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `工作区导出_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showStatusMessage('工作区已导出', 'success');
}

/**
 * 保存工作区到存储
 */
export async function saveWorkspace() {
    try {
        const workspaceData = state.workspace.map(item => ({
            ...item,
            timestamp: item.timestamp.toISOString(),
            markedAt: item.markedAt.toISOString()
        }));
        await setStorageValue('logAnalysisWorkspace', workspaceData);
    } catch (error) {
        console.error('保存工作区失败:', error);
    }
}

/**
 * 从存储加载工作区
 */
export async function loadWorkspace() {
    try {
        const workspaceData = await getStorageValue('logAnalysisWorkspace');
        if (workspaceData) {
            state.workspace = workspaceData.map(item => ({
                ...item,
                timestamp: new Date(item.timestamp),
                markedAt: new Date(item.markedAt)
            }));
            displayWorkspace();
        }
    } catch (error) {
        console.error('加载工作区失败:', error);
    }
}
