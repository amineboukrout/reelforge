// Reelforge desktop shell.
// Runs the same zero-dependency server as the self-hosted build on 127.0.0.1
// and loads it in a window. The Muapi API key is encrypted with the OS
// keychain (Electron safeStorage) and stored in the app's userData folder.

import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from 'electron';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const DEV = process.argv.includes('--dev');
// A fixed port keeps the page origin stable so IndexedDB history survives restarts.
const PORTS = [47821, 47822, 47823, 47824];

const keyFile = () => join(app.getPath('userData'), 'muapi-key.bin');

ipcMain.handle('keystore:get', async () => {
  try {
    const buf = await readFile(keyFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
  } catch {
    return '';
  }
});
ipcMain.handle('keystore:set', async (_e, key) => {
  if (typeof key !== 'string' || key.length > 512) throw new Error('Invalid key');
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key, 'utf8');
  await writeFile(keyFile(), data, { mode: 0o600 });
});
ipcMain.handle('keystore:clear', async () => rm(keyFile(), { force: true }));
ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
});

async function listen() {
  for (const port of PORTS) {
    try {
      const server = await startServer({ port, host: '127.0.0.1', distDir: join(here, '..', 'dist') });
      return server.address().port;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw new Error('No free port for the Reelforge server');
}

async function createWindow() {
  const url = DEV ? 'http://localhost:5173' : `http://127.0.0.1:${await listen()}`;
  const origin = new URL(url).origin;

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#08080b',
    title: 'Reelforge',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Microphone for audio recording in Lip Sync; deny everything else.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === 'media' && wc.getURL().startsWith(origin));
  });

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https:\/\//.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, target) => {
    if (!target.startsWith(origin)) {
      e.preventDefault();
      if (/^https:\/\//.test(target)) shell.openExternal(target);
    }
  });

  win.once('ready-to-show', () => win.show());
  await win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
