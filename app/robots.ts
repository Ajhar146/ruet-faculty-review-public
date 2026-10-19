import type { MetadataRoute } from 'next'
import { CRAWLABLE_ASSETS, INDEXABLE_PATHS } from '@/lib/public-routes'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        ...INDEXABLE_PATHS.map((path) => (path === '/' ? '/$' : path)),
        ...CRAWLABLE_ASSETS,
        '/sitemap.xml',
      ],
      disallow: '/',
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}