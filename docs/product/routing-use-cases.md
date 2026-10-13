# T3.1 路由用例表：双语页面与语言链接

状态：Grok 复核通过；T3.2 前置未决项见 §8。

依据：requirements.md §2.2.1、§2.2.2、§2.4、D-026、D-027、D-036、D-082、D-142；不定义 T3.2 的实现库或数据层接口。

## 1. 术语和固定夹具

### 1.1 输入记号

| 记号 | 含义 |
|---|---|
| `B=zh` | `Accept-Language` 首选语言为中文，例如 `zh-CN,zh;q=0.9` |
| `B=en` | `Accept-Language` 首选语言为英文，例如 `en-US,en;q=0.9` |
| `B=empty` | 没有 `Accept-Language` 请求头 |
| `B=other` | 首选语言既不是中文也不是英文，例如 `fr-FR,fr;q=0.9` |
| `L=none` | 没有已保存的手动语言选择 |
| `L=zh` / `L=en` | 顶栏手动选择后保存的语言偏好 |
| `Z=P` / `E=P` | 文章的中文 / 英文版本已发布 |
| `Z=U` / `E=U` | 中文 / 英文版本不存在或未发布；公开页面把草稿和不存在都视为不可访问 |
| `S=both` | `Z=P, E=P` |
| `S=zh-only` | `Z=P, E=U` |
| `S=en-only` | `Z=U, E=P` |
| `S=none` | `Z=U, E=U` |

`B` 是请求头输入，`L` 是服务端能读取到的已保存偏好。`effective` 是路由选择使用的语言：已有 `L` 时优先使用 `L`，否则使用 `B`；`B=empty` / `B=other` 固定回退到中文（D-142）。

### 1.2 固定内容夹具

| 夹具 | 状态 | 用途 |
|---|---|---|
| `post-both` | `S=both`，slug 为 `boundary-example`；`publishedAt=2026-09-02` | 验证两种正式语言页、中立链接和文章内切换 |
| `post-zh-only` | `S=zh-only`，slug 为 `zh-only-example`；`publishedAt=2026-08-01` | 验证目标英文未发布 |
| `post-en-only` | `S=en-only`，slug 为 `en-only-example`；`publishedAt=2026-07-01` | 验证目标中文未发布 |
| `post-none` | `S=none`，slug 为 `private-example` | 验证未发布内容不会泄漏 |
| `post-missing` | slug 不存在 | 验证正式 URL 和中立 URL 的 404 |
| `home/list` | 公开页面 | 验证页面语言、canonical、hreflang 和语言过滤 |

### 1.3 统一响应字段

每条行为用例必须检查以下字段，不只检查页面是否打开：

- HTTP 状态码、最终 URL、跳转次数和 `Location`；
- 页面显示语言：`<html lang>`、页面标题、导航、提示文字和文章内容语言；
- 正式页 `canonical`；
- `hreflang` 目标集合：只允许指向已发布且可公开访问的正式语言 URL，不指向草稿、404 或无前缀中立 URL；
- 页面是否显示一次性语言切换提示；
- 刷新当前最终 URL 后提示是否消失，页面语言和地址是否保持；
- `scrollWidth === clientWidth`，作为页面行为测试的共同断言。

## 2. 语言选择和首页

### 2.1 根路径自动选择

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-ROOT-01 | `/` | `B=zh, L=none` | `302` 到 `/zh` | `/zh` 返回 `200`；显示中文；canonical 为 `/zh`；不出现语言提示 | 刷新 `/zh` 仍为中文，不再次跳转到 `/` |
| R-ROOT-02 | `/` | `B=en, L=none` | `302` 到 `/en` | `/en` 返回 `200`；显示英文；canonical 为 `/en`；不出现语言提示 | 刷新 `/en` 仍为英文，不再次跳转到 `/` |
| R-ROOT-03 | `/` | `B=empty, L=none` | `302` 到 `/zh` | `/zh` 返回 `200`；显示中文；canonical 为 `/zh`；不出现语言提示 | 刷新 `/zh` 仍为中文，不再次跳转到 `/` |
| R-ROOT-04 | `/` | `B=other, L=none` | `302` 到 `/zh` | `/zh` 返回 `200`；显示中文；canonical 为 `/zh`；不显示错误语言页面或提示 | 刷新 `/zh` 仍为中文，不再次跳转到 `/` |
| R-ROOT-05 | `/` | 任意 `B`，`L=zh` | `302` 到 `/zh` | 显示中文；canonical 为 `/zh`；手动选择覆盖浏览器语言 | 刷新 `/zh` 保持中文 |
| R-ROOT-06 | `/` | 任意 `B`，`L=en` | `302` 到 `/en` | 显示英文；canonical 为 `/en`；手动选择覆盖浏览器语言 | 刷新 `/en` 保持英文 |

