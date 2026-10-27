# 实施计划与分工（D-130 的展开）

更新日期：2026-10-26

## 进度（每个会话结束时更新这一节）

**找下一步只看这里。**任务按表格顺序做；状态写在下表，任务细节和验收标准在后面各阶段的表格里。

| 编号 | 谁做 | 状态 |
|---|---|---|
| T1.1 项目与工具链 | GPT | ✅ 已完成 |
| T1.2 `AGENTS.md` | Sonnet | ✅ 已完成（46 行；`CLAUDE.md` 符号链接已建） |
| P1 检查点 | Sonnet | ✅ 已通过；T2.1 在途格式问题已修复，2026-10-12 最终 `pnpm check` 47/47 通过 |
| T2.1 token 与 Tailwind 主题 | GPT 执行 / DeepSeek + 3R Grok 4.7 复核 | ✅ 机器验收完成：规范色值、对比度、默认色板清空；原始证据见 `docs/notes/2026-10-12-P2.md` |
| T2.2 自托管字体 | GPT 执行 / DeepSeek + 3R Grok 4.7 复核 | 机器验收完成：文楷 262 字真实子集、六字体本地请求、404 后备与慢速 3G 实测；性能及格线已按 D-152 定于首页并由 T3.5 测量（字体就绪时间只记录） |
| T2.3 三档主题 | GPT 执行 / Kimi 最终复核 | 已完成：`/zh`、`/en` 首绘、阻断外部脚本、水合、手动浅深覆盖系统、自动清除记录、系统偏好变化、刷新与 localStorage 不可用共24场景通过；Kimi 整改点复核无剩余实质缺口。原始证据 `artifact://429`、`artifact://430` |
| T2.4a 间距清单 | GPT 执行 / DeepSeek + 3R Grok 4.7 复核 | ✅ 已完成，11 个文件、285 条声明、407 个值；`spacing-inventory.md` 与源文件核对通过 |
| T2.4b 间距方案 | GPT → 你拍板 | ✅ 已完成：已批准 v2，整档保留 18px，其余沿用 v1；完整映射见 `spacing-proposal-v2.md`（D-139）。71 条 / 407 次核对通过；DeepSeek 与 3R Grok 4.7 文档同步复核通过，记录见 `docs/notes/2026-10-13-T2.4b-v2-*` |
| T2.5 K2 组件与 `/_design` | GPT 执行 / DeepSeek + 3R Grok 4.7 复核 | ✅ 机器验收与双模型复核通过；Kai Li 2026-10-25 批准当前公开站布局基准，开发专用配色切换器不纳入生产页面视觉基准。旧 HTML 参照稿按本轮明确选择继续保留。既有证据 `docs/notes/2026-10-13-T2.5.md`，本轮基准在 `docs/notes/2026-10-25-visual-baseline/` |
| T2.6 背景三变体 | GPT → 你选 | ✅ 实现与选型完成：Kai Li 选择当前纸纹（D-141）。三变体36场交互、最终84项实际像素对比度、check57/57、build、dry-run、Playwright15/15通过；点阵半径问题已修正，默认纸纹不变。证据见 `docs/notes/2026-10-13-T2.6.md` |
| P2 检查点 | Grok 复核 → 你确认 | ✅ Kai Li 2026-10-25 批准当前公开站布局；中英五类页面 × 1440 / 820 / 390 × 浅深 60 场已在生产预览生成本地基准，`pnpm test:visual` 像素回归 60/60 通过，均无横向溢出、无开发切换器。旧 HTML 参照稿与当前内容/配色不同，按本轮要求保留，不作为当前页面像素基准 |
| T3.1 双语路由用例表 | GPT 执行 / 3R Grok 4.7 复核 | ✅ 用例表已完成并复核通过；D-142 固定语言回退与手动偏好，D-143 已解决 §8 的 Q-1/Q-2/Q-3。历史 Grok 复核保留。用例表：`docs/product/routing-use-cases.md` |
| T3.2 双语路由实现 | GPT 执行 / wokey Kimi K2.8 Preview 复核 | 已完成（D-145 路由阶段）：check68/68、build、dry-run、生产行为78/78、60张路由截图及18次真实RPC；Kimi 源码复核通过，契约复核发现的英文主题缺口补齐后再次通过。原始证据 `docs/notes/2026-10-13-T3.2.md`；R-SEO-04/05 联验与 T6.1 仍未完成 |
| T3.3 公开页面迁移 | GPT 执行 / Kimi 复核 | ✅ 页面机器验收、X / LinkedIn 个人地址和 Kai Li 的视觉批准均完成：2026-10-25 中英文生产外链专项 6/6、公开站完整回归 127/127、生产布局基准 60/60。HTML 参照稿按用户要求保留。既有证据 `docs/notes/2026-10-13-T3.3.md`，本轮见 `docs/notes/2026-10-25-T3.3-visual.md` |
| T3.4 OG 图 | Claude 执行 / GPT-6.1 Sol 复核（D-150） | ✅ 历史实现完成（D-149 / D-151），后由 D-175 取代：当时以 Satori 0.32.0 + resvg WASM 在 Worker 内生成并完整验证 1200×630 PNG；2026-10-26 因免费额度优先删除运行时生成链路，设计和证据保留用于说明取舍。证据 `docs/notes/2026-10-13-T3.4.md` |
| T3.5 首屏限速测量 | Claude 执行 / GPT-6.1 Sol 复核（D-150） | ✅ 已完成：及格线 D-152（冷缓存 FCP ≤ 4s、LCP ≤ 6s；同上下文重访 FCP ≤ 1.5s），补充 D-157。首次测量 FCP 31.4s，字体声明移出关键路径、缩略图 280 / 640px 并延迟加载后 FCP 约 3.6s；首绘时缩略图为空框是有意识的取舍。GPT 第 3 轮复核通过。证据 `docs/notes/2026-10-14-T3.5.md` |
| P3 检查点（视觉验收） | 你 | ✅ Kai Li 2026-10-25 批准当前公开站布局；生产基准位于 `docs/notes/2026-10-25-visual-baseline/`，命令 `pnpm test:visual`，中英五类页面 × 1440 / 820 / 390 × 浅深共 60/60；旧 HTML 参照稿按本轮要求保留，暂不删除 |
| P4 文章列表（T4.1a ~ T4.2） | Claude 执行 / GPT-6.1 Sol 复核 | ✅ 已完成：设计说明、3 方案 108 张截图、选定 A（D-153）、design.md §9、筛选与 query 规则（D-154）、零篇语言页面级验证；GPT 第 4 轮复核通过。证据 `docs/notes/2026-10-14-T4.md` |
| T5.1 文章版本状态用例表 | Claude、GPT-6.1 Sol 各自独立写 → 对比 | ✅ 已完成：前置 D-155；两份底稿对比后 D-156 裁决；正式表 `docs/product/article-state-cases.md` 117 个编号 |
| T5.2 状态纯函数 | Claude 执行 | ✅ 已完成：`src/features/article-versions.ts`；`tests/article-versions.test.mjs` 256 个用例，主表 64 行从正式表读取 |
| P5 检查点（测试与用例表对应） | GPT-6.1 Sol 复核 | ✅ 通过（第 2 轮），遗漏「无」。证据 `docs/notes/2026-10-14-T5.1-T5.2.md` |
| T5.3a 后台信息结构 | Claude 起草 / GPT-6.1 Sol 复核 | ✅ 已完成：`docs/product/admin-design-note.md`，补充 D-158、D-160；第 3 轮复核通过 |
| T5.3b / T5.3c / T5.4 后台 | Claude 执行 / GPT-6.1 Sol 复核 | ✅ 已完成：方案 84 张截图、选定列表 B + 编辑器 B（D-159）、design.md §9 管理端；后台（开发环境假登录 Kai Li）、CodeMirror 编辑器、Idea、分类标签；开发服务器 e2e 31/31（含 R-SEO-04/05 中英文联验、T6.1 联验、绕过表单、请求期间编辑、离开提示）；生产不可达。GPT 第 4 轮复核通过。证据 `docs/notes/2026-10-14-T5.3-T5.4.md` |
| T5.5 后台改为传统布局（D-161 ~ D-163） | Claude 执行 / GPT-6.1 Sol 复核 | ✅ 已完成：左侧导航、表格 + 分页（每页 15 条，页码与筛选在网址参数）、编辑器右侧边栏、对照另一种语言、编辑 / 分栏 / 预览、Base UI 弹窗替代 `window.confirm`、主题滚动条、页脚去字体说明。check 431/431、build、dry-run、生产 Playwright 122/122、后台 36/36。GPT 第 2 轮复核通过（第 1 轮 4 项 P2、2 项 P3 已关闭）。证据 `docs/notes/2026-10-14-gates-output-13.txt`、`docs/notes/2026-10-14-T5.5-review-r*.md` |
| T5.6 Idea 列表与详情（D-164） | Claude 执行 / GPT-6.1 Sol 复核 | ✅ 已完成：快速输入「保存」并入输入框上方一行并支持 ⌘Enter；列表内容单行省略、可点击；详情页默认预览（`?mode=edit` 编辑），显示时间、关联文章、「用它写文章」「删除」。check 431/431、build、dry-run、生产 Playwright 122/122、后台 39/39。GPT 第 3 轮复核通过。证据 `docs/notes/2026-10-14-gates-output-16.txt`、`docs/notes/2026-10-14-T5.6-review-r*.md` |
| T5.7 文章撤下与删除（D-176） | Claude 执行 / Cursor Opus 5.5 方案评审 / OpenCode DeepSeek v4.1 Flash 代码复核 | ✅ 已完成：按语言撤下并可恢复；所有语言均撤下或从未发布后才允许永久删除；withdrawn 媒体私有引用、D1 级联与七天清理、sitemap、公开页、中立链接和 revision 并发保护均通过。最终 `pnpm check` 458/458、生产 Playwright 47/47、build、dry-run（4240.38 KiB / gzip 884.00 KiB）；复核无 Critical / High。 |
| T6.2 站内客户端跳转（D-165） | GPT-6.1 Sol 起手（中途停止）/ Claude 接手完成 / GPT-6.1 Sol 复核 | ✅ 已完成：公开站站内链接改为客户端跳转（`K2Link` + `isClientPageHref`），切换筛选、导航不再整页刷新和字体抖动；语言切换保留 D-036 / D-142，提示离开地址即清除；筛选链接按实时地址生成（修复复核中发现的连续点击丢条件竞态）。check 447/447、build、dry-run、生产 Playwright 连续 3 次 125/125、后台 39/39。GPT 第 3 轮复核通过。证据 `docs/notes/2026-10-14-gates-output-19.txt`、`docs/notes/2026-10-14-T6.2-review-r*.md` |
| T2.7 暖白默认配色（D-169） | Claude 规格 / Gemini 3.8 Flash 子代理执行 / GPT-6.1 Sol 复核 | ✅ 已完成：默认暖白浅深两套、开发切换器、`.prose th` 次墨线、规范 / audit、OG 黄金哈希。提交前发现开发环境初始化脚本拼接报错，已修复并增加刷新恢复的浏览器回归。check 452/452、build、dry-run、生产 Playwright 125/125、后台 40/40 通过；原两轮复核见 `docs/notes/2026-10-25-T2.7-review-r*.md`，新增脚本修复及回归由 GPT-6.1 Sol 再次独立复核，无代码阻塞。只冻结 D-169 配色，不代表 P2 / P3 全站视觉基准批准。 |
| T6.1 基础 SEO 联验与网站地图 | Claude 执行 / GPT-6.1 Sol 复核（D-150） | ✅ 已完成：`/sitemap.xml` 只含公开正式页，hreflang 与页面一致，XML 经真实解析；保存发布联验（保存不变、首次发布只新增该语言页、再发布更新 lastmod、另一语言不变）在后台 e2e 完成；GPT 第 5 轮复核通过。证据 `docs/notes/2026-10-14-T6.1.md` |
| T7.1 上线资源与数据前置 | 执行者 / Kai Li | ✅ 准备完成（未部署）：独立 D1 `kaili-dev`、R2 `kaili-dev`、DB / MEDIA binding、Drizzle、GitHub OAuth App、本地与生产 secrets 均已准备；真实本地 GitHub 登录成功。远端 D1 保持空库，生产回调和域名切换留 T7.6。隐私数据未进入模型或远端 |
| T7.2 Drizzle + D1 数据层 | 执行者 / 3R Grok 4.7 复核（D-174） | ✅ 已完成：公开站、后台和 sitemap 全部切到请求绑定 D1；迁移链保全子记录；保存发布跨请求持久、事务回滚、双窗口修订冲突、taxonomy 与 slug 竞态均覆盖。D-175 后分享图不再读取 D1。Kimi 整改复核通过；Grok 最终复核通过。证据 `docs/notes/2026-10-26-T7-gates.md` |
| T7.3 GitHub OAuth 与 session | 执行者 / 3R Grok 4.7 复核（D-174） | ✅ 已完成：真实 GitHub `read:user` 登录、数字 ID 允许值、HMAC 一次性 state、D1 session、统一后台鉴权、同源退出均通过；浏览器保存原始随机 ID，D1 只存 SHA-256 摘要，复制数据库摘要不能登录。生产 secret 只核对名称，未读取值；未切生产回调。Grok 最终复核通过 |
| T7.4 R2 私有图片闭环 | 执行者 / 3R Grok 4.7 复核（D-174） | ✅ 已完成：鉴权上传、D1 先登记再写 R2、四槽位原子引用、匿名只读公开引用、后台可读草稿、无效图片拒绝与实际媒体响应均通过；未上传真实内容。Kimi 与 Grok 复核通过 |
| T7.5 图片清理与分享元数据 | 执行者 / 3R Grok 4.7 复核（D-174 / D-175） | ✅ 已完成：Cron 每日触发；恰好七天、引用恢复、墓碑竞态、R2 删除失败重试和每批 100 条已实测。D-175 删除运行时 OG PNG、Cache API 和 CPU 前置，改为同源静态站点分享图；Grok 复核通过，线上 PNG 为 1200×630 |
| T7.6 workers.dev 部署与验收 | 执行者 / Kai Li | ✅ 已授权范围完成：远端 D1 `0000`–`0004` 已应用，Worker 版本 `d0ba5ba6-f5aa-4f28-8328-16553d03a391` 部署到 `https://kaili-dev.nautilus1876.workers.dev`；公开页、SEO/sitemap、静态分享图、空 D1、R2、GitHub OAuth 可配置性、后台鉴权和 Cron 已在线验收。未替换 `kaili.dev`，未改 DNS / custom domain / route，未切生产 OAuth 回调 |
| 质量约束方法文档（非功能实施任务） | GPT 整理 / Cursor Opus 5.5 medium 方法复核 | 已记录框架与候选路线，见 [ai-coding-quality.md](ai-coding-quality.md)；后续按现状与风险逐项选择，本轮未实施门禁、未改变 T7 状态或部署授权。 |
| T8.0 主密钥与测试连接 | Kai Li | 本地 `.dev.vars` 已写入 `AI_MASTER_KEY`；生产 secret 与测试连接留到部署和 T8.6 |
| T8.1 – T8.5 AI 接入层与 slug 候选 | 其他模型执行 / Claude 验收（D-186） | ✅ 已执行并经 Claude 验收（2026-10-27）。验收中修正一处：主密钥格式正确但无法解密已存密文时，调用器原先抛出未捕获异常，现返回 `config` 并记一条调用，补回归测试。未提交、未推送 |
| T8.6 最终验收 | Claude / Kai Li | Claude 部分 ✅：check 559/559、build、dry-run、后台 Playwright 62/62；`dist` 与测试输出中无 `sk-test-0000` / `ai-mock.test` / `mockFetch`；无新依赖，分层 lint 通过。**待 Kai Li：**真实中转连接手测；生产 `AI_MASTER_KEY`、远端迁移 `0008` 与部署（推送 `main` 即触发）由 Kai Li 决定 |
| T8.7 平台与模型挑选改版（D-187） | Claude 规格 / Sonnet 执行 / Claude 验收 | 代码完成，未提交：迁移 `0009`（去平台优先级与默认模型表，模型加调用顺序，能力改为对话 / 画图 / 向量）；查询模型改为勾选后保存；调用顺序可上移下移；平台级失败跳过同平台模型。check 571/571、build、dry-run、后台 Playwright 63/63。待 Kai Li 本地测试后提交；远端迁移 `0009` 随推送 `main` 自动执行 |

