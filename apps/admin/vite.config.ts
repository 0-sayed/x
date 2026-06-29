import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminPort = parsePort(env.ADMIN_PORT, 4173);

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: adminPort,
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      port: adminPort,
      strictPort: true,
    },
  };
});
