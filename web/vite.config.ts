import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'

// HTTPS opcional: si TLS_CERT_PATH y TLS_KEY_PATH apuntan a archivos
// existentes (montados desde ./certs en el contenedor), Vite sirve en
// HTTPS. Si no, queda en HTTP plano (modo dev local sin certificados).
const certPath = process.env.TLS_CERT_PATH
const keyPath = process.env.TLS_KEY_PATH
const httpsConfig =
  certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    https: httpsConfig,
  },
})