规则：

1. 每个会话开头说「读 `docs/product/README.md` 和 `implementation-plan.md`，做 Tx.x」。
2. 适用验收和独立复核均通过后，才在上表把任务标成 ✅，并更新 README 的「当前阶段」；部分完成或受阻须写明事实，不将 todo 提前标完成。
3. GPT 完成产出和适用验收后，自动调用 wokey 的 Kimi 2.X 独立只读复核，无需 Kai Li 再开会话或确认；修正、重新验证后自动复核修改点。同阶段互不依赖的任务可以同时推进。

## 分工原则

2026-10-12 起，Claude 额度不足，T1.2 之后的任务不再使用 Claude（D-137）。原则是：**写的模型和查的模型不能是同一个。** 2026-10-13 起，GPT 负责执行，wokey 的 Kimi 2.X 负责后续复核（当前登记为 Kimi K2.8 Preview，标识 `wokey/kimi-for-coding`，D-144）；高风险推导由两个模型各自独立完成，再对比差异；最后拍板的永远是 Kai Li。此前已完成的 Grok 复核记录保留原样。

**2026-10-13 起（D-150）：**其他执行模型额度不足，下文写「GPT 执行」的未完成任务改由 Claude 执行，「Kimi 复核」改由 omp 的 GPT-6.1 Sol（`gpt/gpt-6.1-sol`）复核；「你选」的方案按推荐先定并记录，视觉基准与真实外链地址仍由 Kai Li 提供。

