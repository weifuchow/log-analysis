let fileList = [];
let remoteLogData = null;
let searchResults = [];
let workspace = [];
let isSearching = false;
let overallTimeRange = null;
let tagColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
let nextTagColorIndex = 0;
let currentTemplate = null;

// 预设模板定义
const PRESET_TEMPLATES = {
    communication: {
        name: '设备通讯',
        keywords: ['communication', '${设备名称}'],
        logic: 'and',
        variables: ['设备名称']
    },
    'status-request': {
        name: '设备状态请求队列',
        keywords: ['GlobalRequestHandler', '${设备名称}'],
        logic: 'and',
        variables: ['设备名称']
    },
    'order-assign': {
        name: '订单分配',
        keywords: ['AssignFreeTasksPhase'],
        logic: 'and',
        variables: []
    },
    'path-planning': {
        name: '车辆路径规划',
        keywords: [
            'VehicleTaskManager line:193 - ${车辆名称}',
            'MoveRequest line:63  - ${车辆名称}',
            'MoveRequest line:70  - ${车辆名称}',
            'VehicleTaskManager line:217 - ${车辆名称}',
            'VehicleTaskManager line:92  - ${车辆名称}',
            'VehicleTaskManager line:104  - ${车辆名称}',
            'CompleteRoutePathBuilder line:100 - ${车辆名称}'
        ],
        logic: 'or',
        variables: ['车辆名称']
    },
    'traffic-control': {
        name: '交管申请与释放',
        keywords: [
            '${车辆名称}:交管申请成功反馈',
            '${车辆名称}: last node sequence id change',
            '${车辆名称}: 释放交管资源前的交管资源为',
            '${车辆名称}: 资源池真实删除的交管资源',
            '${车辆名称}: 释放交管资源后的交管资源为',
            '${车辆名称} release line step'
        ],
        logic: 'or',
        variables: ['车辆名称']
    },
    'order-execute': {
        name: '订单执行过程',
        keywords: [
            'task ${订单id}',
            'execute ${订单id}',
            'taskKey=\'${订单id}\'',
            'handle event ${订单id}',
            'task actuator after ${订单id}',
            'task actuator ${订单id}',
            'FSM ${订单id} event',
            '|${订单id}.',
            '订单为:${订单id}'
        ],
        logic: 'or',
        variables: ['订单id']
    },
    'elevator-state': {
        name: '电梯状态',
        keywords: [
            'ResourceDevice',
            '${电梯名称}'
        ],
        logic: 'and',
        variables: ['电梯名称']
    }
};

// 简化的TAR解析器（内置实现，不依赖外部库）
class SimpleTarReader {
    constructor(buffer) {
        this.buffer = new Uint8Array(buffer);
        this.offset = 0;
    }

    readString(length) {
        const bytes = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        
        // 找到第一个null字节的位置
        let nullIndex = bytes.indexOf(0);
        if (nullIndex === -1) nullIndex = bytes.length;
        
        return new TextDecoder().decode(bytes.slice(0, nullIndex));
    }

    readOctal(length) {
        const str = this.readString(length).trim();
        return str ? parseInt(str, 8) : 0;
    }

    async extractFiles() {
        const files = [];
        
        while (this.offset < this.buffer.length - 1024) {
            // 检查是否到达文件末尾（连续的零字节）
            if (this.buffer[this.offset] === 0) {
                // 检查接下来的512字节是否都是0
                let allZero = true;
                for (let i = 0; i < 512 && this.offset + i < this.buffer.length; i++) {
                    if (this.buffer[this.offset + i] !== 0) {
                        allZero = false;
                        break;
                    }
                }
                if (allZero) break;
            }

            const originalOffset = this.offset;
            
            try {
                // 读取TAR头部
                const name = this.readString(100);
                const mode = this.readString(8);
                const uid = this.readString(8);
                const gid = this.readString(8);
                const size = this.readOctal(12);
                const mtime = this.readString(12);
                const checksum = this.readString(8);
                const type = this.readString(1);
                
                // 跳过剩余的头部信息到512字节边界
                this.offset = originalOffset + 512;
                
                if (name && size >= 0 && (type === '0' || type === '' || type === '\0')) {
                    // 读取文件内容
                    if (this.offset + size <= this.buffer.length) {
                        const fileData = this.buffer.slice(this.offset, this.offset + size);
                        files.push({
                            name: name,
                            size: size,
                            buffer: fileData
                        });
                    }
                }
                
                // 跳到下一个512字节边界
                const paddedSize = Math.ceil(size / 512) * 512;
                this.offset += paddedSize;
                
            } catch (error) {
                console.warn('TAR解析错误:', error);
                break;
            }
        }
        
        return files;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，开始初始化...');
    initializeApp();
    setupEventListeners();
    loadSettings();
    loadWorkspace();
    loadTemplates();
    setupPresetTemplates();
});