### 2.2 正式首页和文章列表

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-HOME-01 | `/zh` | 任意 `B/L` | `200`，不再按请求头跳走 | `<html lang="zh-CN">`；中文首页只显示 `boundary-example`、`zh-only-example`，按 `publishedAt` 倒序；不显示 `en-only-example` / `private-example`；canonical `/zh`；hreflang 闭集为 `/zh`、`/en` | 刷新仍为 `/zh`，无提示 |
| R-HOME-02 | `/en` | 任意 `B/L` | `200`，不再按请求头跳走 | `<html lang="en">`；英文首页只显示 `boundary-example`、`en-only-example`，按 `publishedAt` 倒序；不显示 `zh-only-example` / `private-example`；canonical `/en`；hreflang 闭集为 `/zh`、`/en` | 刷新仍为 `/en`，无提示 |
| R-HOME-03 | `/zh/writing` | 任意 `B/L` | `200` | `<html lang="zh-CN">`；中文列表显示 `boundary-example`、`zh-only-example`，按 `publishedAt` 倒序；不显示英文专属或未发布文章；canonical `/zh/writing`；hreflang 闭集为 `/zh/writing`、`/en/writing` | 刷新仍为中文列表，无提示 |
| R-HOME-04 | `/en/writing` | 任意 `B/L` | `200` | `<html lang="en">`；英文列表显示 `boundary-example`、`en-only-example`，按 `publishedAt` 倒序；不显示中文专属或未发布文章；canonical `/en/writing`；hreflang 闭集为 `/zh/writing`、`/en/writing` | 刷新仍为英文列表，无提示 |
| R-HOME-05 | `/zh/writing?category=engineering&tag=typescript` | 任意 `B/L` | `200`；参数按 T4.2 处理 | 显示中文已发布结果；canonical `/zh/writing`；hreflang `/zh/writing`、`/en/writing`；地址保留 query，筛选 SEO 不把 query 作为正式地址 | 刷新地址和语言保持 |
| R-HOME-06 | `/en/writing?category=engineering&tag=typescript` | 任意 `B/L` | `200`；参数按 T4.2 处理 | 显示英文已发布结果；canonical `/en/writing`；hreflang `/zh/writing`、`/en/writing`；不显示中文版本替代结果，筛选 SEO 不把 query 作为正式地址 | 刷新地址和语言保持 |

## 3. 正式文章 URL

### 3.1 双语版本都已发布

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-ARTICLE-01 | `/zh/writing/boundary-example` | `S=both`，任意 `B/L` | `200`，不重定向 | 中文正文；canonical 为当前正式 URL；`hreflang` 包含 `/zh/writing/boundary-example` 和 `/en/writing/boundary-example` | 刷新保持中文和当前 URL，无提示 |
| R-ARTICLE-02 | `/en/writing/boundary-example` | `S=both`，任意 `B/L` | `200`，不重定向 | 英文正文；canonical 为当前正式 URL；`hreflang` 包含中英文正式 URL | 刷新保持英文和当前 URL，无提示 |
| R-ARTICLE-03 | 在中文文章点击英文按钮 | `S=both` | 进入 `/en/writing/boundary-example`，`200` | 显示英文文章；canonical 和 `hreflang` 与 R-ARTICLE-02 相同；不显示缺失提示 | 刷新不重复提示 |
| R-ARTICLE-04 | 在英文文章点击中文按钮 | `S=both` | 进入 `/zh/writing/boundary-example`，`200` | 显示中文文章；canonical 和 `hreflang` 与 R-ARTICLE-01 相同；不显示缺失提示 | 刷新不重复提示 |

### 3.2 只有中文版本已发布

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-ARTICLE-05 | `/zh/writing/zh-only-example` | `S=zh-only`，任意 `B/L` | `200` | 中文正文；canonical 当前正式 URL；`hreflang` 只包含中文正式 URL，不指向英文 404 | 刷新保持中文，无提示 |
| R-ARTICLE-06 | `/en/writing/zh-only-example` | `S=zh-only`，任意 `B/L` | `404`，不跳转中文文章 | 不泄漏中文正文；不生成该英文正式页的 canonical 或 `hreflang` | 刷新仍为 `404`，无语言切换提示 |
| R-ARTICLE-07 | 在中文 `zh-only` 文章点击英文按钮 | `S=zh-only` | 进入 `/en/writing`，`200` | 显示英文文章列表；只提示一次：`This article isn't available in English.`；列表页不把提示当普通列表状态 | 当前切换后的列表刷新，提示消失；地址和英文语言保持 |
| R-ARTICLE-08 | 在英文文章列表或首页打开普通 `/en/writing` | 任意内容状态 | `200` | 正常英文列表；不显示 R-ARTICLE-07 的提示 | 刷新和新会话都不显示提示 |

