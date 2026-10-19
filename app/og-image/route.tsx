import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'

/**
 * The image in a shared link's preview card. Nothing else uses it.
 *
 * WHY A ROUTE AND NOT app/opengraph-image.tsx. That file convention is
 * INHERITED by every route beneath the segment it sits in, so one at the app
 * root would attach an image to every teacher page as well. Opt-in is the only
 * safe shape here: lib/metadata.ts points the five public pages at this URL
 * and nothing else does.
 *
 * NO NEW DEPENDENCY. next/og ships with Next.
 *
 * THE LOGO IS A PNG, not the SVG the header uses. public/ruet-logo.svg is a
 * 507 KB Inkscape drawing with sub-pixel detail; Satori, which renders this,
 * would have to parse it on every miss. scripts/optimise-photos.ts already
 * depends on sharp, so it was rasterised once to public/og-logo.png (381x440,
 * 85 KB) and is read from disk here — not fetched over HTTP, which would mean
 * this route calling its own deployment.
 *
 * It is fetched by Facebook's and Twitter's crawlers, which obey robots.txt,
 * so /og-image is in CRAWLABLE_ASSETS and allowed there. Allowed to be
 * FETCHED is not the same as allowed to be INDEXED: it is not in the sitemap
 * and it still carries X-Robots-Tag: noindex.
 */

// Facebook and Twitter both crop from this.
const WIDTH = 1200
const HEIGHT = 630

// The site's own tokens, read off @theme in globals.css. Not re-picked here.
const PAPER = '#ffffff'
const INK = '#16243d'
const LINE = '#e4e7ec'

// A day. The card never changes between deploys, and this keeps Satori off the
// critical path for every share.
export const revalidate = 86400

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), 'public', 'og-logo.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          // Site background, and the accent rule the header has, nothing else.
          backgroundColor: PAPER,
          borderBottom: `12px solid ${LINE}`,
          gap: 48,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders
            this to a bitmap on the server; next/image has no part in it. */}
        <img src={logoSrc} alt="" width={190} height={220} />

        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            color: INK,
            letterSpacing: -1,
          }}
        >
          RUET Faculty Review
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  )
}
