import { cn } from '@renderer/lib/utils'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

interface SettingsCardProps {
  icon: ReactElement
  labelKey: string
  descKey: string
  onClick: () => void
  className?: string
}

export function SettingsCard({
  icon: Icon,
  labelKey,
  descKey,
  onClick,
  className,
}: SettingsCardProps) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex h-full min-h-33 select-none flex-col items-start px-5 py-3 text-start transition-all duration-200 ease-out hover:bg-accent/40 active:scale-[0.98] min-[914px]:min-h-[170px] min-[914px]:px-6 min-[914px]:py-4',
        className
      )}
    >
      <div className="flex max-h-18 flex-1 items-center justify-center min-[914px]:max-h-none">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-white/60 bg-gradient-to-b from-white/85 to-white/35 p-2 shadow-sm shadow-black/5 ring-1 ring-black/5 backdrop-blur-sm transition-all duration-200 ease-out group-hover:scale-105 group-hover:shadow-md group-active:scale-95 dark:border-white/15 dark:from-white/15 dark:to-white/5 dark:shadow-black/20 dark:ring-white/10 [&_img]:max-h-10 [&_img]:w-auto">
          {Icon}
        </div>
      </div>
      <div className="min-h-14 pt-3 ps-1 min-[914px]:min-h-22.5 min-[914px]:pt-6">
        <div className="text-sm font-semibold text-foreground">
          {t(labelKey)}
        </div>
        <div className="line-clamp-2 pt-1.5 text-xs text-muted-foreground min-[914px]:pt-2">
          {t(descKey)}
        </div>
      </div>
    </button>
  )
}