| 标记 | 谁做 | 做什么 |
|---|---|---|
| **GPT** | GPT 顶尖模型 | 写代码、配置、测试、调研；从已定需求整理用例表和设计说明；同步文档；按设计说明做方案变体 |
| **Kimi** | wokey Kimi 2.X（当前 `wokey/kimi-for-coding`） | 独立只读复核：对照需求、决策和验收标准检查 GPT 产出，列出差异；高风险任务独立完成同样的推导 |
| **你** | Kai Li | 选方案、说出理由、确认视觉效果、裁决两个模型的分歧 |

### 三种做法

| 做法 | 用在哪里 | 怎么做 |
|---|---|---|
| GPT 执行 → 验收 → Kimi 复核 | 大部分实现任务 | GPT 完成适用机器与运行场景验收、附原始输出后，自动交 Kimi 独立复核；GPT 修正并重新验证，Kimi 复核修改点，均通过后才标完成 |
| GPT 写 → Kimi 复核 | 用例表、设计说明、文档同步、检查点 | GPT 自动交付需求、决策、验收标准和产出；Kimi 独立只读列出「不符 / 遗漏 / 无依据的新内容」，没有问题时写「无」；GPT 修正后再次复核 |
| GPT、Kimi 各自独立做 → 对比 → 你裁决 | T5.1（文章版本状态规则） | 两个模型互相看不到对方的结果，各写一份用例表；GPT 逐行对比，把确需产品决策的不一致项列给 Kai Li；不把代码或文档可查的问题交回用户 |

GPT 主动提供复核材料与目标：「复核 Tx.x 的产出；读取需求、决策、验收标准、当前工作区与原始验证证据，只列问题，不改文件」。复核不是需要用户再次授权的下一步。

### 每个 GPT 任务的通用要求

1. 开始前读根目录 `AGENTS.md`（P1 之后才有）和本文件里对应的任务。
2. 只改任务写明范围内的文件。不新增依赖、不改 token、不改 `docs/product/` 下的需求和规范；发现规范有缺口时停下来，写进下文「需要先定的事」。
3. 完成报告必须附上原始命令输出、测试场景、截图路径和结论；不接受只写一句「已通过」。
4. 实现过程中暴露的问题（规范没覆盖的情况、和预期不一样的地方）记到 `docs/notes/` 当天的文件里，这是写文章的素材。
5. 每条验收标准标明「机器」或「人工」。机器标准必须给出命令、输入夹具和可观察结果；人工标准必须写明检查材料、检查范围和通过条件。
6. 一项验收只在所有前置任务通过后才能标记完成。任务依赖写在对应任务行，不因处于同一阶段而默认可并行。

### 验收按成本从低到高

1. 机器门槛：`pnpm check`、`pnpm build`、`wrangler deploy --dry-run`；每个实现任务都附这三条命令的原始输出，除非任务明确标记为文档或方案任务。
2. 故意违规测试：确认约束真的会报错，并记录非零退出码和完整错误信息。
3. 行为测试：为每个编号用例提供固定输入夹具、期望状态码或页面文字、地址、数据状态和失败结果。
4. 截图：3 个宽度（1440 / 820 / 390）× 浅深两种模式，加 `scrollWidth === clientWidth` 检查；截图必须注明路由、状态和保存路径。
5. wokey Kimi 2.X 对照任务验收标准和关键改动独立只读复核，看实际断言、用例表、截图和原始输出；不将通过数量或测试标题中的编号视为完整验收，不通读无关代码。
6. 你看截图做视觉判断。第一次通过的截图成为基准，验收记录必须写基准路径和回归比对命令；通过前不得删除 HTML 参照稿。

## 需要先定的事（D-147：GPT 按推荐方案决定并记录）

| 事项 | 阻塞哪个任务 | 状态 |
|---|---|---|
| 「人的声音」用哪个字体 | T2.2 | 已定：霞鹜文楷，自托管 + 子集（D-131） |
| 文章列表网址里的分类或标签不存在时怎么处理 | T4.2 | 已定：忽略并跳转到去掉该参数的网址（D-132） |
| 原型阶段后台怎么进入 | T5.4 | 已定：只在开发环境，用假登录状态（D-132） |
| About 页与个人外链 | T3.3 外链验收 | About 已取消（D-135）；X `https://x.com/kaili_dev`、LinkedIn `https://www.linkedin.com/in/kai-li-696024230/` 已由 Kai Li 在 2026-10-25 提供，已接入公开页面。D-146 的“地址待提供”只描述当时阶段，不是当前要求 |
| 生产资源、登录、图片与部署前置 | T7.1–T7.6 | D1 与 R2 已创建，OAuth App / 生产 secret 已配置且本地真实登录完成；D-175 已取消动态 OG 的 CPU / 计费前置。远端空 D1 迁移与 `workers.dev` 部署已授权并在执行；真实内容迁移不在本轮，私密内容不得送入模型；`kaili.dev` 域名、DNS / route 与生产 OAuth 回调切换仍须另行确认 |
| 发布当前语言版本的必填字段（除分类外）及保存 / 发布各自校验哪些字段 | T5.1、T5.2、T5.4 | 已定：D-155；T5.1 对比后的补充裁决 D-156 |
| 文章列表 query 参数的空值、多余参数和大小写不同 slug 如何处理 | T4.2 | 已定：D-154 |
| 慢速 3G 的性能及格线 | T2.2、T3.5 | 已定：D-152（冷缓存 FCP ≤ 4s、LCP ≤ 6s；同上下文重访 FCP ≤ 1.5s；字体就绪只记录）。首次测量 FCP 31.4s 的原因与优化见 `docs/notes/2026-10-14-T3.5.md` |
| 移动端首屏行高、自我介绍与首篇标题字号，以及子页面介绍字号 | T2.5 | 已定：Kai Li 选择「沿用实际排版」（D-140）。≤640px 首屏中英行高1.22；自我介绍中英1.08rem，行高中1.8/英1.7；首页首篇1.18rem/1.35；子页介绍中文1.02rem/1.8、英文1.08rem/1.7。>640px子页中1.12rem/1.8、英1.08rem/1.7。正式规则见design.md §3；60场景实测、100次主规则与20次姓名继承断言通过，证据 `docs/notes/2026-10-13-T2.5-typography*`；不是组件验收 |
| 冷调中性色是否取代宣纸 | 公开站视觉基准 | 已定：D-169，默认改为暖白；冷色只留在开发切换器里对照 |

## P1 · 项目与工具链

| 编号 | 任务 | 谁做 | 验收标准 |
|---|---|---|---|
| T1.1 | 用脚手架建 TanStack Start 项目，接 Cloudflare Vite 插件、Tailwind v4、shadcn（Base UI）、ESLint + Prettier、Vitest、Playwright；TypeScript 严格模式加 `noUncheckedIndexedAccess`；建 `src/routes`、`src/features`、`src/server/data` 三层目录；`.githooks/` 配合 `core.hooksPath`（D-126 / D-127） | GPT | 机器：`pnpm check`、`pnpm build`、`wrangler deploy --dry-run` 通过。固定夹具中页面导入 `src/server/data`、`bg-[#fff]`、`bg-blue-500`、`animate-spin` 各自被 lint 以非零退出码拦下；合法对照通过。失败的 `pnpm check` 通过提交钩子返回非零。依赖扫描没有 `tw-animate-css`。 |
| T1.2 | 写根目录 `AGENTS.md`（`CLAUDE.md` 是指向它的符号链接）：文档在哪、常用命令、不能破的规则（每条注明决策编号）、本文件的位置 | Sonnet | 机器：`wc -l AGENTS.md` ≤80；`test -L CLAUDE.md` 通过且 `readlink CLAUDE.md` 指向 `AGENTS.md`。人工：固定问答全部能在文件中找到：设计规范是 `docs/product/design.md`，验证包含 `pnpm check` / `pnpm build` / `wrangler deploy --dry-run`，未决事项回到本文件「需要先定的事」；每条规则有 D 编号。 |
| ✔ 检查点 | 对照 D-126 / D-127 检查配置，确认故意违规样例存在并且确实报错 | Sonnet | 逐项表格检查：严格模式、`noUncheckedIndexedAccess`、`src/routes` → `src/features` → `src/server/data`、`core.hooksPath`、`pnpm check` 的组成、无 `tw-animate-css`。四个违规样例仍在仓库或由固定夹具生成；每个 lint 退出码非零并附原始错误；合法对照通过。

## P2 · 设计系统基础

