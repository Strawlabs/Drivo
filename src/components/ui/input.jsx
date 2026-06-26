import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        /* Ghost style: light gray bg → white on focus, Deep Blue border on focus */
        'flex h-12 w-full rounded-[var(--radius-lg)] px-4 py-3',
        'bg-[var(--color-input)] text-[var(--color-on-surface)] text-body-md',
        'placeholder:text-[var(--color-muted-foreground)]',
        'border border-[var(--color-outline-variant)]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:bg-white focus-visible:border-[var(--color-deep-blue)] focus-visible:ring-1 focus-visible:ring-[var(--color-deep-blue)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        /* File input reset */
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
