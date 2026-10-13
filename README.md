# kaili.dev

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-FF4154?style=flat&logo=reactquery&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)

> A bilingual personal site for writing and reading — built with AI agents, where every design and architecture rule is enforced by a tool, not a convention.

[中文文档](./README_CN.md) · Live site: not deployed yet (see [Roadmap](#roadmap))

---

## ✨ Highlights

**1. Rules live in tools, not in docs**
Colors may only be defined in `src/styles/tokens.css`; Tailwind's default palette is emptied; arbitrary values like `bg-[#fff]` and `animate-*` classes are rejected by ESLint; the site uses no animation at all. Every guardrail ships with an intentionally violating fixture, so a rule that silently stops working fails the test suite.

**2. Article versions modeled as a pure state machine**
Each article has a shared editing copy plus a published snapshot per language. Saving never changes what readers see; publishing validates only the current language. The rules are a pure function covered by a 117-case specification table — the 64-row main table is read directly by the tests.

**3. Bilingual SSR on the edge**
`/zh` and `/en` are server-rendered on Cloudflare Workers with full HTML, `hreflang`, a sitemap, and per-article Open Graph images generated inside the Worker (Satori + resvg WASM). All fonts are self-hosted; the Chinese handwriting font is subset to the characters actually used.

**4. AI-native workflow, with the paper trail**
One model implements, a different model reviews read-only; a task is marked done only after raw command output, test scenarios, and screenshots pass review. The requirements, 160 numbered decisions, design spec, and task plan are all in [`docs/product/`](docs/product/README.md).

---

## Tech Stack

| Layer     | Technology                                                                           |
| --------- | ------------------------------------------------------------------------------------ |
| Framework | TanStack Start (React 19, SSR), TanStack Router, Vite                                |
| Styling   | Tailwind CSS v4 with a custom token theme, shadcn (Base UI)                          |
| Content   | unified / remark / rehype, GFM, Shiki                                                |
| Editor    | CodeMirror 6 (Markdown)                                                              |
| OG images | Satori + resvg WASM                                                                  |
| Runtime   | Cloudflare Workers (Wrangler)                                                        |
| Quality   | TypeScript strict (`noUncheckedIndexedAccess`), ESLint, Prettier, Vitest, Playwright |

---

## Features

- **Bilingual** — every public page in Chinese and English, with language fallback and a one-time notice when an article doesn't exist in the other language
- **Writing** — article list filtered by category and tag (kept in the URL), article pages with code highlighting
- **Projects & Bookshelf** — content kept in the repository, no admin UI needed
- **Themes** — system / light / dark, applied before first paint with no flash
- **SEO** — `hreflang`, sitemap, generated OG images
- **Admin** — post list, Markdown editor with zh / en tabs, save vs. publish, ideas, categories and tags, unsaved-changes warning

---

## Architecture

```
src/routes          pages and server routes (SSR, sitemap, OG images)
    │
    ▼
src/features        business rules as pure functions + server functions
    │
    ▼
src/server/data     data access (in-memory placeholder data for now)
```

Pages and components can't import the data layer directly; ESLint enforces this across aliases, relative paths, re-exports, and dynamic imports.

---

## Getting Started

Requires Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm run prepare   # enable the pre-commit hook
pnpm dev           # http://localhost:3000
```

Checks and build:

```bash
pnpm check                            # fonts, tokens, spacing, types, lint, format, unit tests
pnpm build
pnpm exec wrangler deploy --dry-run   # bundle only, nothing is published
pnpm exec playwright install chromium
pnpm test:e2e                         # against the production build, run pnpm build first
pnpm test:admin                       # admin flows against the dev server
```

The admin area is available only in development (with a fake signed-in user) and is unreachable in production builds. More detail — fonts, spacing tooling, measurements — is in [docs/development.md](docs/development.md) (Chinese).

---

## Roadmap

- [ ] GitHub OAuth for the admin
- [ ] Cloudflare D1 for articles, R2 for images
- [ ] Deploy to kaili.dev
- [ ] Visual baseline sign-off for every page
- [ ] Real content in place of placeholders

---

## License

Code is released under the [MIT License](LICENSE). The bundled fonts remain under the SIL Open Font License (license texts in `public/fonts/`). Article text, personal copy, and images are © Kai Li, all rights reserved.
