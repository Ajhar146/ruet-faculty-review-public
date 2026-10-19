/**
 * WHICH URLS A SEARCH ENGINE MAY HAVE. One list, read by four files.
 *
 * app/robots.ts, app/sitemap.ts, next.config.ts (the X-Robots-Tag header) and
 * the Open Graph metadata all derive from this. They used to be able to drift;
 * the whole point of putting it here is that allowing a route in one place and
 * forgetting another cannot quietly expose it.
 *
 * ------------------------------------------------------------------
 * THE RULE THIS ENFORCES, AND WHY IT IS AN ALLOW LIST
 * ------------------------------------------------------------------
 *
 * A TEACHER MUST NEVER FIND THEIR OWN RATINGS BY SEARCHING THEIR NAME.
 *
 * That is the whole reason this is an allow list and not a block list. A
 * block list is open by default: add a route next month, forget to list it,
 * and it is indexable. An allow list is closed by default — a new route is
 * blocked until someone deliberately adds it here, and adding a teacher page
 * here would be an obvious thing to refuse in review.
 *
 * TWO LOCKS ON EVERYTHING ELSE. robots.txt is only a request and a badly
 * behaved crawler ignores it, so X-Robots-Tag: noindex goes on every response
 * that is not one of these five. One of the two is advisory; the other is not.
 */

/** The only URLs that may be crawled, indexed, or carry Open Graph tags. */
export const INDEXABLE_PATHS = [
  '/',
  '/guidelines',
  '/privacy',
  '/terms',
  '/contact',
] as const

export type IndexablePath = (typeof INDEXABLE_PATHS)[number]

/**
 * Assets a crawler must be allowed to FETCH even though they are not pages.
 *
 * NOT THE SAME THING AS INDEXABLE. These are never in the sitemap, which
 * lists pages, and they still carry X-Robots-Tag: noindex. A crawler is
 * allowed to fetch them; it is not invited to index them.
 *
 * The Open Graph image is here because Facebook's and Twitter's crawlers obey
 * robots.txt when they fetch a share image. Disallow it and a shared link
 * renders with no picture, which is the thing Open Graph was added for.
 *
 * The two icons are here for the same reason: Google cannot show a site's
 * icon beside a search result if its crawler is refused the file, and
 * Disallow: / refuses it.
 *
 * NO $ ANCHOR ON THESE, and that is deliberate — the opposite decision from
 * the root in the allow list, which must be anchored. Next serves the icons
 * with a cache-busting QUERY STRING:
 *
 *     /favicon.ico?favicon.2vob68tjqpejf.ico
 *     /icon.svg?icon.1c4c2ytt7gvcc.svg
 *
 * robots.txt matching compares the path AND the query string, so an anchored
 * `/favicon.ico$` would not match the URL the browser actually requests.
 * Unanchored, the entry is a prefix and matches both the bare path and the
 * hashed one. It is safe as a prefix here in a way `/` was not: no other
 * route begins with these strings, which the test asserts.
 */
export const CRAWLABLE_ASSETS = [
  '/og-image',
  '/favicon.ico',
  '/icon.svg',
  // The Organization logo in the home page's JSON-LD. Google cannot use a
  // logo its crawler is refused, and Disallow: / refuses it.
  '/ruet-logo.svg',
] as const

/**
 * Everything that must stay out, named explicitly.
 *
 * Not used to BUILD the block — `disallow: '/'` does that, and the allow
 * entries above carve out the exceptions. This list exists so robots.txt says
 * out loud which routes matter, and so a test can assert none of them ever
 * becomes indexable.
 */
export const MUST_STAY_BLOCKED = [
  '/teachers',
  '/departments',
  '/my-reviews',
  '/admin',
  '/api',
  '/login',
  '/review',
  '/styleguide',
  '/maintenance',
] as const

/** Exactly one of the five. A child path is never indexable. */
export function isIndexable(pathname: string): boolean {
  // Strip a query string and any trailing slash, so /terms, /terms/ and
  // /terms?x=1 are all the same page. The root is left as '/'.
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'

  return (INDEXABLE_PATHS as readonly string[]).includes(path)
}

/**
 * URLs that must NOT receive the X-Robots-Tag: noindex header.
 *
 * The five public pages are indexable.
 *
 * `/sitemap.xml` is NOT an indexable page and must NOT be added to
 * INDEXABLE_PATHS. However, Google must be able to fetch the sitemap.
 * Therefore it is an exception only for the X-Robots-Tag rule.
 *
 * This keeps the distinction clear:
 *
 *   INDEXABLE_PATHS  -> pages that Google may index
 *   NOINDEX_EXCEPTIONS -> responses that must not receive X-Robots-Tag: noindex
 */
const NOINDEX_EXCEPTIONS = [
  ...INDEXABLE_PATHS,
  '/sitemap.xml',
] as const

/**
 * The regex source for the X-Robots-Tag header in next.config.ts: every path
 * EXCEPT the five public pages and the sitemap, built from the lists above
 * rather than typed out beside it.
 *
 * Fail-closed by construction. The lookahead names only the allowed
 * exceptions, so anything not named gets the header — including a route that
 * does not exist yet.
 */
export function noindexSourcePattern(): string {
  // '/' becomes the EMPTY alternative: for the root, the part after the
  // leading slash is an empty string.
  const alternatives = NOINDEX_EXCEPTIONS.map((path) =>
    // Trailing slash tolerated, so /terms/ is excluded along with /terms.
    path === '/' ? '' : `${path.slice(1)}/?`
  ).join('|')

  // THE NON-CAPTURING GROUP AROUND THE ALTERNATIVES IS LOAD-BEARING.
  //
  // `(?!a|b$)` means `(?!a)` OR `(?!b$)`, because | binds looser than $. The
  // first alternative here is the empty string for the root, and an empty
  // alternative with no anchor matches at every position — so without the
  // group the lookahead would always fail and this header would be applied to
  // NOTHING. That is fail-open on the one rule that matters most, and it is
  // why tests/public-routes.test.ts compiles this pattern and checks it
  // against real paths rather than trusting it to read correctly.
  return `/:path((?!(?:${alternatives})$).*)`
}