| 编号 | 任务 | 谁做 | 验收标准 |
|---|---|---|---|
| T2.1 | 按 design.md §2、§3 写 `src/styles/tokens.css`（浅色、深色两套）和 Tailwind 主题；对比度表写成测试（D-128） | GPT | **机器：**测试逐项读取 design.md §2 中表格和段落定义的全部颜色，断言浅深 token 值一致；按 WCAG 相对亮度重算所有非「—」组合，误差阈值写死并全部通过；扫描仓库十六进制值，唯一白名单是 `src/styles/tokens.css`。测试还断言 Tailwind 只登记 K2 颜色、字体、字号阶梯和 3px / 4px / 全圆角。 |
| T2.2 | 字体（D-131）：全部自托管；霞鹜文楷（简体）只保留内容文件里用到的字；Noto Serif SC 只要 400 / 600 / 900，按字符范围切片；写好后备字体栈；限速测试脚本 | GPT | **机器：**字体请求记录中所有字体 URL 均为本站，明确覆盖 `fonts.googleapis.com`、`fonts.gstatic.com`、`jsdelivr`；检查 Source Serif 4、Noto Serif SC、霞鹜文楷、Inter、IBM Plex Mono、Cormorant Garamond 的本地资源、字重、`font-display: swap` 和 token 后备栈。子集脚本列出明确扫描路径，内容文件中的每个字缺失即失败；文章正文作为数据内容使用字符范围切片，不假定静态子集。404 字体资源时页面仍有可见文字。慢速 3G 参数固定，输出首屏完成时间和字体加载时间；及格线由你看过第一次结果后补入记录。 |
| T2.3 | 主题三档（浅 / 深 / 跟随系统），服务端渲染时页面不闪一下浅色（D-116） | GPT | **机器：**验证内联主题脚本位于样式表之前，并在首个样式计算时断言背景是对应 `--paper`。覆盖系统深 / 浅且无记录、手动深 / 浅与系统相反、选择「跟随系统」后本地主题记录被清除、修改系统偏好后刷新、`/zh` 与 `/en`。每组都检查首屏颜色、刷新后的颜色和页面无横向溢出。 |
| T2.4a | 把 HTML 参照稿里用到的所有间距值整理成一张表（值、出现位置、次数） | GPT | **人工 + 机器：**范围明确包括 `docs/kaili.dev-mocks/` 中所有 HTML、`k2.css`、`k2-article.css` 的 `margin` / `padding` / `gap` / `inset`；如纳入行高或字距，表中单独列出。脚本扫描上述文件并与表格逐项对照，表中有值、位置和次数，不能只写概数。 |
| T2.4b | 根据上表提出一套间距刻度，以及每个旧值改成哪个刻度值 | GPT → 你拍板 | **人工：**每个旧值有唯一新值；“偏差大”给出明确阈值和单独清单。你拍板后，T2.5 和 T2.6 才能标记开始，并在任务记录中引用拍板版本。 |
| T2.5 | K2 组件（印章、文字封面、胶囊、板块标题、文章列表项、「此刻」面板、长文排版、顶栏、页脚）和按 K2 改样式的 shadcn 基础组件；开发环境专用的 `/_design` 页面 | GPT | **机器：**`/_design` 开发环境返回 200，生产构建真实请求返回 404，响应体不含设计页固定标记，网站地图不含该路由。**人工 + 截图：**清单覆盖 design.md §5 的全部组件，并逐项展示默认、悬停、键盘焦点、当前、空内容、浅色、深色和 390px 状态；禁止入场、位移、缩放、骨架屏动画，保留规范允许的颜色过渡。 |
| T2.6 | 背景质感三个变体并排（D-133）：现在的纸纹、加强的纸纹、很淡的点阵，各做浅色和深色，放在 `/_design` | GPT → 你选 | **机器：**三个变体同页切换，各有浅深版本；示例区域包含首页首屏和文章正文；按实际纹理渲染结果检查表中全部文字组合，对比度均 ≥4.5:1；变体不能泄漏到公开页面。**人工：**你从截图中选择一个，并记录选择理由；选择前不修改设计规范的默认纸纹规则。 |
| ✔ 检查点 | 对照 design.md 和 HTML 参照稿检查 `/_design` 截图，列出差异 | Grok 复核（看截图）→ 你确认 | 先确认机器检查和三种截图矩阵均通过；差异清单每条注明违反了 design.md 哪一节；通过后写入基准截图路径和回归比对命令，之前不得删除 HTML 参照稿。

## P3 · 迁移已完成的公开页面

| 编号 | 任务 | 谁做 | 验收标准 |
|---|---|---|---|
| T3.1 | 根据 requirements §2.2.1、§2.2.2、D-027、D-036、D-082、D-142 整理路由用例表：输入（网址、浏览器语言、哪些语言版本已发布、手动选过的语言）→ 期望（状态码、跳转目标、显示哪个语言、hreflang、是否显示一次性提示） | GPT 写 → Grok 复核 | **人工 + 机器：**每条用例有固定编号、页面类型、网址、`Accept-Language`（中文 / 英文 / 空 / 非中英）、本地语言选择、已发布版本、直接访问或按钮切换、状态码、目标地址、显示语言、canonical、hreflang、完整提示文案和刷新后的结果。必须分开验证：直接访问未发布语言文章为 404；从文章按钮切换才进入目标语言列表并只提示一次；中立链接遵守 D-142 的 `effective` 规则（有手动偏好用手动偏好，没有时才用浏览器语言），无对应版本时回退、两者未发布时 404。R-SEO-04/05/06 的验收落点按 D-145 保留到后续对应任务，不删用例。 |
| T3.2 | 假数据层、界面文字字典、`/zh` `/en` 路由、中立分享链接、hreflang | GPT | **依赖 T3.1 和 §8 的 Q-1/Q-2/Q-3。机器：**按 D-145，验收全部 R-ROOT / R-HOME / R-ARTICLE / R-SHARE / R-LANG / R-SEO-01~03 及静态草稿隔离；每条用例有同编号实际行为断言，重复操作可以合并但不能仅把编号放进标题。测试覆盖状态码、跳转、页面语言、canonical、hreflang 精确闭集、发布成员与排序、提示文字、刷新、新标签页 / 会话与横向溢出；两个读取 RPC 另做非法语言键的真实 HTTP 请求验证。页面和组件不直接读假数据；lint 对页面、组件、别名、相对路径和再导出均拦截数据层导入。R-SEO-04/05 保留到 T3.4 / T5.2 / T5.4 联验，R-SEO-06 归 T6.1；不以静态夹具冒充保存发布。 |
| T3.3 | 迁移首页、文章详情、Projects、书架，顺手做 404（用子页面页头） | GPT | **依赖 T2.3、T2.5、T3.2。机器：**中英文各页在 1440 / 820 / 390 × 浅深模式返回正确状态码，`scrollWidth === clientWidth`；Projects 和书架分别验证 3 条隐藏、4 条显示「全部 →」，文章入口两种数量都显示；目录 ≤960px 折叠；上一篇或下一篇缺一边时另一格留空；404 中英文都是真正 404 且使用子页面页头。首页导航只有写作 / 书架，无 About / 简历；自我介绍下和页脚各有邮件、GitHub、X、LinkedIn 外链，LinkedIn 真实地址提供前不得用占位地址标记验收通过。人工：与中英文参照稿并排检查后保存基准路径；通过前不得删除参照稿。
| T3.4 | OG 图：先调研在 Cloudflare Workers 上生成 PNG 的方案，给出两个方案的对比 → 你选 → 实现 | GPT（调研和实现）+ 你（选） | **依赖 T3.2 的已发布版本读取与生成方案拍板；v1 范围已按 D-082 / D-145 保留。机器：**输出 1200×630 PNG；固定三条标题夹具分别验证 60px、50px 和超过三行后的省略号；草稿标题与已发布标题不同的夹具必须输出已发布标题；爬虫与普通请求使用 D-143 的 effective 规则并跟随 302，OG 使用最终正式页面的已发布语言，不另设英文优先规则；两者未发布时不生成公开卡片。只使用已发布标题、摘要、分类和日期。R-SEO-04/05 的 OG 信息在 T5.4 联验真实保存前后不变、发布当前语言更新及另一语言不变；T3.4 本身不能用静态数据宣告这些联验通过。人工：保留两个方案对比材料，并按 `k2-og.html` 检查版式。 |
| T3.5 | 用限速脚本测首屏 | GPT | **依赖 T2.2、T3.3。机器：**复用 T2.2 的慢速 3G 参数，固定页面、冷缓存 / 同上下文重访（304 重新验证，D-157）条件、浏览器版本和指标定义；输出首屏完成时间、字体加载时间、原始请求记录和结果文件路径。及格线：D-152（冷缓存 FCP ≤ 4s、LCP ≤ 6s，同上下文重访 FCP ≤ 1.5s，字体就绪只记录），由执行者按 D-150 决定；未通过时不得删除参照稿或标记视觉检查点通过。 |
| ✔ 检查点 | 视觉验收；通过后把截图存为基准，删除对应的 HTML 参照稿（D-125） | 你 | 只有机器检查、行为测试和 3×2 截图矩阵都通过后才能确认；记录差异清单、基准截图路径和回归比对命令；确认后才删除对应参照稿。 |

