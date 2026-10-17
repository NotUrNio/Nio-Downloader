import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig(({ command }) => ({
  // Electron file:// + asar needs relative asset paths; the default
  // '/' resolves to the filesystem root, not inside the asar.
  base: './',
  plugins: [tailwindcss()],
  define: {
    __NIO_TARGET__: JSON.stringify('electron'),
    __NIO_PREVIEW_MAC_MENU__: JSON.stringify(
      command === 'serve' && process.env.NIO_PREVIEW_MAC_MENU === '1'
    ),
    __NIO_APP_METADATA__: JSON.stringify({
      name: packageJson.productName,
      version: packageJson.version,
      author:
        typeof packageJson.author === 'string'
          ? { name: packageJson.author, email: '' }
          : packageJson.author,
      license: packageJson.license,
    }),
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@renderer': path.resolve(import.meta.dirname, 'src/renderer'),
      path: path.resolve(
        import.meta.dirname,
        'src/renderer/lib/path-browser-shim.ts'
      ),
    },
  },
}))
