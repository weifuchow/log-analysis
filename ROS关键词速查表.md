# ROS日志分析 - 关键词速查表

快速参考：常用搜索关键词和场景

---

## 🚨 错误和异常类

### 通用错误
```
error
ERROR
exception
Exception
failed
failure
fatal
FATAL
critical
CRITICAL
```

### 连接错误
```
connection failed
connection lost
connection timeout
disconnect
disconnected
cannot connect
unreachable
network error
socket error
```

### 超时错误
```
timeout
timed out
TIMEOUT
overtime
超时
等待超时
响应超时
```

---

## 🔌 设备和硬件类

### 电梯相关
```
elevator
lift
floor
door
ResourceDevice
电梯
楼层
开门
关门
```

### AGV/车辆相关
```
vehicle
agv
robot
car
battery
charge
charging
电量
充电
车辆
```

### 传感器
```
sensor
lidar
camera
ultrasonic
laser
imu
传感器
雷达
摄像头
```

---

## 📦 任务和订单类

### 订单流程
```
order
task
job
assign
execute
complete
finish
订单
任务
分配
执行
完成
```

### 订单状态
```
pending
waiting
running
executing
completed
failed
canceled
paused
等待中
执行中
已完成
已取消
```

### 订单ID搜索（使用变量）
```
order_${orderID}
task_${taskID}
job_${jobID}
```

---

## 🗺️ 路径和导航类

### 路径规划
```
path
route
planning
planner
navigation
navigate
waypoint
路径
路线
规划
导航
```

### 路径问题
```
no path found
path blocked
obstacle
collision
deadlock
无路径
路径受阻
障碍物
死锁
```

### 定位
```
localization
position
pose
location
GPS
SLAM
定位
位置
坐标
```

---

## 🔄 通讯和网络类

### ROS通讯
```
node
topic
publish
subscribe
message
service
callback
节点
话题
消息
```

### 网络状态
```
connect
connected
connecting
disconnect
ping
latency
delay
网络
延迟
```

### 数据传输
```
send
sent
receive
received
transmit
transfer
data
发送
接收
传输
```

---

## ⚙️ 系统和配置类

### 系统状态
```
start
started
starting
stop
stopped
stopping
restart
restarting
init
initialized
启动
停止
重启
初始化
```

### 配置
```
config
configuration
parameter
param
setting
load
loaded
配置
参数
设置
加载
```

### 资源
```
memory
cpu
disk
resource
usage
used
available
内存
磁盘
资源
使用率
```

---

## 🎮 控制和调度类

### 任务调度
```
schedule
scheduler
queue
dispatcher
allocate
allocation
调度
队列
分配
```

### 交通控制
```
traffic
semaphore
lock
unlock
request
release
resource
交通管制
信号量
锁
资源
```

### 状态机
```
state
status
transition
change
mode
状态
状态机
切换
模式
```

---

## ⏱️ 性能和时间类

### 性能指标
```
time
duration
cost
elapsed
latency
delay
ms
second
耗时
延迟
毫秒
```

### 性能问题
```
slow
slowness
performance
lag
stuck
hang
hanging
卡顿
缓慢
阻塞
```

---

## 🔧 调试和日志类

### 调试信息
```
debug
DEBUG
trace
TRACE
verbose
info
INFO
调试
跟踪
```

### 警告
```
warn
WARNING
alert
caution
注意
警告
```

---

## 📋 常用组合搜索

### 组合1：故障排查
```
关键词：
error
failed
exception
timeout

逻辑：OR
时间：故障发生时间段
```

### 组合2：设备状态监控
```
关键词：
elevator
状态
state
error

逻辑：AND（精确）或 OR（宽泛）
时间：监控时间段
```

### 组合3：订单追踪
```
关键词：
order_${orderID}
${orderID}
task

逻辑：OR
时间：订单执行时间段
```

### 组合4：性能分析
```
关键词：
time cost
duration
耗时
ms

逻辑：OR
时间：全部
```

### 组合5：通讯问题
```
关键词：
connection
timeout
disconnect
network
lost

逻辑：OR
时间：问题发生时段
```

### 组合6：路径规划问题
```
关键词：
path
blocked
no path
obstacle
collision

逻辑：OR
时间：规划失败时段
```

---

## 🎯 搜索策略

