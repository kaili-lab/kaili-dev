// T5.3b comparison fixtures, development-only. Two admin article-list
// layouts (A table, B stacked) and two editor layouts (A two-column,
// B single column with a sticky toolbar). Static data; no saving.

type Code = 'N' | 'D' | 'P' | 'M'
export type AdminVariant = 'a' | 'b'
export type AdminPage = 'list' | 'list-empty' | 'editor'
export type Feedback = 'none' | 'saved' | 'published' | 'error'

const stateText: Record<Code, string> = {
  N: '未创建',
  D: '草稿',
  P: '已发布',
  M: '已发布 · 有未发布修改',
}
const stateClass: Record<Code, string> = {
  N: 'av-state av-state-quiet',
  D: 'av-state av-state-quiet',
  P: 'av-state av-state-live',
  M: 'av-state av-state-live av-state-modified',
}

const rows: {
  title: string
  zh: Code
  en: Code
  category: string
  time: string
}[] = [
  {
    title: '（无标题）',
    zh: 'D',
    en: 'N',
    category: '工程',
    time: '保存于 10-14 09:12',
  },
  {
    title: '一套不会把代码库写烂的 AI 辅助开发流程',
    zh: 'M',
    en: 'D',
    category: 'AI',
    time: '发布于 2026-09-20',
  },
  {
    title: '把边界写清楚',
    zh: 'P',
    en: 'M',
    category: '工程',
    time: '发布于 2026-09-02',
  },
  {
    title: 'Moving Say Right to Cloudflare Workers',
    zh: 'N',
    en: 'P',
    category: '工程',
    time: '发布于 2026-08-18',
  },
  {
    title: '读《软件设计的哲学》',
    zh: 'M',
    en: 'M',
    category: '读书',
    time: '发布于 2026-07-01',
  },
]

function Status({ language, code }: { language: 'zh' | 'en'; code: Code }) {
  return (
    <span className={stateClass[code]}>
      {language === 'zh' ? '中' : 'EN'} · {stateText[code]}
    </span>
  )
}

function AdminNav() {
  return (
    <header className="av-nav">
      <strong>kaili.dev 后台</strong>
      <nav aria-label="后台">
        <a href="#posts" aria-current="page">
          文章
        </a>
        <a href="#ideas">Idea</a>
        <a href="#taxonomy">分类与标签</a>
      </nav>
      <span className="av-nav-side">
        <a href="/zh">查看网站 ↗</a>
        <span>Kai Li（开发环境假登录）</span>
      </span>
    </header>
  )
}

