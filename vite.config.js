import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    cors: true,
    watch: {
      ignored: ['**/public/sequence/**', '**/archive/**', '**/temp_png/**', '**/moodboard/**', '**/*.zip'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    cors: true,
  },
})

