export type SkeletonProps = {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`rounded-control bg-mist ${className}`} />
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-card border border-line bg-paper p-8 ${className}`}
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

export type SkeletonListProps = SkeletonProps & {
  count?: number
}

export function SkeletonList({ count = 3, className = '' }: SkeletonListProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`flex flex-col gap-4 ${className}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}
