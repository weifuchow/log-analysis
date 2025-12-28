/**
 * 文件管理模块
 * 处理文件上传、TAR解压、时间范围提取等
 */

import { state } from '../core/state.js';
import { FILE_STATUS } from '../core/constants.js';
import {
    SimpleTarReader,
    extractTimeRangeFromContent,
    decompressGzipFile,
    extractTimeRangeFromTarEntry,
    decompressZstdFile
} from '../utils/parser.js';
import { formatFileSize, getStatusText, formatDateForInput } from '../utils/format.js';
import { showStatusMessage } from '../utils/ui.js';

/**
 * 初始化文件管理器
 */
export function initFileManager() {
    setupFileUploadListeners();
}

/**
 * 设置文件上传相关的事件监听器
 */
function setupFileUploadListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    if (!fileInput || !uploadArea) return;

    fileInput.addEventListener('change', handleFileSelect);

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFileSelect({ target: { files: e.dataTransfer.files } });
    });
}

/**
 * 处理文件选择
 */
function handleFileSelect(event) {
    console.log('处理文件选择');
    const files = Array.from(event.target.files);
    files.forEach(file => {
        console.log('添加文件:', file.name);
        addFileToList(file);
        preprocessFile(file);
    });
}

/**
 * 添加文件到列表
 */
export function addFileToList(file) {
    if (state.fileList.find(f => f.name === file.name && f.size === file.size)) {
        showStatusMessage(`文件 ${file.name} 已存在`, 'info');
        return;
    }

    const fileInfo = {
        file: file,
        name: file.name,
        size: file.size,
        status: FILE_STATUS.PROCESSING,
        timeRange: null,
        subFiles: [] // 用于tar包中的子文件
    };

    state.fileList.push(fileInfo);
    updateFileListDisplay();
    showStatusMessage(`文件 ${file.name} 已添加，正在预处理...`, 'info');
}

/**
 * 预处理文件
 */
async function preprocessFile(file) {
    console.log('预处理文件:', file.name);
    const fileInfo = state.fileList.find(f => f.file === file);
    if (!fileInfo) return;

    try {
        fileInfo.status = FILE_STATUS.PROCESSING;
        updateFileListDisplay();

        if (file.name.endsWith('.tar.zst')) {
            console.log('处理tar.zst文件');
            const arrayBuffer = await file.arrayBuffer();
            const decompressedTar = await decompressZstdFile(new Uint8Array(arrayBuffer), file.name);
            await processTarBuffer(decompressedTar, fileInfo, file.name);
        } else if (file.name.endsWith('.tar')) {
            console.log('处理tar文件');
            const arrayBuffer = await file.arrayBuffer();
            await processTarBuffer(new Uint8Array(arrayBuffer), fileInfo, file.name);
        } else {
            console.log('处理普通文件');
            const timeRange = await extractTimeRangeFromFile(file);
            fileInfo.timeRange = timeRange;
        }

        fileInfo.status = FILE_STATUS.READY;
        updateOverallTimeRange();
        updateFileListDisplay();

        showStatusMessage(`文件 ${file.name} 预处理完成`, 'success');

    } catch (error) {
        console.error(`预处理文件 ${file.name} 时出错:`, error);
        fileInfo.status = FILE_STATUS.ERROR;
        updateFileListDisplay();
        showStatusMessage(`预处理文件 ${file.name} 失败: ${error.message}`, 'error');
    }
}

/**
 * 处理TAR文件
 */
async function processTarBuffer(buffer, fileInfo, sourceName) {
    console.log('处理TAR包:', sourceName);

    try {
        const tarReader = new SimpleTarReader(buffer);
        const entries = await tarReader.extractFiles();

        console.log('TAR中找到的文件数量:', entries.length);

        let overallStart = null;
        let overallEnd = null;

        for (const entry of entries) {
            console.log('处理TAR条目:', entry.name, '大小:', entry.size);

            if (!entry.name.toLowerCase().includes('log')) {
                continue;
            }

            if (entry.name.endsWith('.gz') || entry.name.endsWith('.log') || entry.name.endsWith('.zst')) {
                try {
                    // 获取文件时间范围
                    const timeRange = await extractTimeRangeFromTarEntry(entry, { fileName: entry.name });

                    const subFileInfo = {
                        name: entry.name,
                        size: entry.size,
                        timeRange: timeRange,
                        data: entry.buffer
                    };

                    fileInfo.subFiles.push(subFileInfo);

                    if (!overallStart || timeRange.start < overallStart) {
                        overallStart = timeRange.start;
                    }
                    if (!overallEnd || timeRange.end > overallEnd) {
                        overallEnd = timeRange.end;
                    }

                    console.log('子文件时间范围:', entry.name, timeRange);
                } catch (error) {
                    console.warn(`处理tar子文件 ${entry.name} 时出错:`, error);
                }
            }
        }

        if (overallStart && overallEnd) {
            fileInfo.timeRange = { start: overallStart, end: overallEnd };
            console.log('TAR整体时间范围:', fileInfo.timeRange);
        }
    } catch (error) {
        console.error('处理TAR文件失败:', error);
        throw error;
    }
}

/**
 * 从文件中提取时间范围
 */
