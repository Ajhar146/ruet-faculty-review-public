import type { MetadataRoute } from 'next'
import { INDEXABLE_PATHS } from '@/lib/public-routes'
import { siteUrl } from '@/lib/site'

/**
 * The five public pages, and nothing else.
 *
 * BUILT FROM THE SAME LIST robots.ts reads, which is the point. A sitemap that
 * names a URL robots.txt disallows is a crawler being invited to a page it was
 * told to stay away from, and the only route where that would matter is the
 * one that must never be listed: a teacher page.
 *
 * There is deliberately no entry per teacher, per department or per course.
 * This file is five lines long and should stay five lines long.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()

  return INDEXABLE_PATHS.map((path) => ({
    url: path === '/' ? `${base}/` : `${base}${path}`,
    // The sign-in page and four pages of static text. Nothing here changes
    // often enough to be worth a lastModified that would have to be kept true.
    changeFrequency: 'monthly' as const,
    priority: path === '/' ? 1 : 0.5,
  }))
}
