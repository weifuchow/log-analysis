/**
 * 模板管理模块
 * 处理预设模板和自定义模板
 */

import { state } from '../core/state.js';
import { PRESET_TEMPLATES } from '../core/constants.js';
import { getLocalStorage, setLocalStorage } from '../utils/storage.js';
import { showStatusMessage, closeModal, openModal } from '../utils/ui.js';

/**
 * 初始化模板管理器
 */
export function initTemplates() {
    setupPresetTemplates();
    loadDefaultTemplates();

    // 模板管理器相关按钮
    const templateManagerBtn = document.getElementById('templateManagerBtn');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const applyTemplateBtn = document.getElementById('applyTemplateBtn');

    if (templateManagerBtn) {
        templateManagerBtn.addEventListener('click', showTemplateManager);
    }

    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', saveTemplate);
    }

    if (applyTemplateBtn) {
        applyTemplateBtn.addEventListener('click', applyTemplate);
    }
}

/**
 * 设置预设模板
 */
function setupPresetTemplates() {
    console.log('设置预设模板...');

    const templateBtns = document.querySelectorAll('[data-template]');
    console.log('找到模板按钮数量:', templateBtns.length);

    templateBtns.forEach((btn, index) => {
        console.log(`模板按钮 ${index}:`, btn.dataset.template);

        // 移除旧的事件监听器，添加新的
        btn.removeEventListener('click', templateClickHandler);
        btn.addEventListener('click', templateClickHandler);
    });
}

/**
 * 模板点击处理函数
 */
function templateClickHandler(e) {
    console.log('模板按钮被点击:', e.target.dataset.template);

    // 移除其他按钮的active状态
    document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const templateKey = e.target.dataset.template;
    handleTemplateSelection(templateKey);
}

/**
 * 处理模板选择
 */
function handleTemplateSelection(templateKey) {
    console.log('处理模板选择:', templateKey);

    if (templateKey === 'custom') {
        showTemplateManager();
        return;
    }

    const template = PRESET_TEMPLATES[templateKey];
    if (!template) {
        console.error('找不到模板:', templateKey);
        return;
    }

    console.log('找到模板:', template);
    state.currentTemplate = template;

    // 如果模板有变量，显示变量设置对话框
    if (template.variables && template.variables.length > 0) {
        console.log('显示变量模态框');
        showVariableModal(template);
    } else {
        // 直接应用模板
        console.log('直接应用模板');
        applyTemplateDirectly(template);
    }
}

/**
 * 显示变量输入模态框
 */
function showVariableModal(template) {
    console.log('显示变量模态框:', template);

    const modal = document.getElementById('variableModal');
    const form = document.getElementById('variableForm');

    if (!modal || !form) {
        console.error('找不到变量模态框元素');
        return;
    }

    // 生成变量输入表单
    form.innerHTML = template.variables.map(variable => `
        <div class="variable-item">
            <div class="variable-label">${variable}:</div>
            <input type="text" class="variable-input" data-variable="${variable}" placeholder="请输入${variable}">
        </div>
    `).join('');

    openModal('variableModal');
    console.log('变量模态框已显示');
}

function applyTemplateDsl(template, keywordList) {
    const dslInput = document.getElementById('keywordDsl');
    if (!dslInput) return;

    if (template.dsl && template.dsl.trim()) {
        dslInput.value = template.dsl;
        return;
    }

    const operator = template.logic === 'or' ? ' OR ' : ' AND ';
    dslInput.value = keywordList.join(operator);
}

/**
 * 应用模板（带变量替换）
 */
export function applyTemplate() {
    console.log('应用模板');

    if (!state.currentTemplate) {
        console.error('没有当前模板');
        return;
    }

    const variableInputs = document.querySelectorAll('.variable-input');
    const variables = {};

    // 收集变量值
    variableInputs.forEach(input => {
        const variable = input.dataset.variable;
        const value = input.value.trim();
        if (value) {
            variables[variable] = value;
        }
    });

    console.log('收集的变量:', variables);

    // 检查是否所有必需变量都已填写
    const missingVariables = state.currentTemplate.variables.filter(v => !variables[v]);
    if (missingVariables.length > 0) {
        showStatusMessage(`请填写所有变量: ${missingVariables.join(', ')}`, 'error');
        return;
    }

    // 替换模板中的变量
    const processedKeywords = state.currentTemplate.keywords.map(keyword => {
        let processed = keyword;
        Object.keys(variables).forEach(variable => {
            processed = processed.replace(new RegExp(`\\$\\{${variable}\\}`, 'g'), variables[variable]);
        });
        return processed;
    });

    console.log('处理后的关键词:', processedKeywords);

    // 应用到搜索框
    document.getElementById('keywords').value = processedKeywords.join('\n');
    applyTemplateDsl(state.currentTemplate, processedKeywords);

    closeModal('variableModal');
    showStatusMessage(`已应用模板: ${state.currentTemplate.name}`, 'success');
}

