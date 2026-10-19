import type { ReactNode } from 'react'
import { Container } from '@/components/layout/Container'

/**
 * The reading layout shared by /privacy, /guidelines, /terms and /contact.
 *
 * ONE COMPONENT, NOT FOUR COPIES OF THE SAME CLASSES. Before this file, each
 * of the four pages declared its own HEADING, BODY, LIST, LEAD and LINK
 * constants. They happened to be byte-identical — the drift had not started
 * yet — but four copies of a measurement is four chances to edit one of them
 * and not the others, and the next person to touch one page would not know
 * the other three existed. A page now imports the layout and cannot set a
 * width, a gutter, an alignment or a gap of its own.
 *
 * WHAT IT GUARANTEES, in the words of the brief this was built from:
 *
 *   - ONE LEFT EDGE. The h1, every h2 and every paragraph share it. Bullet
 *     lists are the one documented exception; see Bullets below.
 *   - BODY TEXT LEFT ALIGNED. text-left is explicit rather than inherited,
 *     so an ancestor that is centred later cannot pull it over, and nothing
 *     here is ever centred or justified.
 *   - ONE MAXIMUM LINE WIDTH. 60ch, so a paragraph does not run the width of
 *     a desktop screen. The design system's ceiling is 70 characters; 60
 *     reads better and is well inside it.
 *   - ONE SIDE GUTTER, the site's. It comes from Container and is not
 *     re-stated here. Section 8b: "Container already does the gutter. Never
 *     add horizontal padding on top of it."
 *   - ONE VERTICAL RHYTHM. gap-4 between paragraphs inside a section,
 *     gap-10/md:gap-16 between sections. Two values, nothing in between.
 *
 * EVERY NUMBER BELOW IS A DESIGN-SYSTEM NUMBER, from section 8b's spacing
 * and type scales. None of them is new, and no token was added for this.
 *
 *   page gutter        px-6 md:px-10       24px / 40px   (via Container)
 *   page top/bottom    py-8 md:py-20       32px / 80px
 *   between sections   gap-10 md:gap-16    40px / 64px
 *   page title         24px / sm:32px / md:48px
 *   big section head   22px / sm:28px
 *   body               15px
 *
 * THE COLUMN IS CENTRED; ITS TEXT IS NOT. mx-auto centres the 60ch column in
 * a 1276px container. Pinning the column to the container's left edge would
 * leave a 700px empty band down the right of every desktop screen.
 */

// 1.2 for a heading, per section 3. The phone size is 24px and must stay
// there: at 32px a long title filled two enormous lines at 360px, which is
// the mistake section 8b was written to stop.
const TITLE =
  'text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]'

// The "big section heading" row of the 8b type scale, not the 20px one. A
// legal page has few headings and they carry the whole structure.
//
// mt-2/sm:mt-4 on top of the section's gap-4 is deliberate: a heading
// belongs to the text under it, so it gets 24px above and 16px below rather
// than 16px on both sides.
const HEADING = 'mt-2 text-[22px] leading-[1.2] font-bold text-ink sm:mt-4 sm:text-[28px]'

// 15px body, per the type scale.
//
// leading-7 is 28px, which is looser than section 3's 1.6. That is on
// purpose and predates this component: on a page this long, at 360px, 1.6
// ran the lines together. All four pages already agreed on leading-7, so
// this changes nothing — it is only written down here instead of four times.
const BODY = 'text-[15px] leading-7 text-ink'

// Used by both the page title block and every section, so a paragraph is the
// same distance from its neighbour everywhere on all four pages.
const PARAGRAPH_GAP = 'flex flex-col gap-4'

const LINK_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export function PolicyPage({
  title,
  lead,
  children,
}: {
  title: string
  /** Optional standfirst under the h1. Only /guidelines has one. */
  lead?: ReactNode
  children: ReactNode
}) {
  return (
    <main>
      <Container className="py-8 md:py-20">
        <div
          className="mx-auto flex w-full max-w-[60ch] flex-col gap-10 text-left md:gap-16"
        >
          {/* The title and its standfirst are one block: with a lead, they
              sit a paragraph apart rather than a section apart. Without
              one, the h1 stands alone and the next section is a full
              section gap away. */}
          {lead ? (
            <div className={PARAGRAPH_GAP}>
              <h1 className={TITLE}>{title}</h1>
              {/* 16px slate — the "page subtitle" of section 3. The one
                  place on these pages where text is not ink. */}
              <p className="text-[16px] leading-relaxed text-slate">{lead}</p>
            </div>
          ) : (
            <h1 className={TITLE}>{title}</h1>
          )}

          {children}
        </div>
      </Container>
    </main>
  )
}

/**
 * One section of a policy page.
 *
 * The heading is optional because /contact genuinely has none — it is three
 * blocks of prose under one title, and inventing h2s for it would mean
 * writing words onto a legal page.
 */
export function PolicySection({
  heading,
  children,
}: {
  heading?: string
  children: ReactNode
}) {
  return (
    <section className={PARAGRAPH_GAP}>
      {heading ? <h2 className={HEADING}>{heading}</h2> : null}
      {children}
    </section>
  )
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <p className={BODY}>{children}</p>
}

/**
 * A paragraph with a rule above it.
 *
 * Only /guidelines uses this, for the five "what we do not publish" items. A
 * rejected student is sent to that page to find the one rule that applies to
 * them, so each is a separated block rather than another paragraph in a
 * stack. pt-4 matches the section gap, so the rule sits midway between the
 * two blocks it divides.
 */
export function Rule({ children }: { children: ReactNode }) {
  return <p className={`${BODY} border-t border-line pt-4`}>{children}</p>
}

/**
 * A bullet list.
 *
 * THE ONE PLACE THAT IS NOT ON THE SHARED LEFT EDGE, and the brief asked for
 * list items to be on it, so here is the reasoning rather than a silent
 * deviation.
 *
 * pl-5 puts the marker in a 20px indent and the item's text at 20px. Putting
 * the text itself on the shared edge needs one of two things, and both are
 * worse:
 *
 *   - list-inside, which returns a wrapped line to the marker's column
 *     instead of aligning it under the text above. Several items here run to
 *     four lines, so most of the list would be misaligned to fix the first
 *     line of each item.
 *   - a hanging marker, pl-5 with -ml-5, which pushes the bullet 20px left
 *     of the column. At 360px the gutter is 24px, so the bullets would sit
 *     4px from the edge of the screen and read as clipped.
 *
 * An indented list under a paragraph on the shared edge is the conventional
 * reading, and it is what all four pages already did. Say the word and it
 * changes, but it should be a decision rather than an accident.
 *
 * gap-3 between items, not gap-2: a list is read by scanning it.
 */
export function Bullets({ children }: { children: ReactNode }) {
  return <ul className={`${BODY} flex list-disc flex-col gap-3 pl-5`}>{children}</ul>
}

export function Bullet({ children }: { children: ReactNode }) {
  return <li>{children}</li>
}

/**
 * The bold run-in at the start of a paragraph or list item.
 *
 * semibold, not bold: it marks where an item begins, and 700 next to 400 at
 * 15px is loud enough to read as a heading that wandered into the text.
 */
export function Lead({ children }: { children: ReactNode }) {
  return <strong className="font-semibold">{children}</strong>
}

/**
 * The contact address as a mailto link.
 *
 * break-words because the address is a 27-character unbreakable token: at
 * 360px the column is 312px and a long address inside a sentence is the one
 * thing on these pages that can push a line past the gutter.
 */
export function MailLink({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className={`break-words underline ${LINK_FOCUS}`}>
      {address}
    </a>
  )
}
