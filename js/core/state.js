/**
 * 全局状态管理
 * 集中管理应用的所有状态
 */

export const state = {
    // 文件列表
    fileList: [],

    // 远程日志数据
    remoteLogData: null,

    // 搜索结果
    searchResults: [],

    // 工作区
    workspace: [],

    // 搜索状态锁
    isSearching: false,

    // 整体时间范围
    overallTimeRange: null,

    // 标签颜色索引
    nextTagColorIndex: 0,

    // 当前模板
    currentTemplate: null
};

/**
 * 重置所有状态
 */
export function resetState() {
    state.fileList = [];
    state.remoteLogData = null;
    state.searchResults = [];
    state.isSearching = false;
    state.overallTimeRange = null;
    state.currentTemplate = null;
    // 注意: workspace 和 nextTagColorIndex 不重置，因为它们需要持久化
}

/**
 * 重置搜索相关状态
 */
export function resetSearchState() {
    state.searchResults = [];
    state.isSearching = false;
}
