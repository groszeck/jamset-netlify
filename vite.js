const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_URL || '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: [
      react(),
      svgr(),
      checker({ typescript: true })
    ],
    server: {
      port: env.VITE_PORT ? parseInt(env.VITE_PORT, 10) : 3000,
      strictPort: true,
      open: true,
      proxy: {
        '/.netlify/functions': {
          target: env.VITE_NETLIFY_DEV_URL || 'http://localhost:8888',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/\.netlify\/functions/, '')
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html')
      }
    },
    define: {
      __APP_ENV__: JSON.stringify(mode)
    }
  }
})