### 策略1：从宽到窄
```
1. 先用 OR 逻辑，宽泛搜索
2. 查看结果数量和分布
3. 再用 AND 逻辑，精确定位
4. 结合时间范围进一步缩小
```

### 策略2：时间轴分析
```
1. 不设时间限制，搜索所有相关日志
2. 查看时间分布
3. 发现异常时间点
4. 设置该时间点前后10-30分钟
5. 重新搜索
```

### 策略3：关键词扩展
```
1. 从核心关键词开始（如：error）
2. 查看结果中的高频词
3. 添加高频词到关键词列表
4. 重新搜索
```

### 策略4：排除法
```
1. 搜索所有 error
2. 标记已知/正常错误到工作区（标签：正常）
3. 关注未标记的新错误
```

---

## 💡 实用技巧

### 技巧1：使用中英文双语
很多ROS日志混合中英文，建议同时搜索：
```
error
错误
failed
失败
```

### 技巧2：搜索特定设备
使用设备ID或名称：
```
elevator_01
agv_001
lift_A
车辆_01
```

### 技巧3：搜索时间戳附近
找到关键日志的时间戳后：
```
1. 记录时间：2025-10-31 11:50:23
2. 设置搜索范围：11:45 - 11:55
3. 使用宽泛关键词
4. 查看前后关联日志
```

### 技巧4：工作区分类
使用标签系统分类：
```
标签示例：
- "根因" - 问题的起源
- "影响" - 受影响的模块
- "待处理" - 需要跟进
- "已解决" - 已修复的问题
- "正常" - 已知的正常日志
- "重要" - 关键发现
```

---

## 📊 ROS特定日志格式

### 标准ROS日志格式
```
2025-10-31 11:50:23.456 [INFO] [node_name]: message content
│                           │     │          │
│                           │     │          └─ 日志内容
│                           │     └─ 节点名称
│                           └─ 日志级别
└─ 时间戳（精确到毫秒）
```

### 搜索建议
- **按节点**：搜索 `[node_name]`
- **按级别**：搜索 `[ERROR]` 或 `[WARN]`
- **按内容**：直接搜索关键词

---

## 🔍 正则表达式（未来功能）

当扩展支持正则后，可以使用：

### 搜索订单号
```
order_\d{8}
匹配：order_20251031
```

### 搜索IP地址
```
\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}
匹配：192.168.1.100
```

### 搜索时间戳
```
\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}
匹配：2025-10-31 11:50:23
```

---

## 📝 模板推荐

根据您的ROS系统，建议创建以下模板：

| 模板名称 | 关键词 | 逻辑 | 用途 |
|---------|--------|------|------|
| 系统错误 | error, failed, exception | OR | 日常检查 |
| 电梯异常 | elevator, error, timeout | AND | 电梯故障 |
| 通讯问题 | connection, timeout, lost | OR | 网络诊断 |
| 订单追踪 | order_${id}, task | OR | 订单分析 |
| 性能监控 | time cost, duration, 耗时 | OR | 性能优化 |
| 路径规划 | path, planning, route | AND | 导航分析 |

---

## ⚡ 快捷操作

### 快速查错（3步）
```
1. 上传日志
2. 点击"全部"时间范围
3. 搜索：error（OR逻辑）
```

### 快速追踪订单（4步）
```
1. 点击"自定义"模板
2. 输入关键词：order_${orderID}
3. 输入订单号
4. 搜索
```

### 快速导出分析（5步）
```
1. 搜索关键问题
2. 标记重要日志到工作区
3. 添加分类标签
4. 点击"导出工作区"
5. 保存为报告
```

---

## 🎓 学习路径

### 初级（1-2天）
- ✅ 上传本地日志文件
- ✅ 使用单个关键词搜索
- ✅ 理解AND和OR逻辑
- ✅ 标记日志到工作区

### 中级（3-5天）
- ✅ 使用时间范围过滤
- ✅ 创建自定义模板
- ✅ 添加标签分类
- ✅ 导出搜索结果和工作区

### 高级（1-2周）
- ✅ 远程获取服务器日志
- ✅ 多文件对比分析
- ✅ 构建完整故障链路
- ✅ 建立日志分析工作流

---

## 📞 需要帮助？

- 查看 `ROS日志分析指南.md` 了解详细步骤
- 查看 `README.md` 了解扩展功能
- 查看 `CLAUDE.md` 了解技术细节

**祝分析顺利！** 🚀