function initializeApp() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    document.getElementById('beginDate').value = formatDateForInput(oneHourAgo);
    document.getElementById('endDate').value = formatDateForInput(now);
    document.getElementById('searchBeginDate').value = formatDateForInput(oneHourAgo);
    document.getElementById('searchEndDate').value = formatDateForInput(now);
    
    console.log('应用初始化完成');
}

function setupEventListeners() {
    console.log('设置事件监听器...');
    
    // 文件上传
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

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

    // 预设模板点击事件
    const presetTemplatesContainer = document.getElementById('presetTemplates');
    if (presetTemplatesContainer) {
        presetTemplatesContainer.addEventListener('click', function(e) {
            console.log('模板容器点击事件:', e.target);
            if (e.target.classList.contains('template-btn')) {
                handlePresetTemplateClick(e);
            }
        });
    }

    // 按钮事件监听器
    document.getElementById('fetchBtn').addEventListener('click', fetchRemoteLogs);
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('exportBtn').addEventListener('click', exportWorkspace);
    document.getElementById('clearWorkspaceBtn').addEventListener('click', clearWorkspace);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    document.getElementById('templateManagerBtn').addEventListener('click', showTemplateManager);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
    document.getElementById('applyTemplateBtn').addEventListener('click', applyTemplate);

    // 时间范围按钮
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
                closeModal(modalId);
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
    
    console.log('事件监听器设置完成');
}

// 预设模板设置
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

// 单独的模板点击处理函数
function templateClickHandler(e) {
    console.log('模板按钮被点击:', e.target.dataset.template);
    
    // 移除其他按钮的active状态
    document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    const templateKey = e.target.dataset.template;
    handleTemplateSelection(templateKey);
}

function handlePresetTemplateClick(e) {
    console.log('处理预设模板点击:', e.target);
    
    if (!e.target.classList.contains('template-btn')) {
        console.log('点击的不是模板按钮');
        return;
    }
    
    // 移除其他按钮的active状态
    document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    const templateKey = e.target.dataset.template;
    console.log('选中的模板:', templateKey);
    
    handleTemplateSelection(templateKey);
}

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
    currentTemplate = template;
    
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
    
    modal.style.display = 'block';
    console.log('变量模态框已显示');
}

