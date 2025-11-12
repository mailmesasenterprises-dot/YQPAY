import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Optional plugins - only load if installed
let visualizer = null;
try {
  const visualizerModule = require('rollup-plugin-visualizer');
  visualizer = visualizerModule.visualizer || visualizerModule.default?.visualizer || visualizerModule.default;
} catch (e) {
  // Plugin not installed - that's okay, it's optional
}

let viteCompression = null;
try {
  viteCompression = require('vite-plugin-compression').default;
} catch (e) {
  // Plugin not installed - that's okay, it's optional
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|js)$/, // Allow both .jsx and .js files
      // Fast refresh for better DX
      fastRefresh: true,
    }),
    // Bundle visualizer (only in analyze mode and if installed)
    process.env.ANALYZE && visualizer && visualizer({
      open: true,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    // Gzip compression (if installed)
    viteCompression && viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Only compress files > 1KB
    }),
    // Brotli compression (if installed)
    viteCompression && viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
  ].filter(Boolean),
  
  // Server configuration
  server: {
    port: 3000,
    host: true, // Listen on all addresses
    // Increase max header size to handle large requests (default is 8KB)
    // This is set via Node.js --max-http-header-size flag
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // 🚀 OPTIMIZED Build configuration
  build: {
    outDir: 'dist',
    target: 'es2020', // Modern browsers support
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
    minify: 'esbuild', // Fastest minifier
    cssCodeSplit: true, // Split CSS per route
    cssMinify: true, // Minify CSS
    reportCompressedSize: true, // Report gzip sizes
    chunkSizeWarningLimit: 1500, // Warn if chunk > 1.5MB
    rollupOptions: {
      output: {
        // 🚀 OPTIMIZED Manual Chunking Strategy
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'react-router';
          }
          
          // MUI - Split into smaller chunks
          if (id.includes('node_modules/@mui/material')) {
            return 'mui-material';
          }
          if (id.includes('node_modules/@mui/icons-material')) {
            return 'mui-icons';
          }
          if (id.includes('node_modules/@emotion')) {
            return 'emotion';
          }
          
          // Large libraries
          if (id.includes('node_modules/swiper')) {
            return 'swiper';
          }
          if (id.includes('node_modules/qrcode')) {
            return 'qrcode';
          }
          if (id.includes('node_modules/jszip')) {
            return 'jszip';
          }
          if (id.includes('node_modules/react-window') || id.includes('node_modules/react-virtualized')) {
            return 'virtualization';
          }
          
          // Axios
          if (id.includes('node_modules/axios')) {
            return 'axios';
          }
          
          // Lucide React (icons)
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-icons';
          }
          
          // Other vendor libraries
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico|webp)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/${ext}/[name]-[hash][extname]`;
        },
      },
    },
  },

  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@config': path.resolve(__dirname, './src/config'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
    },
  },

  // 🚀 OPTIMIZED Dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      'axios',
      'qrcode',
      'jszip',
    ],
    exclude: [
      // Exclude large libraries that should be code-split
      'swiper',
    ],
    // Force optimization for these packages
    force: false,
  },
  
  // 🚀 Performance optimizations
  esbuild: {
    // Drop console and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    // Legal comments (licenses) - remove in production
    legalComments: process.env.NODE_ENV === 'production' ? 'none' : 'inline',
  },

  // Environment variables prefix
  envPrefix: 'VITE_',
});
