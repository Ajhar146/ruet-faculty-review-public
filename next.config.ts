import type { NextConfig } from "next";
// A relative import, not the @/ alias: next.config.ts is loaded outside the
// app's module graph and the tsconfig paths are not applied to it.
import { noindexSourcePattern } from "./lib/public-routes";

/**
 * The headers that are the same on every response.
 *
 * SET HERE, NOT IN proxy.ts, because next.config headers() applies to
 * EVERY route Next serves — pages, API routes, and the static assets under
 * /_next that the proxy matcher deliberately skips. The proxy only sees
 * what its matcher lets through, so a header set there would be missing
 * from exactly the responses an attacker would reach for.
 *
 * The one header that cannot live here is the CSP, because it carries a
 * per-request nonce. That is in proxy.ts.
 */
const SECURITY_HEADERS = [
  {
    // Two years, subdomains included. Vercel serves HTTPS only, so there is
    // nothing to lose and a downgrade attack to stop.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  {
    // Stops a browser guessing that an uploaded .txt is really a script.
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Same-origin navigations keep the full path; anything leaving the site
    // sends the origin only. A teacher's slug is not leaked to a link they
    // click.
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // No framing at all. frame-ancestors in the CSP says the same thing for
    // modern browsers; this is for the ones that do not read it.
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Everything the site does not use. It uses none of them.
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', '),
  },
]

/**
 * PER ROUTE, NOT BLANKET ANY MORE.
 *
 * Five pages are findable — /, /guidelines, /privacy, /terms and /contact —
 * and this header must be absent from exactly those and present on everything
 * else. See lib/public-routes.ts, which owns the list.
 *
 * robots.txt asks a crawler not to fetch; this tells one that fetched anyway
 * not to index or follow. /teachers and /teachers/* are the reason both exist:
 * a teacher must never find their own ratings by searching their name, and
 * robots.txt alone is only a request.
 *
 * THE SOURCE IS A NEGATIVE LOOKAHEAD, which is closed by default: it names
 * only the five exceptions, so a route added next month gets the header
 * without anyone remembering to add it. The pattern is generated rather than
 * typed out, and tests/public-routes.test.ts compiles it and checks it against
 * real paths — because the first version of it read correctly and matched
 * nothing at all.
 */
const NOINDEX_HEADER = [
  {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow',
  },
]

const nextConfig: NextConfig = {
  experimental: {
    // A page visited in the last 30 seconds is shown from the browser's
    // router cache instead of being rendered again. `static` is left at its
    // default.
    //
    // SAFE ONLY BECAUSE every write a user can see refreshes their view:
    // sign-in is a full page load, sign-out deletes a cookie in an action
    // (which clears this cache) and redirects, submit/edit/delete/resubmit/
    // appeal and every admin action call revalidatePath, and a vote is
    // remembered on the client in VoteButtons. A new action that changes
    // what its own user sees must do one of those too.
    staleTimes: { dynamic: 30 },
  },

  async headers() {
    return [
      // ':path*' matches every route, including /api and /_next. Every
      // security header except the noindex one applies to all of them.
      { source: '/:path*', headers: SECURITY_HEADERS },
      // Everything that is not one of the five public pages.
      { source: noindexSourcePattern(), headers: NOINDEX_HEADER },
    ]
  },

  images: {
    // 31 days. Vercel bills an image transformation for every cache MISS or
    // STALE, and Hobby includes 5,000 a month. At the 4-hour default each
    // cached variant goes stale six times a day: page 1 of /teachers alone
    // (24 photos, about two widths in real traffic) works out at roughly
    // 8,640 transformations a month. Past 5,000 Vercel answers 402 and the
    // browser shows the alt text instead of the photo. 31 days brings the
    // same traffic to about 1,800.
    //
    // THERE IS NO CACHE INVALIDATION. Next's own documentation says so. A
    // photo replaced at the SAME filename keeps serving the old bytes for up
    // to 31 days, with no way to flush it. So scripts/optimise-photos.ts
    // puts a content hash in every filename it writes: different bytes mean
    // a different name, a different cache key, and the new photo appears at
    // once. Never overwrite a photo in place while this is set.
    minimumCacheTTL: 2678400,

    // ------------------------------------------------------------------
    // THE WIDTH LISTS, TRIMMED TO WHAT TEACHER PHOTOS ACTUALLY NEED
    // ------------------------------------------------------------------
    //
    // Every optimised image on this site is one teacher photo in a circle.
    // The largest it ever renders is 128px (TeacherHeader, md:size-32); the
    // others are 64px or less. The defaults offered fifteen widths up to
    // 3840px, and a srcset is billed per width actually fetched.
    //
    // allSizes is deviceSizes + imageSizes sorted, and for a fixed-width
    // image next/image asks for [width, width * 2] snapped up into that list
    // (get-img-props.js getWidths). So:
    //
    //   width 64  -> 64 and 128
    //   width 128 -> 128 and 256
    //
    // Three distinct widths for the whole site. 256 is the largest and it is
    // exactly 2x the largest rendered width, which is the ceiling worth
    // having: enough for a 2x screen at 128px, and nothing above it that a
    // circle this size could ever use.
    //
    // DO NOT TRIM BELOW 256. A blurry photo is worse than the quota.
    //
    // ONE CAVEAT FOR LATER: these lists are now sized for fixed-width
    // photos. deviceSizes is what a `fill` image or a `vw`-based `sizes`
    // would draw from, so an image like that would have only 256px to pick
    // from and would look soft. Add the widths it needs at the same time.
    deviceSizes: [256],
    imageSizes: [64, 128],

    // Teacher photos live in the public Supabase Storage bucket
    // `teacher-photos`. next/image refuses a remote host unless it is
    // listed here. This is a public URL, not a secret.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '<project-ref>.supabase.co',
        pathname: '/storage/v1/object/public/teacher-photos/**',
      },
    ],
  },
};

export default nextConfig;