## P4 · 文章列表

| 编号 | 任务 | 谁做 | 验收标准 |
|---|---|---|---|
| T4.1a | 写设计说明：哪些已经定了（`.post`、子页面页头、D-037 的筛选规则、D-036 的提示），哪些需要出方案比较（筛选控件的形态、空结果怎么显示、提示放在哪里） | GPT | 一页以内；分别列出已定规则和可变化范围；待比较项必须覆盖筛选控件、空结果、提示位置，并写出每个方案需要截取的默认 / 已筛选 / 空结果 / 提示状态。 |
| T4.1b | 按设计说明做 2～3 个差别明显的方案（放在 `/_design` 或临时路由） | GPT | **依赖 T4.1a。**每个方案有 1440 / 820 / 390 × 浅深截图，并覆盖默认、已筛选、空结果、语言切换提示；“差别明显”用设计说明中的比较项逐项说明。临时路由在生产构建中不可访问。 |
| T4.1c | 选方案并说出理由 | 你 | 选择记录必须逐项回答 T4.1a 的比较项，并指定空结果和提示的最终位置。 |
| T4.1d | 把选定的方案写进 design.md（补 §9「文章列表页」） | GPT | **依赖 T4.1c。**`design.md §9` 明确筛选控件、空结果、提示位置和选定方案；不再保留「文章列表页 待补」，T4.2 的实现和截图必须引用这一版规则。 |
| T4.2 | 实现筛选（写在网址参数里，分类和标签都选时取交集）、空结果、语言切换后的一次性提示 | GPT | **依赖 T3.2、T4.1d，以及 query 参数异常规则已定。机器：**单元测试覆盖参数解析和交集；浏览器测试覆盖：只有非法分类时只删除分类、非法分类 + 合法标签时只保留标签、两个参数都合法但交集为空时地址不变并显示空状态、直接打开同一网址的另一会话不显示提示、刷新后提示消失、目标语言文章存在时切换直达文章、不存在时进入列表并显示 D-036 原文提示。只显示当前语言已发布文章，按发布时间倒序；所有场景检查地址栏、页面文字和 `scrollWidth === clientWidth`。截图覆盖默认、筛选、空结果和提示四种状态。

## P5 · 后台（中文，适配手机）

| 编号 | 任务 | 谁做 | 验收标准 |
|---|---|---|---|
| T5.1 | 文章版本状态规则的用例表：zh 和 en 各 4 种状态（不存在、草稿、已发布、已发布但有未发布修改）× 保存 / 发布 × 校验结果（D-034、D-123、§2.5 发布只校验当前语言），以及图片四个引用槽位（D-047） | GPT、Kimi 各自独立写 → 对比差异 → 你裁决 | **前置：**先确定发布当前语言的必填字段及保存 / 发布校验范围。**人工：**明确 4 × 4 = 16 个 zh / en 状态组合；每个组合分别列保存和发布、当前语言字段校验、另一语言是否变化、草稿和公开内容是否变化。图片部分只写 D-048 的当前语言槽位更新；D-047 的 7 天清理留到 R2 任务，不混入本表。 |
| T5.2 | 按用例表把状态规则写成纯函数，测试穷举所有组合 | GPT | **依赖 T5.1。机器：**每个用例表编号对应一个测试；测试观察当前语言草稿、当前语言公开内容、另一语言草稿和公开内容，覆盖保存 / 发布、缺分类、当前语言缺必填字段和另一语言不存在或为草稿。绕过表单直接调用处理函数时，结果与界面校验一致。**R-SEO-04/05 状态验收（D-145）：**调用真实保存 / 发布纯函数，固定不同的草稿与已发布内容，逐项观察当前语言草稿、公开版本和另一语言两个版本；保存后公开版本不变，发布当前语言后仅该公开版本更新。HTML、metadata 和 OG 的完整联验由 T5.4 完成，不能用状态函数测试替代。 |
| ✔ 检查点 | 核对测试和用例表是否一一对应 | Kimi 复核 | 对照编号逐行列出通过、遗漏或期望不一致；没有遗漏时明确写「无」。同时确认发布只校验当前语言，保存不改变公开内容。 |
| T5.3a | 后台的信息结构：有哪些页面、页面之间怎么跳、16 种状态组合在列表和编辑器里分别怎么显示、编辑器在桌面和手机上的结构 | GPT 起草 → Kimi 复核 → 你定 | **依赖 T5.1。**结论写成一页设计说明，明确页面路由、跳转、16 种组合的列表 / 编辑器文字状态、保存 / 发布反馈、未保存离开提示、分类和标签两个 tab、参考资料只允许 Idea，以及开发 / 生产环境入口差异。 |
| T5.3b | 按设计说明给编辑器和后台文章列表各做 2～3 个方案 | GPT | **依赖 T5.3a。**每个方案有 1440 / 820 / 390 × 浅深截图，并覆盖列表、编辑器、zh / en tab、空状态、未保存状态、发布反馈和 16 种状态的代表性组合；不能使用动画。生产构建中方案路由不可访问。 |
| T5.3c | 选方案；写进 design.md §9「管理端」 | 你选 → GPT 写 | **依赖 T5.3b。**选定方案的页面、状态文字、桌面 / 手机结构和无动画规则写入 `design.md §9`；不再保留「管理端 待补」。 |
| T5.4 | 实现后台：文章列表、编辑器（CodeMirror、zh / en 标签页、保存和发布、新建分类弹窗、参考资料列表里只放 Idea）、Idea 页、分类和标签管理（两个标签页）、离开页面时提示有未保存内容 | GPT | **依赖 T5.2、T5.3c、D-132 环境规则。机器：**Playwright 跑通新建 → 未选分类保存被拦 → 选分类后保存 → 打开公开页确认仍是旧内容 → 发布 zh → 打开公开页确认新内容 → 编辑 → 再发布；英文仍为草稿时中文可独立发布，zh / en tab 不互相覆盖。另测：新建分类后自动选中；Idea 为空或纯空格不能保存；「用它写文章」的新草稿已关联该 Idea；参考资料只出现 Idea；有未保存修改时离开被提示，无修改时不提示；分类 / 标签两个 tab 可用；直接调用服务端处理函数提交缺分类数据会被拒绝。开发环境后台显示假登录 Kai Li，生产构建访问同一路径不是后台页面；所有状态有文字说明，禁用入场 / 位移 / 缩放动画，允许规范中的颜色过渡。**截图：**至少 1440 / 820 / 390 × 浅深，路径和状态写入结果记录。 |

> **R-SEO-04/05 端到端联验（D-145；依赖 T3.4、T5.2）：**固定当前语言草稿标题 / 摘要 / 正文与公开版本不同、另一语言已发布的夹具。实际保存前后比较公开 HTML 内容、title、description、canonical、hreflang 精确集合和 OG 信息，所有公开信息不变；实际发布当前语言后公开内容与对应 metadata / OG 更新，另一语言公开内容和 metadata / OG 保持基线。中英文分别执行，不只验证按钮回调或修改假数据。全部通过前不宣告 SEO 或 v1 完成。


## T6.1 · v1 基础 SEO 联验与网站地图

| 编号 | 任务 | 谁做 | 验收标准 |
|---|---|---|---|
| T6.1 | 根据已发布内容生成网站地图，并完成 D-082 / R-SEO-06 的公开成员和保存发布联验 | GPT 执行 → Kimi 复核 | **依赖 T3.2 的公开版本读取、T3.3 的完整公开页清单；完整联验另依赖 T3.4 / T5.2 / T5.4。机器：**真实请求 `/sitemap.xml` 返回可解析 XML；固定夹具逐项断言中英文首页、列表、Projects、书架及全部已发布语言文章的精确 URL 集合和对应语言关系，每个成员真实请求为200且canonical匹配；排除中立链接、query、404、草稿、后台、Resource、thought、Idea、/_design。执行真实保存后 XML 公开成员和信息不变，首次发布当前语言后仅新增该正式语言页，再发布更新对应公开信息，另一语言不变；两语都未发布的文章不出现。不得只检查数量或非空，未具备完整联验前保持未完成。 |

## P6 · v1 生产化（动态 OG 收缩后部署到 workers.dev）

T7.1–T7.4 已完成；T7.5 的媒体清理保持完成，动态 OG 部分按 D-175 收缩为 Open Graph 文本元数据与静态站点分享图。历史动态模板、实现与 CPU 观测保留在文档中，不再作为现行部署前置。

Kai Li 已授权远端空 D1 迁移和 `workers.dev` 部署验收，但未授权 `kaili.dev` 域名替换、DNS / route 变更或生产 OAuth 回调切换。先完成 D-175 切换门禁与独立复核，再执行远端迁移和无域名部署。