function applyTemplate() {
    console.log('应用模板');
    
    if (!currentTemplate) {
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
    const missingVariables = currentTemplate.variables.filter(v => !variables[v]);
    if (missingVariables.length > 0) {
        showStatusMessage(`请填写所有变量: ${missingVariables.join(', ')}`, 'error');
        return;
    }
    
    // 替换模板中的变量
    const processedKeywords = currentTemplate.keywords.map(keyword => {
        let processed = keyword;
        Object.keys(variables).forEach(variable => {
            processed = processed.replace(new RegExp(`\\$\\{${variable}\\}`, 'g'), variables[variable]);
        });
        return processed;
    });
    
    console.log('处理后的关键词:', processedKeywords);
    
    // 应用到搜索框
    document.getElementById('keywords').value = processedKeywords.join('\n');
    document.querySelector(`input[name="logic"][value="${currentTemplate.logic}"]`).checked = true;
    
    closeModal('variableModal');
    showStatusMessage(`已应用模板: ${currentTemplate.name}`, 'success');
}

function applyTemplateDirectly(template) {
    console.log('直接应用模板:', template);
    
    document.getElementById('keywords').value = template.keywords.join('\n');
    document.querySelector(`input[name="logic"][value="${template.logic}"]`).checked = true;
    showStatusMessage(`已应用模板: ${template.name}`, 'success');
}

// 文件处理 - 支持tar格式
function handleFileSelect(event) {
    console.log('处理文件选择');
    const files = Array.from(event.target.files);
    files.forEach(file => {
        console.log('添加文件:', file.name);
        addFileToList(file);
        preprocessFile(file);
    });
}

function addFileToList(file) {
    if (fileList.find(f => f.name === file.name && f.size === file.size)) {
        showStatusMessage(`文件 ${file.name} 已存在`, 'info');
        return;
    }

    const fileInfo = {
        file: file,
        name: file.name,
        size: file.size,
        status: 'processing',
        timeRange: null,
        subFiles: [] // 用于tar包中的子文件
    };

    fileList.push(fileInfo);
    updateFileListDisplay();
    showStatusMessage(`文件 ${file.name} 已添加，正在预处理...`, 'info');
}

async function preprocessFile(file) {
    console.log('预处理文件:', file.name);
    const fileInfo = fileList.find(f => f.file === file);
    if (!fileInfo) return;

    try {
        fileInfo.status = 'processing';
        updateFileListDisplay();

        if (file.name.endsWith('.tar')) {
            console.log('处理tar文件');
            await processTarFile(file, fileInfo);
        } else {
            console.log('处理普通文件');
            const timeRange = await extractTimeRangeFromFile(file);
            fileInfo.timeRange = timeRange;
        }
        
        fileInfo.status = 'ready';
        updateOverallTimeRange();
        updateFileListDisplay();
        
        showStatusMessage(`文件 ${file.name} 预处理完成`, 'success');
        
    } catch (error) {
        console.error(`预处理文件 ${file.name} 时出错:`, error);
        fileInfo.status = 'error';
        updateFileListDisplay();
        showStatusMessage(`预处理文件 ${file.name} 失败: ${error.message}`, 'error');
    }
}

// 处理tar包
async function processTarFile(file, fileInfo) {
    console.log('处理TAR包:', file.name);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log('TAR文件大小:', arrayBuffer.byteLength);
        
        const tarReader = new SimpleTarReader(arrayBuffer);
        const entries = await tarReader.extractFiles();
        
        console.log('TAR中找到的文件数量:', entries.length);
        
        let overallStart = null;
        let overallEnd = null;
        
        for (const entry of entries) {
            console.log('处理TAR条目:', entry.name, '大小:', entry.size);
            
            if (entry.name.endsWith('.gz') || entry.name.endsWith('.log')) {
                try {
                    // 获取文件时间范围
                    const timeRange = await extractTimeRangeFromTarEntry(entry);
                    
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

// 修复：从tar条目中提取时间范围
async function extractTimeRangeFromTarEntry(entry) {
    let content;
    
    if (entry.name.endsWith('.gz')) {
        try {
            if (typeof pako === 'undefined') {
                throw new Error('pako库未加载');
            }
            
            console.log('尝试使用pako.inflate解压:', entry.name);
            content = pako.inflate(entry.buffer, { to: 'string' });
            
        } catch (pakoError) {
            console.warn('pako.inflate失败，检查是否为ZIP格式:', pakoError.message);
            
            // 检查是否是ZIP文件（ZIP文件头是PK，即0x504B）
            if (entry.buffer[0] === 0x50 && entry.buffer[1] === 0x4B) {
                console.log('检测到ZIP格式，使用JSZip解压');
                try {
                    content = await extractFromZipBuffer(entry.buffer);
                } catch (zipError) {
                    console.error('JSZip解压失败:', zipError);
                    throw new Error(`无法解压ZIP文件 ${entry.name}: ${zipError.message}`);
                }
            } else {
                // 尝试其他gzip方法
                try {
                    console.log('尝试使用pako.ungzip解压:', entry.name);
                    content = pako.ungzip(entry.buffer, { to: 'string' });
                } catch (ungzipError) {
                    console.error('pako.ungzip也失败:', ungzipError);
                    throw new Error(`无法解压文件 ${entry.name}: ${pakoError.message}`);
                }
            }
        }
    } else {
        const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
        content = decoder.decode(entry.buffer);
    }
    
    // 检查解压后的内容
    if (!content || content.length === 0) {
        throw new Error(`文件 ${entry.name} 解压后内容为空`);
    }
    
    console.log(`文件 ${entry.name} 解压成功，内容长度:`, content.length);
    
    return extractTimeRangeFromContent(content);
}

// 修复：从文件中提取时间范围
async function extractTimeRangeFromFile(file) {
    console.log('提取文件时间范围:', file.name);
    
    try {
        let content;
        
        if (file.name.endsWith('.gz')) {
            if (typeof pako === 'undefined') {
                throw new Error('pako库未加载');
            }
            const arrayBuffer = await file.arrayBuffer();
            const compressed = new Uint8Array(arrayBuffer);
            
            try {
                // 先尝试标准gzip
                content = pako.inflate(compressed, { to: 'string' });
            } catch (pakoError) {
                console.warn('gzip解压失败，尝试ZIP格式:', pakoError.message);
                
                // 检查是否是ZIP文件（ZIP文件头是PK，即0x504B）
                if (compressed[0] === 0x50 && compressed[1] === 0x4B) {
                    content = await extractFromZipBuffer(compressed);
                } else {
                    // 尝试其他gzip模式
                    content = pako.ungzip(compressed, { to: 'string' });
                }
            }
        } else {
            content = await file.text();
        }

        return extractTimeRangeFromContent(content);
    } catch (error) {
        console.error('提取时间范围失败:', error);
        throw new Error(`解析时间范围失败: ${error.message}`);
    }
}


// 简化的ZIP解析 - 修复deflate解压问题
async function extractFromZipBuffer(buffer) {
    try {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip库未加载，请检查CDN链接');
        }
        
        console.log('开始使用JSZip解析ZIP文件，buffer大小:', buffer.byteLength);
        const zip = new JSZip();
        
        // 加载ZIP文件
        const zipContent = await zip.loadAsync(buffer);
        
        console.log('ZIP文件解析成功，文件列表:', Object.keys(zipContent.files));
        
        // 查找第一个非目录的文件
        for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (!zipEntry.dir) {
                console.log('读取ZIP中的文件:', filename);
                try {
                    const content = await zipEntry.async('string');
                    console.log('文件内容长度:', content.length);
                    
                    if (content && content.length > 0) {
                        return content;
                    } else {
                        console.warn('文件内容为空:', filename);
                    }
                } catch (readError) {
                    console.error('读取ZIP文件内容失败:', filename, readError);
                    // 尝试以二进制方式读取，然后转换
                    try {
                        const uint8Array = await zipEntry.async('uint8array');
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        const content = decoder.decode(uint8Array);
                        if (content && content.length > 0) {
                            return content;
                        }
                    } catch (binaryError) {
                        console.error('二进制读取也失败:', binaryError);
                    }
                }
            }
        }
        
        throw new Error('ZIP文件中没有找到有效的文本文件');
        
    } catch (error) {
        console.error('JSZip处理失败:', error);
        throw new Error(`JSZip处理ZIP文件失败: ${error.message}`);
    }
}

// 从内容中提取时间范围的通用函数
function extractTimeRangeFromContent(content) {
    const timestampRegex = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}/;
    let firstTimestamp = null;
    let lastTimestamp = null;

    const lines = content.split('\n');
    
    // 查找第一个时间戳
    for (let i = 0; i < Math.min(lines.length, 1000); i++) {
        const line = lines[i];
        if (timestampRegex.test(line)) {
            firstTimestamp = extractTimestamp(line);
            break;
        }
    }

    // 查找最后一个时间戳
    for (let i = Math.max(0, lines.length - 1000); i < lines.length; i++) {
        const line = lines[i];
        if (timestampRegex.test(line)) {
            lastTimestamp = extractTimestamp(line);
        }
    }

    if (!firstTimestamp || !lastTimestamp) {
        throw new Error('无法在文件中找到有效的时间戳');
    }

    return { start: firstTimestamp, end: lastTimestamp };
}

function updateFileListDisplay() {
    const fileListContainer = document.getElementById('fileList');
    
    fileListContainer.innerHTML = fileList.map((fileInfo, index) => `
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

// 更新整体时间范围
function updateOverallTimeRange() {
    const readyFiles = fileList.filter(f => f.status === 'ready' && f.timeRange);
    
    if (readyFiles.length === 0 && (!remoteLogData || !remoteLogData.timeRange)) {
        overallTimeRange = null;
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
    if (remoteLogData && remoteLogData.timeRange) {
        const { start, end } = remoteLogData.timeRange;
        if (!minStart || start < minStart) minStart = start;
        if (!maxEnd || end > maxEnd) maxEnd = end;
    }

    if (minStart && maxEnd) {
        overallTimeRange = { start: minStart, end: maxEnd };
        
        // 自动设置搜索时间范围为文件的时间范围
        document.getElementById('searchBeginDate').value = formatDateForInput(minStart);
        document.getElementById('searchEndDate').value = formatDateForInput(maxEnd);
    }
}

// 设置搜索时间范围
function setSearchTimeRange(type) {
    if (!overallTimeRange) {
        showStatusMessage('请先加载日志文件', 'info');
        return;
    }

    let beginDate, endDate;
    const fileEnd = overallTimeRange.end;

    switch (type) {
        case 'all':
            beginDate = overallTimeRange.start;
            endDate = overallTimeRange.end;
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
    if (beginDate < overallTimeRange.start) beginDate = overallTimeRange.start;
    if (endDate > overallTimeRange.end) endDate = overallTimeRange.end;

    document.getElementById('searchBeginDate').value = formatDateForInput(beginDate);
    document.getElementById('searchEndDate').value = formatDateForInput(endDate);

    showStatusMessage(`已设置时间范围: ${type}`, 'success');
}

function removeFile(index) {
    const fileInfo = fileList[index];
    fileList.splice(index, 1);
    updateFileListDisplay();
    updateOverallTimeRange();
    showStatusMessage(`文件 ${fileInfo.name} 已移除`, 'info');
}

// 远程日志获取
async function fetchRemoteLogs() {
    const serverAddress = document.getElementById('serverAddress').value.trim();
    const beginDate = document.getElementById('beginDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!serverAddress || !beginDate || !endDate) {
        showStatusMessage('请填写完整的服务器地址和时间范围', 'error');
        return;
    }

    const fetchBtn = document.getElementById('fetchBtn');
    const progressDiv = document.getElementById('fetchProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    try {
        fetchBtn.disabled = true;
        progressDiv.style.display = 'block';
        
        progressText.textContent = '正在请求远程日志...';
        progressBar.style.width = '20%';
        progressBar.textContent = '20%';

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
        
        progressText.textContent = '正在下载日志文件...';
        progressBar.style.width = '40%';
        progressBar.textContent = '40%';
        
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

        progressText.textContent = '正在处理tar包...';
        progressBar.style.width = '60%';
        progressBar.textContent = '60%';

        // 处理返回的tar数据
        const arrayBuffer = await downloadResponse.arrayBuffer();
        remoteLogData = await processRemoteTarData(arrayBuffer, filePath);
        
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        progressText.textContent = '远程日志获取完成！';

        updateOverallTimeRange();
        localStorage.setItem('lastServerAddress', serverAddress);

        // 新增：显示加载的文件列表和时间段
        showRemoteLogsSummary(remoteLogData, beginDate, endDate);

        showStatusMessage('远程日志获取成功', 'success');

    } catch (error) {
        console.error('获取远程日志时出错:', error);
        showStatusMessage(`获取远程日志失败: ${error.message}`, 'error');
    } finally {
        fetchBtn.disabled = false;
        setTimeout(() => {
            progressDiv.style.display = 'none';
        }, 3000);
    }
}

// 修改显示远程日志摘要信息的函数
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

// 处理远程tar数据
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

// 搜索功能 - 支持多线程和实时显示
async function performSearch() {
    if (isSearching) {
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

    const readyFiles = fileList.filter(f => f.status === 'ready');
    if (readyFiles.length === 0 && !remoteLogData) {
        showStatusMessage('请先上传日志文件或获取远程日志', 'error');
        return;
    }

    const searchBtn = document.getElementById('searchBtn');
    const resultsContainer = document.getElementById('searchResults');
    const countSpan = document.getElementById('resultCount');

    try {
        isSearching = true;
        searchBtn.disabled = true;
        searchBtn.textContent = '搜索中...';

        showStatusMessage('开始搜索，正在处理文件...', 'info');

        searchResults = [];
        let isResultLimitReached = false;
        const MAX_RESULTS = 20000;
        
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
        if (remoteLogData && remoteLogData.subFiles) {
            for (const subFile of remoteLogData.subFiles) {
                searchTasks.push({
                    type: 'subFile',
                    data: subFile,
                    source: subFile.name
                });
            }
        }

        // 启动多线程搜索
        const searchParams = { keywords, logic, beginTime, endTime };
        await performMultiThreadSearch(searchTasks, searchParams, MAX_RESULTS, (results, finished) => {
            if (results.length + searchResults.length > MAX_RESULTS) {
                isResultLimitReached = true;
                const allowedResults = results.slice(0, MAX_RESULTS - searchResults.length);
                searchResults.push(...allowedResults);
                updateRealTimeResults();
                return true; // 停止搜索
            }
            
            searchResults.push(...results);
            updateRealTimeResults();
            return false; // 继续搜索
        });

        // 移除搜索进度显示
        const progressDiv = document.getElementById('searchProgress');
        if (progressDiv) {
            progressDiv.remove();
        }

        // 最终显示完整结果
        displaySearchResults();

        if (isResultLimitReached) {
            showStatusMessage(`搜索完成，已达到最大结果数限制 ${MAX_RESULTS} 条，请使用更精确的关键词`, 'warning');
        } else {
            showStatusMessage(`搜索完成，找到 ${searchResults.length} 条匹配的日志`, 'success');
        }

    } catch (error) {
        console.error('搜索时出错:', error);
        showStatusMessage(`搜索失败: ${error.message}`, 'error');
    } finally {
        isSearching = false;
        searchBtn.disabled = false;
        searchBtn.textContent = '搜索';
    }
}

// 多线程搜索实现
async function performMultiThreadSearch(searchTasks, searchParams, maxResults, onResultsCallback) {
    const maxWorkers = Math.min(navigator.hardwareConcurrency || 4, searchTasks.length, 8);
    const taskQueue = [...searchTasks];
    let completedTasks = 0;
    let shouldStop = false;

    return new Promise((resolve, reject) => {
        // 为简化实现，我们在主线程中进行搜索，但分批处理
        async function processInMainThread() {
            const batchSize = Math.ceil(taskQueue.length / maxWorkers);
            const batches = [];
            
            for (let i = 0; i < taskQueue.length; i += batchSize) {
                batches.push(taskQueue.slice(i, i + batchSize));
            }

            const processingPromises = batches.map(async (batch, batchIndex) => {
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
                        if (completedTasks % 2 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                        
                    } catch (error) {
                        console.error('处理任务失败:', error);
                    }
                }
            });

            await Promise.all(processingPromises);
            resolve();
        }

        // 预处理gz文件（在主线程中进行）
        // 修复：预处理gz文件（在任务队列中进行）
async function preprocessTask(task) {
    if (task.type === 'file' && task.data.name.endsWith('.gz')) {
        try {
            if (typeof pako === 'undefined') {
                throw new Error('pako库未加载');
            }
            
            const arrayBuffer = await task.data.arrayBuffer();
            const compressed = new Uint8Array(arrayBuffer);
            let content;
            
            try {
                console.log('尝试使用pako.inflate解压:', task.data.name);
                content = pako.inflate(compressed, { to: 'string' });
            } catch (pakoError) {
                console.warn('pako.inflate失败，检查是否为ZIP格式:', pakoError.message);
                
                // 检查是否是ZIP文件（ZIP文件头是PK，即0x504B）
                if (compressed[0] === 0x50 && compressed[1] === 0x4B) {
                    console.log('检测到ZIP格式，使用JSZip解压');
                    try {
                        content = await extractFromZipBuffer(compressed);
                    } catch (zipError) {
                        console.error('JSZip解压失败:', zipError);
                        throw new Error(`无法解压ZIP文件 ${task.data.name}: ${zipError.message}`);
                    }
                } else {
                    // 尝试其他gzip方法
                    try {
                        console.log('尝试使用pako.ungzip解压:', task.data.name);
                        content = pako.ungzip(compressed, { to: 'string' });
                    } catch (ungzipError) {
                        console.error('pako.ungzip也失败:', ungzipError);
                        throw new Error(`无法解压文件 ${task.data.name}: ${pakoError.message}`);
                    }
                }
            }
            
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

        processInMainThread();
    });
}
// 修复：在主线程中处理单个任务
// 同样修复 processTaskInMainThread 中的部分
async function processTaskInMainThread(task, searchParams) {
    const { keywords, logic, beginTime, endTime } = searchParams;
    const results = [];
    
    let content;
    
    try {
        if (task.type === 'file') {
            if (task.data.name.endsWith('.gz')) {
                // 处理.gz文件
                const arrayBuffer = await task.data.arrayBuffer();
                const compressed = new Uint8Array(arrayBuffer);
                
                try {
                    if (typeof pako === 'undefined') {
                        throw new Error('pako库未加载');
                    }
                    console.log('主线程：尝试pako.inflate解压');
                    content = pako.inflate(compressed, { to: 'string' });
                } catch (pakoError) {
                    console.warn('主线程：pako.inflate失败，尝试ZIP格式');
                    if (compressed[0] === 0x50 && compressed[1] === 0x4B) {
                        console.log('主线程：检测到ZIP格式');
                        content = await extractFromZipBuffer(compressed);
                    } else {
                        console.log('主线程：尝试pako.ungzip解压');
                        content = pako.ungzip(compressed, { to: 'string' });
                    }
                }
            } else {
                content = await task.data.text();
            }
        } else if (task.type === 'subFile') {
            if (task.data.name.endsWith('.gz')) {
                try {
                    if (typeof pako === 'undefined') {
                        throw new Error('pako库未加载');
                    }
                    console.log('主线程：处理子文件，尝试pako.inflate解压');
                    content = pako.inflate(task.data.data, { to: 'string' });
                } catch (pakoError) {
                    console.warn('主线程：子文件pako.inflate失败，尝试ZIP格式');
                    if (task.data.data[0] === 0x50 && task.data.data[1] === 0x4B) {
                        console.log('主线程：子文件检测到ZIP格式');
                        content = await extractFromZipBuffer(task.data.data);
                    } else {
                        console.log('主线程：子文件尝试pako.ungzip解压');
                        content = pako.ungzip(task.data.data, { to: 'string' });
                    }
                }
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
        
        if (i % 1000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
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

// 检查日志是否匹配
function checkLogMatch(log, keywords, logic, beginTime, endTime) {
    if (beginTime && log.timestamp < beginTime) return false;
    if (endTime && log.timestamp > endTime) return false;
    
    const content = log.content.toLowerCase();
    const matches = keywords.map(keyword => 
        content.includes(keyword.toLowerCase())
    );
    
    return logic === 'and' ? matches.every(m => m) : matches.some(m => m);
}

// 实时更新搜索结果显示
function updateRealTimeResults() {
    const realTimeContainer = document.getElementById('realTimeResults');
    const countSpan = document.getElementById('resultCount');
    
    if (!realTimeContainer) return;
    
    countSpan.textContent = `${searchResults.length} 条结果`;

    const keywords = document.getElementById('keywords').value.trim().split('\n').filter(k => k.trim());
    
    // 按时间排序最新的结果
    const sortedResults = [...searchResults].sort((a, b) => a.timestamp - b.timestamp);
    
    // 只显示最新的100条结果，避免DOM过大
    const displayResults = sortedResults.slice(-100);
    
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
            const log = searchResults.find(l => l.id === logId);
            if (log) {
                markLogById(log);
            }
        });
    });

    // 滚动到底部显示最新结果
    realTimeContainer.scrollTop = realTimeContainer.scrollHeight;
}

// 通过ID标记日志
function markLogById(log) {
    if (!log) return;

    // 检查是否已经标记
    if (workspace.find(item => item.id === log.id)) {
        showStatusMessage('该日志已经在工作区中', 'info');
        return;
    }

    workspace.push({
        ...log,
        markedAt: new Date(),
        tags: []
    });

    saveWorkspace();
    displayWorkspace();
    showStatusMessage('日志已标记到工作区', 'success');
}

function extractTimestamp(line) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/);
    return match ? new Date(match[1]) : new Date();
}

// 修改最终显示搜索结果函数
function displaySearchResults() {
    const container = document.getElementById('searchResults');
    const countSpan = document.getElementById('resultCount');
    
    countSpan.textContent = `${searchResults.length} 条结果`;

    if (searchResults.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #7f8c8d;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <div>未找到匹配的日志</div>
            </div>
        `;
        return;
    }

    const keywords = document.getElementById('keywords').value.trim().split('\n').filter(k => k.trim());
    
    // 按时间排序
    const sortedResults = [...searchResults].sort((a, b) => a.timestamp - b.timestamp);
    
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
            const log = searchResults.find(l => l.id === logId);
            if (log) {
                markLogById(log);
            }
        });
    });

    // 为导出按钮添加事件监听器
    const exportBtn = document.getElementById('exportSearchResultsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSearchResults);
    }
}

