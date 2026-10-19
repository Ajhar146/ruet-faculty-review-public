import type { ReactNode } from 'react'

export type AlertVariant = 'info' | 'warning' | 'error'

const VARIANTS: Record<AlertVariant, string> = {
  info: 'border-line bg-mist text-ink',
  warning: 'border-accent bg-paper text-ink',
  error: 'border-danger bg-paper text-danger',
}

export type AlertProps = {
  children: ReactNode
  variant?: AlertVariant
  title?: string
  className?: string
}

export function Alert({ children, variant = 'info', title, className = '' }: AlertProps) {
  return (
    <div
      role={variant === 'info' ? 'status' : 'alert'}
      className={`rounded-control border px-4 py-3 text-[15px] ${VARIANTS[variant]} ${className}`}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  )
}
