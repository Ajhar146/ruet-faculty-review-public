import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { CourseReviewBlock } from '@/components/teacher/CourseReviewBlock'
import { RatingPanel } from '@/components/teacher/RatingPanel'
import { TeacherHeader } from '@/components/teacher/TeacherHeader'
import { Button, EmptyState } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth'
import { canReviewDepartment } from '@/server/eligibility'
import { teacherCapProblem } from '@/server/review-caps'
import { getOwnReviewIds, getTeacherReviews } from '@/server/reviews'
import { getVoteSummaries } from '@/server/votes'
import { getSetting } from '@/server/settings'
import { getTeacherBySlug } from '@/server/teachers'

type TeacherPageProps = {
  params: Promise<{ slug: string }>
}

// Title only. No description and no Open Graph: the site is closed and
// robots.txt blocks everything.
export async function generateMetadata({
  params,
}: TeacherPageProps): Promise<Metadata> {
  const { slug } = await params
  const teacher = await getTeacherBySlug(slug)

  if (!teacher) return {}

  return {
    title: `${teacher.nameEn} — ${teacher.department.shortCode} | RUET Faculty Review`,
  }
}

export default async function TeacherPage({ params }: TeacherPageProps) {
  const { slug } = await params

  const [teacher, user, threshold, reviewsEnabled] = await Promise.all([
    getTeacherBySlug(slug),
    getCurrentUser(),
    getSetting('min_students_for_display'),
    getSetting('reviews_enabled'),
  ])

  if (!teacher) notFound()

  // A student whose curriculum shares nothing with this teacher's department
  // can never finish the form, so they are not offered it. Hiding the button
  // is not security: canReview() checks the role and the department again.
  const isStudent = user?.role === 'STUDENT'
  const viewerId = isStudent ? user.id : null
  const viewerDepartmentId = isStudent ? user.departmentId : null

  // THREE INDEPENDENT BRANCHES, run together now that the teacher id is
  // known. Each is a short chain of its own, so at most a handful of queries
  // are in flight at once -- the pool (lib/prisma.ts) queues the rest.
  //
  // The course blocks are PUBLIC and cached (server/reviews.ts). Everything
  // else here is the VIEWER's and is read live on every request.
  const [{ reviewable, capMessage }, ownReviewIds, { courseBlocks, voteSummaries }] =
    await Promise.all([
      // 1. Can this viewer write one?
      (async () => {
        const reviewable =
          viewerId !== null
            ? await canReviewDepartment(viewerDepartmentId, teacher.department.shortCode)
            : null

        // Has this student already used up their reviews for this teacher?
        // Asked with the SAME function the action uses, so the sentence shown
        // here and the sentence the server returns cannot drift apart.
        //
        // Only asked when they could otherwise write one: there is no point
        // counting rows for a signed-out visitor or a teacher.
        const capMessage =
          viewerId !== null && reviewable?.ok
            ? await teacherCapProblem(viewerId, teacher.id)
            : null

        return { reviewable, capMessage }
      })(),

      // 2. Ids of the viewer's own reviews, so Report can be hidden on them.
      // This reads their own rows only; nothing here learns who wrote the
      // others.
      viewerId !== null ? getOwnReviewIds(viewerId, teacher.id) : Promise.resolve([]),

      // 3. The public course blocks, then vote counts for every review on
      // first paint, in ONE query pair rather than one per card. Later
      // batches bring their own, from the load-more action.
      //
      // The viewer is `user.id` only for a student: nobody else can hold a
      // vote, so there is nothing to look up for a teacher or an admin. It is
      // the session's own id either way -- never an argument, so no caller can
      // ask about another student.
      //
      // COUNTS ONLY. Nothing in this object identifies a voter; see
      // server/votes.ts. Never cached: the counts change with every vote.
      getTeacherReviews(teacher.id).then(async (courseBlocks) => ({
        courseBlocks,
        voteSummaries: await getVoteSummaries(
          courseBlocks.flatMap((block) => block.reviews.map((review) => review.id)),
          viewerId
        ),
      })),
    ])

  // Paused reviews hide the button rather than offering a form that cannot
  // be submitted. submitReview checks the switch again regardless, and so
  // does the cap.
  const showWriteReview =
    reviewsEnabled === 'true' && (reviewable?.ok ?? false) && capMessage === null

  return (
    <main>
      <Container className="py-8 md:py-20">
        <TeacherHeader
          slug={teacher.slug}
          nameEn={teacher.nameEn}
          nameBn={teacher.nameBn}
          designation={teacher.designation}
          isHead={teacher.isHead}
          imageUrl={teacher.imageUrl}
          ruetProfileUrl={teacher.ruetProfileUrl}
          departmentNameEn={teacher.department.nameEn}
          showWriteReview={showWriteReview}
          capMessage={capMessage}
        />

        <section className="mt-8 border-t border-line pt-6 md:pt-8">
          <h2 className="sr-only">Rating</h2>
          <RatingPanel
            reviewCount={teacher.reviewCount}
            studentCount={teacher.studentCount}
            minStudentsForDisplay={Number(threshold)}
            avgOverall={teacher.avgOverall}
            avgTeaching={teacher.avgTeaching}
            avgClarity={teacher.avgClarity}
            avgFairness={teacher.avgFairness}
          />
        </section>

        <section className="mt-8 border-t border-line pt-6 md:pt-8">
          <h2 className="text-[20px] leading-[1.2] font-bold text-ink sm:text-[24px]">
            Reviews by course
          </h2>

          {courseBlocks.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                heading="No reviews yet"
                message="Nobody has written about this teacher yet. If you took one of their courses, you could be the first."
                action={
                  showWriteReview ? (
                    <Button as="link" href={`/review/new?teacher=${teacher.slug}`}>
                      Write a review
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            // 12px between cards on a phone, per the mobile spacing scale.
            // md:gap-6 is the 24px desktop has always had — the desktop
            // layout is one column and stays one column.
            <div className="mt-6 flex flex-col gap-3 md:gap-6">
              {courseBlocks.map((block) => (
                <CourseReviewBlock
                  key={block.course.code}
                  block={block}
                  teacherId={teacher.id}
                  ownReviewIds={ownReviewIds}
                  isStudent={isStudent}
                  voteSummaries={voteSummaries}
                />
              ))}
            </div>
          )}
        </section>

        {/* Not decoration. This is what you point at when someone says the
            numbers are wrong. */}
        <p className="mt-8 text-[12px] text-slate">
          Reviews are unverified student opinions. We cannot confirm that a
          reviewer took the course.
        </p>
      </Container>
    </main>
  )
}
