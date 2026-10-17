/**
 * Formats an engine version string for user-facing display by stripping vendor
 * or pre-release suffixes (e.g. "1.37.0-motrix.16" -> "1.37.0", "1.37.0-nio.14" -> "1.37.0").
 * User-facing screens (About, Diagnostics, Dashboard engine status) display only clean SemVer.
 */
export function formatEngineDisplayVersion(
  version: string | null | undefined
): string {
  if (!version) return ''
  const trimmed = version.trim()
  const match = /(\d+\.\d+\.\d+)/.exec(trimmed)
  if (match) {
    return match[1]
  }
  return trimmed.split('-')[0].trim()
}
