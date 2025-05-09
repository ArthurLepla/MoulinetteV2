const DB_NAME = 'IIHPlaygroundDB';
const DB_VERSION = 1;
const ASSET_CACHE_STORE = 'assetCache'; // Store for ExcelRow <-> AssetId

interface DBRequest<T> extends IDBRequest<T> {}
interface DBOpenDBRequest extends IDBOpenDBRequest {}

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      console.warn('IndexedDB is not available in this environment (SSR). Operations will be no-op.');
      // Return a mock/noop DB object or reject if strict usage is needed client-side only
      // For now, let it proceed, and operations will likely fail or be no-op if db is null.
      // A more robust solution might involve a flag or a different strategy for SSR.
      return reject(new Error('IndexedDB not available.')); 
    }

    const request: DBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ASSET_CACHE_STORE)) {
        db.createObjectStore(ASSET_CACHE_STORE, { keyPath: 'excelRowKey' }); // excelRowKey will be like "row-0", "pathKey-Usine@Machine"
      }
      // Add other stores or indexes here if needed in future versions
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      dbPromise = null; // Reset promise on error so retry might be possible
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
  return dbPromise;
};

export const writeData = async (storeName: string, data: { excelRowKey: string; assetId: string; [key: string]: any }): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request: DBRequest<IDBValidKey> = store.put(data); // Using put to insert or update

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = (event: Event) => {
        console.error('Error writing data to IndexedDB:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    // This catch is mainly for initDB() rejection (e.g. SSR)
    console.warn('Could not write to IndexedDB:', error);
    return Promise.resolve(); // No-op if DB init fails
  }
};

export const readData = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request: DBRequest<T> = store.get(key);

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest<T>).result);
      };
      request.onerror = (event: Event) => {
        console.error('Error reading data from IndexedDB:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
   } catch (error) {
    console.warn('Could not read from IndexedDB:', error);
    return Promise.resolve(undefined); // No-op if DB init fails
  }
};

// Example of how you might clear a store if needed for rollback testing etc.
export const clearStore = async (storeName: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      // store.clear() returns IDBRequest<undefined> according to lib.dom.d.ts
      const request: IDBRequest<undefined> = store.clear();

      request.onsuccess = () => { // Success event has no meaningful result value for clear()
        resolve();
      };
      request.onerror = (event: Event) => {
        console.error('Error clearing IndexedDB store:', (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.warn('Could not clear IndexedDB store:', error);
    return Promise.resolve(); // No-op if DB init fails
  }
};

// Ensure constants are available if needed by other parts of the app
export { DB_NAME, ASSET_CACHE_STORE }; 