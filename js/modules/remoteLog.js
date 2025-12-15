/**
 * 远程日志获取模块
 * 处理从远程服务器获取日志
 */

import { state } from '../core/state.js';
import { SimpleTarReader, extractTimeRangeFromTarEntry } from '../utils/parser.js';
import { getStorageValue, getLocalStorage, setLocalStorage } from '../utils/storage.js';
import { formatFileSize } from '../utils/format.js';
import { showStatusMessage, updateProgressBar, toggleElement } from '../utils/ui.js';
import { updateOverallTimeRange } from './fileManager.js';

/**
 * 初始化远程日志模块
 */
export function initRemoteLog() {
    const fetchBtn = document.getElementById('fetchBtn');
    if (fetchBtn) {
        fetchBtn.addEventListener('click', fetchRemoteLogs);
    }

    // 恢复上次使用的服务器地址
    const lastServer = getLocalStorage('lastServerAddress');
    if (lastServer) {
        const serverInput = document.getElementById('serverAddress');
        if (serverInput) {
            serverInput.value = lastServer;
        }
    }
}

/**
 * 获取远程日志
 */
export async function fetchRemoteLogs() {
    const serverAddress = document.getElementById('serverAddress').value.trim();
    const beginDate = document.getElementById('beginDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!serverAddress || !beginDate || !endDate) {
        showStatusMessage('请填写完整的服务器地址和时间范围', 'error');
        return;
    }

    const fetchBtn = document.getElementById('fetchBtn');
    const progressDiv = document.getElementById('fetchProgress');

    try {
        fetchBtn.disabled = true;
        toggleElement('fetchProgress', true);

        updateProgressBar('progressBar', 'progressText', 20, '正在请求远程日志...');

        const token = await getStorageValue('apiToken');

        // 阶段一：准备日志 - 使用POST请求，参数在URL上
        const prepareUrl = `http://${serverAddress}/api/v4/system-logs/prepare?date=&beginDate=${new Date(beginDate).toISOString()}&endDate=${new Date(endDate).toISOString()}`;

        const prepareResponse = await fetch(prepareUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token || 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTc1NTc1MDI2NywiYXVkIjoidXNlciIsImV4cCI6MTc1NTgzNjY2N30.VfJsLUSNrgXTtXVjdzHc8fmuqYv-7sn64IR9rNovW-oVGTz5WLhWj68JzpU-QoOnHSueFdvAOIinR0B7WqFiRA'}`
            }
        });

        if (!prepareResponse.ok) {
            throw new Error(`准备日志失败: ${prepareResponse.status}`);
        }

        const prepareData = await prepareResponse.json();

        if (prepareData.code !== "0") {
            throw new Error(prepareData.message || '准备日志失败');
        }

        const filePath = prepareData.data.filePath;

        updateProgressBar('progressBar', 'progressText', 40, '正在下载日志文件...');

        // 阶段二：下载日志
        const downloadUrl = `http://${serverAddress}/api/v4/system-logs/download/${filePath}`;

        const downloadResponse = await fetch(downloadUrl, {
            headers: {
                'Authorization': `Bearer ${token || 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTc1NTc1MDI2NywiYXVkIjoidXNlciIsImV4cCI6MTc1NTgzNjY2N30.VfJsLUSNrgXTtXVjdzHc8fmuqYv-7sn64IR9rNovW-oVGTz5WLhWj68JzpU-QoOnHSueFdvAOIinR0B7WqFiRA'}`
            }
        });

        if (!downloadResponse.ok) {
            throw new Error(`下载日志失败: ${downloadResponse.status}`);
        }

        updateProgressBar('progressBar', 'progressText', 60, '正在处理tar包...');

        // 处理返回的tar数据
        const arrayBuffer = await downloadResponse.arrayBuffer();
        // 在加载新数据前释放旧的远程日志引用，避免占用内存
        if (state.remoteLogData && state.remoteLogData.subFiles) {
            state.remoteLogData.subFiles = [];
        }

        state.remoteLogData = await processRemoteTarData(arrayBuffer, filePath);

        updateProgressBar('progressBar', 'progressText', 100, '远程日志获取完成！');

        updateOverallTimeRange();
        setLocalStorage('lastServerAddress', serverAddress);

        // 显示加载的文件列表和时间段
        showRemoteLogsSummary(state.remoteLogData, beginDate, endDate);

        showStatusMessage('远程日志获取成功', 'success');

    } catch (error) {
        console.error('获取远程日志时出错:', error);
        showStatusMessage(`获取远程日志失败: ${error.message}`, 'error');
    } finally {
        fetchBtn.disabled = false;
        setTimeout(() => {
            toggleElement('fetchProgress', false);
        }, 3000);
    }
}

/**
 * 处理远程tar数据
 */
