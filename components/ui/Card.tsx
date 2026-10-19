import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type CardProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  className?: string
  // The padding utilities, when a card needs different ones. It is a prop
  // rather than something to put in className because two padding classes
  // in one string is a coin flip: Tailwind picks the winner by its own
  // output order, not by the order they are written.
  padding?: string
}

export function Card({
  children,
  className = '',
  padding = 'p-8',
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      // Resting elevation: a card is an object on the page, not a region
      // painted onto it. The border still says where it stops.
      className={`rounded-card border border-line bg-paper shadow-resting ${padding} ${className}`}
    >
      {children}
    </div>
  )
}
