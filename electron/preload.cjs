// Minimal, explicit bridge. The page never gets Node access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reelforge', {
  isDesktop: true,
  keystore: {
    get: () => ipcRenderer.invoke('keystore:get'),
    set: (key) => ipcRenderer.invoke('keystore:set', key),
    clear: () => ipcRenderer.invoke('keystore:clear'),
  },
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
