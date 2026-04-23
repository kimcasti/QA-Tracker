import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function createManualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('@tiptap') || id.includes('/prosemirror-') || id.includes('/orderedmap')) {
    return 'tiptap-vendor';
  }

  if (
    id.includes('/antd/') ||
    id.includes('@ant-design') ||
    id.includes('/rc-') ||
    id.includes('/@rc-component/')
  ) {
    return 'antd-vendor';
  }

  if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/internmap/')) {
    return 'charts-vendor';
  }

  if (
    id.includes('/jspdf/') ||
    id.includes('/html2canvas/') ||
    id.includes('/docx/') ||
    id.includes('/file-saver/')
  ) {
    return 'export-vendor';
  }

  if (id.includes('@google/genai')) {
    return 'ai-vendor';
  }

  if (id.includes('/dayjs/')) {
    return 'date-vendor';
  }

  if (id.includes('/lucide-react/') || id.includes('/motion/') || id.includes('/swapy/')) {
    return 'ui-vendor';
  }

  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/scheduler/') ||
    id.includes('/react-router-dom/')
  ) {
    return 'react-vendor';
  }

  if (id.includes('@tanstack/react-query') || id.includes('/axios/')) {
    return 'data-vendor';
  }

  if (id.includes('/i18next/') || id.includes('/react-i18next/')) {
    return 'i18n-vendor';
  }

  return 'vendor';
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: createManualChunks,
        },
      },
    },
  };
});
