import { createServerFn } from '@tanstack/react-start'
import { requireLanguage } from '#/features/routing'
import type { SiteContent } from '#/features/site-content'
import siteContent from '#/server/data/site-content.json'

export const loadSiteContent = createServerFn({ method: 'GET' })
  .validator(requireLanguage)
  .handler(({ data }): SiteContent => siteContent[data])
