import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { dump, load } from 'js-yaml'

export function consolidateReleaseArtifacts({ inputDir, outputDir }) {
  const resolvedInput = path.resolve(inputDir)
  const resolvedOutput = path.resolve(outputDir)
  fs.mkdirSync(resolvedOutput, { recursive: true })

  // Copy all non-manifest installer files directly into outputDir
  const targets = fs.readdirSync(resolvedInput)
  for (const target of targets) {
    const targetPath = path.join(resolvedInput, target)
    if (!fs.statSync(targetPath).isDirectory()) continue

    const files = fs.readdirSync(targetPath)
    for (const file of files) {
      const src = path.join(targetPath, file)
      const dest = path.join(resolvedOutput, file)
      if (file.endsWith('.yml')) continue
      fs.copyFileSync(src, dest)
    }
  }

  // Merge latest-mac.yml manifests if both arm64 and x64 exist
  const macArmPath = path.join(
    resolvedInput,
    'release-artifacts-darwin-arm64',
    'latest-mac.yml'
  )
  const macX64Path = path.join(
    resolvedInput,
    'release-artifacts-darwin-x64',
    'latest-mac.yml'
  )
  const outMacPath = path.join(resolvedOutput, 'latest-mac.yml')

  if (fs.existsSync(macX64Path) && fs.existsSync(macArmPath)) {
    const docX64 = load(fs.readFileSync(macX64Path, 'utf8'))
    const docArm = load(fs.readFileSync(macArmPath, 'utf8'))
    const mergedFiles = []
    const seen = new Set()
    for (const f of [...(docX64.files || []), ...(docArm.files || [])]) {
      if (!seen.has(f.url)) {
        seen.add(f.url)
        mergedFiles.push(f)
      }
    }
    const zipFile = mergedFiles.find((f) => f.url.endsWith('.zip'))
    const mergedDoc = {
      ...docX64,
      files: mergedFiles,
      path: zipFile?.url ?? docX64.path,
      sha512: zipFile?.sha512 ?? docX64.sha512,
    }
    fs.writeFileSync(outMacPath, dump(mergedDoc, { lineWidth: -1 }))
    console.log('Successfully merged latest-mac.yml from x64 and arm64')
  } else if (fs.existsSync(macArmPath)) {
    const docArm = load(fs.readFileSync(macArmPath, 'utf8'))
    const zipFile = (docArm.files || []).find((f) => f.url.endsWith('.zip'))
    if (zipFile) {
      docArm.path = zipFile.url
      docArm.sha512 = zipFile.sha512
    }
    fs.writeFileSync(outMacPath, dump(docArm, { lineWidth: -1 }))
  } else if (fs.existsSync(macX64Path)) {
    const docX64 = load(fs.readFileSync(macX64Path, 'utf8'))
    const zipFile = (docX64.files || []).find((f) => f.url.endsWith('.zip'))
    if (zipFile) {
      docX64.path = zipFile.url
      docX64.sha512 = zipFile.sha512
    }
    fs.writeFileSync(outMacPath, dump(docX64, { lineWidth: -1 }))
  }

  // Copy Windows and Linux manifests with canonical legacy paths
  const winPath = path.join(
    resolvedInput,
    'release-artifacts-win32-x64',
    'latest.yml'
  )
  if (fs.existsSync(winPath)) {
    const docWin = load(fs.readFileSync(winPath, 'utf8'))
    const exeFile = (docWin.files || []).find((f) => f.url.endsWith('.exe'))
    if (exeFile) {
      docWin.path = exeFile.url
      docWin.sha512 = exeFile.sha512
    }
    fs.writeFileSync(
      path.join(resolvedOutput, 'latest.yml'),
      dump(docWin, { lineWidth: -1 })
    )
  }

  const linuxPath = path.join(
    resolvedInput,
    'release-artifacts-linux-x64',
    'latest-linux.yml'
  )
  if (fs.existsSync(linuxPath)) {
    const docLinux = load(fs.readFileSync(linuxPath, 'utf8'))
    const debFile = (docLinux.files || []).find((f) => f.url.endsWith('.deb'))
    if (debFile) {
      docLinux.path = debFile.url
      docLinux.sha512 = debFile.sha512
    }
    fs.writeFileSync(
      path.join(resolvedOutput, 'latest-linux.yml'),
      dump(docLinux, { lineWidth: -1 })
    )
  }
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', default: 'downloaded-artifacts' },
      output: { type: 'string', default: 'release' },
    },
  })

  consolidateReleaseArtifacts({
    inputDir: values.input,
    outputDir: values.output,
  })
}