/**
 * 直接应用模板（无变量）
 */
function applyTemplateDirectly(template) {
    console.log('直接应用模板:', template);

    document.getElementById('keywords').value = template.keywords.join('\n');
    applyTemplateDsl(template, template.keywords);
    showStatusMessage(`已应用模板: ${template.name}`, 'success');
}

/**
 * 加载默认模板
 */
function loadDefaultTemplates() {
    const templates = getTemplates();
    // 如果没有模板，添加默认模板
    if (templates.length === 0) {
        const defaultTemplates = [
            {
                name: '路径规划结果',
                keywords: ['CompleteRoutePathBuilder line:101', '[设备名称占位符]'],
                logic: 'and'
            },
            {
                name: '订单分配',
                keywords: ['AssignFreeTasksPhase line:331'],
                logic: 'and'
            }
        ];
        setLocalStorage('searchTemplates', defaultTemplates);
    }
}

/**
 * 获取所有自定义模板
 */
export function getTemplates() {
    return getLocalStorage('searchTemplates', []);
}

/**
 * 显示模板管理器
 */
export function showTemplateManager() {
    const modal = document.getElementById('templateManagerModal');
    const templateList = document.getElementById('templateList');
    const templates = getTemplates();

    // 填充当前搜索条件到模板保存框
    const currentKeywords = document.getElementById('keywords').value;
    const templateKeywordsInput = document.getElementById('templateKeywords');
    if (templateKeywordsInput) {
        templateKeywordsInput.value = currentKeywords;
    }

    templateList.innerHTML = templates.map((template, index) => `
        <div class="template-item" data-template-index="${index}">
            <div>
                <div class="template-name">${template.name}</div>
                <div class="template-keywords">${template.keywords.join(', ')}</div>
            </div>
            <button class="remove-btn" data-template-index="${index}">删除</button>
        </div>
    `).join('');

    // 为模板项添加事件监听器
    templateList.querySelectorAll('.template-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.classList.contains('remove-btn')) {
                const index = parseInt(this.dataset.templateIndex);
                loadTemplate(index);
            }
        });
    });

    // 为删除按钮添加事件监听器
    templateList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.dataset.templateIndex);
            deleteTemplate(index);
        });
    });

    openModal('templateManagerModal');
}

/**
 * 保存自定义模板
 */
export function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const keywords = document.getElementById('templateKeywords').value.trim().split('\n').filter(k => k.trim());
    const dslInput = document.getElementById('keywordDsl');
    const dsl = dslInput ? dslInput.value.trim() : '';

    if (!name || keywords.length === 0) {
        showStatusMessage('请输入模板名称和关键词', 'error');
        return;
    }

    const templates = getTemplates();
    templates.push({
        name,
        keywords,
        logic: 'and',
        dsl: dsl || keywords.join(' AND ')
    });
    setLocalStorage('searchTemplates', templates);

    document.getElementById('templateName').value = '';
    showTemplateManager();
    showStatusMessage('模板已保存', 'success');
}

/**
 * 加载模板
 */
export function loadTemplate(index) {
    const templates = getTemplates();
    const template = templates[index];
    if (!template) return;

    document.getElementById('keywords').value = template.keywords.join('\n');
    applyTemplateDsl(template, template.keywords);

    closeModal('templateManagerModal');
    showStatusMessage(`已加载模板: ${template.name}`, 'success');
}

/**
 * 删除模板
 */
export function deleteTemplate(index) {
    if (confirm('确定要删除这个模板吗？')) {
        const templates = getTemplates();
        templates.splice(index, 1);
        setLocalStorage('searchTemplates', templates);
        showTemplateManager();
        showStatusMessage('模板已删除', 'info');
    }
}
