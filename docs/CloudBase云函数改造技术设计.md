# 打牌记账小程序后端改造技术设计

## 1. 文档目标

本文用于指导当前项目从：

- `小程序 -> CloudBase 云托管(NestJS) -> CloudBase MySQL`

改造为：

- `小程序 -> CloudBase HTTP 云函数 -> NestJS 业务层 -> CloudBase MySQL`

目标是在**不升级 CloudBase 云托管套餐**的前提下，继续保留：

- 微信小程序前端
- NestJS 业务代码
- Prisma + MySQL 数据模型
- 现有 REST API 语义

同时去掉当前受限于个人版套餐的：

- CloudBase 云托管部署链路
- Docker 容器启动依赖
- 基于容器 3000 端口的健康检查模型

## 2. 背景与问题

当前后端已经按 CloudBase 云托管模式实现并部署过一版，但线上失败原因已经明确：

- 服务运行在 CloudBase 云托管
- 数据库使用 CloudBase MySQL 私网地址
- 当前环境为个人版
- 个人版云托管不支持内网互联
- 容器启动时无法连接 MySQL，导致进程退出，健康检查失败

因此，现方案的核心阻塞不在于业务代码本身，而在于**运行载体与套餐能力不匹配**。

## 3. 设计结论

### 3.1 选型结论

本次改造采用以下方案：

- 运行载体：`CloudBase HTTP 云函数`
- 应用框架：继续保留 `NestJS`
- 数据访问：继续保留 `Prisma + MySQL`
- 前端调用：优先保留当前 HTTP API 方式
- 实时能力：第一阶段降级为“HTTP 快照 + 手动刷新 / 轮询”，第二阶段再决定是否恢复 WebSocket

### 3.2 为什么选择这个方案

相比完全推翻为原生云函数或直接切 NoSQL，这个方案的优点是：

- 对当前后端业务代码侵入最小
- 可以保留既有模块分层和 Prisma schema
- 前端接口语义可尽量不变
- 部署目标从云托管切换到云函数，风险更可控
- 后续如果 HTTP 云函数验证通过，仍可继续扩展 SSE / WebSocket

### 3.3 不在本次范围内的内容

- 不在本轮同时引入 Redis
- 不在本轮重写为完全原生云函数 handler 风格
- 不在本轮修改业务规则和数据库 schema
- 不在本轮做多环境自动化发布流水线
- 不在本轮恢复完整 WebSocket 实时推送

## 4. 关键前置验证

在正式改造前，先做一个最小技术验证，避免把代码大改后才发现基础假设不成立。

### 4.1 验证项

1. 当前 CloudBase 环境下，HTTP 云函数是否可正常部署
2. HTTP 云函数在当前环境下是否可访问 CloudBase MySQL
3. `Prisma + MySQL` 在 HTTP 云函数场景下是否可稳定执行 `SELECT 1`
4. 函数冷启动时间是否可接受

### 4.2 通过标准

- 可成功部署一个最小 HTTP 云函数
- 可成功连通 MySQL 并返回简单查询结果
- 冷启动接口响应时间在 MVP 可接受范围内

### 4.3 验证失败时的备选方案

如果前置验证失败，则按优先级切换备选方案：

1. 继续保留 NestJS，但将 MySQL 访问改为更轻量的 `mysql2`
2. 若云函数仍无法访问 MySQL，则重新评估：
   - 改用 CloudBase 文档数据库
   - 或重新接受升级套餐后回到云托管方案

## 5. 当前系统现状

### 5.1 当前后端实现

当前 `backend/` 已具备以下基础：

- NestJS 模块化结构
- Prisma schema 与迁移文件
- 微信登录、房间、成员、规则、记账、结算、用户等模块
- 针对云托管容器的 Dockerfile 和启动脚本
- 已补充数据库连接失败时的启动诊断日志

### 5.2 当前部署假设

当前代码默认假设：

