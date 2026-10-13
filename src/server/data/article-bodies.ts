import type { Language } from '#/features/posts'

type ArticleBody = Partial<Record<Language, string>>

export const articleBodies: Record<string, ArticleBody> = {
  'boundary-example': {
    zh: `## 让边界清楚

边界不是额外的文档，而是让每次改变都有清晰归属的约定。

### 从输入开始

先确认输入由谁负责校验，再让内部逻辑只处理可信的数据。

## 事务在哪里结束

一次操作应该在一个可观察的结果处结束，避免把隐式工作留给调用方。

### 用小例子验证

| 层次 | 责任 |
| --- | --- |
| 输入 | 校验并归一化 |
| 服务 | 执行并返回结果 |

\`\`\`typescript
export function finish(value: string): string {
  return value.trim()
}
\`\`\`

![边界示意图](/images/say-right.png)`,
    en: `## Make the boundary visible

A boundary is a small agreement about ownership, not another document to maintain.

### Start with the input

Validate at the edge so the inner operation can work with trusted data.

## Where the transaction ends

An operation should end at an observable result instead of leaving implicit work to its caller.

### Verify with a small example

| Layer | Responsibility |
| --- | --- |
| Input | Validate and normalize |
| Service | Execute and return |

\`\`\`typescript
export function finish(value: string): string {
  return value.trim()
}
\`\`\`

![Boundary diagram](/images/say-right.png)`,
  },
  'zh-only-example': {
    zh: `## 只有中文

语言版本彼此独立发布，读者只会看到当前语言真正可用的内容。

### 保持版本隔离

草稿和未发布版本不会进入公开页面。

## 继续写下去

稳定的结构比一次性写完更重要。

### 每次只推进一步

小步修改更容易回看，也更容易在发现边界时及时停下。`,
  },
  'en-only-example': {
    en: `## English only for now

Each language is published independently so a reader sees only what is ready.

### Keep versions isolated

Draft text must never cross the public boundary.

## Continue deliberately

A stable structure matters more than finishing everything at once.

### Move one step at a time

Small changes are easier to review and safer to reverse.`,
  },
}
