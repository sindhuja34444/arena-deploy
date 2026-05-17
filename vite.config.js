import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  envDir: '..',
  appType: 'mpa',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'src/index.html'),
        menu:    resolve(__dirname, 'src/menu/index.html'),
        lobby:   resolve(__dirname, 'src/lobby/index.html'),
        bots:    resolve(__dirname, 'src/bots/index.html'),
        pvp:     resolve(__dirname, 'src/pvp/index.html'),
        multiplayer: resolve(__dirname, 'src/multiplayer/index.html'),
      },
    },
  },
  server: { port: 5173, open: '/' },
});
