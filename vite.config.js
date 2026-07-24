import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
