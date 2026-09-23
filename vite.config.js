import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        staff: resolve(process.cwd(),'index.html'),
        customer: resolve(process.cwd(),'customer/index.html')
      }
    }
  }
})
