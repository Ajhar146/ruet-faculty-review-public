import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type ContainerProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  className?: string
}

export function Container({ children, className = '', ...rest }: ContainerProps) {
  return (
    <div {...rest} className={`mx-auto w-full max-w-page px-6 md:px-10 ${className}`}>
      {children}
    </div>
  )
}
