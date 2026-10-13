# kaili.dev

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-FF4154?style=flat&logo=reactquery&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)

> 中英双语的个人网站，用来写作和记录读过的书。和 AI 协作开发，设计和架构规则都交给工具检查，不靠约定。

[English](./README.md) · 线上地址：尚未部署（见[后续计划](#后续计划)）

---

## ✨ 亮点

**1. 规则写进工具，不写成约定**
色值只能定义在 `src/styles/tokens.css`；Tailwind 默认色板已清空；`bg-[#fff]` 这类任意值写法和 `animate-*` 类名由 ESLint 拒绝；全站不用动画。每条约束都配一个故意违规的样例，规则失效时测试会失败。

**2. 文章版本是一个纯函数状态机**
每篇文章有一份共享的编辑稿，每种语言各有一份已发布快照。保存不改变读者看到的内容，发布只校验当前语言。规则写成纯函数，由 117 个编号的用例表覆盖，其中 64 行主表由测试直接读取。

**3. 在边缘节点上做双语服务端渲染**
`/zh`、`/en` 在 Cloudflare Workers 上服务端渲染完整 HTML，带 `hreflang`、网站地图，每篇文章的分享预览图在 Worker 内生成（Satori + resvg WASM）。字体全部自托管，中文手写字体只保留实际用到的字。

**4. AI 协作开发，过程有据可查**
一个模型执行，另一个模型只读复核；附上原始命令输出、测试场景和截图并通过复核后，任务才算完成。需求、160 条编号决策、设计规范和任务计划都在 [`docs/product/`](docs/product/README.md)。

---

## 技术栈

| 层       | 技术                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| 框架     | TanStack Start（React 19，SSR）、TanStack Router、Vite                                  |
| 样式     | Tailwind CSS v4 + 自定义 token 主题、shadcn（Base UI）                                  |
| 内容     | unified / remark / rehype、GFM、Shiki                                                   |
| 编辑器   | CodeMirror 6（Markdown）                                                                |
| 预览图   | Satori + resvg WASM                                                                     |
| 运行环境 | Cloudflare Workers（Wrangler）                                                          |
| 质量     | TypeScript 严格模式（`noUncheckedIndexedAccess`）、ESLint、Prettier、Vitest、Playwright |

---

## 功能

- **中英双语**：所有公开页面都有中英文；语言回退；切换语言时如果文章没有对应语言版本，进入列表并提示一次
- **写作**：文章列表按分类、标签筛选（写在网址参数里），文章页带代码高亮
- **项目与书架**：内容写在仓库文件里，不需要后台
- **主题**：跟随系统 / 浅色 / 深色，首次绘制前生效，不闪烁
- **SEO**：`hreflang`、网站地图、自动生成分享预览图
- **后台**：文章列表、带中英文标签页的 Markdown 编辑器、保存与发布分开、Idea、分类和标签、离开时提示未保存

---

## 架构

```
src/routes          页面和服务端路由（SSR、网站地图、预览图）
    │
    ▼
src/features        业务规则（纯函数）和服务端函数
    │
    ▼
src/server/data     数据访问（目前是内存中的占位数据）
```

页面和组件不能直接导入数据层；ESLint 会检查别名、相对路径、再导出和动态导入。

---

## 本地运行

需要 Node.js 24 和 pnpm 11。

```bash
pnpm install
pnpm run prepare   # 启用提交前检查钩子
pnpm dev           # http://localhost:3000
```

检查与构建：

```bash
pnpm check                            # 字体、色值、间距、类型、lint、格式、单元测试
pnpm build
pnpm exec wrangler deploy --dry-run   # 只验证打包，不发布
pnpm exec playwright install chromium
pnpm test:e2e                         # 针对生产构建，先运行 pnpm build
pnpm test:admin                       # 后台流程，针对开发服务器
```

后台只在开发环境可进入（假登录用户），生产构建中无法访问。字体、间距工具、性能测量等细节见 [docs/development.md](docs/development.md)。

---

## 后续计划

- [ ] 后台接入 GitHub 登录
- [ ] 文章存入 Cloudflare D1，图片存入 R2
- [ ] 部署到 kaili.dev
- [ ] 全站视觉基准验收
- [ ] 用真实内容替换占位内容

---

## 许可

代码使用 [MIT 许可证](LICENSE)。随站分发的字体沿用 SIL Open Font License（许可证文本在 `public/fonts/`）。文章、个人介绍和图片版权归 Kai Li 所有，保留所有权利。
