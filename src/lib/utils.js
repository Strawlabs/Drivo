import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
  We extend tailwind-merge so it understands our custom @theme text-size
  utilities (text-display, text-headline-*, text-body-*, text-label-*).
  Without this, tailwind-merge treats them as text-COLOR utilities and
  incorrectly removes text-[#ffffff] when both appear on the same element.
*/
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display',
        'text-headline-lg',
        'text-headline-md',
        'text-body-lg',
        'text-body-md',
        'text-label-md',
        'text-label-sm',
      ],
    },
  },
})

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
