# 后台登录功能设计

更新日期：2026-10-25

## 结论

kaili.dev 不提供站内注册页面。

后台只提供一个登录入口：

```text
使用 GitHub 登录
```
生产开放规则已由 D-172 确认：T7.2、T7.3 和统一后台 server function 鉴权完成并验收后，生产 `/admin` 开放；当前仍保持关闭。

GitHub 负责证明用户身份。kaili.dev 使用 GitHub 数字用户 ID 判断用户是否有后台权限。

首次允许的 GitHub 用户登录时，系统可以自动创建一个内部 account。这个动作是后台账户初始化，不是开放注册。

## 当前阶段和目标阶段

### 当前阶段

- 本地后台需要有效 session。
- 没有 session 时，访问 `/admin/*` 跳转 `/auth/github/start`。
- 生产 `/admin/*` 仍不可访问。
- 本地文章、Idea、分类和标签仍使用内存仓储。
- OAuth callback 已能写入 D1 account/session，但真实登录验收尚未完成。

### 目标阶段

T7.2 D1 仓储、T7.3 OAuth/session 和后台权限验收完成后，生产后台才允许访问。

生产后台是否在 T7.2/T7.3 完成后开放，需要新增决策来 supersede D-132 的“生产不可达”原型规则。确认前，生产后台继续返回 404。

## 页面

### `/admin/login`

未登录用户看到的页面。

默认状态显示：

- 标题：进入后台
- 说明：使用允许的 GitHub 账号登录。
- 主按钮：使用 GitHub 登录
- 不显示注册按钮。
- 不显示 Client ID、用户 ID、secret 或内部错误。

错误状态显示安全的用户文案：

| 内部情况 | 页面文案 |
|---|---|
| 用户取消 GitHub 授权 | 登录已取消，请重新尝试。 |
| state 缺失或不匹配 | 登录验证失败，请重新开始。 |
| code 换取 token 失败 | GitHub 登录暂时失败，请稍后重试。 |
| GitHub 用户信息读取失败 | GitHub 登录暂时失败，请稍后重试。 |
| D1 写 account/session 失败 | GitHub 登录暂时失败，请稍后重试。 |
| session 过期 | 登录已过期，请重新登录。 |

页面不显示 GitHub 原始错误、access token、响应正文或服务端堆栈。

### `/admin/access-denied`

GitHub 登录成功，但用户数字 ID 不在 `GITHUB_ALLOWED_USER_ID` 中时显示。

显示：

- 标题：没有后台权限
- 说明：当前 GitHub 账号不能访问 kaili.dev 后台。
- 操作：重新登录
- 说明：如果需要更换 GitHub 账号，请先退出当前 GitHub 账号，或使用浏览器无痕窗口重新登录。

系统不假设 GitHub 每次都会显示账号选择页面。

拒绝时：

- 不创建 account。
- 不创建 session。
- 清除 OAuth state cookie。
- 不保存 GitHub access token。

## OAuth 流程

### 开始登录

访问 `/auth/github/start` 时：

1. 生成随机 state。
2. 将 state 和安全的 return URL 一起写入签名的 HttpOnly cookie。
3. 跳转 GitHub 授权页面。

return URL 只能是站内 `/admin` 路径，例如：

```text
/admin/posts
/admin/ideas
/admin/taxonomy
```

以下内容不能作为 return URL：

- 外部 URL。
- `//` 开头的 URL。
- 含反斜杠的 URL。
- 含 `..` 的 URL。
- 登录页和权限拒绝页。

callback 不直接信任 query 中的 return URL。callback 从签名 cookie 读取 return URL。

### GitHub 回调

访问 `/auth/github/callback` 时，服务端按下面顺序处理：

1. 读取 state cookie。
2. 校验 state 签名和 query 中的 state。
3. 如果 state 不匹配，显示登录验证失败。
4. state 校验成功后，再处理 GitHub 的 `error` 参数。
5. 如果用户取消授权，显示登录已取消。
6. 如果没有 code，显示登录失败。
7. 使用服务端 Client Secret 向 GitHub 换取 access token。
8. 使用 access token 读取 GitHub 用户信息。
9. 将 GitHub 数字用户 ID 作为字符串校验。
10. 比较 `GITHUB_ALLOWED_USER_ID`。
11. 不允许时进入 `/admin/access-denied`。
12. 允许时创建或更新 account。
13. 在创建新 session 前，删除当前浏览器已有的旧 session。
14. 创建新的随机 session ID，并写入 D1。
15. 写入 HttpOnly session cookie。
16. 清除 OAuth state cookie。
17. 跳转到签名 cookie 中保存的站内 return URL。

所有失败出口都必须清除 OAuth state cookie。

## Session 规则

Session cookie：

- HttpOnly。
- SameSite=Lax。
- 生产环境使用 Secure。
- 使用随机 session ID。
- session 数据保存在 D1。
- session 有效期由服务端控制。

每次后台请求都必须检查：

1. session 是否存在。
2. session 是否过期。
3. session 对应的 account 是否存在。
4. account 的 GitHub 数字用户 ID 是否仍在允许名单中。

这样，移除 `GITHUB_ALLOWED_USER_ID` 后，已有 session 也不能继续访问后台。

后台 server function 的鉴权必须使用统一包装器，不在每个函数中复制一套检查。

退出登录使用 POST：

1. 删除或失效 D1 session。
2. 清除浏览器 session cookie。
3. 跳转 `/admin/login`。

即使 D1 删除失败，也必须清除浏览器 cookie。

## 安全限制

- Client Secret 只在服务端运行时使用。
- GitHub access token 不保存。
- 不把 secret 写入 HTML、浏览器 JavaScript、日志或错误页面。
- 不把 GitHub 用户完整响应写入日志。
- `GITHUB_ALLOWED_USER_ID` 必须是只包含数字的字符串。
- 不把 GitHub 显示名称或 email 当作权限依据。
- 不允许任意 GitHub 用户首次登录后自动成为管理员。
- 不提供站内注册、密码登录或 Passkey。

## 行为验收

1. 未登录访问 `/admin/posts`，看到登录页面或被跳转到登录页面，不能看到后台内容。
2. 点击 GitHub 登录，授权 URL 只有 `read:user` 权限，并包含随机 state。
3. 修改 state，看到登录验证失败，不创建 session。
4. GitHub 取消授权，看到登录取消提示，不创建 session。
5. 非允许用户完成授权，看到权限拒绝页面，不创建 account 或 session。
6. 允许用户完成授权，返回原来的站内后台路径。
7. 外部 return URL 被拒绝，成功后只能回到 `/admin/posts`。
8. session 过期后访问后台，回到登录页面。
9. 移除允许用户 ID 后，已有 session 不能继续访问后台。
10. 退出登录后，原 session 不能再次访问后台。
11. 同一浏览器同时开始两次 OAuth 登录时，旧 state 不能通过新 state 校验。
12. 生产构建不能通过开发假登录访问后台。

## 当前实现状态

已完成：

- OAuth 授权 URL。
- `read:user` 最小权限。
- state 签名和校验。
- GitHub 数字用户 ID 校验。
- OAuth start/callback 路由。
- D1 account/session 写入基础。
- HttpOnly/SameSite cookie。
- 本地无 session 时的后台页面门禁。

待完成：

- `/admin/login` 页面。
- `/admin/access-denied` 页面。
- 取消授权和 callback 失败状态展示。
- logout 路由和按钮。
- 后台 server function 统一 session 鉴权。
- T7.2 D1 仓储切换。
- 生产后台是否开放的决策。
