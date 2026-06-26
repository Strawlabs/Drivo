import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-deep-blue)] text-[#ffffff] hover:bg-[var(--color-inverse-surface)] active:opacity-90 rounded-[var(--radius-lg)]',
        success:
          'bg-[var(--color-primary)] text-[#ffffff] hover:bg-[var(--color-on-primary-container)] active:opacity-90 rounded-[var(--radius-lg)]',
        outline:
          'border border-[var(--color-outline-variant)] bg-transparent text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-low)] rounded-[var(--radius-lg)]',
        ghost:
          'bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-on-surface)] rounded-[var(--radius-lg)]',
        destructive:
          'bg-[var(--color-error)] text-[#ffffff] hover:opacity-90 rounded-[var(--radius-lg)]',
        link:
          'text-[var(--color-primary)] underline-offset-4 hover:underline p-0 h-auto rounded-none',
      },
      size: {
        default: 'h-12 px-6 py-3 text-label-md',
        sm:      'h-9  px-4 py-2 text-label-sm',
        lg:      'h-14 px-8 py-4 text-base',
        icon:    'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
