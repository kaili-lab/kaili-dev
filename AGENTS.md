# kaili.dev

个人网站（写作 + 书架，中英双语）。TanStack Start（React 19）+ Cloudflare Workers，pnpm。`CLAUDE.md` 是指向本文件的符号链接，只改本文件（D-127）。

## 文档在哪（先读这里再动手）

- `docs/product/README.md`：文件分工和「当前阶段」，每个会话先读。
- `docs/product/implementation-plan.md`：**下一步看开头的「进度」表**；每个任务的负责人和验收标准；未决事项在「需要先定的事」，规范或需求有缺口时停下来写进那一节，不要自己拍板。
- `docs/product/design.md`：设计规范，写页面前先读；规范没覆盖的先补规范再实现（D-111）。
- `docs/product/requirements.md` / `decisions.md` / `todo.md` / `architecture-notes.md`：需求、决策日志（只追加）、待办、技术事实。
- `docs/kaili.dev-mocks/`：HTML 参照稿。页面迁移并通过截图对照前不得删除（D-125）。
- `docs/notes/`：不公开的思考记录，已 gitignore；实现中暴露的问题记在这里当天的文件里（D-125）。

## 常用命令

```sh
pnpm dev                          # 本地开发，端口 3000
pnpm check                        # 字体 + 色值/对比度 + 间距清单 + 类型 + lint + Prettier + Vitest；提交钩子同一条
pnpm build                        # 生产构建
pnpm exec wrangler deploy --dry-run   # 验证打包，不发布
pnpm test:e2e                     # Playwright，需先 pnpm build
pnpm format                       # Prettier 写入（docs/ 不参与格式化）
```

完成任何实现任务，附上 `pnpm check`、`pnpm build`、`wrangler deploy --dry-run` 的原始输出。

## 不能破的规则

- 不得读取、搜索、输出或让工具返回 `.dev.vars` 的内容；排查本地配置时只核对变量名或让 Kai Li 自行确认，生产 secret 只用 `wrangler secret list` 核对名称，不读取值。

- 代码分三层：`src/routes` → `src/features`（纯函数业务规则）→ `src/server/data`（数据访问）；页面和组件不得导入数据层，由 ESLint 拦截（D-127）。
- 能交给工具检查的规则不写成文档约定；新增约束优先写成 lint 或测试，并保留一个故意违规的夹具（D-127）。
- 色值只写在 `src/styles/tokens.css`，浅深两套；其他位置不得出现十六进制色值（D-128）。
- Tailwind 默认色板已清空；禁止任意值写法（`bg-[#fff]`）和动画类名（`animate-*`）；例外须写禁用注释说明理由（D-128 / D-129）。
- 全站不用动画（含后台、弹窗、下拉）；不安装 `tw-animate-css`；只允许规范中的颜色过渡（D-129）。
- 后台不新增颜色：朱砂只表示错误 / 危险；成功用黛蓝；所有状态必须配文字说明（D-129）。
- 字体全部自托管，不请求 Google Fonts、jsDelivr 等第三方字体服务（D-131）。
- TypeScript 严格模式含 `noUncheckedIndexedAccess`；不得放宽（D-127）。
- 文章版本状态与「保存时分类必填」写成纯函数并穷举测试；保存不改变公开内容，发布只校验当前语言（D-034 / D-123 / D-127）。
- shadcn 只添加用得到的组件，再按 K2 改样式；不引入 i18n 库，界面文字用自写的带类型字典（D-126）。
- 假数据只放在数据层后面；后台只在开发环境可进入（假登录 Kai Li），生产构建不可访问（D-132）。
- 不被旧项目（Next.js / Vercel / 旧代码）束缚（D-009 / D-125）。

## 改文档时

- `decisions.md` 只追加，推翻旧决定时新增一条并标注 supersedes；每次会话结束追加日期分隔。
- 新增行用插入操作，不替换相邻行；编辑后复读确认原行与新行都在。
- 任务做完后更新 `implementation-plan.md` 的「进度」表和 README 的「当前阶段」。
