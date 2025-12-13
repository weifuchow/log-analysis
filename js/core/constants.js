/**
 * 应用常量定义
 */

// 预设模板定义
export const PRESET_TEMPLATES = {
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

// 标签颜色调色板
export const TAG_COLORS = [
    '#e74c3c',
    '#3498db',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#34495e',
    '#e67e22'
];

// 搜索配置
export const SEARCH_CONFIG = {
    MAX_RESULTS: 20000,              // 最大搜索结果数
    BATCH_SIZE: 2,                   // 批处理大小
    BATCH_DELAY: 10,                 // 批处理延迟(ms)
    YIELD_INTERVAL: 1000,            // 让出控制权的间隔(行数)
    YIELD_DELAY: 0,                  // 让出控制权的延迟(ms)
    REALTIME_DISPLAY_LIMIT: 100      // 实时显示的结果数量限制
};

// 时间范围类型
export const TIME_RANGE_TYPES = {
    ALL: 'all',
    LAST_1H: 'last1h',
    LAST_6H: 'last6h',
    LAST_24H: 'last24h'
};

// 文件状态
export const FILE_STATUS = {
    PROCESSING: 'processing',
    READY: 'ready',
    ERROR: 'error'
};

// 消息类型
export const MESSAGE_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning'
};

// 日志逻辑运算符
export const LOGIC_OPERATORS = {
    AND: 'and',
    OR: 'or'
};
