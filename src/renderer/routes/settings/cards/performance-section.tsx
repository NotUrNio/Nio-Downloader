import {
  ArrowUpRightIcon,
  ConnectionsIcon,
  DiskCacheIcon,
  type NioDownloaderIcon,
  PieceSizeIcon,
  ServerConnectionsIcon,
} from '@renderer/components/icons'
import { SettingsFormRow } from '@renderer/components/settings-kit/settings-form-row'
import { SettingsSelectTrigger } from '@renderer/components/settings-kit/settings-select-trigger'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { useByteFormat } from '@renderer/hooks/use-byte-format'
import {
  ENGINE_PERFORMANCE_PROFILE_IDS,
  type EnginePerformanceProfile,
  getEnginePerformanceProfileValues,
  MAX_SPEED_PRESET,
  PREVIOUS_AUTO_PRESET,
} from '@shared/constants/engine-performance-profiles'
import { getDownloadPerformanceUrl } from '@shared/external-urls'
import { MAX_CONNECTIONS_PER_SERVER } from '@shared/schemas/engine-settings'
import { type UseFormReturn, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { type DownloadsFields, MB } from './downloads-form'
import { EngineNumberSettingRow } from './engine-number-setting-row'

type PerformanceMetric = {
  icon: NioDownloaderIcon
  label: string
  value: number | string
}

export function PerformanceSection({
  form,
}: {
  form: UseFormReturn<DownloadsFields>
}) {
  const { t, i18n } = useTranslation()
  const { formatByteQuantity } = useByteFormat()
  const performanceProfile = useWatch({
    control: form.control,
    name: 'engine.performanceProfile',
  })
  const maxSpeed = useWatch({
    control: form.control,
    name: 'engine.maxSpeed',
  })
  const split = useWatch({
    control: form.control,
    name: 'engine.split',
  })
  const maxConnectionPerServer = useWatch({
    control: form.control,
    name: 'engine.maxConnectionPerServer',
  })
  const minSplitSize = useWatch({
    control: form.control,
    name: 'engine.minSplitSize',
  })
  const diskCache = useWatch({
    control: form.control,
    name: 'engine.diskCache',
  })

  const performanceProfileOptions = ENGINE_PERFORMANCE_PROFILE_IDS.map(
    (value) => ({
      value,
      label: t(`settings.downloads.performance.profiles.${value}.label`),
    })
  )

  const effectiveSplit =
    split ??
    (maxSpeed === false ? PREVIOUS_AUTO_PRESET.split : MAX_SPEED_PRESET.split)
  const effectiveMaxConnectionPerServer =
    maxConnectionPerServer ??
    (maxSpeed === false
      ? PREVIOUS_AUTO_PRESET.maxConnectionPerServer
      : MAX_SPEED_PRESET.maxConnectionPerServer)
  const effectiveMinSplitSize =
    minSplitSize ??
    (maxSpeed === false
      ? PREVIOUS_AUTO_PRESET.minSplitSize
      : MAX_SPEED_PRESET.minSplitSize)
  const effectiveDiskCache =
    diskCache ??
    (maxSpeed === false
      ? PREVIOUS_AUTO_PRESET.diskCache
      : MAX_SPEED_PRESET.diskCache)

  const performanceMetrics: PerformanceMetric[] = [
    {
      icon: ConnectionsIcon,
      label: t('settings.downloads.performance.metrics.connections'),
      value: effectiveSplit,
    },
    {
      icon: ServerConnectionsIcon,
      label: t('settings.downloads.performance.metrics.perServer'),
      value: effectiveMaxConnectionPerServer,
    },
    {
      icon: PieceSizeIcon,
      label: t('settings.downloads.performance.metrics.minimum'),
      value: formatByteQuantity(Math.round(effectiveMinSplitSize / MB), 'MiB'),
    },
    {
      icon: DiskCacheIcon,
      label: t('settings.downloads.performance.metrics.cache'),
      value: formatByteQuantity(Math.round(effectiveDiskCache / MB), 'MiB'),
    },
  ]

  const applyPerformanceProfile = (profile: EnginePerformanceProfile) => {
    const values = getEnginePerformanceProfileValues(profile)
    if (!values) return
    form.setValue(
      'engine.maxConnectionPerServer',
      values.maxConnectionPerServer,
      { shouldDirty: true, shouldValidate: true }
    )
    form.setValue('engine.split', values.split, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('engine.minSplitSize', values.minSplitSize, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('engine.diskCache', values.diskCache, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const handleMaxSpeedChange = (checked: boolean) => {
    form.setValue('engine.maxSpeed', checked, {
      shouldDirty: true,
      shouldValidate: true,
    })
    const preset = checked ? MAX_SPEED_PRESET : PREVIOUS_AUTO_PRESET
    form.setValue(
      'engine.maxConnectionPerServer',
      preset.maxConnectionPerServer,
      { shouldDirty: true, shouldValidate: true }
    )
    form.setValue('engine.split', preset.split, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('engine.minSplitSize', preset.minSplitSize, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('engine.diskCache', preset.diskCache, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  return (
    <>
      <h3 className="text-sm font-semibold text-foreground">
        {t('settings.downloads.performance.title')}
      </h3>
      <FormField
        control={form.control}
        name="engine.maxSpeed"
        render={({ field }) => (
          <SettingsFormRow>
            <div className="space-y-1">
              <FormLabel>
                {t('settings.downloads.performance.maxSpeed')}
              </FormLabel>
              <FormDescription className="text-xs">
                {t('settings.downloads.performance.maxSpeedDesc')}
              </FormDescription>
              <FormDescription className="text-xs text-muted-foreground/80">
                {t('settings.downloads.performance.maxSpeedNotice')}
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked)
                  handleMaxSpeedChange(checked)
                }}
              />
            </FormControl>
          </SettingsFormRow>
        )}
      />
      <FormField
        control={form.control}
        name="engine.performanceProfile"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <FormLabel>
                  {t('settings.downloads.performance.profile')}
                </FormLabel>
                <FormDescription className="text-xs">
                  {t('settings.downloads.performance.profileDesc')}
                </FormDescription>
              </div>
              <FormControl>
                <Select
                  items={performanceProfileOptions}
                  value={field.value}
                  onValueChange={(value) => {
                    if (value === null) return
                    const profile = value as EnginePerformanceProfile
                    field.onChange(profile)
                    applyPerformanceProfile(profile)
                  }}
                >
                  <SettingsSelectTrigger className="min-w-40">
                    <SelectValue />
                  </SettingsSelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {performanceProfileOptions.map(({ label, value }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </div>

            <div
              className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="flex min-h-5 items-start justify-between gap-3">
                <p className="min-w-0 py-0.5">
                  {t(
                    `settings.downloads.performance.profiles.${performanceProfile}.desc`
                  )}
                </p>
                <a
                  href={getDownloadPerformanceUrl(
                    i18n.resolvedLanguage ?? i18n.language
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-sm py-0.5 text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('settings.downloads.performance.learnMore')}
                  <ArrowUpRightIcon aria-hidden="true" className="size-3" />
                </a>
              </div>
              {performanceMetrics && (
                <div className="mt-2">
                  <div className="grid grid-cols-4 overflow-hidden rounded-md border border-border bg-background/70">
                    {performanceMetrics.map(({ icon: Icon, label, value }) => (
                      <div
                        className="flex min-w-0 items-center gap-2 px-2.5 py-2 [&:not(:first-child)]:border-s [&:not(:first-child)]:border-border"
                        key={label}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate font-semibold tabular-nums text-foreground">
                            {value}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <FormMessage className="basis-full text-xs" />
          </FormItem>
        )}
      />

      {(performanceProfile === 'custom' ||
        form.formState.errors.engine?.split ||
        form.formState.errors.engine?.maxConnectionPerServer ||
        form.formState.errors.engine?.minSplitSize ||
        form.formState.errors.engine?.diskCache) && (
        <div className="space-y-4 rounded-md border border-border bg-muted/20 p-3">
          <h4 className="text-xs font-semibold text-foreground">
            {t('settings.downloads.performance.customParameters')}
          </h4>
          <EngineNumberSettingRow
            form={form}
            name="maxConnectionPerServer"
            labelKey="settings.downloads.performance.maxConnectionPerServer"
            descKey="settings.downloads.performance.maxConnectionPerServerDesc"
            presets={[
              { label: '1', value: 1 },
              { label: '8', value: 8 },
              { label: '16', value: 16 },
              { label: '32', value: 32 },
              {
                label: String(MAX_CONNECTIONS_PER_SERVER),
                value: MAX_CONNECTIONS_PER_SERVER,
              },
            ]}
          />
          <EngineNumberSettingRow
            form={form}
            name="split"
            labelKey="settings.downloads.performance.split"
            descKey="settings.downloads.performance.splitDesc"
            presets={[
              { label: '4', value: 4 },
              { label: '16', value: 16 },
              { label: '32', value: 32 },
              { label: '64', value: 64 },
            ]}
          />
          <EngineNumberSettingRow
            form={form}
            name="minSplitSize"
            labelKey="settings.downloads.performance.minSplitSize"
            descKey="settings.downloads.performance.minSplitSizeDesc"
            presets={[
              { label: formatByteQuantity(1, 'MiB'), value: 1 },
              { label: formatByteQuantity(4, 'MiB'), value: 4 },
              { label: formatByteQuantity(10, 'MiB'), value: 10 },
              { label: formatByteQuantity(20, 'MiB'), value: 20 },
            ]}
          />
          <EngineNumberSettingRow
            form={form}
            name="diskCache"
            labelKey="settings.downloads.disk.diskCache"
            descKey="settings.downloads.disk.diskCacheDesc"
            presets={[
              { label: formatByteQuantity(16, 'MiB'), value: 16 },
              { label: formatByteQuantity(32, 'MiB'), value: 32 },
              { label: formatByteQuantity(64, 'MiB'), value: 64 },
            ]}
          />
        </div>
      )}

      <EngineNumberSettingRow
        form={form}
        name="maxConcurrentDownloads"
        labelKey="settings.downloads.performance.maxConcurrentDownloads"
        descKey="settings.downloads.performance.maxConcurrentDownloadsDesc"
        presets={[
          { label: '1', value: 1 },
          { label: '3', value: 3 },
          { label: '5', value: 5 },
          { label: '10', value: 10 },
          { label: '20', value: 20 },
          { label: '30', value: 30 },
        ]}
      />
    </>
  )
}