### 3.3 只有英文版本已发布

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-ARTICLE-09 | `/en/writing/en-only-example` | `S=en-only`，任意 `B/L` | `200` | 英文正文；canonical 当前正式 URL；`hreflang` 只包含英文正式 URL | 刷新保持英文，无提示 |
| R-ARTICLE-10 | `/zh/writing/en-only-example` | `S=en-only`，任意 `B/L` | `404`，不跳转英文文章 | 不泄漏英文正文；不生成该中文正式页的 canonical 或 `hreflang` | 刷新仍为 `404`，无语言切换提示 |
| R-ARTICLE-11 | 在英文 `en-only` 文章点击中文按钮 | `S=en-only` | 进入 `/zh/writing`，`200` | 显示中文文章列表；只提示一次：`这篇文章暂无中文版` | 当前切换后的列表刷新，提示消失；地址和中文语言保持 |
| R-ARTICLE-12 | 在中文文章列表或首页打开普通 `/zh/writing` | 任意内容状态 | `200` | 正常中文列表；不显示 R-ARTICLE-11 的提示 | 刷新和新会话都不显示提示 |

### 3.4 两种语言都未发布或 slug 不存在

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-ARTICLE-13 | `/zh/writing/private-example` | `S=none` | `404` | 不泄漏草稿或私人参考资料；无 canonical / hreflang | 刷新仍为 `404`，无提示 |
| R-ARTICLE-14 | `/en/writing/private-example` | `S=none` | `404` | 不泄漏草稿或私人参考资料；无 canonical / hreflang | 刷新仍为 `404`，无提示 |
| R-ARTICLE-15 | `/zh/writing/missing-example` | `post-missing` | `404` | 不返回中立链接的回退页，不生成 SEO 链接 | 刷新仍为 `404` |
| R-ARTICLE-16 | `/en/writing/missing-example` | `post-missing` | `404` | 同 R-ARTICLE-15 | 刷新仍为 `404` |
| R-ARTICLE-17 | 在 `S=none` 文章页面尝试切换语言 | `S=none` | 前置文章页本身应为 `404`，不存在可用的文章内切换入口 | 不产生列表提示或草稿泄漏 | 保持 `404` |

## 4. 无前缀中立分享链接

中立链接只负责按语言选择目标正式版本；成功后必须进入带语言前缀的正式文章 URL。成功响应的 `canonical`、`hreflang` 和页面语言以目标正式页为准；不把 `/writing/<slug>` 作为正式语言页面的 canonical。

