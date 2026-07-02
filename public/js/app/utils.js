export { PASSWORD_REGEX, isStrongPassword, isValidEmail } from '/scripts/utils/validation.js';
export { debounce } from '/scripts/utils/debounce.js';

export function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function ptToPx(pt) {
  return parseFloat(pt) * 1.333;
}

export function navigateTo(url) {
  window.location.href = url;
}

// Simple IndexedDB wrapper for binary snapshots
export const Storage = {
  dbName: 'SyncroEditCache',
  storeName: 'docSnapshots',

  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async set(key, val) {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, 'readwrite');
    tx.objectStore(this.storeName).put(val, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(key) {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, 'readonly');
    const request = tx.objectStore(this.storeName).get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};
