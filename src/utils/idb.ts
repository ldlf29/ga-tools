export const setInDB = async (key: string, val: unknown): Promise<void> => {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('ga-cache', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('cache')) {
        req.result.createObjectStore('cache');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      store.put(val, key);
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
};

export const getFromDB = async (key: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('ga-cache', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('cache')) {
        req.result.createObjectStore('cache');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) {
        return resolve(null);
      }
      const tx = db.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    };
    req.onerror = () => reject(req.error);
  });
};
