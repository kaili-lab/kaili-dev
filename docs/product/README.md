# 产品需求工作区

kaili.dev 新版（portfolio + blog）的需求讨论会跨多个会话进行。这个目录是所有讨论的唯一落点，任何会话开始前先读这里。

## 文件分工

| 文件 | 作用 | 更新方式 |
|---|---|---|
| `requirements.md` | 需求正文（living doc）。按模块组织，随讨论逐步从「模糊」变「确定」 | 直接改写，始终反映最新共识 |
| `decisions.md` | 已拍板事项的编号日志（D-001…）。只追加，不改写；推翻旧决定时新增一条并标注 supersedes | 只追加 |
| `todo.md` | 待讨论问题、模糊想法、待办。带优先级，讨论清楚后移入 `requirements.md` 并在此打勾 | 增删改 |
| `architecture-notes.md` | 技术架构事实、方案比较、验证结果与未决技术问题 | 随讨论更新 |
| `design.md` | 设计规范：颜色、字体、版面、组件、禁止项（D-111）。新页面先读它 | 随设计讨论更新 |
| `implementation-plan.md` | 实施阶段的任务拆分：每个任务由谁做（GPT / Sonnet / Opus / Kai Li）和验收标准 | 随进度更新 |
| `ai-coding-quality.md` | AI coding 质量约束的概念框架、现状证据和候选实施路线；先理解各部分作用，再逐项实施 | 实施前核对现状，完成后更新证据；不自动升级为强制门禁 |
| `ai-integration-requirements.md` | AI 接入层需求讨论稿：用户要求、设计补充、风险边界、待裁决问题和 review 记录；接入层与 slug 候选均属 v2（D-094 / D-182）；第一阶段绑定语义 slug 候选作为唯一场景（待裁决） | Kai Li review 后同步到 requirements / decisions |

不公开的思考与学习记录放在 `docs/notes/`（已加入 `.gitignore`，D-125），用作以后写文章的素材。

## 最重要的一条约束（D-009 / D-125）

**新项目不受旧项目（Next.js 16 / Vercel / 旧代码与数据结构）的任何影响和束缚。** 将来怎么做、用什么技术，完全取决于讨论结论和实际需要。项目代码直接建在本仓库根目录，所有文档放在 `docs/` 下（D-125）。

## 约定

- 需求条目的成熟度用标记区分：**[定]** 已拍板 / **[议]** 讨论中 / **[想]** 模糊想法，暂不展开。
- `requirements.md` 里 **[定]** 的条目必须能在 `decisions.md` 找到对应编号。
- 每次会话结束时，在 `decisions.md` 末尾追加一行日期分隔，方便回溯。
- 新增索引、需求或待办行时，必须使用插入操作，不得通过替换相邻已有行实现新增；编辑后复读相邻内容，确认原行与新行都存在。
- 一次补丁不得对同一区间发送多个替换；所有行号必须来自编辑前最新读取，不得按同一补丁内删除或插入后的行号计算。编辑失败或发现语法问题后，先重新读取再修改。
- 同步需求时只修改明确受影响的条目；旧内容只有在用户确认取消或替代时才移除。涉及跨文档规则的变更，检查需求、决策日志和待办的关联表述；决策日志只追加，不改写历史。
- 设计依据：`design.md`（规范）+ `docs/kaili.dev-mocks/` 下的参照稿（D-109 / D-111）：首页 `k2-paper.html` / `k2-paper-en.html`，文章详情 `k2-article*.html`，Projects `k2-projects*.html`，书架 `k2-books*.html`；共享样式 `k2.css`、主题切换 `k2-theme.js`。`k2-og.html` 按 D-175 保留为被取代的动态分享图历史方案，不是现行运行时规范。早期的 `a-ledger.html`（mock A，D-002）已删除，需要时可从提交 896b1fa 恢复；早期各轮变体的截图已删除，其中 A / B 两组可从同一提交恢复。

## 当前阶段

2026-10-14 · 执行改由 Claude、复核改由 GPT-6.1 Sol（D-150）。实施计划中可由执行者完成的任务已全部完成并经复核：T3.4 OG 图、T3.5 首屏性能（D-152 / D-157）、P4 文章列表（D-153 / D-154）、T5.1 ~ T5.4 后台（D-155 ~ D-160）、T6.1 网站地图及保存发布联验（含 R-SEO-04/05）。门槛见 `docs/notes/2026-10-14-gates-output-11.txt`：check 412/412、build、dry-run、生产 Playwright 122/122、后台 Playwright（`pnpm test:admin`，开发服务器）31/31。

