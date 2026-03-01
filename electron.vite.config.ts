import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': '/electron',
        '@shared': '/shared'
      }
    },
    build: {
      lib: {
        entry: 'electron/main.ts'
      },
      outDir: 'out/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': '/shared'
      }
    },
    build: {
      lib: {
        entry: 'electron/preload.ts'
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js'
        }
      },
      outDir: 'out/preload'
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': '/src',
        '@shared': '/shared'
      }
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: 'index.html'
      }
    }
  }
});