自动部署顺序：GitHub Actions 先运行 `pnpm check`，再执行 `pnpm exec wrangler d1 migrations apply kaili-dev --remote`，最后构建并部署 Worker。新增 D1 列或 trigger 时不得让代码先于迁移上线。

## P8 · AI 接入层与 slug 候选（D-182 ~ D-186）

需求见 [ai-integration-requirements.md](ai-integration-requirements.md)，决定见 D-182 ~ D-186。分工按 D-186：Claude 拆卡和最终验收；任务卡经 OpenCode DeepSeek v4.1 Flash 只读审核；Kai Li 把每张卡交给其他模型执行。上文「分工原则」「三种做法」中关于 GPT / Kimi 的安排不适用于 P8。

### P8 执行者通用要求（每张卡都适用，执行前先读）

1. 先读 `AGENTS.md`、本节和对应卡片；按卡片「依赖」顺序做，前置卡未完成不开始。
2. 只改卡片「改动范围」列出的文件。不新增 npm 依赖；不改 `docs/product/`；不改 `src/styles/tokens.css`；不读取、搜索或输出 `.dev.vars`。卡片没写清、或与现有代码冲突时，停下来，把问题写进 `docs/notes/<当天日期>-T8.md`，不要自己补规则。
3. 分层：`src/routes`、`src/components` 不得导入 `src/server/data`（ESLint `architecture/no-ui-data-import` 会拦截）；业务规则写成 `src/features` 下的纯函数；数据库读写只在 `src/server/data`。
4. 现有写法照抄：服务端函数照 `src/features/admin.functions.ts`（`createServerFn` + `requireAdminFunctionSession` 中间件 + 手写输入检查）；数据访问照 `src/server/data/ideas.ts`（`database.prepare(...).bind(...)`）；Worker 环境变量照 `src/lib/require-admin-session.ts` 用 `import('cloudflare:workers')` 懒加载；单元测试为 `tests/*.test.mjs`（Vitest）；后台 e2e 在 `tests/admin-e2e/`（`pnpm test:admin`，开发服务器 3200 端口，`/_test-reset?fixture=` 重置数据）。
5. 不用动画；不新增颜色；所有状态和错误都配中文文字；界面文字写在组件里，与现有后台一致。
6. API key、主密钥、解密后的明文：不得出现在日志、错误信息、服务端函数返回值、页面 HTML 或测试快照中。测试用假 key（如 `sk-test-0000`），不使用真实 key。
7. 完成时提交报告到 `docs/notes/<当天日期>-T8.x.md`：改动文件列表、（T8.2 之后的卡）本地 D1 已应用 `0008` 的证据（如 `pnpm exec wrangler d1 migrations list kaili-dev --local` 输出）、`pnpm check`、`pnpm build`、`pnpm exec wrangler deploy --dry-run` 的原始输出（卡片另有要求的命令也附上），以及卡片验收清单逐条的结果。不提交 git，不部署，不执行远端迁移。

### 共用约定（多张卡引用）

```ts
// src/features/ai-routing.ts 中导出，其他卡只引用不重复定义
export type DataClass = 'public' | 'draft' | 'idea' | 'resource' | 'image'
export type Capability = 'chat' | 'structured-output'
export type FailureKind =
  | 'timeout' | 'network' | 'redirect' | 'rate-limited' | 'server-error'
  | 'auth-failed' | 'model-missing'          // 以上 7 种：尝试下一个合格连接
  | 'bad-request' | 'bad-format'             // 不切换，直接失败
  | 'config' | 'no-eligible-connection' | 'deadline' // 调用前或总时限

export type ConnectionSummary = {
  id: string; name: string; baseURL: string; keyMask: string
  priority: number; enabled: boolean; dataClasses: DataClass[]
  lastCheckedAt: string | null; lastOk: boolean | null; lastFailure: FailureKind | null
}
export type ModelSummary = {
  id: string; connectionId: string; providerModelId: string
  capabilities: Capability[]; enabled: boolean; source: 'discovered' | 'manual'
}
export type CapabilityDefaults = Partial<Record<Capability, string>> // 值为 ModelSummary.id
```

- `src/server/data/ai.ts` 对外一律返回上面的 camelCase 类型（由它负责 snake_case 列与 JSON 列的转换）；`key_iv` / `key_ciphertext` 只通过 `getConnectionSecret` 返回，不出现在 `ConnectionSummary` 中。
- `src/features/ai.functions.ts` 不导出任何返回明文 key 或密文的服务端函数；解密只在 `ai-invoke.server.ts` 和 `ai.functions.ts` 的调用点内部发生，结果不进入返回值。

- 主密钥环境变量名 `AI_MASTER_KEY`：32 字节随机数的 base64，本地来自 `.dev.vars`（T8.0 由 Kai Li 写入，执行者不读取该文件）。T8.4、T8.5 的 e2e 依赖它，`pnpm test:admin` 不在 CI 中运行，不设测试专用主密钥。缺失或格式不对时，所有需要解密的操作返回 `config` 错误并显示「未配置 AI_MASTER_KEY」，不抛出未捕获异常。
- e2e 假上游：开发环境下，baseURL 主机名为 `ai-mock.test` 的请求不走网络，由 `src/features/ai-mock.server.ts` 按路径返回固定响应。baseURL 仍必须是 HTTPS。生产构建中不得包含该分支，判定方法是 `pnpm build` 后 `grep -r "ai-mock.test" dist` 无输出（硬验收）。

### 任务卡

