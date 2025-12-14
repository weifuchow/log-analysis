/**
 * AI 总结模块
 * 支持报告梳理模式与分析模式的提示词生成与调用
 */

import { state } from '../core/state.js';
import { getStorageValue } from '../utils/storage.js';
import { getLocalStorage, setLocalStorage } from '../utils/storage.js';
import { showStatusMessage, setButtonLoading } from '../utils/ui.js';

const MODE_HINTS = {
    report: '报告梳理模式：已知问题现象与怀疑的原因，生成完整报告。',
    analysis: '分析模式：只提供现象，由 AI 自行推理原因与结论。'
};

const STATUS_COLORS = {
    info: '#6c757d',
    success: '#2ecc71',
    error: '#e74c3c'
};

const POE_API_URL = 'https://api.poe.com/v1/chat/completions';

export function initAiSummary() {
    const entryBtn = document.getElementById('aiSummaryEntryBtn');
    if (entryBtn) {
        entryBtn.addEventListener('click', () => {
            const section = document.getElementById('aiSummarySection');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    const modeRadios = document.querySelectorAll('input[name="aiSummaryMode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', () => updateMode(radio.value));
    });
    const checkedMode = document.querySelector('input[name="aiSummaryMode"]:checked');
    updateMode(checkedMode ? checkedMode.value : 'report');

    const previewBtn = document.getElementById('previewAiSummaryBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', handlePreview);
    }

    const analyzeBtn = document.getElementById('runAiSummaryBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', handleAnalysis);
    }

    const exportBtn = document.getElementById('exportAiSummaryBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAiMarkdown);
    }

    const clearHistoryBtn = document.getElementById('clearAiHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAiHistory);
    }

    populateModelSelector();
    renderHistory();
}

function updateMode(mode) {
    const hint = document.getElementById('aiSummaryHint');
    if (hint) {
        hint.textContent = MODE_HINTS[mode] || MODE_HINTS.report;
    }

    const causeGroup = document.getElementById('aiKnownCauseGroup');
    if (causeGroup) {
        causeGroup.style.display = mode === 'report' ? 'block' : 'none';
    }
}

function collectFormValues() {
    const mode = document.querySelector('input[name="aiSummaryMode"]:checked')?.value || 'report';
    const issue = document.getElementById('aiSummaryIssue')?.value.trim() || '';
    const cause = document.getElementById('aiKnownCause')?.value.trim() || '';
    const model = document.getElementById('aiSummaryModelSelector')?.value || '';

    if (!issue) {
        throw new Error('请先填写问题现象描述');
    }

    if (!model) {
        throw new Error('请先选择 Poe 模型');
    }

    return { mode, issue, cause, model };
}

function buildWorkspaceTimeline() {
    if (!state.workspace || state.workspace.length === 0) {
        return '未提供标记日志，可直接基于现象进行分析。';
    }

    const sorted = [...state.workspace].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.map((item, index) => {
        const titleLine = item.content.split('\n')[0] || item.content;
        const tagText = item.tags && item.tags.length > 0
            ? ` | 标签: ${item.tags.map(tag => tag.name).join(', ')}`
            : '';
        return `${index + 1}. ${item.timestamp.toLocaleString()} | ${item.source || '日志'}${tagText}\n   ${titleLine}`;
    }).join('\n');
}

function buildPrompt({ mode, issue, cause }) {
    const timeline = buildWorkspaceTimeline();
    const base = [
        '你是工业自动化领域的日志分析助手，请基于提供的信息进行总结。',
        `问题现象: ${issue}`,
        `标记日志时间线:\n${timeline}`
    ];

    if (mode === 'report') {
        base.push(`已知/怀疑的原因: ${cause || '未填写，请结合日志与经验补充分析'}`);
        base.push('请产出完整报告，包含: 1) 时间线梳理；2) 现象复盘与根因推断；3) 关键证据与缺失信息；4) 排查建议和下一步动作。');
    } else {
        base.push('未知原因，请根据日志和行业经验独立推理可能的根因与验证路径。');
        base.push('请输出: 1) 主要症状与假设原因；2) 可能的影响范围；3) 需要验证的日志/指标；4) 建议的行动项。');
    }

    return base.join('\n');
}

