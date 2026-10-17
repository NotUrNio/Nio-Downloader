import { cn } from '@renderer/lib/utils'
import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ForwardRefExoticComponent,
  forwardRef,
  type RefAttributes,
  useId,
} from 'react'

export type NioDownloaderIconProps = ComponentPropsWithoutRef<'svg'> & {
  size?: number | string
  title?: string
}
export type NioDownloaderIcon = ForwardRefExoticComponent<
  NioDownloaderIconProps & RefAttributes<SVGSVGElement>
>
type IconGlyph = ComponentType<
  NioDownloaderIconProps & RefAttributes<SVGSVGElement>
>

// Keep creation free of side effects: callers mark it pure for tree shaking.
export function createIcon(
  name: string,
  Glyph: IconGlyph,
  iconSet: string
): NioDownloaderIcon {
  const Icon = forwardRef<SVGSVGElement, NioDownloaderIconProps>(function Icon(
    { title, className, children, ...props },
    ref
  ) {
    const id = useId()
    const named = Boolean(
      title || props['aria-label'] || props['aria-labelledby']
    )

    return (
      <Glyph
        ref={ref}
        className={cn('nio-icon', className)}
        data-icon={name}
        data-icon-set={iconSet}
        aria-hidden={named ? undefined : true}
        role={named ? 'img' : undefined}
        aria-labelledby={title ? id : undefined}
        {...props}
      >
        {title ? <title id={id}>{title}</title> : null}
        {children}
      </Glyph>
    )
  })
  Icon.displayName = `NioDownloaderIcon(${name})`
  return Icon
}
