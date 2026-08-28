import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // Backt die Proxy-Adresse zur Build-Zeit fest in die App ein (siehe
    // metadata-proxy/README.md) — so brauchen Freunde, die den Installer
    // herunterladen, keinen eigenen SteamGridDB-Key.
    define: {
      'process.env.METADATA_PROXY_URL': JSON.stringify(process.env.METADATA_PROXY_URL ?? '')
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