- 应用运行于长期驻留容器
- 容器主动监听端口
- 启动时允许做连接初始化
- 容器可直接访问数据库私网地址

这些假设与 HTTP 云函数场景不完全一致，因此需要做适配。

## 6. 目标架构

### 6.1 目标请求链路

目标架构如下：

1. 微信小程序发起 HTTPS 请求
2. 请求进入 CloudBase HTTP 云函数
3. HTTP 云函数内部启动 NestJS 应用
4. NestJS Controller / Service 处理业务逻辑
5. Prisma 访问 CloudBase MySQL
6. 返回标准 JSON 响应给小程序

### 6.2 目标架构原则

- 应用层仍以 NestJS 为中心
- 部署层切换为云函数
- 数据层继续使用 MySQL
- 前端接口兼容优先于后端“最优雅”重构
- 先恢复可用性，再优化性能

## 7. 技术方案设计

## 7.1 运行模式选择

HTTP 云函数支持两种方式：

- 框架模式：基于函数框架导出 `main`
- 原生模式：应用作为标准 Web 服务监听 `9000`

本项目建议优先采用：

- **原生模式**

原因：

- 当前后端已是标准 NestJS Web API
- 现有 `main.ts` 逻辑更接近原生 Web 服务
- 后续接入中间件、鉴权、Swagger、SSE 时更自然

设计要求：

- 云函数运行时监听 `9000`
- 本地开发仍可监听 `3000`
- 启动逻辑支持“单例复用”，避免每次请求重复初始化

## 7.2 目录结构建议

建议在保留 `backend/` 作为主开发目录的基础上，补充面向云函数的部署结构。

建议结构：

```text
backend/
  src/
  prisma/
  package.json
  tsconfig.json
  ...
cloudfunctions/
  backend-http/
    index.js
    package.json
    scf_bootstrap
    dist/
    prisma/
```

说明：

- `backend/` 继续承载源代码开发
- `cloudfunctions/backend-http/` 作为部署产物目录
- 通过构建脚本把 `backend/dist`、`prisma`、生产依赖复制到函数目录

## 7.3 启动入口设计

当前入口是容器模式：

- `main.ts` 启动 Nest 应用
- `app.listen(PORT)`
- 由 Docker / start.sh 驱动

目标入口改造为：

- 统一抽取 `createApp()` 或 `bootstrapApp()` 工厂
- 本地开发入口继续监听 `3000`
- 云函数入口监听 `9000`
- 云函数环境中复用已经初始化的 Nest 实例

建议拆分为：

- `src/bootstrap.ts`：负责创建并配置 Nest app
- `src/main.ts`：本地开发 / 普通 Node 启动入口
- `cloudfunctions/backend-http/index.js`：云函数入口，负责启动监听 `9000`

## 7.4 配置管理设计

保留 `ConfigModule`，统一通过环境变量注入。

### 保留的环境变量

