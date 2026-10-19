import type { ReactNode } from 'react'

export type EmptyStateProps = {
  heading: ReactNode
  message?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ heading, message, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-card border border-line bg-mist px-6 py-12 text-center ${className}`}
    >
      <h2 className="text-xl font-semibold text-ink">{heading}</h2>
      {message ? <p className="max-w-[60ch] text-[15px] text-slate">{message}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
