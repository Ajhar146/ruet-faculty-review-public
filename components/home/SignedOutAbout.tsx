import Link from 'next/link'
import { Container } from '@/components/layout/Container'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

/**
 * What the site is, and the five questions people ask, for signed-out
 * visitors only.
 *
 * WHY IT EXISTS. Google only ever sees the signed-out home page — every other
 * page redirects to sign-in — and that page was under forty words. A site
 * with nothing to read can rank for its own name and nothing else.
 *
 * SIGNED OUT ONLY. A student who signs in every day does not need the site
 * explained to them; the caller decides, so nothing here reads a session.
 *
 * CONSTANT TEXT, NO DATABASE. Not one number here is read from a row. This
 * page currently needs no query at all and a count would add one.
 *
 * EVERY CLAIM BELOW WAS CHECKED AGAINST THE CODE, not against what the site
 * was assumed to do. Who may sign in comes from ALLOWED_STUDENT_DOMAINS and
 * ALLOWED_TEACHER_DOMAINS in the OAuth callback; what a teacher may not do
 * comes from requireStudent() in lib/auth.ts and the role check at the top of
 * canReview(). If either changes, this text is wrong and must change with it.
 */

type Step = { n: number; text: React.ReactNode }

const STEPS: Step[] = [
  {
    n: 1,
    // NOT "only students". Teachers sign in too — they simply cannot write.
    text: 'Sign in with your RUET email address. Students can read and write reviews; teachers can read the site but cannot write one.',
  },
  {
    n: 2,
    text: 'Choose a teacher whose course you took. The site checks this before it lets you write anything.',
  },
  {
    n: 3,
    text: 'Rate the teaching, and add a comment if you want to. Your name is never shown — every review appears as "Anonymous Student".',
  },
]

type Question = { q: string; a: React.ReactNode }

const QUESTIONS: Question[] = [
  {
    q: 'Can a teacher see who wrote a review?',
    a: 'No. Every review appears as "Anonymous Student" and a student’s identity is never put on the page. Teacher pages are also blocked from search engines, so a teacher cannot find their ratings by searching their own name.',
  },
  {
    q: 'Who can sign in?',
    a: 'Anyone with a RUET email address. Students sign in with @student.ruet.ac.bd and can read and write reviews. Teachers sign in with @ruet.ac.bd and can read the site, but cannot write a review or report one.',
  },
  {
    q: 'Can I review any teacher?',
    a: 'Only teachers whose course you took.',
  },
  {
    q: 'What is not allowed?',
    a: (
      <>
        Personal attacks, accusations, and anything about a teacher&rsquo;s
        private life.{' '}
        {/* The only link in either card. */}
        <Link
          href="/guidelines"
          // Ink, not gold. The underline is what marks it as a link, so the
          // hover takes it away rather than introducing a second colour.
          className={`text-ink underline underline-offset-2 hover:no-underline ${FOCUS_RING}`}
        >
          Honest criticism of teaching
        </Link>{' '}
        is welcome — that is what the site is for.
      </>
    ),
  },
  {
    q: 'Is this run by RUET?',
    a: 'No. It is an independent student project, and it is not affiliated with, endorsed by or reviewed by the university.',
  },
]

// The sign-in card is max-w-[400px]. These are wider so the page opens out
// below it, and still centred so the whole column shares one axis. Two cards
// across 900px is about 430px each, which keeps a line of 15px text to
// roughly sixty characters — a comfortable measure to read.
const MEASURE = 'mx-auto w-full max-w-[900px]'

// ONE CONSTANT FOR BOTH CARDS, so their padding and rhythm cannot drift.
//
// text-left is explicit rather than inherited. The sign-in card above is
// centred because it holds one short line and a button; paragraphs are not
// read that way, and a card that picks up a centred ancestor later would be
// a silent regression.
const CARD =
  'flex h-full flex-col gap-4 rounded-card border border-line bg-paper p-4 text-left shadow-resting md:gap-5 md:p-6'

// 20px on a phone, 24px from sm — the section-heading step. The h1 and the h2
// are the same size on purpose: they are peers on the page, and a heading
// that out-sizes its neighbour implies a hierarchy that is not there.
//
// ink is the darkest blue in the system (#16243d). brand and brand-hover are
// navy too, but the design system reserves those for the background of a
// filled button and says text stays ink.
const HEADING = 'text-[20px] leading-[1.2] font-bold text-ink sm:text-[24px]'

const BODY = 'text-[15px] leading-relaxed text-slate'

// The same 2px accent rule the header has under it and the footer has above
// it. It ties these cards to the page rather than decorating them, and it is
// the ONLY place gold appears inside a card.
function AccentBar() {
  return <div className="h-0.5 bg-accent" aria-hidden="true" />
}

export function SignedOutAbout() {
  return (
    // A section, not a second <main>: SignInView owns the main above this.
    // mt-10/md:mt-16 is the scale's gap BETWEEN sections, so this reads as a
    // second section rather than something stuck to the sign-in card.
    <section className="mt-10 md:mt-16" aria-label="About this site">
      <Container>
        <div className={`${MEASURE} grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 md:gap-4`}>
          {/* CARD 1. Its heading is the page's h1: the page is about the
              site, not about signing in. */}
          <article className={CARD}>
            <AccentBar />

            <h1 className={HEADING}>What RUET Faculty Review is</h1>

            <p className={BODY}>
              RUET Faculty Review collects anonymous student reviews of teaching
              at Rajshahi University of Engineering &amp; Technology. Every
              review is written by a student who actually took that
              teacher&rsquo;s course, and every review is about the teaching —
              how clearly a teacher explains, how they handle questions, how
              they grade — never about the person.
            </p>

            {/* An ordered list, so the steps are steps to a screen reader and
                not three sentences that happen to start with a digit. The
                marker is drawn rather than left to the browser, because a
                browser marker cannot be a filled circle in ink. */}
            <ol className="flex flex-col gap-4">
              {STEPS.map((step) => (
                <li key={step.n} className="flex items-start gap-3">
                  {/* The number reversed out of the darkest blue. The circle
                      sits outside the text's left edge; the text beside it
                      starts on the same edge as everything else in the card.
                      mt-0.5 puts the circle on the first line's optical
                      centre rather than its box top. */}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-paper"
                  >
                    {step.n}
                  </span>
                  <span className={BODY}>{step.text}</span>
                </li>
              ))}
            </ol>

            <p className={BODY}>
              Ratings are shown per course as well as overall, so you can tell
              the difference between a teacher and one particular course they
              teach.
            </p>

            <p className={BODY}>
              Each student counts once, however many of a teacher&rsquo;s
              courses they took, so no single person can decide a rating on
              their own.
            </p>
          </article>

          {/* CARD 2. */}
          <article className={CARD}>
            <AccentBar />

            <h2 className={HEADING}>Questions</h2>

            {/* A description list: each question is a term and each answer its
                definition, which is what this actually is. The same gap-4 the
                steps use, so the two cards share one rhythm. */}
            <dl className="flex flex-col gap-4">
              {QUESTIONS.map((item) => (
                <div key={item.q} className="flex flex-col gap-1">
                  {/* ink and bold, so the eye can skim the questions alone. */}
                  <dt className="text-[15px] font-bold text-ink">{item.q}</dt>
                  <dd className={BODY}>{item.a}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </Container>
    </section>
  )
}
