import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5179,
      proxy: {
        '/api': {
          target: env.API_BASE || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, env.API_PREFIX || '/api'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.API_TOKEN) {
                proxyReq.setHeader('Authorization', `Token ${env.API_TOKEN}`)
              }
            })
          },
        },
      },
    },
  }
})