之后按 Kai Li 试用原型的决定完成 T5.5：后台改为传统布局（D-161 ~ D-163），GPT 第 2 轮复核通过；门槛见 `docs/notes/2026-10-14-gates-output-13.txt`：check 431/431、生产 Playwright 122/122、后台 Playwright 36/36。随后完成 T5.6（D-164，Idea 列表单行与详情页），GPT 第 3 轮复核通过；随后完成 T6.2（D-165，公开站站内客户端跳转，消除切换时的字体抖动），GPT 第 3 轮复核通过；最新门槛见 `docs/notes/2026-10-14-gates-output-19.txt`：check 447/447、生产 Playwright 125/125、后台 Playwright 39/39。

同日把 TanStack Start 从 RC 钉版升到稳定版（D-166）：`@tanstack/react-start` 1.169.1、`@tanstack/react-router` 1.170.44。GPT-6.1 Sol 只读复核为有条件通过。审计后改了 architecture-notes 里「npm latest 为 1.169.1」：复核时 latest 已是 1.169.2（仍依赖 router 1.170.44，只有依赖提升），本次不追。门槛见 `docs/notes/2026-10-14-start-1.169-gates.txt`：check 447/447、build、dry-run（6144.60 KiB / gzip 1674.82 KiB）、生产 Playwright 125/125、后台 Playwright 39/39。

2026-10-25 · 公开站默认配色改为暖白纸色（D-169，supersedes D-168 冷白试验）：`tokens.css` 浅深两套换为暖白 / 暖近黑，深色面板抬高、深色黛蓝改钢青，文章表头线改次墨；旧冷色留在开发环境切换器里对照。`design.md` §2 与 `audit-tokens` 同步，OG 黄金哈希更新。Claude 规格 + Gemini 3.8 Flash 子代理执行；check 452/452、build、dry-run 通过（`docs/notes/2026-10-25-T2.7-gates.txt`）；GPT-6.1 Sol 第 1 轮有条件通过，整改（文档术语、D-169 措辞、进度记录、配色覆盖测试）后第 2 轮通过，唯一剩余项是本句的测试数量，已同步。

2026-10-25 · 提交前实际浏览器检查发现开发环境主题脚本与配色脚本直接拼接时报 `TypeError`，已用语句分隔符修复；新增开发环境刷新后配色恢复回归。修复后 check 452/452、build、dry-run、生产 Playwright 125/125、后台 Playwright 40/40（含新增用例）通过；生产预览在桌面 / 手机及浅 / 深模式保持暖白，且不显示配色切换器。只冻结 D-169 配色，不视作 P2 / P3 全站视觉基准批准。

本轮新增脚本修复及开发配色回归已交 GPT-6.1 Sol 独立只读复核；除实施计划状态回写外无阻塞，状态已同步。D-169 配色可以提交，全站视觉验收仍未完成。

2026-10-25 · Kai Li 提供 X 与 LinkedIn 个人地址，首页介绍及页脚中英均改成实际链接；生产浏览器外链专项 6/6、公开站完整回归 127/127 通过。Kai Li 已批准 P2 / P3 当前公开站布局，生产页面 60 张本地视觉基准存于 `docs/notes/2026-10-25-visual-baseline/`，`pnpm test:visual` 像素回归 60/60 通过；旧 HTML 参照稿按用户要求保留。v1 生产化已拆 T7.1–T7.6，D1/R2 资源和 Drizzle 依赖已备，不等于真实数据、鉴权、图片或部署完成。

2026-10-26 · T7.1 资源前置及 T7.2–T7.5 已完成：公开站和后台切到 D1；真实 GitHub OAuth/session 登录通过；R2 图片按四槽位鉴权；七天墓碑清理含失败重试；OG 改为版本化 Cache API。新增 D1 修订号避免双窗口晚到保存覆盖，数据库 trigger 封住 taxonomy 删除竞态，退出 POST 要求同源。Grok 首轮复核发现 session 原值落库，现已改为只存 SHA-256 摘要，并证明数据库摘要不能直接充当 Cookie；第二轮 `APPROVED`、无剩余阻塞。最终门禁：check 468/468、build、dry-run 7449.07 KiB / gzip 2022.79 KiB、生产 Playwright 129/129、后台 Playwright 46/46；证据见 `docs/notes/2026-10-26-T7-gates.md`。

