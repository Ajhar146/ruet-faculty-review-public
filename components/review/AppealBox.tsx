'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { appealReview } from '@/app/actions/review'
import { useSchoolKeyword } from '@/components/auth/SchoolKeywordGate'
import { Alert, Button, Textarea } from '@/components/ui'
import { APPEAL_MAX } from '@/validators/review'

// Said once it is sent, and said plainly. Promising a reply nobody has time
// to write would be worse than saying there is not one.
const SENT =
  'Thanks. We will look at this when we next review appeals. You will not get a reply unless the decision changes.'

export type AppealBoxProps = {
  reviewId: string
  // Already appealed. The box becomes the record that it happened.
  appealed: boolean
  // What they give up by appealing. Sending the appeal spends these,
  // whatever the admin decides, so the number has to be in front of them
  // before they send it.
  attemptsLeft: number
}

export function AppealBox({ reviewId, appealed, attemptsLeft }: AppealBoxProps) {
  const router = useRouter()
  const { keyword } = useSchoolKeyword()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send() {
    setError(null)

    startTransition(async () => {
      const result = await appealReview({
        reviewId,
        appealText: text,
        schoolKeyword: keyword ?? '',
      })

      if (!result.ok) {
        setError(result.error)
        setConfirming(false)
        return
      }

      // Shown at once, so the result screen does not need a page load to
      // confirm it. /my-reviews still refreshes, so a reload agrees.
      setSent(true)
      setOpen(false)
      setConfirming(false)
      router.refresh()
    })
  }

  // One appeal per review, so once it is used this is all there is to show.
  if (appealed || sent) {
    return <Alert>{SENT}</Alert>
  }

  if (!open) {
    return (
      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          Appeal this decision
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-mist p-4 md:p-6">
      <Textarea
        label="Why should we look at this again?"
        hint="One appeal per review."
        maxLength={APPEAL_MAX}
        rows={4}
        value={text}
        disabled={pending}
        onChange={(event) => setText(event.target.value)}
      />

      {/* The cost of appealing, before they pay it. It is not "if the
          appeal is refused" — sending it is what ends the attempts, and a
          student who appeals casually must not find that out afterwards. */}
      {confirming ? (
        <Alert variant="warning">
          Appealing ends your remaining attempts. You will not be able to edit
          this review again, whatever the admin decides.{' '}
          {attemptsLeft > 0 ? (
            <>
              You have{' '}
              {attemptsLeft === 1 ? '1 attempt' : `${attemptsLeft} attempts`} left
              if you would rather fix it yourself.
            </>
          ) : (
            <>You have no attempts left.</>
          )}
        </Alert>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          loading={pending}
          disabled={text.trim().length === 0}
          onClick={() => (confirming ? send() : setConfirming(true))}
        >
          {confirming ? 'Yes, send the appeal' : 'Send the appeal'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setConfirming(false)
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
