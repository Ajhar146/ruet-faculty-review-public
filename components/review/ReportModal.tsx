'use client'

import { useId, useState, useTransition } from 'react'
import { reportReview } from '@/app/actions/report'
import { Alert, Button, Modal, Textarea } from '@/components/ui'
import {
  DESCRIPTION_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
} from '@/validators/report'
import type { ReportReasonValue } from '@/validators/report'

// The same sentence every time a report is accepted. It does not say what
// happens next, how many reports this review has, or how close it is to
// being hidden. Any of those would let someone work out when one more
// report tips it over.
const THANKS = 'Thanks. We will look at this review.'

const FOCUS_RING =
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

export type ReportModalProps = {
  open: boolean
  onClose: () => void
  reviewId: string
}

export function ReportModal({ open, onClose, reviewId }: ReportModalProps) {
  const groupName = useId()
  const [reason, setReason] = useState<ReportReasonValue | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function close() {
    // Next time it opens it is a fresh form, not the last one still filled
    // in with a thank you on top.
    setReason(null)
    setDescription('')
    setError(null)
    setDone(false)
    onClose()
  }

  function submit() {
    setError(null)

    startTransition(async () => {
      const result = await reportReview({
        reviewId,
        reason,
        description: description.trim() ? description : undefined,
      })

      // An accepted report always looks the same, including the second one
      // from the same person. The action decides that; this only shows it.
      if (result.ok) {
        setDone(true)
        return
      }

      setError(result.error)
    })
  }

  if (done) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="Report this review"
        footer={
          <Button type="button" onClick={close}>
            Close
          </Button>
        }
      >
        <Alert>{THANKS}</Alert>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Report this review"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>

          <Button
            type="button"
            onClick={submit}
            loading={pending}
            disabled={reason === null}
          >
            {pending ? 'Sending...' : 'Send the report'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-[15px] font-medium text-ink">
            What is wrong with it?
          </legend>

          {REPORT_REASONS.map((value) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-3 text-[15px] text-ink"
            >
              <input
                type="radio"
                name={groupName}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                disabled={pending}
                className={`size-4 shrink-0 accent-ink ${FOCUS_RING}`}
              />
              <span>{REPORT_REASON_LABELS[value]}</span>
            </label>
          ))}
        </fieldset>

        <Textarea
          label="Anything else we should know?"
          hint="Optional."
          maxLength={DESCRIPTION_MAX}
          rows={4}
          value={description}
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
        />

        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>
    </Modal>
  )
}
