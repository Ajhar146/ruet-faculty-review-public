'use client'

import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { editMyReviewComment } from '@/app/actions/review'
import { DeleteReviewButton } from '@/components/review/DeleteReviewButton'
import { useSchoolKeyword } from '@/components/auth/SchoolKeywordGate'
import { Button, Textarea } from '@/components/ui'
import { COMMENT_MAX, COMMENT_MIN } from '@/validators/review'

export type EditableCommentProps = {
  reviewId: string
  comment: string | null
  // The long date, and the short one a phone has room for.
  dateLabel: string
  dateLabelShort: string
  // The ratings line. It sits between the comment and the footer, and it
  // is not editable: the review was checked against those numbers.
  children?: ReactNode
  // Set once the review has been appealed. The comment and the date still
  // show, and so does Delete — it is still their review — but there is no
  // way into editing. editMyReviewComment refuses it on the server too.
  locked?: boolean
}

export function EditableComment({
  reviewId,
  comment,
  dateLabel,
  dateLabelShort,
  children,
  locked = false,
}: EditableCommentProps) {
  const router = useRouter()
  const { keyword } = useSchoolKeyword()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const length = draft.trim().length
  const valid = (length === 0 || length >= COMMENT_MIN) && length <= COMMENT_MAX

  function save() {
    setError(null)

    startTransition(async () => {
      const result = await editMyReviewComment({
        reviewId,
        comment: draft.trim(),
        schoolKeyword: keyword ?? '',
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setEditing(false)
      router.refresh()
    })
  }

  function cancel() {
    setDraft(comment ?? '')
    setError(null)
    setEditing(false)
  }

  return (
    <>
      {editing ? (
        <div className="flex flex-col gap-3">
          {/* Say it before they save, not after. Clearing the comment leaves
              nothing to read, so that case is not sent back to be checked. */}
          {length > 0 ? (
            <p className="text-[13px] text-slate">
              Editing sends your review back to be checked. It will be hidden until
              then.
            </p>
          ) : null}

          <Textarea
            label="Your feedback"
            hint="Optional. Leave it empty to remove the comment."
            maxLength={COMMENT_MAX}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={
              valid
                ? undefined
                : `Write at least ${COMMENT_MIN} characters, or leave it empty.`
            }
          />

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={!valid || pending}>
              {pending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={cancel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : comment ? (
        <p className="border-t border-line pt-3 text-[15px] leading-relaxed text-ink">
          {comment}
        </p>
      ) : null}

      {children}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        {/* "3 Oct 2026" on a phone, the full month from md. */}
        <p className="shrink-0 text-[13px] text-slate">
          <span className="md:hidden">{dateLabelShort}</span>
          <span className="hidden md:inline">{dateLabel}</span>
        </p>

        {/* Edit is the action. Delete is a text button beside it. No other
            field can be changed. */}
        <div className="flex items-center gap-2">
          {editing || locked ? null : (
            <Button type="button" onClick={() => setEditing(true)}>
              <span className="md:hidden">Edit</span>
              <span className="hidden md:inline">Edit comment</span>
            </Button>
          )}

          <DeleteReviewButton reviewId={reviewId} />
        </div>
      </div>
    </>
  )
}
