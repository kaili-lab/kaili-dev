# 技术架构讨论记录

更新日期：2026-10-02

这份文件记录技术选型过程中的事实、比较和未决问题。已拍板事项以决策日志和需求正文为准；本文件不替代 `decisions.md`。

## 已确定

### Web 架构

- 首期使用 TanStack Start + React。
- 部署目标为 Cloudflare Workers。
- 采用模块化单体：公开站、后台、API 和定时任务共享一个项目与领域模型。
- 公开文章页使用运行时 SSR 返回完整 HTML，以满足基础 SEO；首期不采用 SSG 和发布后重新构建流程。
- 这些结论记录在 D-023。
- 前端与工具链（2026-10-12）：Tailwind v4、shadcn/ui（Base UI）、React Hook Form + Zod 4、unified + Shiki、CodeMirror 6、ESLint + Prettier、Vitest + Playwright，数据先用假数据、之后 Drizzle + D1。见 D-126；工程约束见 D-127。
- 已核对的版本事实（2026-10-14）：TanStack Start 从 1.169 起为稳定版（官方称 `@tanstack/react-start` 1.169 是第一个稳定版，版本号没有重置成 1.0.0）。本仓库钉 `@tanstack/react-start` 1.169.1、`@tanstack/react-router` 1.170.44。复核时 npm `latest` 已是 1.169.2（2026-10-14T14:52Z 发布，仍精确依赖 react-router 1.170.44，release note 只有依赖提升），本次不追这个 patch。2026-10-12 核对时官方文档仍标 Release Candidate，npm 为 1.168.61。Cloudflare 有官方 TanStack Start 指南；shadcn/ui 自 2026-07 起默认 Base UI；`eslint-plugin-better-tailwindcss` 4.9 支持 Tailwind v4。见 D-166。
- 基础 SEO 与自动网站地图按 D-082 实现；具体框架接入和现有 Google 平台配置在上线前核对。仅使用公开内容，保持 D-034 的保存与发布边界。
- 封面图和 OG 分享预览按 D-083 / D-084 实现；封面图由 AI 按用户操作生成，OG 图由应用根据已发布文章信息生成，不在每次分享时调用 AI。具体任务卡另行确定。

### 数据库

- 首期结构化数据使用 Cloudflare D1。
- 选择依据：当前是单用户、低写入、关系型内容系统；文章、资源、标签、来源关系和事件模型可以用 SQLite 表、外键、索引和事务性 batch 表达。
- D1 不是 PostgreSQL。D1 使用 SQLite 语义；Cloudflare 通过 Hyperdrive 连接外部 PostgreSQL，但 Hyperdrive 本身不是数据库。
- 这些结论记录在 D-024；D-025 澄清了迁移和未决范围。

## 对照验证

验证目录：`kaili-stack-spike/`（独立的本地验证项目，不在本仓库中）

TanStack Start 与 React + Hono 都验证了：

- production build；
- Wrangler dry-run；
- 动态文章 URL；
- API 响应；
- Cron scheduled handler。

结果：

- TanStack Start 默认提供 SSR、动态 metadata、server route 和 Worker 入口。
- React + Hono 默认是 SPA 壳；加入最小 `react-dom/server` 路由后，也能在 Workers 返回完整文章 HTML。
- React + Hono 的额外边界包括 server document、SSR 路由、metadata 和后续 hydration。
- 两者都可行；TanStack Start 以较少的自建 SSR 边界满足当前目标，因此在 Kai Li 接受 RC 风险的前提下选择 TanStack Start。

详细结果见 `kaili-stack-spike/RESULTS.md`。

## Cloudflare 能力与成本事实

以下是当前官方文档显示的额度和能力，额度可能随计划与官方政策变化：

### R2

R2 Standard storage 当前每月包含：

- 10 GB-month 存储；
- 100 万 Class A 操作；
- 1000 万 Class B 操作；
- Internet egress 免费。

