import { mergeConfig } from 'vite';
import baseConfig from './vite.config';

// Keep browser tests independent of an already-running developer server.
export default mergeConfig(baseConfig, {
  cacheDir: 'node_modules/.vite-e2e',
  optimizeDeps: { force: true },
});
