# GitHub OAuth 配置说明

## 目的

本项目使用 GitHub OAuth 让指定的 GitHub 账号进入后台。

当前项目已完成 OAuth 回调、GitHub 用户 ID 校验、HttpOnly session 和后台真实登录。当前线上测试地址是 `workers.dev`；正式切换 `kaili.dev` 前，GitHub OAuth App 需要使用 workers.dev 的回调地址。

## 执行者

- Kai Li：注册或维护 GitHub OAuth App，保存 Client ID 和 Client Secret，生成本地 `SESSION_SECRET`，填写本地 `.dev.vars`。
- kaili.dev 项目：根据当前请求来源生成 OAuth callback，执行 state 校验、用户校验和 session 创建。
- Cloudflare：保存生产 secret。生产 secret 不写进仓库。

## 安全限制

不要把下面任何实际值发到聊天：

- GitHub Client Secret
- GitHub 数字用户 ID
- `SESSION_SECRET`
- `.dev.vars` 的完整内容

不要把 secret 写入以下位置：

- 源代码
- `wrangler.jsonc`
- `package.json`
- GitHub Issue 或 Pull Request
- 日志
- Git 提交

`.dev.vars` 已被 Git 忽略。助手不会读取 `.dev.vars`。

## 1. 注册 GitHub OAuth App

在浏览器打开：

<https://github.com/settings/applications/new>

如果没有直接进入新建页面，按下面路径进入：

```text
GitHub 头像
→ Settings
→ Developer settings
→ OAuth Apps
→ New OAuth App
```

填写以下内容：

| GitHub 字段 | 值 |
|---|---|
| Application name | `kaili.dev Admin` |
| Homepage URL | `https://kaili-dev.nautilus1876.workers.dev/`（当前测试阶段） |
| Application description | `Private admin access for kaili.dev` |
| Authorization callback URL | `https://kaili-dev.nautilus1876.workers.dev/auth/github/callback` |

不要开启 wildcard matching。

如果需要本地 OAuth 测试，再点击 **Add redirect URI**，增加：

```text
http://localhost:3000/auth/github/callback
http://127.0.0.1:3000/auth/github/callback
```

GitHub 回调地址必须与浏览器实际访问的主机名一致：

- 使用 `http://localhost:3000` 时，使用 `localhost` 回调地址。
- 使用 `http://127.0.0.1:3000` 时，使用 `127.0.0.1` 回调地址。

完成后点击：

```text
Register application
```

## 2. 保存 GitHub 应用凭据

注册成功后，GitHub 会显示 `Client ID`。

1. 把 `Client ID` 保存到密码管理器。
2. 点击 **Generate a new client secret**。
3. 把 Client Secret 保存到密码管理器。
4. 不要把 Client Secret 发到聊天或写进仓库。

如果忘记 Client Secret，只能在 GitHub 页面重新生成。重新生成后，旧 secret 会失效。

## 3. 获取 GitHub 数字用户 ID

在本机终端执行：

```sh
gh api user --jq .id
```

命令输出的是 GitHub 数字用户 ID，不是用户名。

把这个数字保存到密码管理器。不要把命令输出发到聊天。

## 4. 生成本地 session secret

在本机终端执行：

```sh
openssl rand -base64 32
```

把输出保存到密码管理器。

本地 `SESSION_SECRET` 应该和生产 `SESSION_SECRET` 不同。原因是：

- 本地密钥泄露时，不影响生产 session。
- 本地调试时更换密钥，不会让线上用户退出登录。
- 本地生成的 cookie 不应在生产环境有效。

## 5. 配置本地 `.dev.vars`

项目根目录的 `.dev.vars` 已经创建。只填写值，不修改变量名：

```dotenv
GITHUB_CLIENT_ID=填写 GitHub Client ID
GITHUB_CLIENT_SECRET=填写 GitHub Client Secret
GITHUB_ALLOWED_USER_ID=填写 GitHub 数字用户 ID
SESSION_SECRET=填写本地随机密钥
```

如果本地和生产使用同一个 GitHub OAuth App：

- `GITHUB_CLIENT_ID` 可以相同。
- `GITHUB_CLIENT_SECRET` 可以相同。
- `GITHUB_ALLOWED_USER_ID` 可以相同。
- `SESSION_SECRET` 应该不同。

填写后检查文件是否仍被 Git 忽略：

```sh
git check-ignore -q .dev.vars && echo ignored
```

预期输出：

```text
ignored
```

不要执行会输出 `.dev.vars` 内容的命令，也不要把文件内容发给助手。

## 6. 配置 Cloudflare 生产 secret

生产 secret 使用 Wrangler 写入 Cloudflare：

```sh
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm exec wrangler secret put GITHUB_ALLOWED_USER_ID
pnpm exec wrangler secret put SESSION_SECRET
```

每条命令分别执行。命令提示输入值时，粘贴对应值后按回车。

检查 secret 是否存在时，只查看名称：

```sh
pnpm exec wrangler secret list
```

不要查看、复制或发送 secret 内容。

## 7. 本地、workers.dev 和正式域名的登录流程

本地流程是：

```text
打开 http://localhost:3000/admin
→ 跳转 GitHub 授权页面
→ GitHub 回调 http://localhost:3000/auth/github/callback
→ 服务端校验 state
→ 服务端使用 Client Secret 换取 GitHub 用户信息
→ 服务端比较 GitHub 数字用户 ID
→ 服务端创建 HttpOnly session
→ 进入本地后台
```

当前线上测试流程使用：

```text
https://kaili-dev.nautilus1876.workers.dev/auth/github/callback
```

正式域名切换后再改为：

```text
https://kaili.dev/auth/github/callback
```

项目会根据当前请求来源生成 callback；GitHub OAuth App 中必须提前登记当前实际使用的完整地址。本地和线上执行相同的登录规则，两边使用不同的 `SESSION_SECRET`，所以 session 不互通。
## 8. 当前状态

已完成：

- GitHub OAuth App 已由 Kai Li 创建并配置当前线上 callback。
- Cloudflare 生产 secret 已写入并完成轮换后的线上登录验证。
- OAuth 登录入口、callback、state 校验、GitHub 用户 ID 校验、HttpOnly session、退出和后台真实登录均已完成。
- 当前 Worker 已部署到 `workers.dev`；`kaili.dev` callback 留待正式域名切换时更新。

仍需在正式域名切换时执行：

- 将 GitHub OAuth App 的 Authorization callback URL 改为 `https://kaili.dev/auth/github/callback`。
- 用正式域名重新验证登录、退出和后台访问。

本地 secret 和生产 secret 不要发到聊天；生产 secret 只用 `wrangler secret list` 核对名称，不读取值。
