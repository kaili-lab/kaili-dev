import type { ReactNode } from 'react'

import { useRouterState } from '@tanstack/react-router'
import { K2Footer, K2Header, K2Link, K2PageHeading } from '#/components/k2'
import type { Language } from '#/features/routing'

function socialLinks(language: Language) {
  return [
    {
      label: language === 'zh' ? '邮件' : 'Email',
      href: 'mailto:hello@kaili.dev',
    },
    { label: 'GitHub', href: 'https://github.com/kaili-lab' },
    { label: 'X', href: 'https://x.com/kaili_dev' },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/kai-li-696024230/',
    },
  ]
}

export function PublicSocialLinks({ language }: { language: Language }) {
  return (
    <div className="site-social-links">
      {socialLinks(language).map((link) => (
        <a key={link.label} href={link.href}>
          {link.label}
        </a>
      ))}
    </div>
  )
}

export function PublicLayout({
  language,
  children,
  article,
  page,
  notFound = false,
}: {
  language: Language
  children: ReactNode
  article?: { slug: string; alternatePublished: boolean }
  page?: 'projects' | 'bookshelf'
  notFound?: boolean
}) {
  const location = useRouterState({
    select: (state) => state.location,
  })
  const currentPage = location.pathname
  const languageHref = (next: Language) => {
    if (notFound) return `/${next}`
    if (article) {
      return article.alternatePublished
        ? `/${next}/writing/${article.slug}`
        : `/${next}/writing`
    }
    if (currentPage.endsWith('/writing')) {
      return `/${next}/writing${location.searchStr}`
    }
    return `/${next}${page ? `/${page}` : ''}`
  }

  function chooseLanguage(next: Language) {
    document.cookie = `kaili-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    if (article && !article.alternatePublished) {
      sessionStorage.setItem('kaili-language-notice', next)
    }
  }

  return (
    <div className="public-site" lang={language === 'zh' ? 'zh-CN' : 'en'}>
      <K2Header
        language={language}
        homeHref={`/${language}`}
        navigation={[
          {
            label: language === 'zh' ? '写作' : 'Writing',
            href: `/${language}/writing`,
            current: currentPage.startsWith(`/${language}/writing`),
          },
          {
            label: language === 'zh' ? '书架' : 'Bookshelf',
            href: `/${language}/bookshelf`,
            current: page === 'bookshelf',
          },
        ]}
        languageLinks={{ zh: languageHref('zh'), en: languageHref('en') }}
        onLanguageChange={notFound ? undefined : chooseLanguage}
      />
      <main className="k2-wrap">{children}</main>
      <K2Footer links={socialLinks(language)} />
    </div>
  )
}

export function PublicPageHeading({
  title,
  introduction,
}: {
  title: string
  introduction?: string
}) {
  return <K2PageHeading title={title} introduction={introduction} />
}

export function PublicNotFound() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const language =
    pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh'
  return (
    <PublicLayout language={language} notFound>
      <PublicPageHeading
        title={language === 'zh' ? '404 · 页面不存在' : '404 · Page not found'}
      />
      <p className="site-not-found">
        {language === 'zh'
          ? '这个地址没有可公开访问的页面。'
          : 'There is no public page at this address.'}{' '}
        <K2Link href={`/${language}`}>
          {language === 'zh' ? '返回首页 →' : 'Back to home →'}
        </K2Link>
      </p>
    </PublicLayout>
  )
}
