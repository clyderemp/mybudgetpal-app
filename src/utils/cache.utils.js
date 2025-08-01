class CacheUtils {
  constructor(dbName = "AppCacheDB", storeName = "cacheStore") {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  async _initDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async save(key, value) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => {
        console.error("Failed to save to IndexedDB:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  async get(key) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = (e) => {
        console.error("Failed to get from IndexedDB:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  async remove(key) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => {
        console.error("Failed to remove from IndexedDB:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  async clear() {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => {
        console.error("Failed to clear IndexedDB:", e.target.error);
        reject(e.target.error);
      };
    });
  }
}

export const useCacheUtils = new CacheUtils();
