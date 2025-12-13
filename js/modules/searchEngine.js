/**
 * 搜索引擎模块
 * 处理日志搜索、结果显示和导出
 */

import { state } from '../core/state.js';
import { SEARCH_CONFIG, FILE_STATUS } from '../core/constants.js';
import { decompressGzipFile, extractFromZipBuffer, extractTimestamp } from '../utils/parser.js';
import { highlightKeywords } from '../utils/format.js';
import { showStatusMessage, setButtonLoading } from '../utils/ui.js';

/**
 * 初始化搜索引擎
 */
export function initSearchEngine() {
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
}

/**
 * 执行搜索
 */
export async function performSearch() {
    if (state.isSearching) {
        showStatusMessage('搜索正在进行中，请稍候...', 'info');
        return;
    }

    const keywords = document.getElementById('keywords').value.trim().split('\n').filter(k => k.trim());
    const logic = document.querySelector('input[name="logic"]:checked').value;
    const beginDate = document.getElementById('searchBeginDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    if (keywords.length === 0) {
        showStatusMessage('请输入搜索关键词', 'error');
        return;
    }

    const readyFiles = state.fileList.filter(f => f.status === FILE_STATUS.READY);
    if (readyFiles.length === 0 && !state.remoteLogData) {
        showStatusMessage('请先上传日志文件或获取远程日志', 'error');
        return;
    }

    const resultsContainer = document.getElementById('searchResults');
    const countSpan = document.getElementById('resultCount');

    try {
        state.isSearching = true;
        setButtonLoading('searchBtn', true, '搜索中...');

        showStatusMessage('开始搜索，正在处理文件...', 'info');

        state.searchResults = [];
        let isResultLimitReached = false;

        countSpan.textContent = '搜索中...';
        resultsContainer.innerHTML = `
            <div id="realTimeResults"></div>
            <div id="searchProgress" style="padding: 2rem; text-align: center; color: #7f8c8d;">
                <div class="loading"></div>
                <div style="margin-top: 1rem;">正在搜索日志...</div>
            </div>
        `;

        const beginTime = beginDate ? new Date(beginDate) : null;
        const endTime = endDate ? new Date(endDate) : null;

        // 准备所有搜索任务
        const searchTasks = buildSearchTasks(readyFiles);

        // 启动多线程搜索
        const searchParams = { keywords, logic, beginTime, endTime };
        await performMultiThreadSearch(searchTasks, searchParams, SEARCH_CONFIG.MAX_RESULTS, (results, finished) => {
            if (results.length + state.searchResults.length > SEARCH_CONFIG.MAX_RESULTS) {
                isResultLimitReached = true;
                const allowedResults = results.slice(0, SEARCH_CONFIG.MAX_RESULTS - state.searchResults.length);
                state.searchResults.push(...allowedResults);
                updateRealTimeResults(keywords);
                return true; // 停止搜索
            }

            state.searchResults.push(...results);
            updateRealTimeResults(keywords);
            return false; // 继续搜索
        });

        // 移除搜索进度显示
        const progressDiv = document.getElementById('searchProgress');
        if (progressDiv) {
            progressDiv.remove();
        }

        // 最终显示完整结果
        displaySearchResults(keywords);

        if (isResultLimitReached) {
            showStatusMessage(`搜索完成，已达到最大结果数限制 ${SEARCH_CONFIG.MAX_RESULTS} 条，请使用更精确的关键词`, 'warning');
        } else {
            showStatusMessage(`搜索完成，找到 ${state.searchResults.length} 条匹配的日志`, 'success');
        }

    } catch (error) {
        console.error('搜索时出错:', error);
        showStatusMessage(`搜索失败: ${error.message}`, 'error');
    } finally {
        state.isSearching = false;
        setButtonLoading('searchBtn', false);
    }
}

/**
 * 构建搜索任务列表
 */
function buildSearchTasks(readyFiles) {
    const searchTasks = [];

    // 本地文件任务
    for (const fileInfo of readyFiles) {
        if (fileInfo.subFiles.length > 0) {
            // tar包中的子文件
            for (const subFile of fileInfo.subFiles) {
                searchTasks.push({
                    type: 'subFile',
                    data: subFile,
                    source: subFile.name
                });
            }
        } else {
            // 单个文件
            searchTasks.push({
                type: 'file',
                data: fileInfo.file,
                source: fileInfo.file.name
            });
        }
    }

    // 远程日志任务
    if (state.remoteLogData && state.remoteLogData.subFiles) {
        for (const subFile of state.remoteLogData.subFiles) {
            searchTasks.push({
                type: 'subFile',
                data: subFile,
                source: subFile.name
            });
        }
    }

    return searchTasks;
}