function ListA({ empty }: { empty: boolean }) {
  return (
    <section className="av-page">
      <div className="av-page-head">
        <h1>文章</h1>
        <button type="button" className="ui-button">
          新建文章
        </button>
      </div>
      {empty ? (
        <p className="av-empty">还没有文章。点「新建文章」开始写第一篇。</p>
      ) : (
        <table className="av-table">
          <thead>
            <tr>
              <th scope="col">标题</th>
              <th scope="col">中文</th>
              <th scope="col">English</th>
              <th scope="col">分类</th>
              <th scope="col">时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.title}>
                <td>
                  <a href="#editor">{row.title}</a>
                </td>
                <td>
                  <span className={stateClass[row.zh]}>
                    {stateText[row.zh]}
                  </span>
                </td>
                <td>
                  <span className={stateClass[row.en]}>
                    {stateText[row.en]}
                  </span>
                </td>
                <td>{row.category}</td>
                <td className="av-time">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ListB({ empty }: { empty: boolean }) {
  return (
    <section className="av-page">
      <div className="av-page-head">
        <h1>文章</h1>
        <button type="button" className="ui-button">
          新建文章
        </button>
      </div>
      {empty ? (
        <p className="av-empty av-empty-box">
          还没有文章。点「新建文章」开始写第一篇。
        </p>
      ) : (
        <ul className="av-stack">
          {rows.map((row) => (
            <li key={row.title}>
              <a href="#editor">{row.title}</a>
              <div className="av-stack-meta">
                <Status language="zh" code={row.zh} />
                <Status language="en" code={row.en} />
                <span>{row.category}</span>
                <span className="av-time">{row.time}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type EditorProps = {
  tab: 'zh' | 'en'
  zh: Code
  en: Code
  unsaved: boolean
  feedback: Feedback
}

function feedbackLine(feedback: Feedback, tab: 'zh' | 'en') {
  if (feedback === 'saved')
    return (
      <p role="status" className="av-feedback av-ok">
        已保存 14:32
      </p>
    )
  if (feedback === 'published')
    return (
      <p role="status" className="av-feedback av-ok">
        {tab === 'zh' ? '中文版' : '英文版'}已发布 14:33 ·{' '}
        <a href="/zh">查看公开页 ↗</a>
      </p>
    )
  if (feedback === 'error')
    return (
      <p role="alert" className="av-feedback av-error">
        未发布：缺少标题、摘要
      </p>
    )
  return null
}

function SharedFields({ unsaved }: { unsaved: boolean }) {
  return (
    <fieldset className="av-shared">
      <legend>
        共享信息{unsaved ? ' •' : ''}
        {unsaved && <span className="av-sr"> 有未保存修改</span>}
      </legend>
      <label>
        <span>slug</span>
        <input
          className="ui-input"
          defaultValue="make-boundaries-visible"
          readOnly
        />
        <small>已发布后锁定</small>
      </label>
      <label>
        <span>分类</span>
        <span className="av-inline">
          <select className="ui-input" defaultValue="engineering">
            <option value="engineering">工程</option>
            <option value="ai">AI</option>
          </select>
          <button type="button" className="ui-button">
            新建分类
          </button>
        </span>
      </label>
      <div className="av-tags">
        <span>标签</span>
        <label>
          <input type="checkbox" defaultChecked /> TypeScript
        </label>
        <label>
          <input type="checkbox" /> Cloudflare
        </label>
      </div>
    </fieldset>
  )
}

function Tabs({ tab, zh, en, unsaved }: Omit<EditorProps, 'feedback'>) {
  return (
    <div role="tablist" aria-label="语言" className="av-tabs">
      {(['zh', 'en'] as const).map((language) => {
        const code = language === 'zh' ? zh : en
        const active = language === tab
        return (
          <button
            key={language}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'av-tab is-active' : 'av-tab'}
          >
            {language === 'zh' ? '中文' : 'English'} · {stateText[code]}
            {active && unsaved ? ' •' : ''}
          </button>
        )
      })}
    </div>
  )
}

function Content({ tab }: { tab: 'zh' | 'en' }) {
  const zh = tab === 'zh'
  return (
    <div className="av-content">
      <label>
        <span>标题</span>
        <input
          className="ui-input"
          defaultValue={zh ? '把边界写清楚' : 'Make boundaries visible'}
        />
      </label>
      <label>
        <span>摘要</span>
        <input
          className="ui-input"
          defaultValue={
            zh
              ? '所有权、边界和事务结束的位置，决定了服务是否容易理解。'
              : 'Ownership and where the transaction ends make a service understandable.'
          }
        />
      </label>
      <div className="av-body-head">
        <span>正文</span>
        <span className="av-toggle">
          <button type="button" className="ui-button" aria-pressed="true">
            编辑
          </button>
          <button type="button" className="ui-button" aria-pressed="false">
            预览
          </button>
        </span>
      </div>
      <textarea
        className="ui-input av-body"
        aria-label="正文"
        defaultValue={
          zh
            ? '## 让边界清楚\n\n边界不是额外的文档，而是让每次改变都有清晰归属的约定。\n\n### 从输入开始\n\n先确认输入由谁负责校验……'
            : '## Make it clear\n\nA boundary is not extra documentation…'
        }
      />
    </div>
  )
}

function StatusLine({ tab, code }: { tab: 'zh' | 'en'; code: Code }) {
  return (
    <p className="av-statusline">
      当前：<span className={stateClass[code]}>{stateText[code]}</span>
      {code === 'P' || code === 'M' ? (
        <span className="av-time"> · 首次发布 2026-09-02</span>
      ) : null}
      <span className="av-sr">（{tab === 'zh' ? '中文' : 'English'}）</span>
    </p>
  )
}

function Actions({ tab, feedback }: { tab: 'zh' | 'en'; feedback: Feedback }) {
  return (
    <div className="av-actions">
      <div className="av-buttons">
        <button type="button" className="ui-button">
          保存
        </button>
        <button type="button" className="ui-button av-primary">
          {tab === 'zh' ? '发布中文' : '发布英文'}
        </button>
      </div>
      {feedbackLine(feedback, tab)}
    </div>
  )
}

function References({ collapsed }: { collapsed: boolean }) {
  const list = (
    <ul className="av-refs">
      <li>
        <p>边界的本质是归属：谁改、谁负责。也许可以写成一篇……</p>
        <span className="av-ref-actions">
          <button type="button" className="ui-button">
            展开
          </button>
          <a href="#idea">打开 ↗</a>
          <button type="button" className="ui-button">
            移除
          </button>
        </span>
      </li>
    </ul>
  )
  return collapsed ? (
    <details className="av-references">
      <summary>参考资料（Idea · 1）</summary>
      {list}
      <button type="button" className="ui-button">
        添加 Idea
      </button>
    </details>
  ) : (
    <section className="av-references" aria-label="参考资料">
      <h2>参考资料（Idea）</h2>
      {list}
      <button type="button" className="ui-button">
        添加 Idea
      </button>
    </section>
  )
}

function EditorA(props: EditorProps) {
  const code = props.tab === 'zh' ? props.zh : props.en
  return (
    <section className="av-page av-editor-a">
      <div className="av-main">
        <SharedFields unsaved={props.unsaved} />
        <Tabs {...props} />
        <Content tab={props.tab} />
      </div>
      <aside className="av-side">
        <StatusLine tab={props.tab} code={code} />
        <Actions tab={props.tab} feedback={props.feedback} />
        <References collapsed={false} />
      </aside>
    </section>
  )
}

function EditorB(props: EditorProps) {
  const code = props.tab === 'zh' ? props.zh : props.en
  return (
    <section className="av-page av-editor-b">
      <div className="av-toolbar">
        <StatusLine tab={props.tab} code={code} />
        <Actions tab={props.tab} feedback={props.feedback} />
      </div>
      <Tabs {...props} />
      <Content tab={props.tab} />
      <SharedFields unsaved={props.unsaved} />
      <References collapsed />
    </section>
  )
}

export function AdminVariantPage({
  variant,
  page,
  ...editor
}: { variant: AdminVariant; page: AdminPage } & EditorProps) {
  return (
    <div className="av-root" lang="zh-CN">
      <AdminNav />
      {page === 'editor' ? (
        variant === 'a' ? (
          <EditorA {...editor} />
        ) : (
          <EditorB {...editor} />
        )
      ) : variant === 'a' ? (
        <ListA empty={page === 'list-empty'} />
      ) : (
        <ListB empty={page === 'list-empty'} />
      )}
    </div>
  )
}
