import type { Metadata } from 'next'
import { isIndexable } from '@/lib/public-routes'
import { siteUrl } from '@/lib/site'

/**
 * Open Graph and Twitter tags, for the five public pages ONLY.
 *
 * WHY THIS MATTERS MORE THAN SEARCH HERE. Students share links on Facebook and
 * Messenger. Without these tags a shared link is a blank white box that nobody
 * taps; with them it is a card with a name, a line of description and an
 * image.
 *
 * ------------------------------------------------------------------
 * NEVER ON A TEACHER PAGE.
 * ------------------------------------------------------------------
 *
 * An og:title on /teachers/<slug> would put a teacher's name — and whatever
 * the description said — into the preview card of anyone who pasted the link
 * into a group chat. That is the opposite of what this site promises.
 *
 * TWO THINGS STOP THAT, not one:
 *
 *   1. This is opt-in. Metadata on a page does not inherit to other pages, and
 *      there is deliberately NO app/opengraph-image.tsx at the app root —
 *      that file convention WOULD be inherited by every route beneath it,
 *      including every teacher page. A file that is open by default is the
 *      wrong shape for this rule.
 *
 *   2. It throws if asked for a path that is not one of the five. A typo or a
 *      copy-paste onto a teacher page fails the build instead of shipping.
 */
export function openGraph({
  path,
  title,
  description,
}: {
  path: string
  title: string
  description: string
}): Metadata {
  if (!isIndexable(path)) {
    throw new Error(
      `openGraph() refused "${path}". Only the five public pages in ` +
        'lib/public-routes.ts may carry Open Graph tags. A teacher page must ' +
        'never have them: the card would show a teacher name to anyone who ' +
        'pasted the link.'
    )
  }

  const base = siteUrl()
  const url = path === '/' ? `${base}/` : `${base}${path}`

  // Absolute, because Facebook ignores a relative og:image. 1200x630 is the
  // size both Facebook and Twitter crop from.
  const image = {
    url: `${base}/og-image`,
    width: 1200,
    height: 630,
    alt: 'RUET Faculty Review',
  }

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'RUET Faculty Review',
      type: 'website',
      locale: 'en_GB',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}
