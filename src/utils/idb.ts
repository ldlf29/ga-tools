export const setInDB = async (key: string, val: any): Promise<void> => {
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
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
};

export const getFromDB = async (key: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('ga-cache', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('cache')) {
        req.result.createObjectStore('cache');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Safety check: if somehow it upgraded and there's no data yet, tx will still succeed
      const tx = db.transaction('cache', 'readonly');
      const store = tx.objectStore('cache');
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result);
      };
      getReq.onerror = () => reject(getReq.error);
    };
    req.onerror = () => reject(req.error);
  });
};