async function extractTimeRangeFromFile(file) {
    console.log('提取文件时间范围:', file.name);

    try {
        let content;

        if (file.name.endsWith('.gz')) {
            const arrayBuffer = await file.arrayBuffer();
            const compressed = new Uint8Array(arrayBuffer);
            content = await decompressGzipFile(compressed, file.name);
        } else if (file.name.endsWith('.zst')) {
            const arrayBuffer = await file.arrayBuffer();
            const decompressed = await decompressZstdFile(new Uint8Array(arrayBuffer), file.name);
            const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
            content = decoder.decode(decompressed);
        } else {
            content = await file.text();
        }

        return extractTimeRangeFromContent(content, { fileName: file.name });
    } catch (error) {
        console.error('提取时间范围失败:', error);
        throw new Error(`解析时间范围失败: ${error.message}`);
    }
}

/**
 * 更新文件列表显示
 */
export function updateFileListDisplay() {
    const fileListContainer = document.getElementById('fileList');
    if (!fileListContainer) return;

    fileListContainer.innerHTML = state.fileList.map((fileInfo, index) => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-name">${fileInfo.name}</div>
                <div class="file-size">${formatFileSize(fileInfo.size)}</div>
                <div class="file-status ${fileInfo.status}">
                    ${getStatusText(fileInfo.status)}
                </div>
                ${fileInfo.timeRange ? `
                    <div class="file-time-range">
                        ${fileInfo.timeRange.start.toLocaleString()} ~ ${fileInfo.timeRange.end.toLocaleString()}
                    </div>
                ` : ''}
                ${fileInfo.subFiles.length > 0 ? `
                    <div class="sub-files">
                        ${fileInfo.subFiles.map(subFile => `
                            <div class="sub-file-item">
                                <div class="file-name">${subFile.name}</div>
                                <div class="file-size">${formatFileSize(subFile.size)}</div>
                                ${subFile.timeRange ? `
                                    <div class="file-time-range">
                                        ${subFile.timeRange.start.toLocaleString()} ~ ${subFile.timeRange.end.toLocaleString()}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <button class="remove-btn" data-file-index="${index}">删除</button>
        </div>
    `).join('');

    // 为删除按钮添加事件监听器
    fileListContainer.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.fileIndex);
            removeFile(index);
        });
    });
}

/**
 * 移除文件
 */
export function removeFile(index) {
    const fileInfo = state.fileList[index];
    if (fileInfo) {
        // 释放可能占用大量内存的引用
        fileInfo.file = null;
        fileInfo.subFiles = [];
    }

    state.fileList.splice(index, 1);
    updateFileListDisplay();
    updateOverallTimeRange();
    showStatusMessage(`文件 ${fileInfo.name} 已移除`, 'info');
}

/**
 * 更新整体时间范围
 */
export function updateOverallTimeRange() {
    const readyFiles = state.fileList.filter(f => f.status === FILE_STATUS.READY && f.timeRange);

    if (readyFiles.length === 0 && (!state.remoteLogData || !state.remoteLogData.timeRange)) {
        state.overallTimeRange = null;
        return;
    }

    let minStart = null;
    let maxEnd = null;

    readyFiles.forEach(fileInfo => {
        const { start, end } = fileInfo.timeRange;
        if (!minStart || start < minStart) minStart = start;
        if (!maxEnd || end > maxEnd) maxEnd = end;
    });

    // 包含远程日志的时间范围
    if (state.remoteLogData && state.remoteLogData.timeRange) {
        const { start, end } = state.remoteLogData.timeRange;
        if (!minStart || start < minStart) minStart = start;
        if (!maxEnd || end > maxEnd) maxEnd = end;
    }

    if (minStart && maxEnd) {
        state.overallTimeRange = { start: minStart, end: maxEnd };

        // 自动设置搜索时间范围为文件的时间范围
        const searchBeginDate = document.getElementById('searchBeginDate');
        const searchEndDate = document.getElementById('searchEndDate');

        if (searchBeginDate && searchEndDate) {
            searchBeginDate.value = formatDateForInput(minStart);
            searchEndDate.value = formatDateForInput(maxEnd);
        }
    }
}

/**
 * 设置搜索时间范围
 */
export function setSearchTimeRange(type) {
    if (!state.overallTimeRange) {
        showStatusMessage('请先加载日志文件', 'info');
        return;
    }

    let beginDate, endDate;
    const fileEnd = state.overallTimeRange.end;

    switch (type) {
        case 'all':
            beginDate = state.overallTimeRange.start;
            endDate = state.overallTimeRange.end;
            break;
        case 'last1h':
            endDate = fileEnd;
            beginDate = new Date(fileEnd.getTime() - 60 * 60 * 1000);
            break;
        case 'last6h':
            endDate = fileEnd;
            beginDate = new Date(fileEnd.getTime() - 6 * 60 * 60 * 1000);
            break;
        case 'last24h':
            endDate = fileEnd;
            beginDate = new Date(fileEnd.getTime() - 24 * 60 * 60 * 1000);
            break;
        default:
            return;
    }

    // 确保时间范围不超出文件范围
    if (beginDate < state.overallTimeRange.start) beginDate = state.overallTimeRange.start;
    if (endDate > state.overallTimeRange.end) endDate = state.overallTimeRange.end;

    const searchBeginDate = document.getElementById('searchBeginDate');
    const searchEndDate = document.getElementById('searchEndDate');

    if (searchBeginDate && searchEndDate) {
        import('../utils/format.js').then(({ formatDateForInput }) => {
            searchBeginDate.value = formatDateForInput(beginDate);
            searchEndDate.value = formatDateForInput(endDate);
        });
    }

    showStatusMessage(`已设置时间范围: ${type}`, 'success');
}
