import { headers } from 'next/headers'
import { DEVTO_URL, GITHUB_URL, siteUrl } from '@/lib/site'

/**
 * WebSite and Organization JSON-LD, for the home page only.
 *
 * ONE WebSite NODE AND ONE Organization NODE, and it has to stay that way.
 * Google allows a single site name per site; a second node of either type can
 * cancel both, so this array is the whole graph and nothing else on the site
 * emits JSON-LD.
 *
 * WHY IT EXISTS. A Google result for this site read
 *
 *     Vercel
 *     https://ruet-faculty-review.vercel.app
 *     RUET Faculty Review
 *
 * because Google took the site name from the hosting domain. og:site_name is
 * already set and Google ignores it; WebSite structured data is the
 * documented signal for a site name, and this site had none.
 *
 * ------------------------------------------------------------------
 * TWO THINGS THAT WOULD OTHERWISE BREAK THIS SILENTLY
 * ------------------------------------------------------------------
 *
 * 1. THE NONCE. script-src is 'self' plus a per-request nonce, so a <script>
 *    without one is BLOCKED — and blocked silently, leaving a console error
 *    and nothing else. The tag would be absent from the DOM Google reads
 *    while the page looked perfectly fine. The nonce is read back out of the
 *    request's own CSP header, which proxy.ts set, so it is the same value
 *    the policy will accept.
 *
 * 2. dangerouslySetInnerHTML. Strict hygiene applies here: React has
 *    no other way to emit a raw JSON-LD body, and what goes in is
 *    JSON.stringify of the constants below — a site name and two URLs built
 *    from lib/site.ts. No user input, no review text, nothing from the
 *    database reaches this.
 *
 * URLS COME FROM lib/site.ts so they cannot be localhost in a production
 * build, which is the mistake the sitemap nearly shipped with.
 */

const NAME = 'RUET Faculty Review'

export async function StructuredData() {
  const base = siteUrl()

  // proxy.ts puts the policy on the REQUEST headers as well as the response,
  // which is how Next stamps its own scripts. Same source, same nonce.
  const csp = (await headers()).get('content-security-policy')
  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1]

  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: NAME,
      url: `${base}/`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: NAME,
      url: `${base}/`,
      // THE SAME ENTITY, IN THREE PLACES. sameAs is how Google is told that
      // the site, the public repository and the write-up are one project
      // rather than three pages that happen to share a name.
      sameAs: [GITHUB_URL, DEVTO_URL],
      // THERE IS DELIBERATELY NO logo HERE. It used to point at
      // /ruet-logo.svg, which is RUET's crest and belongs to the university.
      // Telling Google that this organization's logo is RUET's mark invites
      // it to merge the two entities — the exact opposite of what the
      // footer's "Not affiliated with, or endorsed by, RUET" says. A missing
      // logo costs a knowledge-panel image; a merged entity costs the
      // disclaimer its meaning.
    },
  ]

  return (
    <>
      {graph.map((item) => (
        <script
          key={item['@type']}
          type="application/ld+json"
          nonce={nonce}
          // THE ONE PLACE THIS IS ALLOWED. See note above: JSON.stringify
          // of the constants in this file, never a prop, a database value
          // or anything a person typed.
          //
          // No eslint-disable here on purpose — react/no-danger is not
          // enabled in this project, so a directive for it is dead weight
          // that lint reports as unused.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  )
}