// 导出搜索结果
function exportSearchResults() {
    if (searchResults.length === 0) {
        showStatusMessage('没有搜索结果可导出', 'info');
        return;
    }

    const content = searchResults
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

function highlightKeywords(content, keywords) {
    let highlighted = content;
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${escapeRegex(keyword)})`, 'gi');
        highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
    });
    return highlighted;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 工作区功能
function markLog(index) {
    const log = searchResults[index];
    if (!log) return;

    // 检查是否已经标记
    if (workspace.find(item => item.id === log.id)) {
        showStatusMessage('该日志已经在工作区中', 'info');
        return;
    }

    workspace.push({
        ...log,
        markedAt: new Date(),
        tags: []
    });

    saveWorkspace();
    displayWorkspace();
    showStatusMessage('日志已标记到工作区', 'success');
}

function displayWorkspace() {
    const container = document.getElementById('workspace');
    
    if (workspace.length === 0) {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #7f8c8d;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
                <div>标记的日志将在这里显示</div>
            </div>
        `;
        return;
    }

    // 按时间戳排序
    const sortedWorkspace = [...workspace].sort((a, b) => a.timestamp - b.timestamp);

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

function addTag(workspaceIndex, tagName) {
    if (!tagName.trim()) return;

    const item = workspace[workspaceIndex];
    if (item.tags.find(tag => tag.name === tagName.trim())) return;

    const color = tagColors[nextTagColorIndex % tagColors.length];
    nextTagColorIndex++;

    item.tags.push({
        name: tagName.trim(),
        color: color
    });

    saveWorkspace();
    displayWorkspace();
}