function setAiSummaryStatus(message, type = 'info') {
    const status = document.getElementById('aiSummaryStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = STATUS_COLORS[type] || STATUS_COLORS.info;
}

async function handlePreview() {
    try {
        const values = collectFormValues();
        const prompt = buildPrompt(values);
        const preview = document.getElementById('aiSummaryPromptPreview');
        if (preview) {
            preview.value = prompt;
        }
        setAiSummaryStatus('已生成提示词预览', 'success');
    } catch (error) {
        setAiSummaryStatus(error.message, 'error');
        showStatusMessage(error.message, 'error');
    }
}

async function handleAnalysis() {
    let values;
    try {
        values = collectFormValues();
    } catch (error) {
        setAiSummaryStatus(error.message, 'error');
        showStatusMessage(error.message, 'error');
        return;
    }

    const prompt = buildPrompt(values);
    const resultArea = document.getElementById('aiSummaryResult');

    setButtonLoading('runAiSummaryBtn', true, 'AI 分析中...');
    setAiSummaryStatus('正在请求 AI 服务，请稍候...', 'info');

    try {
        const result = await requestAiAnalysis(prompt, values.model);
        if (resultArea) {
            resultArea.value = result;
        }
        const preview = document.getElementById('aiSummaryPromptPreview');
        if (preview && !preview.value) {
            preview.value = prompt;
        }
        setAiSummaryStatus('AI 分析完成', 'success');

        saveHistoryEntry({
            ...values,
            prompt,
            result,
            timestamp: Date.now()
        });
        renderHistory();
    } catch (error) {
        setAiSummaryStatus(error.message, 'error');
        showStatusMessage(error.message, 'error');
    } finally {
        setButtonLoading('runAiSummaryBtn', false, 'AI 分析');
    }
}

async function requestAiAnalysis(prompt, model) {
    const config = await getStorageValue('aiConfig') || {};
    const poeToken = getLocalStorage('poeToken', config.token || '');

    if (!poeToken) {
        throw new Error('请在设置中配置 Poe 密钥');
    }

    const response = await fetch(POE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${poeToken}`
        },
        body: JSON.stringify({
            model: model || config.model || 'default',
            messages: [
                { role: 'system', content: '你是一个专业的日志分析与根因定位助手，请输出 Markdown 报告。' },
                { role: 'user', content: prompt }
            ],
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`Poe 接口请求失败: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices && data.choices[0];
    const markdown = choice?.message?.content || data.output || data.result || '';
    return markdown || JSON.stringify(data, null, 2);
}

function populateModelSelector() {
    const selector = document.getElementById('aiSummaryModelSelector');
    if (!selector) return;

    const storedModels = getLocalStorage('poeModels', []);
    const defaultModel = getLocalStorage('poeDefaultModel', '') || storedModels[0] || '';

    if (storedModels.length === 0) {
        selector.innerHTML = '<option value="">请先在设置中添加模型</option>';
        return;
    }

    selector.innerHTML = storedModels.map(model => `
        <option value="${model}">${model}</option>
    `).join('');

    if (defaultModel) {
        selector.value = defaultModel;
    }
}

function saveHistoryEntry(entry) {
    const history = getLocalStorage('aiSummaryHistory', []);
    history.unshift(entry);
    setLocalStorage('aiSummaryHistory', history.slice(0, 50));
}

function renderHistory() {
    const container = document.getElementById('aiSummaryHistory');
    if (!container) return;

    const history = getLocalStorage('aiSummaryHistory', []);
    if (history.length === 0) {
        container.innerHTML = '<div class="helper-text">暂无历史记录</div>';
        return;
    }

    container.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        return `
            <div class="history-item">
                <div class="history-meta">
                    <span>${date.toLocaleString()}</span>
                    <span>模式: ${item.mode === 'report' ? '报告梳理' : '分析'} | 模型: ${item.model}</span>
                </div>
                <div class="history-preview">${item.result.slice(0, 120)}${item.result.length > 120 ? '...' : ''}</div>
            </div>
        `;
    }).join('');
}

function clearAiHistory() {
    setLocalStorage('aiSummaryHistory', []);
    renderHistory();
    setAiSummaryStatus('历史记录已清空', 'info');
}

function exportAiMarkdown() {
    const resultArea = document.getElementById('aiSummaryResult');
    if (!resultArea || !resultArea.value.trim()) {
        showStatusMessage('暂无可导出的 AI 报告', 'info');
        return;
    }

    const blob = new Blob([resultArea.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `ai-summary-${timestamp}.md`;
    link.click();
    URL.revokeObjectURL(url);
}
