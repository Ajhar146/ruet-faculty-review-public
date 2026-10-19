import type { ReactNode } from 'react'

export type BadgeVariant = 'neutral' | 'success' | 'danger'

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-mist text-slate',
  success: 'border-success bg-paper text-success',
  danger: 'border-danger bg-paper text-danger',
}

export type BadgeProps = {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[13px] font-medium ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
