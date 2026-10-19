/**
 * The site's own absolute URL.
 *
 * robots.txt, the sitemap and every Open Graph tag need an absolute URL, and
 * a relative one in an og:image is simply ignored by Facebook.
 *
 * NEXT_PUBLIC_SITE_URL IS BAKED IN AT BUILD TIME. It has to be set in Vercel
 * BEFORE the first build or every one of those URLs points at localhost. The
 * fallback below is for local work only.
 */
/**
 * Where else this project exists, for the Organization node's sameAs.
 *
 * sameAs is how Google is told that a set of URLs are the SAME entity. These
 * two are what connect the site, the public repository and the write-up into
 * one thing rather than three unrelated pages that happen to share a name.
 *
 * PLAIN CONSTANTS, AND THEY HAVE TO STAY THAT WAY. components/seo/
 * StructuredData.tsx relies on static constants in that file and this one
 * for structured schema JSON. A value from the database, a prop or
 * anything a person typed is not allowed there.
 */
export const GITHUB_URL = 'https://github.com/Ajhar146/ruet-faculty-review-about'

export const DEVTO_URL =
  'https://dev.to/ajhar146/i-built-an-anonymous-teacher-review-site-for-my-university-the-code-was-the-easy-part-3p51'

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  // Trailing slashes are stripped so `${siteUrl()}/terms` never doubles up.
  if (configured) return configured.replace(/\/+$/, '')

  // Vercel sets this on every deployment, so a preview still gets its own
  // absolute URLs rather than localhost ones.
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}
