import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

interface Step {
  name?: string
  run?: string
}

interface MatrixInclude {
  target: string
  os: string
  platform: string
  arch: string
  rust_target: string
  expected_files: string
}

interface Workflow {
  jobs: {
    build?: {
      strategy?: {
        matrix?: {
          include?: MatrixInclude[]
        }
      }
      steps?: Step[]
    }
  }
}

const workflow = load(
  readFileSync('.github/workflows/release-build.yml', 'utf8')
) as Workflow

describe('Release build workflow signing environment', () => {
  it('requests valid, active runner labels for all build platforms', () => {
    const matrix = workflow.jobs.build?.strategy?.matrix?.include ?? []
    const targets = Object.fromEntries(
      matrix.map((entry) => [entry.target, entry.os])
    )

    expect(targets).toEqual({
      'darwin-arm64': 'macos-14',
      'darwin-x64': 'macos-15-intel',
      'win32-x64': 'windows-2022',
      'linux-x64': 'ubuntu-24.04',
    })
  })

  it('unsets empty macOS signing variables before ad-hoc packaging', () => {
    const steps = workflow.jobs.build?.steps ?? []
    const step = steps.find(
      (candidate) => candidate.name === 'Package macOS distribution'
    )
    const command = step?.run ?? ''

    const adHocCommand =
      'CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --$' +
      '{{ matrix.arch }} -c.mac.bundleVersion=$' +
      '{{ inputs.version }}.0.0 --publish never'
    const adHocIndex = command.indexOf(adHocCommand)
    const unsetIndex = command.indexOf(
      'unset CSC_LINK CSC_KEY_PASSWORD APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER'
    )

    expect(adHocIndex).toBeGreaterThanOrEqual(0)
    expect(unsetIndex).toBeGreaterThanOrEqual(0)
    expect(unsetIndex).toBeLessThan(adHocIndex)
  })
})
