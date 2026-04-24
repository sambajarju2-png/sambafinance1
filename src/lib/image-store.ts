'use client';

/**
 * Local image store using IndexedDB
 * Bill images stored on-device only — never uploaded to server
 * 
 * Key: bill ID (uuid)
 * Value: { blob: Blob, mimeType: string, createdAt: string }
 */

const DB_NAME = 'paywatch-images';
const DB_VERSION = 1;
const STORE_NAME = 'bill-images';

interface StoredImage {
  billId: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'billId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save an image for a bill
 */
export async function saveImage(billId: string, file: File | Blob): Promise<string> {
  const db = await openDB();
  const blob = file instanceof File ? new Blob([await file.arrayBuffer()], { type: file.type }) : file;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredImage = {
      billId,
      blob,
      mimeType: blob.type || 'image/jpeg',
      createdAt: new Date().toISOString(),
    };

    const request = store.put(record);
    request.onsuccess = () => {
      // Return an object URL for immediate preview
      const url = URL.createObjectURL(blob);
      resolve(url);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load an image for a bill — returns object URL or null
 */
export async function loadImage(billId: string): Promise<string | null> {
  try {
    const db = await openDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(billId);

      request.onsuccess = () => {
        const record = request.result as StoredImage | undefined;
        if (record?.blob) {
          resolve(URL.createObjectURL(record.blob));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete an image for a bill
 */
export async function deleteImage(billId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(billId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if an image exists for a bill
 */
export async function hasImage(billId: string): Promise<boolean> {
  try {
    const db = await openDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count(IDBKeyRange.only(billId));

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Revoke an object URL when done viewing (prevents memory leaks)
 */
export function revokeImageUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