文章图片使用 Cloudflare R2 已由 D-046 / D-048 确定：上传为临时对象、保存时登记引用、对象保持私有，匿名只读已发布版本引用。网页快照、附件等其他对象的存储与访问策略仍未确定。来源：<https://developers.cloudflare.com/r2/pricing/>

### D1

当前官方文档显示 Workers Free 包含：

- 每日 500 万行读取；
- 每日 10 万行写入；
- 账户总计 5 GB 存储；
- Free 单库 500 MB，Paid 单库 10 GB。

真实边界：

- 单个 D1 数据库单线程处理查询；
- 单个字符串、BLOB 或行最大约 2 MB；
- 单条 SQL 最长执行时间 30 秒；
- 读取和写入额度达到上限后，Free plan 查询会失败，直到额度重置或升级。

D1 支持外键、索引、事务性 batch、JSON 函数和 FTS5。FTS5 能支持基础全文检索，但中文分词和相关性排序仍需验证。来源：

- <https://developers.cloudflare.com/d1/platform/limits/>
- <https://developers.cloudflare.com/d1/platform/pricing/>
- <https://developers.cloudflare.com/d1/sql-api/sql-statements/>

D1 的全球读复制可以降低读延迟，但写入仍然到 primary；读复制不是中国大陆速度保证，是否启用需要以后按实际部署测量。来源：<https://developers.cloudflare.com/d1/best-practices/read-replication/>

### PostgreSQL 与 Hyperdrive

Cloudflare Workers 可以通过 Hyperdrive 连接外部 PostgreSQL。Hyperdrive 提供连接复用和查询缓存，不托管 PostgreSQL 数据库。外部 PostgreSQL 提供商的费用与 Hyperdrive / Workers 费用分开计算。来源：

- <https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/>
- <https://developers.cloudflare.com/hyperdrive/platform/pricing/>

如果未来迁移到 PostgreSQL，至少需要：

1. 从 D1 导出 SQLite SQL 或通过数据导出流程读取数据；
2. 转换 SQLite schema、字段类型和 SQL 方言；
3. 转换事务和批处理调用；
4. 导入 PostgreSQL；
5. 验证行数、外键关系、时间字段和业务查询；
6. 重建全文索引；
7. 切换数据访问适配器；
8. 准备回滚方案。

D1 官方导出当前不支持含 FTS5 虚拟表的数据库；需要先移除或单独处理虚拟表，再从原始内容重建搜索索引。导出过程还会阻塞其他数据库请求，因此不能承诺零停机迁移。来源：<https://developers.cloudflare.com/d1/best-practices/import-export-data/>

首期只要求业务代码不直接散用 D1 binding；不提前实现第二数据库适配器，也不强制使用所谓“跨数据库自动兼容”的工具。

## 后台任务

### Cron

Cron Trigger 只负责按 UTC 时间启动 Worker 的 `scheduled()` handler。适合简单周期任务，例如同步 GitHub、检查待处理任务、定期启动调研。来源：<https://developers.cloudflare.com/workers/configuration/cron-triggers/>

### Workflow

Workflow 适合多步骤、需要重试、暂停、等待外部事件或持久化状态的任务。资源调研可以是：抓取来源、保存快照、调用 AI、保存结果、等待人工确认。Workflows 当前官方文档显示 Free 和 Paid plan 均可用。来源：<https://developers.cloudflare.com/workflows/>

### Queue

Queue 用来缓冲和批量处理大量相互独立的消息，适合批量抓取多个资源或把突发任务从请求中解耦。第一版不提前引入；只有出现任务量、突发流量或明确的生产者/消费者解耦需求时再加。来源：<https://developers.cloudflare.com/queues/>

当前最小组合建议：

```text
简单周期任务：Cron
多步骤 AI 调研：Workflow
大量独立任务：以后再引入 Queue
```

