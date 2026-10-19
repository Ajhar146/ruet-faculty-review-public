import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * One button style, and one text-link style.
 *
 * Every button on the site is the dark fill: ink background, paper text.
 * There is no outline variant any more, so nothing can drift into looking
 * like a second kind of button.
 *
 * `ghost` is not a button. It is a text link that happens to need an
 * onClick, such as Cancel, and it is the only thing that is allowed to look
 * different.
 */
export type ButtonVariant = 'primary' | 'ghost'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// active:, not only hover:. A phone never hovers, so a hover-only style
// means a button that looks dead the whole time a thumb is on it.
const VARIANTS: Record<ButtonVariant, string> = {
  // The same style the header has always used for My reviews.
  // Resting at rest, raised on hover, on top of the colour change that was
  // already here. A filled button is an object; it lifts.
  primary:
    'bg-ink text-paper shadow-resting transition-shadow hover:bg-brand-hover hover:shadow-raised active:bg-brand-hover motion-reduce:transition-none',
  // NO SHADOW. ghost is a text link that happens to need a tap target, not a
  // button, and a shadow on a piece of text is the thing the rule exists to
  // stop.
  ghost: 'text-slate hover:underline active:text-ink active:underline',
}

const DISABLED =
  'disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-paper disabled:text-slate disabled:shadow-none'

type SharedProps = {
  variant?: ButtonVariant
  loading?: boolean
  className?: string
  children: ReactNode
}

type NativeButtonProps = SharedProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof SharedProps> & { as?: 'button' }

type LinkButtonProps = SharedProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof SharedProps> & { as: 'link' }

export type ButtonProps = NativeButtonProps | LinkButtonProps

export function Button(props: ButtonProps) {
  const { variant = 'primary', loading = false, className = '' } = props
  const classes = [BASE, VARIANTS[variant], className].filter(Boolean).join(' ')

  if (props.as === 'link') {
    const { as, variant: _v, loading: _l, className: _c, children, ...linkProps } = props
    return (
      <Link {...linkProps} className={classes}>
        {children}
      </Link>
    )
  }

  const {
    as,
    variant: _v,
    loading: _l,
    className: _c,
    children,
    disabled,
    type,
    ...buttonProps
  } = props

  return (
    <button
      {...buttonProps}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${classes} ${loading ? '' : DISABLED}`}
    >
      {loading ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <path
            d="M14 8a6 6 0 0 0-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {children}
    </button>
  )
}
