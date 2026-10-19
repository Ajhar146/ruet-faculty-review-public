import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/Container'
import { ReviewForm } from '@/components/review/ReviewForm'
import { Alert, Button } from '@/components/ui'
import { requireStudent } from '@/lib/auth'
import { canReviewDepartment } from '@/server/eligibility'
import { getSetting } from '@/server/settings'
import { getTeacherBySlug } from '@/server/teachers'

export const metadata: Metadata = {
  title: 'Write a review | RUET Faculty Review',
}

type NewReviewPageProps = {
  searchParams: Promise<{ teacher?: string }>
}

// 64px: the CSS box at its largest (md:size-16). 48px on a phone
// (size-12) is served from the same file.
const PHOTO_SIZE = 64

// NO `sizes` PROP, DELIBERATELY. It used to be here and it was costing the
// image quota.
//
// next/image treats `sizes` as "this is responsive": get-img-props.js
// getWidths() returns ALL of allSizes -- deviceSizes + imageSizes, 15 widths
// by default -- and the px-only string here made that worse, because the
// `vw` branch that would have filtered the list never matched. One photo
// could be transformed at 15 widths instead of 2.
//
// Without it, a numeric `width` takes the fixed path: [width, width * 2],
// snapped into allSizes. Two widths, a 1x/2x srcset, and the browser picks
// on device pixel ratio.
//
// THE PHOTO IS STILL SHARP AT EVERY BREAKPOINT, because width below is the
// LARGEST size this photo ever renders at, so 2x covers the densest screen
// at that size -- and a smaller breakpoint asks for fewer CSS pixels than
// the same file already provides.

export default async function NewReviewPage({ searchParams }: NewReviewPageProps) {
  const { teacher: slug } = await searchParams

  // No slug and an unknown slug are the same thing: there is nobody to review.
  if (!slug) notFound()

  const [user, teacher, reviewsEnabled] = await Promise.all([
    requireStudent(),
    getTeacherBySlug(slug),
    getSetting('reviews_enabled'),
  ])
  if (!teacher) notFound()

  // Tell them before they fill in five steps, not after they press submit.
  // The same check runs again inside submitReview, and that one is the real
  // gate: this only saves wasted work.
  const reviewsOpen = reviewsEnabled === 'true'

  // Nothing this teacher's department teaches is in the student's
  // curriculum, so the picker would be empty and every submission refused.
  // Say so rather than showing a form that cannot be finished.
  const reviewable = await canReviewDepartment(
    user.departmentId,
    teacher.department.shortCode
  )

  return (
    <main>
      <Container className="py-8 md:py-20">
        {/* A measure cap, not a centred column: mx-auto would have put the
            form's left edge somewhere the header's is not. */}
        <div className="flex max-w-[640px] flex-col gap-8">
          {/* Who this is about, so nobody reviews the wrong person. */}
          <div className="flex items-center gap-3 border-b border-line pb-6 md:gap-4 md:pb-8">
            {teacher.imageUrl ? (
              <Image
                src={teacher.imageUrl}
                alt=""
                width={PHOTO_SIZE}
                height={PHOTO_SIZE}
                      // At the top of the form, so it is not lazy.
                priority
                className="size-12 shrink-0 rounded-full object-cover md:size-16"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mist text-[17px] font-semibold text-slate md:size-16 md:text-[20px]"
              >
                {teacher.nameEn.trim().charAt(0).toUpperCase()}
              </span>
            )}

            <div className="flex flex-col gap-1">
              <p className="text-[13px] text-slate">Writing a review about</p>
              <h1 className="text-[20px] leading-[1.2] font-bold text-ink sm:text-[24px]">
                {teacher.nameEn}
              </h1>
              <p className="text-[15px] text-slate">
                {teacher.designation} · {teacher.department.shortCode}
              </p>
            </div>
          </div>

          {!reviewsOpen ? (
            <div className="flex flex-col gap-6">
              <Alert variant="info">
                Reviews are paused right now. Please try again later.
              </Alert>

              <Button as="link" href={`/teachers/${teacher.slug}`}>
                Back to {teacher.nameEn}
              </Button>
            </div>
          ) : reviewable.ok ? (
            <ReviewForm
              teacherId={teacher.id}
              teacherSlug={teacher.slug}
              teacherName={teacher.nameEn}
              teacherDeptShortCode={teacher.department.shortCode}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <Alert variant="info">
                {reviewable.studentShortCode ? (
                  <>
                    You can&apos;t review this teacher. {teacher.nameEn} teaches{' '}
                    {teacher.department.shortCode} courses, which aren&apos;t part of
                    the {reviewable.studentShortCode} curriculum.
                  </>
                ) : (
                  // No department on the account. canReview() gives the same
                  // answer at submit, in the same words.
                  <>
                    We could not work out your department from your roll number.
                    Please contact us.
                  </>
                )}
              </Alert>

              <Button as="link" href={`/teachers/${teacher.slug}`}>
                Back to {teacher.nameEn}
              </Button>
            </div>
          )}
        </div>
      </Container>
    </main>
  )
}
