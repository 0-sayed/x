import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveApiBaseUrl(env: Record<string, string>): string {
  const apiPort = parsePort(env.API_PORT, 3000);
  const configuredBaseUrl = env.VITE_API_BASE_URL;
  const defaultBaseUrl = 'http://127.0.0.1:3000';

  if (configuredBaseUrl && (configuredBaseUrl !== defaultBaseUrl || apiPort === 3000)) {
    return configuredBaseUrl;
  }

  return `http://127.0.0.1:${apiPort}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminPort = parsePort(env.WEB_PORT ?? env.ADMIN_PORT, 4173);
  const apiBaseUrl = resolveApiBaseUrl(env);

  return {
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
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