- `NODE_ENV`
- `DATABASE_URL`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PRISMA_CONNECT_TIMEOUT_MS`
- `PRISMA_CONNECT_MAX_RETRIES`
- `PRISMA_CONNECT_RETRY_DELAY_MS`

### 废弃或弱化的环境变量

- `RUN_PRISMA_MIGRATE`
- 面向云托管容器的端口语义

### 新增建议变量

- `HTTP_FUNCTION_PORT=9000`
- `APP_RUNTIME=local|cloudfunction`
- `ENABLE_REALTIME=false`

## 7.5 Prisma 与数据库连接策略

这是本次改造的核心风险点之一。

### 现状

当前 `PrismaService` 在模块初始化时主动连接数据库，并带有日志、重试、超时控制。

### 目标

在云函数环境中：

- 允许实例复用时共享 PrismaClient
- 避免每次请求都重新初始化
- 失败时打印脱敏后的目标地址和错误原因
- 尽量减少冷启动连接成本

### 设计方案

1. 保留现有 `PrismaService` 的诊断能力
2. 增加“全局单例 PrismaClient”策略
3. 在云函数场景下避免重复 `new PrismaClient()`
4. 仅在实例首次初始化时进行连接尝试

### migration 策略

不再依赖“服务启动时自动迁移”。

改为：

- 本地执行 `prisma migrate dev`
- 线上发布前单独执行 `prisma migrate deploy`
- HTTP 云函数本身只负责提供 API，不承担 schema 迁移责任

## 7.6 鉴权与会话设计

当前方案已具备：

- 微信 `code2Session`
- JWT 签发
- 基于 token 的接口鉴权

本次不改鉴权模型，只迁移运行载体。

设计要求：

- 登录接口仍保留现有返回结构
- 小程序 token 存储逻辑尽量不改
- 鉴权守卫代码不因部署方式切换而产生语义变化

## 7.7 REST API 兼容策略

本次改造要求优先保持以下兼容性：

- 路径前缀继续为 `/api`
- 现有接口 method 不变
- 现有返回字段尽量不变
- 错误码结构尽量不变

这样前端仅需要修改：

- API 基础域名

不强制要求同步重写调用层。

## 7.8 实时能力设计

### 第一阶段策略

第一阶段不强制恢复原 WebSocket 方案，改为：

- 页面进入时拉取快照
- 关键写操作成功后主动刷新
- 必要时增加轻量轮询

原因：

- 先把“可部署、可连库、可用接口”跑通
- 避免在同一阶段同时处理 HTTP 云函数 + MySQL + WebSocket 三重变量

### 第二阶段策略

如果第一阶段稳定，再评估恢复实时能力：

- 方案 A：HTTP 云函数的 WebSocket 支持
- 方案 B：SSE + 页面局部刷新
- 方案 C：保留轮询，不恢复长连接

当前建议：

- 第二阶段再做技术选型，不在本轮强绑定

## 7.9 健康检查与可观测性

云托管的 3000 端口 readiness probe 会被移除，改为函数级可观测性。

保留并增强：

- `/api/health`
- 数据库连接诊断信息
- 启动日志
- 登录日志
- 关键业务写操作日志

目标：

- 能从云函数日志快速判断失败点
- 能区分“函数未启动”“路由错误”“数据库错误”“微信接口错误”

## 7.10 部署模型设计

部署分为两类：

### 本地开发

- `backend/` 本地运行
- 本地 MySQL
- 本地 `.env`

### 云上部署

- 构建 `backend`
- 生成函数部署目录
- 配置 HTTP 云函数
- 上传函数代码
- 注入环境变量

发布链路建议：

1. `backend/` 安装依赖
2. 生成 Prisma Client
3. 编译 NestJS
4. 拷贝 `dist`、`prisma`、生产依赖到 `cloudfunctions/backend-http`
5. 部署 HTTP 云函数

## 8. 对现有代码的影响

## 8.1 必改文件

- `backend/src/main.ts`
- `backend/src/prisma/prisma.service.ts`
- `backend/package.json`
- `backend/.env.example`

## 8.2 建议新增文件

- `backend/src/bootstrap.ts`
- `cloudfunctions/backend-http/index.js`
- `cloudfunctions/backend-http/package.json`
- `cloudfunctions/backend-http/scf_bootstrap`
- 构建 / 打包脚本

## 8.3 可移除或废弃文件

- `backend/Dockerfile`
- `backend/start.sh`
- 仅用于云托管部署的说明文档

说明：

这些文件不一定要立刻删除，可以先标记为“废弃”，等函数版本稳定后再清理。

## 9. 风险与应对

### 9.1 风险：HTTP 云函数无法访问 MySQL

应对：

- 先做最小 POC
- 若 Prisma 方案失败，回退为 `mysql2`
- 若函数网络仍不可达，重新评估数据库选型

### 9.2 风险：冷启动较慢

应对：

- 减少函数包体积
- 优化 Prisma 初始化
- 精简依赖
- 避免启动时做非必要任务

### 9.3 风险：WebSocket 无法快速恢复

应对：

- 第一阶段接受轮询降级
- 第二阶段再恢复实时能力

### 9.4 风险：前端调用地址切换引入联调问题

应对：

- 保持路径与返回结构稳定
- 只改基础域名
- 保留本地覆盖地址能力

## 10. 里程碑与验收标准

## 10.1 里程碑 M0：技术验证

验收标准：

- 最小 HTTP 云函数可部署
- 可成功执行数据库连通性检查

## 10.2 里程碑 M1：基础 API 可用

验收标准：

- `/api/health`
- `/api/auth/login`
- `/api/users/me`

均可在线上函数环境正常工作

## 10.3 里程碑 M2：核心业务链路可用

验收标准：

- 创建房间
- 加入房间
- 单人记账
- 批量记账
- 结算预览

可在函数环境跑通

## 10.4 里程碑 M3：前端联调完成

验收标准：

- 小程序切换到云函数 API
- 核心页面无阻塞
- 用户可完成完整业务主链路

## 11. 分任务清单

下面按“可以直接执行”的粒度拆分任务。

### T0. 方案验证

- `T0-1` 创建最小 HTTP 云函数样例
- `T0-2` 配置当前环境变量并部署
- `T0-3` 在函数内执行 MySQL `SELECT 1`
- `T0-4` 记录冷启动时间和错误日志形式

交付物：

- POC 代码
- 验证结论
- 是否继续保留 Prisma 的决定

### T1. 入口重构

- `T1-1` 抽取 Nest app 工厂入口
- `T1-2` 保持本地 `main.ts` 可继续开发
- `T1-3` 新增云函数运行入口
- `T1-4` 统一本地与线上配置加载方式

交付物：

- `bootstrap.ts`
- 调整后的 `main.ts`
- 云函数入口文件

### T2. 数据库连接改造

- `T2-1` 梳理 Prisma 在函数场景下的生命周期
- `T2-2` 增加全局单例复用策略
- `T2-3` 保留脱敏日志与连接诊断
- `T2-4` 去掉“启动即迁移”的依赖

交付物：

- 调整后的 `PrismaService`
- 明确的 migration 运行说明

### T3. 部署目录与构建脚本

- `T3-1` 新建 `cloudfunctions/backend-http`
- `T3-2` 编写打包脚本，将 `dist`、`prisma`、依赖复制到函数目录
- `T3-3` 准备函数入口 `package.json`
- `T3-4` 准备 `scf_bootstrap`

交付物：

- 可重复执行的构建脚本
- 可部署的函数目录

### T4. 配置迁移

- `T4-1` 更新 `.env.example`
- `T4-2` 梳理线上环境变量清单
- `T4-3` 移除云托管专用变量
- `T4-4` 新增函数运行所需变量说明

交付物：

- 更新后的配置模板
- 环境变量部署清单

### T5. 核心接口上线

- `T5-1` 健康检查接口验证
- `T5-2` 登录接口上线
- `T5-3` 用户信息接口上线
- `T5-4` 房间相关接口上线
- `T5-5` 记账和结算接口上线

交付物：

- 可访问的 HTTP 云函数 API
- 接口联调记录

### T6. 前端联调

- `T6-1` 调整小程序 API 基础地址
- `T6-2` 验证登录链路
- `T6-3` 验证首页、房间页、结算页、个人页
- `T6-4` 增加失败重试和错误提示

交付物：

- 可运行的小程序联调版本

### T7. 实时能力降级方案

- `T7-1` 梳理当前页面对实时更新的依赖点
- `T7-2` 以“写后主动刷新”替代原推送预期
- `T7-3` 必要处增加轻量轮询
- `T7-4` 明确后续是否恢复 WebSocket

交付物：

- 第一阶段非实时方案
- 第二阶段实时能力评估结论

### T8. 文档与清理

- `T8-1` 更新部署文档
- `T8-2` 更新测试清单
- `T8-3` 标记云托管相关文件为废弃

## 12. 当前实施进度

截至 2026-04-18，已完成以下内容：

- `T0` 最小验证已通过：HTTP 云函数可部署、可访问 CloudBase MySQL、`Prisma + MySQL` 可成功执行健康检查查询
- `T1` 入口重构已完成：已拆分 `bootstrap.ts`、本地 `main.ts`、云函数入口 `cloudfunctions/backend-http/index.js`
- `T2` 数据库连接改造已完成：函数场景下 Prisma 已支持单例复用、脱敏连接日志、超时与重试诊断
- `T3` 部署目录与构建脚本已完成：`cloudfunctions/backend-http` 与 `scripts/build-cloudfunction-backend.ps1` 可重复构建部署产物
- `T4` 配置迁移已基本完成：函数环境变量已注入 CloudBase，当前仍需替换生产级 `JWT_SECRET`
- `T5` 已完成基础 API 上线：`/api/health` 已在线验证成功，`/api/auth/login` 与 `/api/users/me` 路由已随函数上线，待按真实小程序登录链路继续联调

当前云上函数信息：

- 环境 ID：`cloud1-9gh8rxwd3720ac2-9c7088062`
- 函数名：`backend-http`
- 网关基础地址：`https://cloud1-9gh8rxwd3720ac2-9c7088062.service.tcloudbase.com/backend-http`
- 健康检查地址：`https://cloud1-9gh8rxwd3720ac2-9c7088062.service.tcloudbase.com/backend-http/api/health`

