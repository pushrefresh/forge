import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// electron-vite v5 auto-detects `src/main/index.ts`, `src/preload/index.ts`,
// and the renderer root's index.html. Don't override `rollupOptions.input` —
// Rolldown (Vite 8) rejects some options the older Rollup API accepted.

// Bake build-time env into the main bundle so the packaged DMG doesn't
// depend on shell env vars that aren't inherited when launched from
// /Applications. DSN is a public write-only identifier — safe to embed.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};
const mainDefine = {
  'process.env.FORGE_SENTRY_DSN': JSON.stringify(process.env.FORGE_SENTRY_DSN ?? ''),
  'process.env.FORGE_VERSION': JSON.stringify(pkg.version),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: mainDefine,
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
});