## 逐项讨论队列

以下队列只列仍未决的技术实现或产品落点；已定事项以 `requirements.md` 和 `decisions.md` 为准。

1. **资源与 Idea 数据模型及界面**：Resource 字段、Idea 字段/状态/界面，见 requirements §3.4–§3.5 与 todo P1。
2. **语言 URL 的技术实现**：记住语言选择的存储、缓存和服务端行为；不重新讨论 D-027、D-036 的产品契约，也不重新讨论 D-037 的 query string 筛选。
3. **其他对象存储**：网页快照、附件等对象的存储、上传和访问策略；文章图片和 X 推文图片使用 R2，分别见 D-046 / D-048 与 D-058。
4. **关键词搜索与向量检索实现**：D-081 已确定第一版文章提供两种搜索；公开搜索只读当前语言的已发布文章，不包含草稿、Resource、`thought` 或 Idea。后台 Resource / Idea 搜索仍按 D-056 / D-074 / D-075。模型、存储、索引更新、排序和技术复用方案在实现阶段选择并验证，不预设统一公开搜索；须验证保存不公开、发布后搜索更新，以及中文和英文查询效果。
5. **身份与权限实现**：D-051 已确定统一账户/session 及 GitHub OAuth、密码登录、Passkey 三种入口；仍需确定具体接入流程、账户绑定和 Chrome 插件身份调用方式。
6. **后台任务**：Cron、Workflow、Queue 的适用边界；临时图片清理的执行方式仍待确定，边界按 D-047 验收。
7. **运行配置**：secrets、环境区分、日志和错误告警。
8. **AI 能力、研究 Agent、Chat 与 MCP 实现**：D-087 至 D-092 已确定模型配置、X 推文研究 Agent、文章编辑器 Chat、公开个人 Chat 和 MCP Server 的产品范围；D-090 已确定 AI-native 任务卡流程。仍需确定供应商接入、API key 安全存储、Chat / Agent 工具、任务状态、预算、引用、报告保存，以及 MCP 工具、权限、认证和部署方式。

### 当前讨论：资源与 Idea 数据模型

D-045 至 D-048 已确定文章编辑器基本方向和图片生命周期边界；D-067 已确定文章使用 PostResource / PostIdea 参考资料列表；D-070 至 D-073 已确定 Idea 后台入口、共用编辑器、手动保存和排序；D-080 只确定 Idea 临时页面布局；D-087 至 D-092 已确定 AI 配置、Research Agent、两种 Chat 和 MCP 范围。最终管理端与公开页面 UI、AI 任务卡和参考资料 Agent 对话框后续单独设计，不纳入当前模型。

## T3.4 · Cloudflare OG PNG 生成方案（2026-10-13）

依据 `design.md §7`，输出固定 1200×630、始终浅色，只读取最终正式页面语言的已发布标题、摘要、分类与日期。不能通过任意 HTML / URL 输入读取草稿，不能为爬虫另设英文优先规则。