| 编号 | 任务 | 依赖 | 改动范围 | 验收标准 |
|---|---|---|---|---|
| T8.0 | 准备主密钥与测试连接 | — | 无代码 | **Kai Li 人工：**① 生成主密钥：`openssl rand -base64 32`；② 本地写入 `.dev.vars` 的 `AI_MASTER_KEY=`；③ 生产 `pnpm exec wrangler secret put AI_MASTER_KEY`；④ 把主密钥另存到密码管理器（D-185 ②）。⑤ 准备一个可用的中转平台 baseURL 与 key，留到 T8.6 验收时在后台填写。执行模型不做此卡。 |
| T8.1 | 路由与错误分类纯函数 | — | 新增 `src/features/ai-routing.ts`、`tests/ai-routing.test.mjs` | 导出上文「共用约定」中的全部类型，以及：<br>① `normalizeCapabilities(caps: Capability[]): Capability[]`：含 `structured-output` 时自动补 `chat`，去重并按 `chat, structured-output` 排序。<br>② `validateConnectionInput({ name, baseURL, priority, dataClasses })` 返回错误码数组：`name-required`（去空格后为空）、`base-url-invalid`（`new URL` 失败，或协议不是 `https:`，或含用户名 / 密码，或含 query / hash）、`priority-invalid`（不是 1–99 的整数）、`data-classes-invalid`（为空或含未知值）。另导出 `normalizeBaseURL(url: string): string`：去掉末尾所有 `/`，保存前调用。<br>③ `selectCandidates({ connections, models, defaults, request })`：`request = { capability, dataClasses: DataClass[], modelId?: string }`。合格条件：连接 `enabled`、连接 `dataClasses` 包含请求的**全部**类别、模型 `enabled`、模型能力包含请求能力。有 `modelId` 时只返回该模型一项，不合格返回 `{ ok: false, kind: 'config' }`；否则先放该能力的默认模型（若合格），再按连接 `priority` 升序、同优先级按连接 `id` 升序，每个连接内按模型 `providerModelId` 升序，去掉已放入的默认模型；结果为空返回 `{ ok: false, kind: 'no-eligible-connection' }`。<br>④ `classifyFailure(input)`：`input` 为 `{ status: number }` 或 `{ error: 'timeout' \| 'network' }`；status 为 0（`redirect: 'manual'` 下的 opaque redirect）或 3xx→`redirect`，401/403→`auth-failed`，404→`model-missing`，429→`rate-limited`，≥500→`server-error`，其余 4xx→`bad-request`。`canTryNext(kind)` 只对前 7 种返回 `true`。<br>**机器：**每个函数的每个分支至少一个用例；`selectCandidates` 覆盖：显式模型所属连接不允许 `draft`→`config`；默认模型不合格时被跳过；两个连接同优先级的排序；只允许 `public` 的连接收到 `draft` 请求时被排除；`structured-output` 请求不会选中只有 `chat` 的模型。 |
| T8.2 | 加密、迁移与数据层 | T8.1 | 新增 `src/features/ai-secrets.ts`、`drizzle/0008_ai_connections.sql`、`src/server/data/ai.ts`、`tests/ai-secrets.test.mjs`、`tests/ai-data.test.mjs`；修改 `src/server/data/schema.ts`、`src/server/cloudflare.d.ts`（`env` 加 `AI_MASTER_KEY?: string`）、`tests/migrations.test.mjs`、`drizzle/meta/_journal.json` | **加密（`ai-secrets.ts`，只用全局 `crypto.subtle`，不导入 `cloudflare:*`）：**`encryptSecret(plain, masterKeyB64)` → `{ iv, ciphertext }`（均 base64，AES-GCM 256，每次随机 12 字节 iv）；`decryptSecret(record, masterKeyB64)` → 明文；`maskSecret(plain)` → 前 3 位 + `…` + 后 4 位，长度 ≤ 8 时全部替换为 `••••`。主密钥缺失或解码后不是 32 字节时抛 `AiConfigError`（在 `ai-secrets.ts` 中定义并导出，`class AiConfigError extends Error`）。<br>**迁移 `0008`（手写 SQL，与 `0005`–`0007` 一样追加 journal 条目）：**`ai_connections`（`id` TEXT PK、`name`、`base_url`、`key_iv`、`key_ciphertext`、`key_mask`、`priority` INTEGER、`enabled` INTEGER 0/1、`data_classes_json` 默认 `'["public"]'`、`last_checked_at`、`last_ok` INTEGER NULL、`last_failure` TEXT NULL、`created_at`、`updated_at`）；`ai_models`（`id` PK、`connection_id` FK → `ai_connections` ON DELETE CASCADE、`provider_model_id`、`capabilities_json` 默认 `'["chat"]'`、`enabled` 默认 1、`source` `'discovered'\|'manual'`、`created_at`；`UNIQUE(connection_id, provider_model_id)`）；`ai_defaults`（`capability` TEXT PK、`model_id` FK → `ai_models` ON DELETE CASCADE）；`ai_calls`（`id` PK、`created_at`、`purpose`、`connection_name` TEXT NULL、`provider_model_id` TEXT NULL、`outcome` TEXT（`ok` 或 `FailureKind`）、`latency_ms`、`fell_back` INTEGER 0/1、`input_tokens` NULL、`output_tokens` NULL；索引 `created_at`）。不存 prompt 和返回内容（S-05）。<br>**`schema.ts`：**照现有表补上四张表的 Drizzle 定义，只作镜像，与 SQL 保持一致；数据层不使用 Drizzle 查询，仍用 `prepare().bind()`。<br>**数据层 `ai.ts`：**`resetAiStores(database)` 删除四张 `ai_*` 表的全部行（供 T8.4 的测试重置用）；连接的增改删查（列表与读取**不返回** `key_iv` / `key_ciphertext`，只返回 `key_mask`；单独的 `getConnectionSecret(db, id)` 只供服务端调用）、模型增删改查、批量写入查询到的模型（已存在的 ID 不重复插入，不改已有模型的能力和启用）、读写默认模型、记录调用、读最近 N 条调用、更新连接最近一次结果。<br>**机器：**`ai-secrets` 测试：加解密往返、两次加密 iv 不同、错误主密钥解密失败、`maskSecret` 边界。`migrations.test.mjs` 增加用例：在 `0000`–`0007` 之后执行 `0008`，插入连接与模型，删除连接后模型和默认模型被级联删除，重复的 `(connection_id, provider_model_id)` 被拒绝。`ai-data.test.mjs`：照 `tests/article-data.test.mjs` 第 20–50 行的写法，用 `node:sqlite` 内存库包一层 D1 接口，覆盖列表不含密文、批量写入不重复。 |
| T8.3 | OpenAI-compatible 适配层与调用器 | T8.1、T8.2 | 新增 `src/features/ai-openai.server.ts`、`src/features/ai-invoke.server.ts`、`src/features/ai-mock.server.ts`、`tests/ai-openai.test.mjs`、`tests/ai-invoke.test.mjs`；修改 `tests/guardrails.test.mjs` | **适配层（所有函数接受注入的 `fetchImpl`，默认全局 `fetch`；`signal` 由调用方创建，单次请求超时 10 秒，即 `AbortSignal.timeout(10_000)` 或调用器给出的更短剩余时间）：**`listModels({ baseURL, apiKey, signal })` 请求 `GET {baseURL}/models`，解析 `{ data: [{ id }] }`，返回去重排序后的 ID；`chatCompletion({ baseURL, apiKey, model, messages, maxTokens, signal })` 请求 `POST {baseURL}/chat/completions`，body 为 `{ model, messages, max_tokens, temperature: 0.2 }`，**不发送** `response_format`（D-185 ①），返回 `{ text, inputTokens?, outputTokens? }`（取 `choices[0].message.content` 与 `usage.prompt_tokens` / `completion_tokens`）。所有请求：`redirect: 'manual'`；`Authorization: Bearer <key>`；非 2xx 用 `classifyFailure` 归类；`fetch` 抛 `AbortError`→`timeout`、其他异常→`network`；2xx 但 JSON 结构不符→`bad-format`。抛出的错误对象只含 `kind` 和不超过 120 字的中文说明，不含 key、请求头或上游响应正文。<br>**调用器 `invokeChat({ database, masterKeyB64, fetchImpl?, purpose, capability, dataClasses, modelId?, messages, maxTokens, deadlineMs })`：**`database` 与 `masterKeyB64` 由调用方传入（与 `src/server/data/*` 收 `database` 的写法一致；T8.4、T8.5 的服务端函数负责 `await runtimeDatabase()` 和从 `import('cloudflare:workers')` 的 `env.AI_MASTER_KEY` 取主密钥）；`fetchImpl` 缺省为全局 `fetch`，传给适配层（假上游判断仍在适配层内）。捕获 `AiConfigError` 返回 `{ ok: false, kind: 'config' }`。读连接、模型、默认值 → `selectCandidates` → 依次尝试；每次尝试的超时为 `min(剩余时间, 10000ms)`；`canTryNext` 为真时尝试下一个，否则立即失败；超过 `deadlineMs` 返回 `deadline`。每次调用（不是每次尝试）写一条 `ai_calls`，`fell_back` 表示是否用到了第一个候选之外的连接；每次尝试后更新该连接的 `last_checked_at` / `last_ok` / `last_failure`。返回 `{ ok: true, text, connectionName, providerModelId }` 或 `{ ok: false, kind }`。<br>**假上游 `ai-mock.server.ts`：**导出 `mockFetch(input, init): Promise<Response>`（与 `fetch` 签名兼容）。适配层在决定用哪个 fetch 时写成：`if (import.meta.env.DEV && new URL(baseURL).host === 'ai-mock.test') { const { mockFetch } = await import('./ai-mock.server'); fetchImpl = mockFetch }`，条件与 `import` 必须在同一个 `if` 内且直接使用 `import.meta.env.DEV`（不能先赋给变量），以便生产构建删除该分支；不修改全局 `fetch`。主机 `ai-mock.test`；路径首段决定行为：`/ok/v1/models` 返回 `mock-chat`、`mock-json` 两个模型，`/ok/v1/chat/completions` 返回 `{"slugs":["mock-first-slug","mock-second-slug","Bad Slug"]}`；`/down/...` 返回 503；`/badkey/...` 返回 401；`/redirect/...` 返回 302。<br>**机器：**`ai-openai.test.mjs` 用假 `fetchImpl` 覆盖每种 `FailureKind`、`redirect: 'manual'` 确实传入、错误信息不含 key（断言 `JSON.stringify(error)` 不含 `sk-test-0000`）。`ai-invoke.test.mjs`：主连接 503 切到备用并记录 `fell_back=1`；主连接 400 不切换；全部失败；显式模型不合格→`config` 且 `fetchImpl` 未被调用；注入一个延迟超过 `deadlineMs` 的 `fetchImpl`，结果为 `deadline`；`masterKeyB64` 为空→`config`。数据库用 `tests/article-data.test.mjs` 同款 `node:sqlite` 包装，执行 `0000`–`0008` 迁移后写入测试数据。`guardrails.test.mjs`（现有用例不跑构建）新增补充断言：`src/` 中没有对 `ai-mock.server` 的静态 import。硬验收是报告中附 `pnpm build` 后 `grep -r "ai-mock.test" dist` 无输出的原始结果。 |
| T8.4 | 后台「AI 接入」页面 | T8.0（本地 `.dev.vars`）、T8.3 | 新增 `src/features/ai.functions.ts`、`src/routes/admin/ai/index.tsx`、`src/routes/admin/ai/$id.tsx`、`src/routes/admin/ai/new.tsx`、`src/components/admin/ai-pages.tsx`、`tests/admin-e2e/ai.spec.ts`；修改 `src/components/admin/admin-shell.tsx`（导航加「AI 接入」，放在「分类与标签」之后，并把 `section` 的联合类型扩展为 `'posts' \| 'ideas' \| 'taxonomy' \| 'ai'`）、`src/features/test-store.server.ts`（① `resetStores` 对**所有** fixture 先调用 `resetAiStores`；② 新增 fixture `ai`：加进第 21 行的 `fixtures` 允许列表（否则 `/_test-reset` 返回 400）；文章部分与 `many` 一样映射到 `default` 文章种子；主密钥直接用 `test-store.server.ts` 第 1 行已导入的 `env.AI_MASTER_KEY`；再写入两个连接：`主中转` 优先级 1 baseURL `https://ai-mock.test/down/v1`、`备用中转` 优先级 2 baseURL `https://ai-mock.test/ok/v1`，均允许 `public`、`draft`，key 均为 `sk-test-0000` 加密写入；两个连接下各有一个模型 `mock-json`，能力 `chat, structured-output`，**不设默认模型**，这样调用时先试主中转（503）再切到备用中转） | **页面按 `docs/product/admin-design-note.md` 的 `/admin/ai`、`/admin/ai/<id>` 两行和 `design.md` §9 管理端规则实现，只复用现有列表页、表单控件、按钮、AlertDialog 组件与类名，不新增 CSS 颜色或动画。**<br>**服务端函数（全部挂 `requireAdminFunctionSession`）：**列出连接（含默认模型与最近 20 条调用）、读取一个连接及其模型、保存连接（新建必须填 key；编辑时 key 留空表示不替换）、删除连接、测试连接（调用 `listModels`，只更新连接最近结果，不写模型）、查询模型（调用 `listModels` 并批量写入，来源 `discovered`，能力为 `chat`）；这两项都不写 `ai_calls`、手动添加模型、修改模型能力 / 启用、删除模型、设置 `structured-output` 默认模型。所有输入照 `admin.functions.ts` 手写检查；校验用 `validateConnectionInput`。返回值中 key 只出现 `key_mask`。<br>**主密钥错误：**保存连接（加密时）、测试连接、查询模型都捕获 `AiConfigError`，显示「未配置 AI_MASTER_KEY」。<br>**错误文字（照抄，e2e 断言用到）：**`name-required`「请填写名称」；`base-url-invalid`「只允许 HTTPS 地址，且不能带用户名、密码、查询参数」；`priority-invalid`「优先级须为 1–99 的整数」；`data-classes-invalid`「至少选择一类可发送的内容」；`timeout`「请求超时」；`network`「网络错误」；`redirect`「上游返回重定向，已拒绝」；`rate-limited`「上游限流」；`server-error`「上游服务错误」；`auth-failed`「API key 无效或无权限」；`model-missing`「模型不存在」；`bad-request`「上游拒绝了请求」；`bad-format`「上游返回格式不对」；`config`「配置错误」；`no-eligible-connection`「没有允许发送这类内容的可用连接」；`deadline`「超过总等待时间」。<br>**最近调用表格：**`outcome` 为 `ok` 显示「成功」，其余显示上面对应的错误文字；`fell_back` 为 1 时该行显示「已切换连接」。<br>**数据类别显示名：**`public`「已发布内容」、`draft`「文章草稿」、`idea`「Idea」、`resource`「Resource」、`image`「私有图片」。<br>**机器（`ai.spec.ts`，fixture `ai`）：**① 列表显示两个连接、脱敏 key、优先级、数据类别；页面 HTML 不含 `sk-test-0000`（`page.content()` 断言）。② 新建连接：baseURL 填 `http://example.com` 报「只允许 HTTPS 地址」；名称空报错；保存后默认数据类别只有「已发布内容」。③ 对 `备用中转` 点「测试连接」显示成功；对 `主中转` 显示「上游服务错误」。④ 对 `备用中转` 点「查询模型」后出现 `mock-chat`（`mock-json` 已存在，不重复），重复查询不产生重复行。⑤ 手动添加模型、勾选 `structured-output` 后 `chat` 自动勾上。⑥ 删除连接需在 AlertDialog 确认，「取消」默认获得焦点。⑦ 导航当前项为「AI 接入」。**截图：**`/admin/ai` 与 `/admin/ai/<id>` × 1440 / 820 / 390 × 浅深，路径写进报告，且 `scrollWidth === clientWidth`。 |
| T8.5 | 编辑器 slug 候选按钮 | T8.0（本地 `.dev.vars`）、T8.4 | 新增 `src/features/ai-slug.ts`、`tests/ai-slug.test.mjs`；修改 `src/features/article-versions.ts`（只把现有 `SLUG` 正则改为 `export`，不改其他逻辑）、`src/features/admin.functions.ts`（只把现有 `takenSlugs` 函数改为 `export`，不改其他逻辑）、`src/features/ai.functions.ts`（新增 `generateSlugCandidates`）、`src/components/admin/article-editor.tsx`、`tests/admin-e2e/ai.spec.ts` | **纯函数 `ai-slug.ts`：**`slugPrompt({ title, summary })` 返回 messages：system 为「你为个人博客文章起英文 URL slug。只输出 JSON：{"slugs":["...","...","..."]}。每个 slug 只用小写英文字母、数字和连字符，3–6 个英文单词，表达文章主题，不用拼音。」，user 为「标题：{title}\n摘要：{summary}」；`parseSlugCandidates(text, takenSlugs)`：从文本中取第一个 `{` 到最后一个 `}` 解析 JSON，取 `slugs` 数组中的字符串，去首尾空格，丢弃不符合 `SLUG`、在 `takenSlugs` 中、或重复的项，最多返回 3 个；解析失败返回空数组。D-181 提到的保留词检查在现有保存路径中不存在，本卡不新增，与保存路径保持一致（已记入 `todo.md`）。<br>**服务端函数 `generateSlugCandidates({ articleId \| null, language, title, summary })`：**`title`、`summary` 去空格后任一为空→返回错误「先填写标题和摘要」且不调用 AI；`articleId` 不为 null 时用 `getStoredArticle(database, articleId)`（`src/server/data/articles.ts`）读取该文章，`Boolean(article.zh.published \|\| article.en.published)` 为真（与 `admin.functions.ts` 中 `editorView` 返回的 `slugLocked` 属性写法相同）→返回错误「slug 已锁定」且不调用；标题和摘要用客户端传入的当前编辑内容（可能尚未保存），不与库中草稿比对，这是有意的；否则 `invokeChat({ database, masterKeyB64, purpose: 'slug-candidates', capability: 'structured-output', dataClasses: ['draft'], messages: slugPrompt(...), maxTokens: 200, deadlineMs: 20000 })`（`database` 用本函数同一次 `await runtimeDatabase()` 的结果，`masterKeyB64` 取 `import('cloudflare:workers')` 的 `env.AI_MASTER_KEY`），用现有 `takenSlugs`（`admin.functions.ts` 中，排除本文章）过滤；候选为空返回「没有生成可用的 slug，请手动填写」。只发送当前语言的标题和摘要，不发送正文（D-185 ⑥）。<br>**编辑器：**「共享信息」面板 slug 输入框下方加按钮「生成候选」：当前语言的标题或摘要为空时禁用并在旁边暖灰小字「先填写标题和摘要」（标题也会进入提示词，所以比 D-185 ⑥ 只写摘要更严，是有意的）；slug 锁定状态用现有 `view.slugLocked`；slug 已锁定时不显示按钮；点击后按钮显示「生成中…」并禁用（无动画）；成功后在按钮下列出候选，每个是一个按钮，点击才把值填入 slug 输入框（标记为未保存，不自动保存）；失败显示朱砂错误文字。生成本身不修改 slug 输入框、不保存、不发布（S-03 / D-181）。<br>**机器：**`ai-slug.test.mjs` 覆盖：合法 JSON、JSON 前后有说明文字、非 JSON、含大写 / 空格 / 已占用 / 重复项、超过 3 个。`ai.spec.ts` 新增（fixture `ai`，主连接 503、备用连接返回候选）：新文章填标题、留空摘要→按钮禁用；填摘要→点击后显示 `mock-first-slug`、`mock-second-slug`，不显示 `Bad Slug`；slug 输入框在点击候选前保持原值；点击候选后输入框为该值且出现未保存标记；`/admin/ai` 最近调用出现一条 `slug-candidates`，结果为「成功」，并显示「已切换连接」；已发布文章不显示按钮；把两个连接都设为只允许「已发布内容」后点击→显示「没有允许发送这类内容的可用连接」。 |
| T8.6 | 最终验收 | T8.0–T8.5 | 只读（发现问题写回对应卡片重做） | **Claude：**逐卡对照改动范围与验收清单看代码；重跑 `pnpm check`、`pnpm build`、`pnpm exec wrangler deploy --dry-run`、`pnpm test:admin`；检查 key 不外泄（全文搜索构建产物与测试输出中的 `sk-test-0000`）、分层规则、无新依赖。**Kai Li 人工：**本地 `pnpm dev`，在 `/admin/ai` 填写真实中转连接，完成测试连接、查询模型、设默认模型、在一篇草稿上生成 slug 候选。远端迁移 `0008` 与部署需 Kai Li 另行授权；注意 `.github/workflows/deploy.yml` 在推送到 `main` 时自动执行远端迁移和部署，所以执行者和 Claude 都不推送 `main`，提交与推送由 Kai Li 决定。 |
