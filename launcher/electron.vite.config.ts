import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // Die Proxy-Adresse steht fest in src/main/config.ts — hier wird sie nur
    // noch ersetzt, WENN beim Bauen bewusst eine Umgebungsvariable gesetzt
    // wurde. Früher wurde sie immer durch einen leeren Text ersetzt; wer die
    // Variable vergaß, lieferte damit eine App ohne Cover-Dienst aus, ohne es
    // zu merken (genau das ist bei v1.30.1 passiert).
    // Die Discord-Anwendungs-Id bleibt rein optional — ohne sie ist die
    // Funktion einfach inaktiv (siehe discordPresence.ts).
    define: {
      ...(process.env.METADATA_PROXY_URL !== undefined
        ? { 'process.env.METADATA_PROXY_URL': JSON.stringify(process.env.METADATA_PROXY_URL) }
        : {}),
      'process.env.DISCORD_CLIENT_ID': JSON.stringify(process.env.DISCORD_CLIENT_ID ?? '')
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
