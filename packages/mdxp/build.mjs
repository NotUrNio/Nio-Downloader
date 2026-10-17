import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(packageDir, 'dist')

execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: packageDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

for (const relPath of readdirSync(distDir, { recursive: true })) {
  if (
    typeof relPath !== 'string' ||
    (!relPath.endsWith('.js') && !relPath.endsWith('.d.ts'))
  ) {
    continue
  }
  const fullPath = path.join(distDir, relPath)
  const fileDir = path.dirname(fullPath)
  const original = readFileSync(fullPath, 'utf8')
  const rewritten = original.replace(
    /(from\s+['"])(\.\.?(?:\/[^'"]+)?)((?<!\.js)['"])/g,
    (_match, prefix, specifier, suffix) => {
      const resolvedIndex = path.join(fileDir, specifier, 'index.js')
      const nextSpecifier = existsSync(resolvedIndex)
        ? `${specifier}/index.js`
        : `${specifier}.js`
      return `${prefix}${nextSpecifier}${suffix}`
    }
  )
  if (rewritten !== original) {
    writeFileSync(fullPath, rewritten, 'utf8')
  }
}
