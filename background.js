// 点击插件图标时打开新页面
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('main.html')
    });
});

// 处理跨域请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchRemoteLogs') {
        fetchRemoteLogsFromBackground(request.data)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function fetchRemoteLogsFromBackground(data) {
    const { serverAddress, beginDate, endDate, token } = data;
    
    try {
        // 阶段一：准备日志
        const prepareUrl = `http://${serverAddress}/api/v4/system-logs/prepare?date=&beginDate=${new Date(beginDate).toISOString()}&endDate=${new Date(endDate).toISOString()}`;
        
        const prepareResponse = await fetch(prepareUrl, {
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

        const arrayBuffer = await downloadResponse.arrayBuffer();
        
        return {
            arrayBuffer: Array.from(new Uint8Array(arrayBuffer)),
            fileName: filePath,
            size: downloadResponse.headers.get('content-length') || '未知'
        };

    } catch (error) {
        throw error;
    }
}