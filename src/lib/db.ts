// Minimal IndexedDB wrapper. Generation history and uploads (including the
// original file blobs) live entirely on the user's machine.

import type { Generation, UploadRecord } from './types';

const DB_NAME = 'reelforge';
const DB_VERSION = 1;
type StoreName = 'generations' | 'uploads';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('generations')) {
        db.createObjectStore('generations', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('uploads')) {
        db.createObjectStore('uploads', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

async function all<T>(store: StoreName): Promise<T[]> {
  const rows = await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  return rows.sort((a: any, b: any) => b.createdAt - a.createdAt);
}

export const db = {
  generations: {
    all: () => all<Generation>('generations'),
    put: (g: Generation) => tx('generations', 'readwrite', (s) => s.put(g)),
    delete: (id: string) => tx('generations', 'readwrite', (s) => s.delete(id)),
    clear: () => tx('generations', 'readwrite', (s) => s.clear()),
  },
  uploads: {
    all: () => all<UploadRecord>('uploads'),
    get: (id: string) => tx<UploadRecord | undefined>('uploads', 'readonly', (s) => s.get(id)),
    put: (u: UploadRecord) => tx('uploads', 'readwrite', (s) => s.put(u)),
    delete: (id: string) => tx('uploads', 'readwrite', (s) => s.delete(id)),
    clear: () => tx('uploads', 'readwrite', (s) => s.clear()),
  },
};
