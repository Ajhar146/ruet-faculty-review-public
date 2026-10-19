'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMyReview } from '@/app/actions/review'
import { useSchoolKeyword } from '@/components/auth/SchoolKeywordGate'
import { Button } from '@/components/ui'

export type DeleteReviewButtonProps = {
  reviewId: string
}

export function DeleteReviewButton({ reviewId }: DeleteReviewButtonProps) {
  const router = useRouter()
  const { keyword } = useSchoolKeyword()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function remove() {
    setError(null)

    startTransition(async () => {
      const result = await deleteMyReview({
        reviewId,
        schoolKeyword: keyword ?? '',
      })

      if (!result.ok) {
        setError(result.error)
        setConfirming(false)
        return
      }

      // The action revalidates, but this page is already on screen.
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        {/* Quieter than Edit on purpose. Two identical filled buttons side
            by side, one of which destroys the review, is a mistake waiting
            to happen. The confirmation below is unchanged. */}
        <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
          Delete
        </Button>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[13px] text-slate">Delete this review?</p>

      <Button type="button" onClick={remove} disabled={pending}>
        {pending ? 'Deleting...' : 'Yes, delete'}
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Keep it
      </Button>
    </div>
  )
}