当前已确认的运行状态：

- 函数状态为 `Active / Available`
- 已绑定可用 VPC：`vpc-havlmdig`
- 已绑定可用子网：`subnet-ff9szsxr`
- 最近健康检查调用返回成功，数据库连接状态为 `connected=true`
- 最近一次冷启动日志显示初始化完成约 `2027ms`

下一步建议直接进入：

- `T5-2` 基于真实微信 `code` 验证 `/api/auth/login`
- `T5-3` 在获取 JWT 后验证 `/api/users/me`
- `T6-2` ~ `T6-4` 小程序联调与错误提示完善
- `T8-4` 稳定后清理 Docker 相关残留

交付物：

- 更新后的开发文档
- 更新后的部署文档

## 12. 建议执行顺序

建议严格按以下顺序推进：

1. `T0` 技术验证
2. `T1` 入口重构
3. `T2` 数据库连接改造
4. `T3` 构建与部署目录
5. `T4` 配置迁移
6. `T5` 核心接口上线
7. `T6` 前端联调
8. `T7` 实时能力降级
9. `T8` 文档清理

## 13. 本次设计的最终建议

本项目当前最稳妥的路径不是继续纠缠个人版云托管，而是：

- 保留 NestJS
- 保留 Prisma + MySQL
- 改为 CloudBase HTTP 云函数承载 API
- 第一阶段先放弃完整 WebSocket
- 先把登录、房间、记账、结算主链路跑通

这条路径的优点是：

- 保住现有代码资产
- 避开当前套餐限制
- 仍然保留后续扩展到更强实时能力的可能性

## 14. 参考文档

- HTTP 云函数：<https://docs.cloudbase.net/cloud-function/web-func>
- 函数类型对比：<https://docs.cloudbase.net/cloud-function/quickstart/select-types>
- 云函数 WebSocket：<https://docs.cloudbase.net/cloud-function/develop/websocket>
- 云函数 MySQL 集成：<https://docs.cloudbase.net/cloud-function/resource-integration/mysql>
- 云函数 VPC 配置：<https://docs.cloudbase.net/cloud-function/function-configuration/config>
- 云托管内网互联限制：<https://docs.cloudbase.net/run/deploy/networking/internal-link>
