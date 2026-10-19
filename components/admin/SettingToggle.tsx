'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSetting } from '@/app/actions/admin'
import { Badge, Button } from '@/components/ui'

export type SettingToggleProps = {
  settingKey: string
  // WHICH setting this is, shown on a phone only.
  //
  // Desktop has never had it: two cards side by side, and the button text
  // says which is which. Stacked on a phone, with the thing above and below
  // also being a card, "Reviews are on" alone does not say what it belongs
  // to — and the one question being asked in a hurry is whether the site is
  // open. Adding it at md would change a desktop that must not change.
  label: string
  // The value in the database right now. This component keeps no copy of
  // it: after a flip it refreshes and is handed the new one. What you see
  // is always what is stored.
  value: string
  // What each state is called.
  whenOn: string
  whenOff: string
  // What the button says, depending on where it will take you.
  turnOn: string
  turnOff: string
  // True when 'true' is the state worth noticing, as with maintenance mode.
  // Normally 'false' is the state to worry about, as with paused reviews.
  alarmWhenOn?: boolean
}

export function SettingToggle({
  settingKey,
  label,
  value,
  whenOn,
  whenOff,
  turnOn,
  turnOff,
  alarmWhenOn = false,
}: SettingToggleProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isOn = value === 'true'
  const alarmed = isOn === alarmWhenOn

  function flip() {
    setError(null)

    startTransition(async () => {
      const result = await setSetting({
        key: settingKey,
        value: isOn ? 'false' : 'true',
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      // Read the new state back from the database rather than assuming the
      // write did what was asked.
      router.refresh()
    })
  }

  return (
    // A stacked full-width row on a phone. From md every class below
    // resolves to what was here before: flex-row, flex-wrap, items-center,
    // justify-between, gap-3, p-6.
    <div className="flex flex-col gap-3 rounded-card border border-line bg-paper p-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:p-6">
      <div className="flex flex-col gap-2">
        {/* Phone only, for the reason in the prop's comment. */}
        <p className="text-[13px] text-slate md:hidden">{label}</p>

        {/* self-start only on a phone: the badge is a pill, not a bar. From
            md it goes back to the default stretch, which is what it has
            always had — visible only when an error sits beside it. */}
        <Badge
          variant={alarmed ? 'danger' : 'success'}
          className="self-start md:self-auto"
        >
          {isOn ? whenOn : whenOff}
        </Badge>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      </div>

      {/* Full width on a phone so it is a 44px target across the card, the
          width it was from md. */}
      <Button
        type="button"
        loading={pending}
        onClick={flip}
        className="w-full md:w-auto"
      >
        {isOn ? turnOff : turnOn}
      </Button>
    </div>
  )
}