function removeTag(workspaceIndex, tagName) {
    const item = workspace[workspaceIndex];
    item.tags = item.tags.filter(tag => tag.name !== tagName);
    saveWorkspace();
    displayWorkspace();
}

function removeFromWorkspace(index) {
    workspace.splice(index, 1);
    saveWorkspace();
    displayWorkspace();
}

function clearWorkspace() {
    if (confirm('确定要清空工作区吗？')) {
        workspace = [];
        saveWorkspace();
        displayWorkspace();
        showStatusMessage('工作区已清空', 'info');
    }
}

function exportWorkspace() {
    if (workspace.length === 0) {
        showStatusMessage('工作区为空，无法导出', 'info');
        return;
    }

    const content = workspace.map(item => {
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

// 存储功能
function saveWorkspace() {
    try {
        const workspaceData = workspace.map(item => ({
            ...item,
            timestamp: item.timestamp.toISOString(),
            markedAt: item.markedAt.toISOString()
        }));
        setStorageValue('logAnalysisWorkspace', workspaceData);
    } catch (error) {
        console.error('保存工作区失败:', error);
    }
}

async function loadWorkspace() {
    try {
        const workspaceData = await getStorageValue('logAnalysisWorkspace');
        if (workspaceData) {
            workspace = workspaceData.map(item => ({
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

// 模板功能
function getTemplates() {
    return JSON.parse(localStorage.getItem('searchTemplates') || '[]');
}

function loadTemplates() {
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
        localStorage.setItem('searchTemplates', JSON.stringify(defaultTemplates));
    }
}

function showTemplateManager() {
    const modal = document.getElementById('templateManagerModal');
    const templateList = document.getElementById('templateList');
    const templates = getTemplates();

    // 填充当前搜索条件到模板保存框
    const currentKeywords = document.getElementById('keywords').value;
    document.getElementById('templateKeywords').value = currentKeywords;

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

    modal.style.display = 'block';
}

function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const keywords = document.getElementById('templateKeywords').value.trim().split('\n').filter(k => k.trim());
    const logic = document.querySelector('input[name="logic"]:checked').value;

    if (!name || keywords.length === 0) {
        showStatusMessage('请输入模板名称和关键词', 'error');
        return;
    }

    const templates = getTemplates();
    templates.push({ name, keywords, logic });
    localStorage.setItem('searchTemplates', JSON.stringify(templates));

    document.getElementById('templateName').value = '';
    showTemplateManager();
    showStatusMessage('模板已保存', 'success');
}

function loadTemplate(index) {
    const templates = getTemplates();
    const template = templates[index];
    if (!template) return;

    document.getElementById('keywords').value = template.keywords.join('\n');
    document.querySelector(`input[name="logic"][value="${template.logic}"]`).checked = true;

    closeModal('templateManagerModal');
    showStatusMessage(`已加载模板: ${template.name}`, 'success');
}

function deleteTemplate(index) {
    if (confirm('确定要删除这个模板吗？')) {
        const templates = getTemplates();
        templates.splice(index, 1);
        localStorage.setItem('searchTemplates', JSON.stringify(templates));
        showTemplateManager();
        showStatusMessage('模板已删除', 'info');
    }
}

// 设置功能
function showSettings() {
    document.getElementById('settingsModal').style.display = 'block';
}

async function saveSettings() {
    const token = document.getElementById('apiToken').value.trim();
    if (token) {
        await setStorageValue('apiToken', token);
        showStatusMessage('设置已保存', 'success');
    }
    closeModal('settingsModal');
}

async function loadSettings() {
    const token = await getStorageValue('apiToken');
    if (token) {
        document.getElementById('apiToken').value = token;
    }
    
    const lastServer = localStorage.getItem('lastServerAddress');
    if (lastServer) {
        document.getElementById('serverAddress').value = lastServer;
    }
}

// 模态框管理
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Chrome存储API封装
async function getStorageValue(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
}

async function setStorageValue(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

// 工具函数
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusText(status) {
    switch (status) {
        case 'processing': return '预处理中...';
        case 'ready': return '已就绪';
        case 'error': return '处理失败';
        default: return '未知状态';
    }
}

function showStatusMessage(message, type) {
    const statusDiv = document.getElementById('searchStatus');
    statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, 5000);
}

function clearSearch() {
    document.getElementById('keywords').value = '';
    document.querySelectorAll('.template-btn').forEach(btn => btn.classList.remove('active'));
    searchResults = [];
    displaySearchResults();
    showStatusMessage('搜索条件已清空', 'info');
}

// 页面关闭时清理
window.addEventListener('beforeunload', () => {
    // 清理资源
    fileList = [];
    remoteLogData = null;
    searchResults = [];
});