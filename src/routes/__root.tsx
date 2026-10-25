import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'
import fontsCss from '../styles/fonts.css?url'
import { paletteBootstrap } from '#/lib/palette-store'
import { themeBootstrap } from '#/lib/theme-store'
import { PublicNotFound } from '#/components/public-site'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'kaili.dev',
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: PublicNotFound,
})

// Runs only after the main stylesheet has loaded (an inline script after a
// stylesheet waits for it), so the ~300 KB @font-face list never competes
// with first-paint resources. media="print" keeps it off the render path
// until loaded; every face is font-display: swap (T3.5, D-152).
const fontsActivation = (href: string) =>
  `(()=>{const l=document.createElement('link');l.id='k2-fonts';l.rel='stylesheet';l.href=${JSON.stringify(href)};l.media='print';l.addEventListener('load',()=>{l.media='all'},{once:true});document.head.appendChild(l)})()`

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const language =
    pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh-CN'
  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: import.meta.env.DEV
              ? `${themeBootstrap};${paletteBootstrap}`
              : themeBootstrap,
          }}
        />
        <link rel="stylesheet" href={appCss} />
        <script
          dangerouslySetInnerHTML={{ __html: fontsActivation(fontsCss) }}
        />
        <noscript>
          <link rel="stylesheet" href={fontsCss} />
        </noscript>
        <HeadContent />
      </head>
      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