2026-10-26 · D-175 取代 T7.5 的动态 OG 部分：删除逐文章 Satori / resvg、WASM、Cache API 与 `/og/...` 运行时生成链路，文章继续输出各自的 Open Graph 文本元数据，并共用随部署静态资源提供的 1200×630 站点分享图。旧模板、缓存行为和 179ms / 2ms 观测只作为历史取舍依据；Workers Free 的首次 OG CPU 测量和计费不再是部署前置。切换后门禁：check 449/449、build、dry-run 4230.43 KiB / gzip 882.12 KiB、生产 Playwright 120/120、后台 Playwright 46/46。

2026-10-26 · T7.6 的已授权范围已完成：远端 D1 成功应用 `0000`–`0004` 且 `PRAGMA foreign_key_check` 无结果；Worker 版本 `d0ba5ba6-f5aa-4f28-8328-16553d03a391` 已部署到 `https://kaili-dev.nautilus1876.workers.dev`，清理 Cron 为 `17 3 * * *`。线上已验证中英文公开页、重定向、sitemap、静态 1200×630 PNG、OAuth 启动配置、后台鉴权、空 D1、R2 binding 与不存在媒体 404；浏览器无控制台错误和横向溢出。`kaili.dev` 域名、DNS / route 与生产 OAuth App 回调切换未获授权，未执行；隐私正文、Idea 和真实图片未上传。

2026-10-27 · T5.7 文章撤下与删除完成（D-176 ~ D-180）：中英文公开版本可独立撤下并恢复；所有语言无公开版本后才允许永久删除；撤下媒体保留私有引用；D1 迁移、taxonomy trigger、媒体清理、公开页 / sitemap / 中立链接和 revision 并发保护已覆盖。OpenCode DeepSeek v4.1 Flash 复核无 Critical / High；最终 `pnpm check` 458/458、后台 Playwright 47/47、build、dry-run（4240.38 KiB / gzip 884.00 KiB）。生产域名、生产 OAuth 回调和真实内容仍未切换。

2026-10-27 · 质量约束讨论整理见 [ai-coding-quality.md](ai-coding-quality.md)：记录 A–F 框架、当前 CI / 迁移 / 后台能力、Cursor Opus 5.5 medium 的方法复核及分步实施候选项。本轮只记录文档，未新增检查、变更流水线或执行部署；候选项不视为已实施。

2026-10-27 · AI 接入层需求定稿并拆卡（D-182 ~ D-186）：AI slug 候选与接入层属 v2 并提前排期，v1 slug 只手填；需求稿见 [ai-integration-requirements.md](ai-integration-requirements.md)，任务卡见 implementation-plan.md 的 P8（T8.0 主密钥已由 Kai Li 写入本地 `.dev.vars`）。任务卡经 OpenCode DeepSeek v4.1 Flash 四轮只读审核，结论为可交付执行；T8.1–T8.5 由 Kai Li 在 omp 中按顺序交其他模型执行，完成后 Claude 做 T8.6 验收。本轮未改代码、未部署。

2026-10-27 · T8.1–T8.5 已执行并经 Claude 验收：`/admin/ai` 连接与模型管理、AES-GCM 加密存 key、按优先级切换的调用器、编辑器「生成候选」按钮均已实现。验收修正一处（错误主密钥解密失败改为返回 `config`，补回归测试）。门禁：check 559/559、build、dry-run（4319.41 KiB / gzip 900.04 KiB）、后台 Playwright 62/62；构建产物与测试输出无明文 key 和假上游。剩余 T8.6 的 Kai Li 部分：真实中转手测、生产 secret、远端迁移 `0008` 与部署。代码未提交。

2026-10-27 · Kai Li 生产试用后改版 AI 接入（D-187）：连接即平台、去掉优先级与 `structured-output`；查询到的模型勾选后才保存；能力改为对话 / 画图 / 向量；每种能力一个可调整的跨平台调用顺序；平台级失败直接换平台。迁移 `0009` 已在本地应用。门禁：check 571/571、build、dry-run（4323.85 KiB / gzip 900.44 KiB）、后台 Playwright 63/63。待 Kai Li 本地测试，未提交、未推送。

2026-10-28 · 模型类型改为单选并用真实调用核对（D-188）：平台 `/models` 不说明模型能力，改为按类型调用对应接口试调用，向量模型添加或改类型后自动核对。迁移 `0010` 已在本地应用。门禁：check 576/576、build、dry-run、后台 Playwright 69/69。已提交并推送。

2026-10-28 · 画图模型去掉试调用，生图调用方式改为写在代码里、随 AI 封面图任务卡再定（D-189）；生图平台比价记在 `todo.md`。