| 比较项 | A：Satori standalone → SVG → resvg WASM → PNG | B：Cloudflare Browser Run 截图 API |
|---|---|---|
| 渲染位置 | 当前 Worker 内排版并栅格化，不启动浏览器 | Worker 发起服务端截图请求，由 Cloudflare 的 Chromium 渲染 |
| 版式与字体 | 使用显式本地字体数据；须验证纸纹、字体切片、标题测量及省略号，不假定所有浏览器 CSS 都一致 | 可复用真实 HTML / CSS；等待字体就绪后截图，浏览器排版更接近 `k2-og.html` |
| 新前置 | 安装 `satori@0.55.1`（实测不可用，已由 D-151 改为 0.32.0）、`@resvg/resvg-wasm@2.6.2`；WASM 以预编译模块导入，不运行动态编译 | Cloudflare account ID、服务端 API token 和 Browser Run 额度；不能将 token 发给浏览器 |
| 资源与成本 | 无单独浏览器小时账单；占 Worker CPU / 内存。Free CPU 为10ms，请求是否满足须实际测量，不能先保证免费可用 | Free 每日10分钟浏览器时间；Paid 每月10小时，超出后$0.09/小时；Quick Actions 不收并发浏览器费用 |
| 冷启动与可靠性 | 两份 WASM 分别为519494、2478606字节（0.32.0 的 yoga.wasm 为 71,736 字节，见下方实现结果）；实际 Worker 包体和运行耗时待实现测量，不能把 npm 解包大小当部署大小 | 每次未缓存生成另有截图 API 请求及浏览器渲染；账号额度或凭据故障会影响生成 |
| 发布后更新 | 从公开版本读取并生成，可接入 T5.4 的保存不变 / 发布更新联验；不以构建时固定图片冒充动态发布 | 同样须读取公开版本，截图 HTML 不能混入编辑中内容；远端读取另有网络前置 |
| 当前可执行性 | 没有账号凭据前置，安装授权后可在本地 workerd 验证真实 PNG | 现有仓库没有此能力所需凭据，当前只能完成方案研究，不能声称已实测 |

按 D-147 推荐并选 A：这个站只需要固定版式的文章卡片，不值得为截图增加一个带凭据、额度和远程调用的运行依赖。选择不等于实现通过；须在真实 Worker 环境证明字体、纸纹、PNG尺寸、60px / 50px / 三行省略号，以及已发布语言隔离。Kai Li 已明确允许本次安装，两个包已按指定版本安装（D-149）；不部署，不提前把尚未运行验证的实现标成通过。

**实现结果（2026-10-13，D-151）：**实测 satori@0.55.1 在 workerd 中无法加载（内嵌 harfbuzz wasm 运行时编译、读取 `self.location`），改用 0.32.0（yoga.wasm 71.7 kB，gzip 29.0 kB）+ resvg 2.6.2（2,478.6 kB，gzip 965.2 kB）。`wrangler deploy --dry-run` 显示两者均为 `compiled-wasm`，总上传 6112.04 KiB / gzip 1665.17 KiB。本地开发 workerd 中单张卡片墙钟时间约 170–240ms（含读取 14 个字体文件）；未测到 CPU 时间，但量级明显超过 Workers Free 的 10ms CPU，部署前须用 Paid 计划或在发布时生成并缓存，见 todo。

已核实的官方与发布包来源：

- Satori 字体、standalone 和字体路径嵌入：<https://github.com/vercel/satori#readme>；0.55.1 的 `init` 接受 `WebAssembly.Module`：<https://unpkg.com/satori@0.55.1/dist/standalone.d.ts>；现用 0.32.0 同样接受：<https://unpkg.com/satori@0.32.0/dist/standalone.d.ts>，其依赖不含 harfbuzzjs：<https://registry.npmjs.org/satori/0.32.0>。
- resvg WASM 的 `initWasm` 接受 `WebAssembly.Module`，输出 `asPng()`：<https://unpkg.com/@resvg/resvg-wasm@2.6.2/index.d.ts>。
- 两个发布包及二进制字节数：<https://registry.npmjs.org/satori/latest>、<https://registry.npmjs.org/@resvg/resvg-wasm/latest>、<https://unpkg.com/satori@0.55.1/?meta>、<https://unpkg.com/@resvg/resvg-wasm@2.6.2/?meta>。
- Workers 只接受预编译 WASM：<https://developers.cloudflare.com/workers/runtime-apis/webassembly/>；当前额度和 CPU / 内存 / 包体限制：<https://developers.cloudflare.com/workers/platform/limits/>。
- Browser Run 的 HTML / URL 截图与等待策略：<https://developers.cloudflare.com/browser-run/quick-actions/screenshot-endpoint/>；成本：<https://developers.cloudflare.com/browser-run/pricing/>。

