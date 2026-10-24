import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { TaskStatus } from '@shared/types/task'
import { CURRENT_SETTINGS_VERSION } from '../src/core/settings/migrations'
import { makeDownloadTask } from '../src/test-utils/task'
import {
  expect,
  launchNio,
  test,
  waitForEngineReady,
} from './fixtures/electron-app'
import { setTaskInspectorContentSize } from './fixtures/task-inspector-activity'

test('downloads table header and row geometry align across widths, densities, and column visibility', async ({
  userDataDir,
  rpcPort,
}) => {
  test.setTimeout(180_000)

  // Configure onboarding completed to launch directly into the app
  await writeFile(
    path.join(userDataDir, 'settings.json'),
    JSON.stringify({
      version: CURRENT_SETTINGS_VERSION,
      app: { liquidGlassEffect: true, theme: 'light', language: 'en-US' },
      tracker: { autoSync: false },
      onboarding: { disclaimerAccepted: true },
    })
  )

  const app = await launchNio({ userDataDir, rpcPort })
  try {
    const page = await app.firstWindow()
    await waitForEngineReady(page)

    // Navigate to Downloads
    await page.getByRole('link', { name: 'Downloads', exact: true }).click()
    await page
      .waitForSelector('[data-testid="downloads-loading"]', {
        state: 'detached',
        timeout: 10_000,
      })
      .catch(() => {})

    // Publish a realistic task with complete properties
    const task = makeDownloadTask({
      id: 'geometry-test-task-1',
      engineTaskId: 'gid-geom-1',
      name: 'Fedora-Workstation-Live-x86_64-40.iso',
      status: TaskStatus.Downloading,
      progress: 0.62,
      totalBytes: 2_200_000_000,
      sizeWhenDone: 2_200_000_000,
      downloadedBytes: 1_364_000_000,
      downloadSpeed: 8_400_000,
      uploadSpeed: 210_000,
      connections: 24,
      etaSeconds: 102,
      finishedAt: Date.now() - 3600_000,
      createdAt: Date.now() - 7200_000,
    })

    await app.evaluate(
      ({ webContents }, payload) => {
        for (const contents of webContents.getAllWebContents()) {
          if (!contents.isDestroyed()) {
            contents.send('event:taskUpdated', payload.tasks)
          }
        }
      },
      { tasks: [task] }
    )

    // Helper to toggle sidebar (controls comfortable vs compact density)
    const setDensity = async (compact: boolean) => {
      const isExpanded = await page.evaluate(() => {
        return localStorage.getItem('sidebar_state') !== 'false'
      })
      if ((compact && isExpanded) || (!compact && !isExpanded)) {
        await page
          .getByRole('button', { name: 'Toggle sidebar', exact: true })
          .click()
        await page.waitForTimeout(250)
      }
    }

    // Helper to toggle Date completed column
    const setDateCompletedVisibility = async (desiredVisible: boolean) => {
      const listViewBtn = page.getByRole('button', {
        name: 'List View',
        exact: true,
      })
      await listViewBtn.click()
      const checkbox = page.getByRole('menuitemcheckbox', {
        name: 'Date completed',
      })
      await checkbox.waitFor({ state: 'visible' })
      const checked = (await checkbox.getAttribute('aria-checked')) === 'true'
      if (checked !== desiredVisible) {
        await checkbox.click()
        await page.waitForTimeout(150)
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }

    // Helper to verify alignment and bounds
    const verifyGeometry = async (label: string) => {
      const headerRow = page.locator('[role="row"][aria-rowindex="1"]')
      const firstRow = page.locator('[role="row"][aria-rowindex="2"]')
      await expect(headerRow).toBeVisible()
      await expect(firstRow).toBeVisible()

      const result = await page.evaluate(() => {
        const headerRow = document.querySelector(
          '[role="row"][aria-rowindex="1"]'
        )
        const firstRow = document.querySelector(
          '[role="row"][aria-rowindex="2"]'
        )
        if (!headerRow || !firstRow) {
          return { ok: false, error: 'Rows not found in DOM' }
        }

        const headerCells = Array.from(
          headerRow.querySelectorAll(':scope > [role="columnheader"]')
        )
        const rowCells = Array.from(
          firstRow.querySelectorAll(':scope > [role="gridcell"]')
        )

        if (headerCells.length !== rowCells.length) {
          return {
            ok: false,
            error: `Cell count mismatch: header has ${headerCells.length}, row has ${rowCells.length}`,
          }
        }

        const firstRowRect = firstRow.getBoundingClientRect()

        // 1. No header text bounding box intersects the first row's bounding box
        const textElements = Array.from(
          headerRow.querySelectorAll('span, button, [title]')
        )
        for (const el of textElements) {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) {
            if (r.bottom > firstRowRect.top + 0.5) {
              return {
                ok: false,
                error: `Header text overlaps first row: text bottom ${r.bottom} > row top ${firstRowRect.top}`,
              }
            }
          }
        }

        // 2. For each visible column, the header cell's left edge and width match the first body row's cell within 1 px
        for (let i = 0; i < headerCells.length; i++) {
          const hRect = headerCells[i].getBoundingClientRect()
          const rRect = rowCells[i].getBoundingClientRect()
          const leftDiff = Math.abs(hRect.left - rRect.left)
          const widthDiff = Math.abs(hRect.width - rRect.width)
          if (leftDiff > 1.05 || widthDiff > 1.05) {
            return {
              ok: false,
              error: `Cell index ${i} misalignment: left diff ${leftDiff.toFixed(2)}px, width diff ${widthDiff.toFixed(2)}px`,
            }
          }
        }

        return { ok: true, cellCount: headerCells.length }
      })

      expect(result.ok, `${label}: ${result.error ?? ''}`).toBe(true)
    }

    const widths = [900, 1200, 1600]
    const densities: Array<'comfortable' | 'compact'> = [
      'comfortable',
      'compact',
    ]
    const dateCompletedStates = [true, false]

    for (const width of widths) {
      await setTaskInspectorContentSize(app, page, width, 800)
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(200)

      for (const density of densities) {
        await setDensity(density === 'compact')

        for (const dateCompleted of dateCompletedStates) {
          await setDateCompletedVisibility(dateCompleted)
          const label = `width=${width}, density=${density}, dateCompleted=${dateCompleted}`
          await verifyGeometry(label)
        }
      }
    }
  } finally {
    await app.close().catch(() => {})
  }
})
