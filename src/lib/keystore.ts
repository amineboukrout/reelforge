// API key storage. Never leaves the user's machine except as the `x-api-key`
// header on requests to Muapi (through the local proxy).
//
// - Desktop (Electron): encrypted with the OS keychain via safeStorage.
// - Browser: localStorage on this origin.

const LS_KEY = 'reelforge.apiKey';

interface DesktopBridge {
  isDesktop: true;
  keystore: { get(): Promise<string>; set(key: string): Promise<void>; clear(): Promise<void> };
  openExternal(url: string): void;
}

declare global {
  interface Window {
    reelforge?: DesktopBridge;
  }
}

export const isDesktop = () => !!window.reelforge?.isDesktop;

export const keystore = {
  async get(): Promise<string> {
    if (window.reelforge) return (await window.reelforge.keystore.get()) || '';
    try {
      return localStorage.getItem(LS_KEY) || '';
    } catch {
      return '';
    }
  },
  async set(key: string): Promise<void> {
    if (window.reelforge) return window.reelforge.keystore.set(key);
    localStorage.setItem(LS_KEY, key);
  },
  async clear(): Promise<void> {
    if (window.reelforge) return window.reelforge.keystore.clear();
    localStorage.removeItem(LS_KEY);
  },
  describe(): string {
    return isDesktop()
      ? 'Encrypted with your operating system keychain on this computer.'
      : 'Stored in this browser only (localStorage). It is sent only to Muapi, through your local Reelforge server.';
  },
};