| ID | 页面 | 输入 | 期望状态和跳转 | 期望显示 / SEO | 刷新与提示 |
|---|---|---|---|---|---|
| R-SHARE-01 | `/writing/boundary-example` | `S=both, effective=zh` | `302` 到 `/zh/writing/boundary-example` | 目标页 `200`，中文；canonical 目标正式 URL；`hreflang` 包含两种已发布正式 URL；不提示 | 刷新目标正式 URL保持中文 |
| R-SHARE-02 | `/writing/boundary-example` | `S=both, effective=en` | `302` 到 `/en/writing/boundary-example` | 目标页 `200`，英文；canonical 目标正式 URL；`hreflang` 包含两种已发布正式 URL；不提示 | 刷新目标正式 URL保持英文 |
| R-SHARE-09 | `/writing/boundary-example` | `S=both, B=en, L=zh` | `302` 到 `/zh/writing/boundary-example`；`L` 胜过 `B` | 中文目标页 `200`；canonical 为中文正式 URL；hreflang 为中英文正式 URL；无提示 | 刷新目标正式 URL保持中文 |
| R-SHARE-10 | `/writing/boundary-example` | `S=both, B=zh, L=en` | `302` 到 `/en/writing/boundary-example`；`L` 胜过 `B` | 英文目标页 `200`；canonical 为英文正式 URL；hreflang 为中英文正式 URL；无提示 | 刷新目标正式 URL保持英文 |
| R-SHARE-11 | `/writing/zh-only-example` | `S=zh-only, B=en, L=en` | `302` 到 `/zh/writing/zh-only-example`；偏好语言未发布，回退到中文 | 中文目标页 `200`；不显示任何语言缺失提示，也不得出现 `This article isn't available in English.` | 刷新目标正式 URL保持中文 |
| R-SHARE-12 | `/writing/en-only-example` | `S=en-only, B=zh, L=zh` | `302` 到 `/en/writing/en-only-example`；偏好语言未发布，回退到英文 | 英文目标页 `200`；不显示任何语言缺失提示，也不得出现 `这篇文章暂无中文版` | 刷新目标正式 URL保持英文 |
| R-SHARE-13 | `/writing/boundary-example` | `S=both, B=empty, L=none` | `302` 到 `/zh/writing/boundary-example`；按 D-142 中文回退 | 中文目标页 `200`；canonical 为中文正式 URL；无提示 | 刷新目标正式 URL保持中文 |
| R-SHARE-14 | `/writing/boundary-example` | `S=both, B=other, L=none` | `302` 到 `/zh/writing/boundary-example`；按 D-142 中文回退 | 中文目标页 `200`；canonical 为中文正式 URL；无提示 | 刷新目标正式 URL保持中文 |
| R-SHARE-03 | `/writing/zh-only-example` | `S=zh-only, effective=zh` | `302` 到 `/zh/writing/zh-only-example` | 目标中文正式页 `200`；canonical / hreflang 只含中文正式页 | 刷新目标正式 URL保持中文 |
| R-SHARE-04 | `/writing/zh-only-example` | `S=zh-only, effective=en` | 按中立链接回退到已发布中文版本：`302` 到 `/zh/writing/zh-only-example` | 目标中文正式页 `200`；不显示任何语言缺失提示，也不得出现 `This article isn't available in English.` | 刷新目标正式 URL保持中文 |
| R-SHARE-05 | `/writing/en-only-example` | `S=en-only, effective=en` | `302` 到 `/en/writing/en-only-example` | 目标英文正式页 `200`；canonical / hreflang 只含英文正式页 | 刷新目标正式 URL保持英文 |
| R-SHARE-06 | `/writing/en-only-example` | `S=en-only, effective=zh` | 按中立链接回退到已发布英文版本：`302` 到 `/en/writing/en-only-example` | 目标英文正式页 `200`；不显示任何语言缺失提示，也不得出现 `这篇文章暂无中文版` | 刷新目标正式 URL保持英文 |
| R-SHARE-07 | `/writing/private-example` | `S=none` | `404`，不回退到任何语言 | 不泄漏草稿、参考资料、canonical 或 hreflang | 刷新仍为 `404` |
| R-SHARE-08 | `/writing/missing-example` | `post-missing` | `404` | 不生成 SEO 信息 | 刷新仍为 `404` |

## 5. 顶栏语言按钮

这些是跨页面操作的补充用例；文章目标状态、完整提示文案、canonical 和 hreflang 以 R-ARTICLE-03/04/07/11 及对应正式页面用例为准，不创建第二套互相冲突的文章断言。

| ID | 当前页面 | 操作 | 期望结果 |
|---|---|---|---|
| R-LANG-01 | `/zh` | 点击 EN | `200` 的 `/en`；显示英文首页；保存 `L=en`；canonical `/en`；hreflang `/zh`、`/en`；刷新仍为 `/en`，无提示 |
| R-LANG-02 | `/en` | 点击中文 | `200` 的 `/zh`；显示中文首页；保存 `L=zh`；canonical `/zh`；hreflang `/zh`、`/en`；刷新仍为 `/zh`，无提示 |
| R-LANG-03 | `/zh/writing?category=engineering&tag=typescript` | 点击 EN | `200` 的 `/en/writing?category=engineering&tag=typescript`；显示英文列表；保存 `L=en`；canonical 和 query 保持；无提示 |
| R-LANG-04 | `/en/writing?category=engineering&tag=typescript` | 点击中文 | `200` 的 `/zh/writing?category=engineering&tag=typescript`；显示中文列表；保存 `L=zh`；canonical 和 query 保持；无提示 |
| R-LANG-05 | 双语文章正式页 | 点击另一语言，目标版本已发布 | 按 R-ARTICLE-03/04 进入相同 slug 的目标正式页；保存目标语言偏好；无提示 |
| R-LANG-06 | 单语文章正式页 | 点击另一语言，目标版本未发布 | 按 R-ARTICLE-07/11 进入目标语言列表；显示对应 D-036 完整提示一次；保存目标语言偏好 |
| R-LANG-07 | 语言切换后的目标列表 | 刷新 | 地址、页面语言、列表、canonical 和 hreflang 保持；一次性提示消失 |
| R-LANG-08 | 普通直接访问目标语言列表 | 无切换上下文 | `200` 列表；正确 canonical / hreflang；不显示文章缺失提示 |
| R-LANG-09 | 语言切换后新开同一列表 URL | 没有本次切换上下文 | `200` 列表；正确 canonical / hreflang；不显示文章缺失提示 |
## 6. SEO 和公开内容排除

