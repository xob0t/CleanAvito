import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  outDir: '.output',
  alias: {
    '@': '.',
  },
  manifest: {
    name: 'AVE script',
    description: 'Block unwanted sellers and listings on Avito',
    permissions: ['storage'],
    host_permissions: ['*://www.avito.ru/*', '*://m.avito.ru/*'],
    icons: {
      16: '/icon.svg',
      32: '/icon.svg',
      48: '/icon.svg',
      128: '/icon.svg',
    },
    action: {
      default_title: 'AVE Script',
      default_popup: 'popup/index.html',
    },
    web_accessible_resources: [
      {
        resources: ['/injected.js'],
        matches: ['*://m.avito.ru/*'],
      },
    ],
  },
});