/**
 * 多线程搜索实现
 */
async function performMultiThreadSearch(searchTasks, searchParams, maxResults, onResultsCallback) {
    const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, searchTasks.length, 8);
    const taskQueue = [...searchTasks];
    let completedTasks = 0;
    let shouldStop = false;

    return new Promise((resolve) => {
        async function processInMainThread() {
            const batchSize = Math.ceil(taskQueue.length / maxWorkers);
            const batches = [];

            for (let i = 0; i < taskQueue.length; i += batchSize) {
                batches.push(taskQueue.slice(i, i + batchSize));
            }

            const processingPromises = batches.map(async (batch) => {
                for (const task of batch) {
                    if (shouldStop) break;

                    try {
                        const preprocessedTask = await preprocessTask(task);
                        if (!preprocessedTask) continue;

                        const results = await processTaskInMainThread(preprocessedTask, searchParams);

                        if (results.length > 0) {
                            const shouldStopSearch = onResultsCallback(results, false);
                            if (shouldStopSearch) {
                                shouldStop = true;
                                break;
                            }
                        }

                        completedTasks++;

                        // 每处理几个任务暂停一下，避免阻塞UI
                        if (completedTasks % SEARCH_CONFIG.BATCH_SIZE === 0) {
                            await new Promise(resolve => setTimeout(resolve, SEARCH_CONFIG.BATCH_DELAY));
                        }

                    } catch (error) {
                        console.error('处理任务失败:', error);
                    }
                }
            });

            await Promise.all(processingPromises);
            resolve();
        }

        processInMainThread();
    });
}

/**
 * 预处理任务（解压.gz文件）
 */
async function preprocessTask(task) {
    if (task.type === 'file' && task.data.name.endsWith('.gz')) {
        try {
            const arrayBuffer = await task.data.arrayBuffer();
            const compressed = new Uint8Array(arrayBuffer);
            const content = await decompressGzipFile(compressed, task.data.name);

            if (!content || content.length === 0) {
                throw new Error(`文件 ${task.data.name} 解压后内容为空`);
            }

            console.log(`文件 ${task.data.name} 解压成功，内容长度:`, content.length);

            return {
                type: 'preprocessed',
                data: { content: content },
                source: task.source
            };

        } catch (error) {
            console.error(`预处理文件失败 ${task.source}:`, error);
            return null;
        }
    }
    return task;
}

/**
 * 在主线程中处理单个任务
 */
async function processTaskInMainThread(task, searchParams) {
    const { keywords, logic, beginTime, endTime } = searchParams;
    const results = [];

    let content;

    try {
        if (task.type === 'file') {
            if (task.data.name.endsWith('.gz')) {
                const arrayBuffer = await task.data.arrayBuffer();
                const compressed = new Uint8Array(arrayBuffer);
                content = await decompressGzipFile(compressed, task.data.name);
            } else {
                content = await task.data.text();
            }
        } else if (task.type === 'subFile') {
            if (task.data.name.endsWith('.gz')) {
                content = await decompressGzipFile(task.data.data, task.data.name);
            } else {
                const decoder = new TextDecoder('utf-8', { fatal: false });
                content = decoder.decode(task.data.data);
            }
        } else if (task.type === 'preprocessed') {
            content = task.data.content;
        }

        if (!content || content.length === 0) {
            console.warn('任务内容为空:', task.source);
            return results;
        }

        console.log(`任务 ${task.source} 内容解析成功，长度:`, content.length);

    } catch (error) {
        console.error(`处理任务 ${task.source} 时出错:`, error);
        return results;
    }

    // 解析日志内容
    const lines = content.split('\n');
    const timestampRegex = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}/;
    let currentLog = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (timestampRegex.test(line)) {
            if (currentLog) {
                const shouldAdd = checkLogMatch(currentLog, keywords, logic, beginTime, endTime);
                if (shouldAdd) {
                    results.push(currentLog);
                    if (results.length >= 20000) break;
                }
            }

            currentLog = {
                timestamp: extractTimestamp(line),
                content: line,
                source: task.source,
                id: `${task.source}-${Date.now()}-${Math.random()}`
            };
        } else if (currentLog) {
            currentLog.content += '\n' + line;
        }

        if (i % SEARCH_CONFIG.YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, SEARCH_CONFIG.YIELD_DELAY));
        }
    }

    if (currentLog) {
        const shouldAdd = checkLogMatch(currentLog, keywords, logic, beginTime, endTime);
        if (shouldAdd) {
            results.push(currentLog);
        }
    }

    console.log(`任务 ${task.source} 处理完成，找到 ${results.length} 条匹配日志`);

    return results;
}

/**
 * 检查日志是否匹配
 */
