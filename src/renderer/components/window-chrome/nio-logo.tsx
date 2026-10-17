import { ChevronDownIcon } from '@renderer/components/icons'

export function NioDownloaderLogo() {
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="nio-menu-logo"
        className="h-2.5 w-11 shrink-0 bg-foreground"
        style={{
          maskImage: 'url("./nio-logo.svg")',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          WebkitMaskImage: 'url("./nio-logo.svg")',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
        }}
      />
      <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0" />
    </>
  )
}
