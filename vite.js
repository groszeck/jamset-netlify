const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), svgr()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@assets': path.resolve(__dirname, 'src/assets')
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE)
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT) || 3000,
      strictPort: true,
      open: mode === 'development',
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:8888',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/api/, '')
        },
        '/.netlify/functions': {
          target: env.VITE_API_BASE || 'http://localhost:8888',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/\.netlify\/functions/, '')
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            if (/\.(gif|jpe?g|png|svg)$/.test(name || '')) {
              return 'assets/images/[name]-[hash][extname]'
            }
            if (/\.(woff2?|eot|ttf|otf)$/.test(name || '')) {
              return 'assets/fonts/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          }
        }
      }
    }
  }
})