import type { ForgeApi } from '../../preload';

declare global {
  interface Window {
    forge: ForgeApi;
  }
}

export const ipc = () => window.forge;
