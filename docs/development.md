# 开发说明

面向在本仓库开发的人。项目概览见根目录 [README](../README_CN.md)，需求与任务见 [docs/product/README.md](product/README.md)。

## 本地运行

使用 Node.js 24 和 pnpm 11.6.0：

```sh
pnpm install
pnpm run prepare
pnpm dev
```

`prepare` 将当前仓库的 `core.hooksPath` 设为 `.githooks`；显式运行一次，避免本机安装脚本策略导致钩子未启用。

## 检查与构建

```sh
pnpm check
pnpm build
pnpm exec wrangler deploy --dry-run
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:admin
```

`check` 包含字体字形与后备栈检查、design.md 命名色值及对比度核对、间距清单核对、路由生成、严格类型检查、ESLint、Prettier 和 Vitest。提交钩子运行同一命令，失败会阻止提交。`pnpm format` 格式化工程文件；`docs/` 不参与自动格式化。

`pnpm preview` 用本地 Worker 运行生产构建。`pnpm test:e2e` 同样启动生产预览（4173 端口），运行前先执行 `pnpm build`；`pnpm test:admin` 针对开发服务器运行后台流程。`deploy --dry-run` 只验证打包，不发布。

## 工程约束

- `src/routes` → `src/features` → `src/server/data`；页面、组件及辅助模块不能直接导入数据层（D-127）。ESLint 覆盖别名、相对路径、再导出和静态字符串动态导入。
- Tailwind v4 的默认色板已清空；任意值和动画类名被 lint 拒绝（D-128 / D-129）。`tests/guardrails.test.mjs` 保留故意违规与合法样例。
- `components.json` 配置 shadcn Base UI；只在需要时添加组件，再按 K2 规范改样式。未安装 `tw-animate-css`。
- 三档主题由样式表前的内联脚本初始化；React 接管后同步按钮状态。
- 以 `_` 开头的路由（`/_design`、方案对比页等）和 `/admin` 只在开发环境可用，生产构建中不可访问（D-132）。
- Playwright 验证 1440 / 820 / 390 × 浅深模式，截图位于 `test-results/`；正式页面视觉基准另按实施计划验收。

## 参照稿间距

`node tooling/spacing-inventory.mjs` 生成 [间距清单](product/spacing-inventory.md)，`node tooling/spacing-inventory.mjs --check` 核对清单与源文件一致。使用 Vite 已提供的 PostCSS 解析器；布局间距与行高、字距分开统计。组件间距按 [spacing-proposal-v2.md](product/spacing-proposal-v2.md) 的完整映射（整档保留 18px，D-139）与 [design.md §4](product/design.md#4-版面) 执行；四项响应式字号见 design.md §3（D-140）。

## 自托管字体

`pnpm fonts:check` 检查六字体的本地资源、字重、许可证及文楷实际字形覆盖；`pnpm check` 和 `pnpm build` 已包含它。文楷输入范围见 `src/assets/fonts/wenkai-inputs.json`。修改内容后运行 `pnpm fonts:generate` 重新生成子集与清单。首次生成会下载校验过的官方 v1.522 字体，之后使用本机缓存；也可通过 `LXGW_WENKAI_SOURCE` 指定原始 TTF。

新增使用 `--hand` 的内容来源时，必须在 `wenkai-inputs.json` 登记；检查器只能验证已登记的输入，不能自动识别新的文案来源。

`pnpm fonts:css` 根据已安装 Fontsource 资源重建字体 CSS 和许可证。Noto Serif SC 的 400 / 600 / 900 保留按字符范围加载的完整切片，支持动态文章正文。所有字体使用 `font-display: swap` 和系统后备栈。

## 性能测量

构建并启动 `pnpm preview --host 127.0.0.1 --port 4173` 后运行：

```sh
pnpm fonts:measure http://127.0.0.1:4173 test-results/fonts-slow-3g
pnpm fonts:fallback http://127.0.0.1:4173 test-results/fonts-fallback
```

脚本保存 `report.json`、`requests.json`、首屏与字体加载后截图。慢速 3G 固定 400ms 延迟、上下行各 50,000 字节/秒、冷缓存。首页首屏按同样的限速条件测量：

```sh
node scripts/measure-home.mjs http://127.0.0.1:4173 test-results/home
```

及格线见 D-152 / D-157（冷缓存 FCP ≤ 4s、LCP ≤ 6s；同上下文重访 FCP ≤ 1.5s）。`tests/e2e/performance.spec.ts` 检查字体不阻塞首绘、项目缩略图小且延迟加载。
