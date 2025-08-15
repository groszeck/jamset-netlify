const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    root: process.cwd(),
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      svgr(),
      mkcert()
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        '@components': path.resolve(process.cwd(), 'src/components'),
        '@api': path.resolve(process.cwd(), 'src/api'),
        '@styles': path.resolve(process.cwd(), 'src/styles'),
        '@utils': path.resolve(process.cwd(), 'src/utils'),
        '@types': path.resolve(process.cwd(), 'src/types'),
        '@functions': path.resolve(process.cwd(), 'netlify/functions')
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    server: {
      host: true,
      port: Number(env.PORT) || 3000,
      strictPort: true,
      open: true,
      fs: { strict: false }
    },
    preview: {
      host: true,
      port: Number(env.PREVIEW_PORT) || 8080
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      manifest: true,
      sourcemap: env.SOURCE_MAP === 'true',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: ({ name }) => {
            if (name?.endsWith('.css')) return 'assets/css/[name]-[hash][extname]'
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/.test(name ?? '')) return 'assets/images/[name]-[hash][extname]'
            return 'assets/[name]-[hash][extname]'
          }
        }
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/global.scss";`
        }
      }
    },
    define: {
      'import.meta.env': JSON.stringify(env)
    }
  }
})