function checkLogMatch(log, keywords, logic, beginTime, endTime) {
    if (beginTime && log.timestamp < beginTime) return false;
    if (endTime && log.timestamp > endTime) return false;

    const content = log.content.toLowerCase();
    const matches = keywords.map(keyword =>
        content.includes(keyword.toLowerCase())
    );

    return logic === 'and' ? matches.every(m => m) : matches.some(m => m);
}

/**
 * 实时更新搜索结果显示
 */
function updateRealTimeResults(keywords) {
    const realTimeContainer = document.getElementById('realTimeResults');
    const countSpan = document.getElementById('resultCount');

    if (!realTimeContainer) return;

    countSpan.textContent = `${state.searchResults.length} 条结果`;

    // 按时间排序最新的结果
    const sortedResults = [...state.searchResults].sort((a, b) => a.timestamp - b.timestamp);

    // 只显示最新的100条结果，避免DOM过大
    const displayResults = sortedResults.slice(-SEARCH_CONFIG.REALTIME_DISPLAY_LIMIT);

    realTimeContainer.innerHTML = displayResults.map((log) => `
        <div class="log-item">
            <div class="log-header">
                <div>
                    <div class="log-timestamp">${log.timestamp.toLocaleString()}</div>
                    <div class="log-source">${log.source}</div>
                </div>
                <button class="mark-btn" data-log-id="${log.id}">标记</button>
            </div>
            <div class="log-content">${highlightKeywords(log.content, keywords)}</div>
        </div>
    `).join('');

    // 为新添加的标记按钮添加事件监听器
    realTimeContainer.querySelectorAll('.mark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const logId = this.dataset.logId;
            const log = state.searchResults.find(l => l.id === logId);
            if (log) {
                // 动态导入workspace模块以避免循环依赖
                import('./workspace.js').then(({ markLogById }) => {
                    markLogById(log);
                });
            }
        });
    });

    // 滚动到底部显示最新结果
    realTimeContainer.scrollTop = realTimeContainer.scrollHeight;
}

/**
 * 最终显示搜索结果
 */
export function displaySearchResults(keywords = null) {
    const container = document.getElementById('searchResults');
    const countSpan = document.getElementById('resultCount');

    if (!container) return;

    countSpan.textContent = `${state.searchResults.length} 条结果`;

    if (state.searchResults.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #7f8c8d;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <div>未找到匹配的日志</div>
            </div>
        `;
        return;
    }

    // 如果没有传入keywords，尝试从输入框获取
    if (!keywords) {
        keywords = document.getElementById('keywords').value.trim().split('\n').filter(k => k.trim());
    }

    // 按时间排序
    const sortedResults = [...state.searchResults].sort((a, b) => a.timestamp - b.timestamp);

    container.innerHTML = `
        <div class="search-results-header">
            <div>显示所有 ${sortedResults.length} 条结果</div>
            <div class="search-results-actions">
                <button id="exportSearchResultsBtn" class="btn btn-secondary">导出结果</button>
            </div>
        </div>
        <div class="search-results-content">
            ${sortedResults.map((log) => `
                <div class="log-item">
                    <div class="log-header">
                        <div>
                            <div class="log-timestamp">${log.timestamp.toLocaleString()}</div>
                            <div class="log-source">${log.source}</div>
                        </div>
                        <button class="mark-btn" data-log-id="${log.id}">标记</button>
                    </div>
                    <div class="log-content">${highlightKeywords(log.content, keywords)}</div>
                </div>
            `).join('')}
        </div>
    `;

    // 为标记按钮添加事件监听器
    container.querySelectorAll('.mark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const logId = this.dataset.logId;
            const log = state.searchResults.find(l => l.id === logId);
            if (log) {
                import('./workspace.js').then(({ markLogById }) => {
                    markLogById(log);
                });
            }
        });
    });

    // 为导出按钮添加事件监听器
    const exportBtn = document.getElementById('exportSearchResultsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSearchResults);
    }
}

/**
 * 导出搜索结果
 */
export function exportSearchResults() {
    if (state.searchResults.length === 0) {
        showStatusMessage('没有搜索结果可导出', 'info');
        return;
    }

    const content = state.searchResults
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(log => `${log.timestamp.toLocaleString()}\n${log.content}\n${'='.repeat(80)}\n`)
        .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `搜索结果_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showStatusMessage('搜索结果已导出', 'success');
}

/**
 * 清空搜索
 */
export function clearSearch() {
    document.getElementById('keywords').value = '';
    document.querySelectorAll('.template-btn').forEach(btn => btn.classList.remove('active'));
    state.searchResults = [];
    displaySearchResults();
    showStatusMessage('搜索条件已清空', 'info');
}
