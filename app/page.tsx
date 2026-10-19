import type { Metadata } from 'next'
import { SignInView } from '@/components/auth/SignInView'
import { SignedOutAbout } from '@/components/home/SignedOutAbout'
import { StructuredData } from '@/components/seo/StructuredData'
import { Container } from '@/components/layout/Container'
import { DepartmentTile } from '@/components/home/DepartmentTile'
import { SectionHeader } from '@/components/home/SectionHeader'
import { TeacherTile } from '@/components/home/TeacherTile'
import { SearchBar } from '@/components/teacher/SearchBar'
import { getCurrentUser } from '@/lib/auth'
import { openGraph } from '@/lib/metadata'
import { getDepartments } from '@/server/departments'
import { getSetting } from '@/server/settings'
import { getSiteStats } from '@/server/stats'
import { getTopRatedTeachers } from '@/server/teachers'

// Thousand separators, and the locale is fixed rather than the server's.
// toLocaleString() with no argument would follow the host, and a Bangla
// locale renders 1,094 in Bengali digits.
function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

// Six cards are RENDERED in each grid. A phone SHOWS four.
//
// The cut is not made here — it is the [&>*:nth-child(n+5)]:hidden on each
// grid below, because Tailwind reads class names out of the source and cannot
// be handed a number at runtime. Change this number and you have to change
// those selectors too.
//
// Rendering six and hiding two is safe in a way it would not be for
// pagination: nothing becomes unreachable, because the rest are behind the
// same "see all" link either way. The two hidden teacher photos are not even
// downloaded — they are lazy, and a lazy image inside a display:none box is
// never near the viewport, so the browser never fetches it.
const HOME_GRID_CARDS = 6

// THE PHRASE PEOPLE TYPE HAS TO BE IN HERE. Neither the old title nor the
// old description contained "RUET faculty review", which is what a student
// searching for this site actually types — so there was nothing for Google to
// match a search against.
//
// The description leads with that exact phrase, then says what the site does
// in plain words: anonymous ratings, written by students, by department and
// course. Every clause is true of the site as it stands; none of it is a
// promise the page does not keep.
//
// 154 characters, under the 160 Google truncates at, so it is never cut off
// mid-sentence. Count it again if you edit it.
//
// openGraph() in lib/metadata.ts feeds title and description to the <title>,
// the meta description, og:title, og:description, twitter:title and
// twitter:description from these two strings — so a shared link and a search
// result cannot say different things.
export const metadata: Metadata = openGraph({
  path: '/',
  title: 'RUET Faculty Review — Teacher Reviews & Ratings',
  description:
    'RUET faculty reviews written by students. Read anonymous ratings of teachers at Rajshahi University of Engineering & Technology, by department and course.',
})

type RootPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>
}

/**
 * THE ROOT URL, and it answers 200 either way.
 *
 * This page used to live at app/(app)/page.tsx, inside the route group whose
 * layout calls requireAuth(), so / redirected a signed-out visitor to
 * /login?callbackUrl=%2F. Google indexes the redirect TARGET, so that ugly URL
 * is what a search result would have shown. It is now one page: the sign-in
 * screen signed out, the real home page signed in, and no redirect in either
 * case.
 *
 * THE AUTH CHECK IS STILL ON THE SERVER, just here rather than in a layout.
 * Nothing below the branch renders for a visitor without a session.
 */
export default async function RootPage({ searchParams }: RootPageProps) {
  const user = await getCurrentUser()

  // A banned account is shown the sign-in screen with its own message, the
  // same sentence requireAuth() sends to /login?error=banned. Not a redirect:
  // the point of this page is that / never redirects.
  if (!user || user.isBanned) {
    const { error, callbackUrl } = await searchParams

    return (
      <>
        {/* BOTH BRANCHES CARRY IT, and the signed-out one is the one that
            matters: Google crawls / without a session, so this is the version
            it reads. */}
        <StructuredData />
        <SignInView
          error={user?.isBanned ? 'banned' : error}
          callbackUrl={callbackUrl}
        />
        {/* SIGNED OUT ONLY, and below everything else. Google sees no other
            page on this site, so this is the only place there is anything to
            read. A signed-in student lands here daily and does not need the
            site explained, so it is not in the branch below. */}
        <SignedOutAbout />
      </>
    )
  }

  return (
    <>
      <StructuredData />
      <HomePage />
    </>
  )
}

