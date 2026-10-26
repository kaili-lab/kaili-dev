DELETE FROM media_references;
DELETE FROM media_objects;
DELETE FROM article_ideas;
DELETE FROM article_languages;
DELETE FROM articles;
DELETE FROM taxonomy_entries;
DELETE FROM ideas;

INSERT INTO taxonomy_entries (kind, slug, zh, en) VALUES
  ('categories', 'engineering', '工程', 'Engineering'),
  ('categories', 'ai', 'AI', 'AI'),
  ('tags', 'typescript', 'TypeScript', 'TypeScript'),
  ('tags', 'cloudflare', 'Cloudflare', 'Cloudflare');

INSERT INTO articles (id, slug, category, tags_json, idea_ids_json, saved_at, last_language) VALUES
  ('boundary-example', 'boundary-example', 'engineering', '["typescript"]', '[]', '2026-10-01T00:00:00.000Z', NULL),
  ('zh-only-example', 'zh-only-example', 'engineering', '["typescript"]', '[]', '2026-10-01T00:00:00.000Z', NULL),
  ('en-only-example', 'en-only-example', 'engineering', '["typescript"]', '[]', '2026-10-01T00:00:00.000Z', NULL),
  ('private-example', 'private-example', 'engineering', '[]', '[]', '2026-10-01T00:00:00.000Z', NULL);

INSERT INTO article_languages (
  article_id, language,
  draft_title, draft_summary, draft_body, draft_images_json,
  published_title, published_summary, published_body, published_images_json,
  published_at, published_updated_at, published_category, published_tags_json
) VALUES
  (
    'boundary-example', 'zh',
    '未发布中文标题不得出现', '未发布中文摘要不得出现', '未发布中文修改不得出现', '[]',
    '把边界写清楚', '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
    '段落使用正文宋体。这里是一篇中文公开文章。\n\n## 让边界清楚\n\n边界不是额外的文档，而是让每次改变都有清晰归属的约定。\n\n### 从输入开始\n\n先确认输入由谁负责校验，再让内部逻辑只处理可信的数据。\n\n## 事务在哪里结束\n\n一次操作应该在一个可观察的结果处结束，避免把隐式工作留给调用方。\n\n### 用小例子验证\n\n| 层次 | 责任 |\n| --- | --- |\n| 输入 | 校验并归一化 |\n| 服务 | 执行并返回结果 |\n\n```typescript\nexport function finish(value: string): string {\n  return value.trim()\n}\n```\n\n![边界示意图](/images/say-right.png)', '[]',
    '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z', 'engineering', '["typescript"]'
  ),
  (
    'boundary-example', 'en',
    'Unpublished English title must not appear', '未发布英文摘要不得出现', 'Unpublished English edit must not appear', '[]',
    'Make boundaries visible', 'Ownership, boundaries, and where the transaction ends make a service understandable.',
    'This is the published English article.\n\n## Make the boundary visible\n\nA boundary is a small agreement about ownership, not another document to maintain.\n\n### Start with the input\n\nValidate at the edge so the inner operation can work with trusted data.\n\n## Where the transaction ends\n\nAn operation should end at an observable result instead of leaving implicit work to its caller.\n\n### Verify with a small example\n\n| Layer | Responsibility |\n| --- | --- |\n| Input | Validate and normalize |\n| Service | Execute and return |\n\n```typescript\nexport function finish(value: string): string {\n  return value.trim()\n}\n```\n\n![Boundary diagram](/images/say-right.png)', '[]',
    '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z', 'engineering', '["typescript"]'
  ),
  (
    'zh-only-example', 'zh',
    '只有中文的文章', '这篇文章还没有英文版本。',
    '这篇文章只有中文公开版本。\n\n## 只有中文\n\n语言版本彼此独立发布，读者只会看到当前语言真正可用的内容。\n\n### 保持版本隔离\n\n草稿和未发布版本不会进入公开页面。\n\n## 继续写下去\n\n稳定的结构比一次性写完更重要。\n\n### 每次只推进一步\n\n小步修改更容易回看，也更容易在发现边界时及时停下。', '[]',
    '只有中文的文章', '这篇文章还没有英文版本。',
    '这篇文章只有中文公开版本。\n\n## 只有中文\n\n语言版本彼此独立发布，读者只会看到当前语言真正可用的内容。\n\n### 保持版本隔离\n\n草稿和未发布版本不会进入公开页面。\n\n## 继续写下去\n\n稳定的结构比一次性写完更重要。\n\n### 每次只推进一步\n\n小步修改更容易回看，也更容易在发现边界时及时停下。', '[]',
    '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 'engineering', '["typescript"]'
  ),
  (
    'en-only-example', 'en',
    'An English-only article', 'This article is currently available in English only.',
    'This article has only an English published version.\n\n## English only for now\n\nEach language is published independently so a reader sees only what is ready.\n\n### Keep versions isolated\n\nDraft text must never cross the public boundary.\n\n## Continue deliberately\n\nA stable structure matters more than finishing everything at once.\n\n### Move one step at a time\n\nSmall changes are easier to review and safer to reverse.', '[]',
    'An English-only article', 'This article is currently available in English only.',
    'This article has only an English published version.\n\n## English only for now\n\nEach language is published independently so a reader sees only what is ready.\n\n### Keep versions isolated\n\nDraft text must never cross the public boundary.\n\n## Continue deliberately\n\nA stable structure matters more than finishing everything at once.\n\n### Move one step at a time\n\nSmall changes are easier to review and safer to reverse.', '[]',
    '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', 'engineering', '["typescript"]'
  );

INSERT INTO ideas (id, text, created_at, updated_at) VALUES
  ('idea-boundaries', '边界的本质是归属：谁改、谁负责。也许可以写成一篇关于服务边界的文章。', '2026-09-01T08:00:00.000Z', '2026-09-01T08:00:00.000Z');
