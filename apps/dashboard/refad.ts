// vite.config.ts
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // ⚠️ point at the CJS output, not the TS sources:
      '@elearning/schemas': path.resolve(__dirname, '../../packages/schemas/src/index.js'),
      '@elearning/types':   path.resolve(__dirname, '../../packages/types/src/index.js'),
      '@elearning/lib':     path.resolve(__dirname, '../../packages/lib/src/index.js'),
      '@elearning/models':  path.resolve(__dirname, '../../packages/models/src/index.js'),
    },
  },

  server: {
    port: 3001,
  },

  build: {
    commonjsOptions: {
      include: [
        /node_modules/,
        /packages\/schemas\/dist\/index\.js$/,
        /packages\/types\/dist\/index\.js$/,
        /packages\/lib\/dist\/index\.js$/,
        /packages\/models\/dist\/index\.js$/,
        /packages\/mailer\/dist\/index\.js$/,
      ],
      transformMixedEsModules: true,
    },
  },
})