async function processRemoteTarData(arrayBuffer, fileName) {
    const tarReader = new SimpleTarReader(arrayBuffer);
    const entries = await tarReader.extractFiles();

    let overallStart = null;
    let overallEnd = null;
    const subFiles = [];

    for (const entry of entries) {
        if (entry.name.endsWith('.gz') || entry.name.endsWith('.log')) {
            try {
                const timeRange = await extractTimeRangeFromTarEntry(entry);

                subFiles.push({
                    name: entry.name,
                    size: entry.size,
                    timeRange: timeRange,
                    data: entry.buffer
                });

                if (!overallStart || timeRange.start < overallStart) {
                    overallStart = timeRange.start;
                }
                if (!overallEnd || timeRange.end > overallEnd) {
                    overallEnd = timeRange.end;
                }
            } catch (error) {
                console.warn(`处理远程tar子文件 ${entry.name} 时出错:`, error);
            }
        }
    }

    return {
        fileName: fileName,
        timeRange: overallStart && overallEnd ? { start: overallStart, end: overallEnd } : null,
        subFiles: subFiles
    };
}

/**
 * 显示远程日志摘要信息
 */
function showRemoteLogsSummary(logData, beginDate, endDate) {
    console.log('remoteLogData结构:', logData);

    // 创建或获取摘要容器
    let summaryContainer = document.getElementById('remoteLogsSummary');
    if (!summaryContainer) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = 'remoteLogsSummary';
        summaryContainer.className = 'remote-logs-summary';
        // 插入到进度条下方
        const progressDiv = document.getElementById('fetchProgress');
        progressDiv.parentNode.insertBefore(summaryContainer, progressDiv.nextSibling);
    }

    if (!logData || typeof logData !== 'object') {
        summaryContainer.innerHTML = '<div class="error">日志数据格式错误</div>';
        summaryContainer.style.display = 'block';
        return;
    }

    // logData 现在是单个对象，包含 fileName, timeRange, subFiles
    const mainFileName = logData.fileName || '未知文件';
    const mainTimeRange = logData.timeRange;
    const subFiles = logData.subFiles || [];

    let totalSize = 0;
    let subFileListHtml = '';

    // 处理子文件列表
    subFiles.forEach((subFile, index) => {
        const sizeText = subFile.size ? `${(subFile.size / 1024 / 1024).toFixed(2)} MB` : '未知大小';
        totalSize += subFile.size || 0;

        let timeRangeText = '时间范围未知';
        if (subFile.timeRange && subFile.timeRange.start && subFile.timeRange.end) {
            timeRangeText = `${subFile.timeRange.start} ~ ${subFile.timeRange.end}`;
        }

        // 使用树形结构符号
        const isLast = index === subFiles.length - 1;
        const treeSymbol = isLast ? '└─' : '├─';
        const lineSymbol = isLast ? '&nbsp;&nbsp;&nbsp;' : '│&nbsp;&nbsp;';

        subFileListHtml += `
            <div class="sub-file">
                &nbsp;&nbsp;${treeSymbol} 📄 <strong>${subFile.name}</strong>
                <div class="sub-file-details">
                    &nbsp;&nbsp;${lineSymbol}&nbsp;💾 大小: ${sizeText}
                    <br>&nbsp;&nbsp;${lineSymbol}&nbsp;⏰ 时间: ${timeRangeText}
                </div>
            </div>
        `;
    });

    const html = `
        <div class="summary-header">
            <h4>🗂️ 远程日志加载摘要</h4>
        </div>
        <div class="summary-info">
            <div class="info-row">
                <span class="info-label">📅 请求时间范围:</span>
                <span class="info-value">${beginDate} 至 ${endDate}</span>
            </div>
            ${mainTimeRange && mainTimeRange.start && mainTimeRange.end ? `
                <div class="info-row actual-range">
                    <span class="info-label">📋 实际日志范围:</span>
                    <span class="info-value">${mainTimeRange.start} 至 ${mainTimeRange.end}</span>
                </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">📄 子文件数量:</span>
                <span class="info-value">${subFiles.length} 个</span>
            </div>
            <div class="info-row">
                <span class="info-label">💾 总文件大小:</span>
                <span class="info-value">${(totalSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
        </div>
        <div class="file-list">
            <div class="main-file">
                📁 <strong>主文件: ${mainFileName}</strong>
                ${mainTimeRange && mainTimeRange.start && mainTimeRange.end ?
                    `<br>&nbsp;&nbsp;&nbsp;<span class="main-time-range">时间范围: ${mainTimeRange.start} ~ ${mainTimeRange.end}</span>` :
                    ''
                }
            </div>
            <div class="sub-files-container">
                ${subFileListHtml || '<div class="no-files">&nbsp;&nbsp;无子文件</div>'}
            </div>
        </div>
    `;

    summaryContainer.innerHTML = html;
    summaryContainer.style.display = 'block';
}
