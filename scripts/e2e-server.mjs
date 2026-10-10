import { createServer } from 'vite';

// Use Vite's API rather than a CLI that editor extensions may instrument.
const server = await createServer({
  configFile: 'vite.e2e.config.ts',
  server: {
    host: '127.0.0.1', port: 3100, strictPort: true,
    proxy: {
      '/api': { target: process.env.PLAYWRIGHT_API_URL || 'http://localhost:1337', changeOrigin: true },
      '/uploads': { target: process.env.PLAYWRIGHT_API_URL || 'http://localhost:1337', changeOrigin: true },
    },
  },
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:3100') },
});
await server.listen();
server.printUrls();
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
