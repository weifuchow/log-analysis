/**
 * 存储工具
 * Chrome Storage API 和 localStorage 封装
 */

/**
 * 从Chrome Storage获取值
 */
export async function getStorageValue(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
}

/**
 * 向Chrome Storage设置值
 */
export async function setStorageValue(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

/**
 * 从localStorage获取值
 */
export function getLocalStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
        console.error('读取localStorage失败:', error);
        return defaultValue;
    }
}

/**
 * 向localStorage设置值
 */
export function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('写入localStorage失败:', error);
        return false;
    }
}

/**
 * 从localStorage删除值
 */
export function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('删除localStorage失败:', error);
        return false;
    }
}
