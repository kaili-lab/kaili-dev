import type { ComponentProps } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '#/lib/utils'

export function Button({
  className,
  ...props
}: ComponentProps<typeof BaseButton>) {
  return <BaseButton className={cn('ui-button', className)} {...props} />
}