| ID | 输入 | 期望 |
|---|---|---|
| R-SEO-01 | `S=both` 的中文正式文章页 | `title` / `description` 使用中文已发布版本；canonical 为中文正式 URL；`hreflang` 只有中文和英文正式 URL |
| R-SEO-02 | `S=both` 的英文正式文章页 | `title` / `description` 使用英文已发布版本；canonical 为英文正式 URL；`hreflang` 只有中文和英文正式 URL |
| R-SEO-03 | 单语正式文章页 | title / description 使用已发布版本；hreflang 不指向未发布语言 |
| R-SEO-04 | 保存未发布修改后访问公开页 | 公开 HTML、title、description、canonical、hreflang 和 OG 信息不变 |
| R-SEO-05 | 发布当前语言后访问公开页 | 当前语言公开内容和对应 metadata 更新；另一语言 metadata 不被改变 |
| R-SEO-06 | 生成网站地图 | 属于 D-082 的 v1 范围，按 D-145 由 T6.1 验收，不作为 T3.2 通过条件。必须排除无前缀中立链接、query、404、草稿、后台、Resource、`thought`、Idea、`/_design`，并验证公开正式页精确成员、保存不变和发布后更新；依赖 T3.3 / T5.2 / T5.4 的对应产出 |

**验收落点（D-145）：**T3.2 验收 R-SEO-01~03 与静态公开内容隔离，不把静态夹具称为执行过保存。R-SEO-04/05 的原期望不变：T5.2 验证真实保存发布的状态变化，T3.4 生成 OG 并保证公开版本读取，T5.4 联验实际保存 / 发布后的公开 HTML、metadata 与 OG；全部通过前保持 R-SEO-04/05 未完成，不宣告 SEO 或 v1 完成。

## 7. 已决语言规则

### R-01：`B=empty` / `B=other` 的默认语言

Kai Li 选择中文默认（D-142）：没有中文或英文可识别偏好时，根路径进入 `/zh`。这保持当前站点入口和 `<html lang="zh-CN">` 的默认方向。R-ROOT-03 和 R-ROOT-04 的目标固定为 `/zh`。

### R-02：手动语言偏好是否影响中立分享链接

Kai Li 选择中立链接遵守全站手动偏好（D-142）：`L` 优先于 `B`，因此 `/writing/<slug>` 也使用已保存的手动语言选择；没有 `L` 时才使用 `Accept-Language`，目标语言未发布时按 D-027 回退到另一已发布语言。

这两项确认后，T3.2 必须直接使用 `effective` 规则，不得在路由实现里另行定义回退或忽略手动偏好。

## 8. T3.2 前置问题已解决

Q-1、Q-2、Q-3 已由 Kai Li 确认，具体规则写入 §9。T3.2 可按本表实现与验收；D-145 已批准 R-SEO-04/05 按实现依赖联验、R-SEO-06 归 v1 的 T6.1，不因尚未实现就删减这些要求。
## 9. 已决实现规则

### R-SEO-QUERY：筛选列表的正式地址

筛选 query 只保存筛选状态，不构成独立 SEO 正式页。`/zh/writing?category=...&tag=...` 的 canonical 为 `/zh/writing`，`/en/...` 对应为 `/en/writing`；两者的 hreflang 只指向不带 query 的中英文基础列表。地址栏和刷新仍保留 query。

### R-LANGUAGE-Q：Accept-Language 查找规则

在请求头中按 q 权重从高到低寻找首个支持的中文或英文标签；忽略排在前面的不支持语言。例如 `fr-FR,en;q=0.8` 选择英文。只有没有任何可识别中文/英文标签时才回退中文；`L` 存在时仍优先于整个请求头。

### R-OG-LANGUAGE：爬虫跟随最终页面

无语言偏好的爬虫与普通访问使用同一 `effective` 规则并跟随 302；中立链接最终进入中文时，OG 使用中文已发布版本。英文优先的独立 OG 规则不再适用本路由契约，T3.4 按最终页面验证。
