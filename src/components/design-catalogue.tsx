import { Fragment, useState, type ReactNode } from 'react'

import sayRightImage from '../assets/design-say-right.png'
import voice from './design-voice.json'
import {
  K2ArticleEnd,
  K2ArticleHeading,
  K2ArticleLayout,
  K2ArticleItem,
  K2BookItem,
  K2BookGroup,
  K2FeatureArticle,
  K2Footer,
  K2Header,
  K2Hero,
  K2NowPanel,
  K2PageHeading,
  K2Pill,
  K2ProjectItem,
  K2Prose,
  K2Quote,
  K2SectionTitle,
  K2TableOfContents,
  K2TextCover,
} from '#/components/k2'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

function Example({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="catalogue-example" aria-label={title}>
      <h2 className="catalogue-label">{title}</h2>
      {children}
    </section>
  )
}

// Isolated design fixtures, not published personal content. Chinese voice copy
// comes from the retained references and their existing WenKai input manifest.
export function DesignCatalogue({ language }: { language: 'zh' | 'en' }) {
  const en = language === 'en'
  const [pressed, setPressed] = useState(false)
  const [texture, setTexture] = useState<'current' | 'strong' | 'dots'>(
    'current',
  )
  const post = {
    title: en
      ? 'Writing TypeScript services after six years of Java'
      : '写了六年 Java 之后，我怎么写 TypeScript 服务',
    summary: en
      ? 'Types are not the hard part. Ownership, boundaries, and where the transaction ends are.'
      : '类型不是难点。所有权、边界、事务在哪里结束才是。',
    category: en ? 'Engineering' : '工程',
    date: '2026-09-02',
    href: '#prose',
  }
  const rows = en
    ? [
        {
          label: 'Reading',
          text: 'A Philosophy of Software Design',
          note: 'second time',
        },
        {
          label: 'Writing',
          text: 'What it takes to actually understand a saved tweet',
          note: 'draft',
        },
        { label: 'Building', text: 'This site, from scratch', note: 'v1' },
        {
          label: 'Practising',
          text: 'Spoken English, twice a week',
          note: 'week 22',
        },
      ]
    : voice.rows
  const project = {
    name: 'Say Right',
    why: en
      ? 'I wanted to practise English using things I actually want to say.'
      : voice.projectWhy,
    introduction: en
      ? 'Start with a thought in Chinese, try saying it in English, then compare it with a more natural expression.'
      : voice.projectIntroduction,
    image: {
      src: sayRightImage,
      alt: en ? 'Say Right homepage' : 'Say Right 首页截图',
    },
    url: 'https://say-right.kaili.dev',
    repository: 'https://github.com/kaili-lab/say-right',
    status: en ? 'Maintained' : '在维护',
    active: true,
  }
  const book = {
    title: 'A Philosophy of Software Design',
    author: 'John Ousterhout',
    status: en ? 'Reading' : '在读',
    active: true,
    note: en
      ? 'Second time through. This time, applying deep modules to my own code.'
      : voice.bookNote,
  }
  const links = [
    { label: en ? 'Email' : '邮件', href: 'mailto:hello@kaili.dev' },
    { label: 'GitHub', href: 'https://github.com/kaili-lab' },
    { label: 'X', href: 'https://x.com' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com' },
  ]
  const tocItems: Array<{ id: string; title: string; level: 2 | 3 }> = [
    {
      id: 'prose-start',
      title: en ? 'Make boundaries visible' : '让边界清楚',
      level: 2,
    },
    {
      id: 'prose-details',
      title: en ? 'A concrete example' : '一个具体例子',
      level: 3,
    },
  ]
  const emptyMessage = en ? 'No entries yet.' : '暂无内容。'

  return (
    <div data-design-catalogue="K2 - DESIGN SYSTEM" data-texture={texture}>
      <K2Header
        language={language}
        homeHref="#hero"
        navigation={[
          { label: en ? 'Writing' : '写作', href: '#writing', current: true },
          { label: en ? 'Bookshelf' : '书架', href: '#books' },
        ]}
        languageLinks={{ zh: '/_design?lang=zh', en: '/_design?lang=en' }}
      />
      <main className="k2-wrap">
        <div className="catalogue-intro">
          <p className="catalogue-label">K2 - DESIGN SYSTEM · D-139 / D-140</p>
          <h2>
            {en ? 'Components, typography and states' : '组件、排版与状态'}
          </h2>
          <p>
            {en
              ? 'Development only. These are reference fixtures, not published content.'
              : '仅开发环境可见。以下为参照稿夹具，不是已发布内容。'}
          </p>
          <p>
            {en
              ? 'Default, current and empty examples below; hover links and use Tab to see real focus. Static seal, cover, prose and quotation have no hover/current/focus state.'
              : '下方展示默认、当前与空内容；悬停链接、按 Tab 查看真实焦点。印章、封面、正文和摘抄不适用悬停、当前或焦点状态。'}
          </p>
          <p>
            {en
              ? 'Footer social links demonstrate layout; X / LinkedIn point to their service homepages, not a claimed personal account.'
              : '页脚外链仅演示排版；X / LinkedIn 指向服务首页，不声称是个人账号。'}
          </p>
        </div>

        <Example
          id="textures"
          title={en ? 'Paper texture variants' : '纸纹变体'}
        >
          <p className="catalogue-texture-description">
            {en
              ? 'Choose one variant to apply to the catalogue. Each option is tested in light and dark mode below, including the hero and long-form article.'
              : '选择一种变体应用到整个目录页。下面会在浅色和深色中展示首屏与长文正文。'}
          </p>
          <div
            className="catalogue-texture-grid"
            role="group"
            aria-label={en ? 'Paper texture variants' : '纸纹变体'}
          >
            {(['current', 'strong', 'dots'] as const).map((variant) => {
              const labels = {
                current: en ? 'Current grain' : '现在的纸纹',
                strong: en ? 'Stronger grain' : '加强的纸纹',
                dots: en ? 'Faint dots' : '很淡的点阵',
              }
              return (
                <button
                  key={variant}
                  type="button"
                  className="catalogue-texture-option"
                  data-texture-option={variant}
                  aria-pressed={texture === variant}
                  onClick={() => setTexture(variant)}
                >
                  <span
                    className="catalogue-texture-swatch"
                    aria-hidden="true"
                  />
                  <span>{labels[variant]}</span>
                </button>
              )
            })}
          </div>
          <p className="catalogue-texture-status" role="status">
            {en ? 'Current variant: ' : '当前变体：'}
            {texture === 'current'
              ? en
                ? 'current grain'
                : '现在的纸纹'
              : texture === 'strong'
                ? en
                  ? 'stronger grain'
                  : '加强的纸纹'
                : en
                  ? 'faint dots'
                  : '很淡的点阵'}
          </p>
        </Example>

        <Example
          id="hero"
          title={
            en
              ? 'Header seal / hero / introduction / Now'
              : '顶栏印章 / 首屏 / 自我介绍 / 此刻'
          }
        >
          <K2Hero
            lines={
              en
                ? [
                    'A perpetual student,',
                    <Fragment key="ending">
                      <em>evolving</em> with AI.
                    </Fragment>,
                  ]
                : [
                    '永远的学生，',
                    <Fragment key="ending">
                      与 AI 一起<em>进化</em>。
                    </Fragment>,
                  ]
            }
            introduction={
              <p>
                <span className="name">Kai Li</span>
                {en
                  ? '· Seven years as a backend and full-stack engineer. Java, Node.js, Python, React; payments, finance, distributed systems. I can build a product from the ground up, on my own.'
                  : voice.introduction}
              </p>
            }
          >
            <K2NowPanel
              title={en ? 'Now' : '此刻'}
              updated="2026-10-09"
              rows={rows}
              emptyMessage={emptyMessage}
            />
          </K2Hero>
        </Example>

        <Example
          id="sections"
          title={
            en
              ? 'Section headings: link present / absent'
              : '板块标题：有链接 / 无链接'
          }
        >
          <K2SectionTitle
            allLink={{
              label: en ? 'All posts →' : '全部文章 →',
              href: '#articles',
            }}
          >
            {en ? 'Recent writing' : '最近写的'}
          </K2SectionTitle>
          <K2SectionTitle>
            {en ? 'Made things (three or fewer)' : '做过的小东西（不超过三项）'}
          </K2SectionTitle>
        </Example>

        <Example
          id="writing"
          title={
            en
              ? 'Featured article: desktop and mobile typography'
              : '首页首篇：桌面与手机排版'
          }
        >
          <K2FeatureArticle {...post} minutes={9} language={language} />
        </Example>
        <Example
          id="cover"
          title={
            en
              ? 'Text cover: category initial / empty category'
              : '文字封面：分类首字 / 空分类'
          }
        >
          <div className="catalogue-covers">
            <K2TextCover category={post.category} />
            <K2TextCover category="" />
          </div>
        </Example>
        <Example
          id="pill"
          title={
            en
              ? 'Pills: ongoing / completed / linked current tag'
              : '胶囊：进行中 / 完成 / 当前标签链接'
          }
        >
          <div className="catalogue-row">
            <K2Pill active>{en ? 'Reading' : '在读'}</K2Pill>
            <K2Pill>{en ? 'Completed' : '读完'}</K2Pill>
            <K2Pill active href="#prose">
              TypeScript
            </K2Pill>
          </div>
        </Example>
        <Example
          id="articles"
          title={
            en
              ? 'Article list: default / absent optional summary / empty list'
              : '文章列表：默认 / 无可选摘要 / 空列表'
          }
        >
          <K2ArticleItem {...post} />
          <K2ArticleItem
            {...post}
            title={en ? 'An article without a summary' : '无摘要文章'}
            summary={undefined}
          />
          <p className="catalogue-empty">{emptyMessage}</p>
        </Example>
        <Example id="now" title={en ? 'Now: empty rows' : '此刻：空内容'}>
          <K2NowPanel
            title={en ? 'Now' : '此刻'}
            updated="2026-10-09"
            rows={[]}
            emptyMessage={emptyMessage}
          />
        </Example>
        <Example
          id="projects"
          title={
            en
              ? 'Projects: home / detail / absent optional introduction'
              : '项目：首页 / 详情 / 无可选介绍'
          }
        >
          <ul className="catalogue-list">
            <K2ProjectItem {...project} mode="home" />
            <K2ProjectItem {...project} mode="detail" />
            <K2ProjectItem
              {...project}
              mode="detail"
              name="Vocab Master"
              introduction={undefined}
              repository={undefined}
              status={en ? 'Archived' : '已停更'}
              active={false}
            />
          </ul>
          <p className="catalogue-empty">
            {en
              ? 'Empty project list: no projects yet.'
              : '空项目列表：暂无项目。'}
          </p>
        </Example>
        <Example
          id="books"
          title={
            en
              ? 'Books: home / reading / completed / no note'
              : '书架：首页 / 在读 / 读完 / 无备注'
          }
        >
          <ul className="catalogue-list">
            <K2BookItem {...book} mode="home" />
          </ul>
          <K2BookGroup
            title={en ? 'Reading' : '在读'}
            count={1}
            reading
            language={language}
          >
            <K2BookItem {...book} mode="detail" language={language} />
          </K2BookGroup>
          <K2BookGroup title="2026" count={2} language={language}>
            <K2BookItem
              mode="detail"
              language={language}
              title="Designing Data-Intensive Applications"
              author="Martin Kleppmann"
              status={en ? 'Completed' : '读完'}
              finished="2026-08"
              note={
                en
                  ? 'Chapters five and seven are worth rereading every year.'
                  : voice.finishedBookNote
              }
              article={{ title: post.title, href: '#prose' }}
            />
            <K2BookItem
              mode="detail"
              title="The Pragmatic Programmer"
              author="David Thomas, Andrew Hunt"
              status={en ? 'Completed' : '读完'}
              finished="2026-02"
            />
          </K2BookGroup>
          <p className="catalogue-empty">
            {en ? 'Empty bookshelf: no books yet.' : '空书架：暂无书籍。'}
          </p>
        </Example>
        <Example
          id="quote"
          title={
            en
              ? 'Quotation: English italic / dark inset border'
              : '摘抄：中文不斜体 / 深色内描边'
          }
        >
          <K2Quote
            source={
              en
                ? 'Harold Abelson, Structure and Interpretation of Computer Programs'
                : 'Harold Abelson，《计算机程序的构造和解释》序言（意译）'
            }
          >
            <span>
              {en
                ? 'Programs must be written for people to read, and only incidentally for machines to execute.'
                : voice.quote}
            </span>
          </K2Quote>
        </Example>
        <Example
          id="page-heading"
          title={
            en
              ? 'Subpage heading: optional voice introduction / omitted'
              : '子页面页头：可选介绍 / 不渲染介绍'
          }
        >
          <K2PageHeading
            title={en ? 'Made things' : '做过的东西'}
            introduction={
              <span>
                {en
                  ? 'Small tools for myself and my family. They are online, and the code is open.'
                  : voice.pageIntroduction}
              </span>
            }
          />
          <K2PageHeading title={en ? 'Bookshelf' : '书架'} />
        </Example>
        <Example
          id="prose"
          title={
            en
              ? 'Long-form typography / contents / tags / pagination'
              : '长文排版 / 目录 / 标签 / 翻页'
          }
        >
          <K2ArticleLayout>
            <K2ArticleHeading
              title={post.title}
              summary={post.summary}
              category={{ label: post.category, href: '#articles' }}
              date={post.date}
              minutes={9}
              backHref="#articles"
              language={language}
            />
            <K2TableOfContents
              language={language}
              items={tocItems}
              currentId="prose-start"
            />
            <K2Prose>
              <h2 id="prose-start">{tocItems[0]?.title}</h2>
              <p>
                {en
                  ? 'A paragraph uses the body serif. '
                  : '段落使用正文宋体。'}
                <strong>
                  {en
                    ? 'Emphasis is weight 600, not a different colour.'
                    : '加粗为 600 字重，不变色。'}
                </strong>
                {en ? ' This ' : '这个'}
                <a href="#prose-details">{en ? 'inline link' : '正文链接'}</a>
                {en
                  ? ' is underlined, and supports hover and keyboard focus.'
                  : '有下划线，并支持悬停和键盘焦点。'}
              </p>
              <blockquote>
                <p>
                  {en
                    ? 'Someone else’s words use the body serif, not the personal voice font.'
                    : '别人的话使用正文宋体，不用「我说的话」的文楷。'}
                </p>
              </blockquote>
              <ul>
                <li>{en ? 'Keep ownership explicit.' : '把所有权写清楚。'}</li>
                <li>{en ? 'Keep changes local.' : '让变化停在局部。'}</li>
              </ul>
              <ol>
                <li>{en ? 'Identify the boundary.' : '先找出边界。'}</li>
                <li>{en ? 'Observe the result.' : '再观察结果。'}</li>
              </ol>
              <h3 id="prose-details">{tocItems[1]?.title}</h3>
              <p>
                {en ? 'Inline code: ' : '行内代码：'}
                <code>saveDraft(article)</code>
                {en ? '.' : '。'}
              </p>
              <pre data-lang="TypeScript">
                <code>
                  <span className="k">const</span> title ={' '}
                  <span className="s">'Write for people'</span>;<br />
                  <span className="c">
                    //{' '}
                    {en
                      ? 'Only this block scrolls horizontally.'
                      : '只有代码块内部横向滚动。'}
                  </span>
                  <br />
                  {`const boundary = '${'consumer-visible-'.repeat(12)}';`}
                </code>
              </pre>
              <div className="k2-table">
                <table>
                  <thead>
                    <tr>
                      <th>{en ? 'Rule' : '规则'}</th>
                      <th>
                        {en
                          ? 'Meaning — this wide header stays on a single line'
                          : '含义：该宽列表头保持单行，用于验证表格内部滚动'}
                      </th>
                      <th>{en ? 'Count' : '数量'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{en ? 'A very wide column' : '宽列'}</td>
                      <td>
                        <code>{'explicit-boundary-'.repeat(9)}</code>
                      </td>
                      <td className="num">12345</td>
                    </tr>
                    <tr>
                      <td>{en ? 'Local scrolling' : '局部滚动'}</td>
                      <td>
                        {en
                          ? 'The page itself must not overflow.'
                          : '页面本身不得横向溢出。'}
                      </td>
                      <td className="num">2</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <figure>
                <img src={sayRightImage} alt={project.image.alt} />
                <figcaption>
                  {en
                    ? 'A real product screenshot used as a design fixture.'
                    : '用于设计夹具的真实产品截图。'}
                </figcaption>
              </figure>
              <hr />
              <p>
                {en
                  ? 'An article without second-level headings has no contents block.'
                  : '没有二级标题的文章不显示目录。'}
              </p>
            </K2Prose>
          </K2ArticleLayout>
          <K2TableOfContents language={language} items={[]} />
          <K2ArticleEnd
            language={language}
            tags={[{ label: 'TypeScript', href: '#articles' }]}
            previous={{
              title: en ? 'Earlier article' : '更早的一篇',
              href: '#articles',
            }}
            next={{
              title: en ? 'Later article' : '更晚的一篇',
              href: '#writing',
            }}
          />
          <p className="catalogue-label">
            {en
              ? 'Previous absent; next stays right on desktop'
              : '缺上一篇；桌面下一篇仍在右侧'}
          </p>
          <K2ArticleEnd
            language={language}
            tags={[]}
            next={{
              title: en ? 'Later article' : '更晚的一篇',
              href: '#writing',
            }}
          />
          <p className="catalogue-label">
            {en
              ? 'Next absent; previous stays left'
              : '缺下一篇；上一篇仍在左侧'}
          </p>
          <K2ArticleEnd
            language={language}
            tags={[]}
            previous={{
              title: en ? 'Earlier article' : '更早的一篇',
              href: '#articles',
            }}
          />
        </Example>
        <Example
          id="input"
          title={
            en
              ? 'K2-styled shadcn basics: usable button / input / empty / disabled'
              : 'K2 样式的 shadcn 基础组件：可操作按钮 / 输入框 / 空值 / 禁用'
          }
        >
          <div className="catalogue-row">
            <Button
              type="button"
              aria-pressed={pressed}
              onClick={() => setPressed(!pressed)}
            >
              {en ? 'Toggle current state' : '切换当前状态'}
            </Button>
            <Button type="button" disabled>
              {en ? 'Disabled' : '禁用'}
            </Button>
            <span role="status">
              {pressed
                ? en
                  ? 'Current: selected'
                  : '当前：已选中'
                : en
                  ? 'Current: not selected'
                  : '当前：未选中'}
            </span>
          </div>
          <label className="catalogue-field" htmlFor="design-input">
            {en ? 'Example input' : '示例输入框'}
            <Input id="design-input" defaultValue="K2" />
          </label>
          <label className="catalogue-field" htmlFor="design-input-empty">
            {en ? 'Empty input' : '空输入框'}
            <Input id="design-input-empty" />
          </label>
        </Example>
      </main>
      <K2Footer links={links} />
    </div>
  )
}