async function HomePage() {
  const [departments, minStudentsForRanking, stats] = await Promise.all([
    getDepartments(),
    getSetting('min_students_for_ranking'),
    // Null only when the counts could not be read. Cached for up to 15
    // minutes inside getSiteStats, and dropped on every review change.
    getSiteStats(),
  ])

  const rankingThreshold = Number(minStudentsForRanking)

  // Usually empty, and about to be emptier: every review is being deleted
  // before launch. The section below renders nothing at all when it is.
  const topRated = Number.isFinite(rankingThreshold)
    ? await getTopRatedTeachers(rankingThreshold)
    : []

  // Both counts come from the rows just loaded, never from a constant.
  // 471 and 18 change the moment the scraper runs again.
  const teacherTotal = departments.reduce((sum, d) => sum + d.teacherCount, 0)

  // The first few in the official RUET code order: CE, EEE, ME, CSE.
  // getDepartments() already returns them in that order, so this only takes
  // the top of the list. The full list is one link away.
  const firstFew = departments.slice(0, HOME_GRID_CARDS)

  // The tile needs a short code and the query returns an id. The department
  // list is already loaded, so no second query is needed for it.
  const shortCodeById = new Map(departments.map((d) => [d.id, d.shortCode]))

  return (
    <main>
      {/*
        pt ONLY, AND THAT IS THE DEAD-GAP FIX.

        This Container was py-8 md:py-20, so 80px of bottom padding sat under
        the last card, and Footer adds mt-10 md:mt-20 on top of it — 160px of
        nothing on desktop, 72px on a phone. The two do not collapse into one,
        because the body is a flex column and flex items never collapse
        margins.

        With the bottom padding gone the gap is the footer's own margin and
        nothing else.
      */}
      <Container className="pt-8 md:pt-20">
        {/* 1. HERO. Left aligned, and it stays that way. */}
        <div className="flex flex-col gap-3">
          <h1 className="text-[24px] leading-[1.2] font-bold text-ink sm:text-[32px] md:text-[48px]">
            Find your RUET teachers
          </h1>
          <p className="text-[13px] text-slate md:text-[16px]">
            Read what students say about teaching and course experience.
          </p>
        </div>

        <div className="mt-8 max-w-[600px]">
          <SearchBar sort="name" variant="hero" />
        </div>

        <p className="mt-6 text-[15px] text-slate">
          {departments.length} departments · {teacherTotal} teachers
        </p>

        {/* The four totals, ALWAYS — zeros included. The threshold that used
            to hide them below 50 reviews is gone.

            The null check is still here and still earns its place: getSiteStats
            returns null when the counts cannot be READ, and four dashes under
            a hero would say less than nothing. */}
        {stats ? (
          <section className="mt-10 md:mt-16" aria-label="Site totals">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {[
                { value: stats.reviews, label: 'reviews' },
                { value: stats.studentsSignedUp, label: 'students signed up' },
                { value: stats.teachers, label: 'teachers reviewed' },
                { value: stats.coursesReviewed, label: 'courses reviewed' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 rounded-card border border-line bg-paper p-4 text-center shadow-resting md:px-2 md:py-6"
                >
                  <span className="text-[22px] leading-[1.2] font-bold text-ink sm:text-[28px]">
                    {formatCount(stat.value)}
                  </span>
                  <span className="text-[13px] text-slate">{stat.label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 2. DEPARTMENTS, FIRST. A student arrives to find their own teacher,
               and the department is how they get there. Top rated is for
               browsing, which is not the job they came to do. */}
        <section className="mt-10 md:mt-16">
          <SectionHeader
            title="Departments"
            href="/departments"
            linkLabel={`See all ${departments.length} departments`}
          />

          {/* FOUR ON A PHONE, SIX FROM md, and the cut is made in CSS.
              Reading the window size in JavaScript would mean a hydration
              mismatch and a visible flash as two cards disappear on load.

              The selector is on the GRID, not on the card: `hidden` on the
              tile would collide with the `flex` in its own class string, and
              a collision between two display utilities is settled by
              Tailwind's output order rather than by intent. A child selector
              outranks both, which is also why md restores `flex` and not
              `block`. */}
          <div className="mt-6 grid grid-cols-2 items-stretch gap-3 [&>*:nth-child(n+5)]:hidden md:grid-cols-3 md:gap-4 md:[&>*:nth-child(n+5)]:flex">
            {firstFew.map((department) => (
              <DepartmentTile
                key={department.id}
                slug={department.slug}
                shortCode={department.shortCode}
                nameEn={department.nameEn}
                teacherCount={department.teacherCount}
              />
            ))}
          </div>
        </section>

        {/* 3. TOP RATED. NOTHING AT ALL when nobody qualifies — no heading, no
               gold rule, no empty box. An empty section is worse than a
               missing one. */}
        {topRated.length > 0 ? (
          <section className="mt-10 md:mt-16">
            <SectionHeader
              title="Top rated teachers"
              href="/teachers"
              linkLabel="View all teachers"
            />

            {/* ONE across on a phone: at 360px a 64px photo and a name side by
                side inside a half-width card leaves about 40px for the name.
                Three across from md, two rows — never six in a row, where
                each card would be too narrow to read. */}
            <div className="mt-6 grid grid-cols-1 items-stretch gap-3 [&>*:nth-child(n+5)]:hidden md:grid-cols-3 md:gap-4 md:[&>*:nth-child(n+5)]:flex">
              {topRated.map((teacher) => (
                <TeacherTile
                  key={teacher.slug}
                  slug={teacher.slug}
                  nameEn={teacher.nameEn}
                  departmentShortCode={shortCodeById.get(teacher.departmentId) ?? ''}
                  imageUrl={teacher.imageUrl}
                  avgOverall={teacher.avgOverall}
                  reviewCount={teacher.reviewCount}
                />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </main>
  )
}
