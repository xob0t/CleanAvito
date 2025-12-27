const DB_NAME = 'AveBlacklist';
const DB_VERSION = 1;
const STORE_USERS = 'users';
const STORE_OFFERS = 'offers';

let db = null;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_USERS)) {
        database.createObjectStore(STORE_USERS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_OFFERS)) {
        database.createObjectStore(STORE_OFFERS, { keyPath: 'id' });
      }
    };
  });
}

function getStore(storeName, mode = 'readonly') {
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// User operations
export async function addUser(userId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_USERS, 'readwrite');
    const request = store.put({ id: userId });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeUser(userId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_USERS, 'readwrite');
    const request = store.delete(userId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllUsers() {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_USERS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.map(item => item.id));
    request.onerror = () => reject(request.error);
  });
}

export async function hasUser(userId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_USERS);
    const request = store.get(userId);
    request.onsuccess = () => resolve(request.result !== undefined);
    request.onerror = () => reject(request.error);
  });
}

// Offer operations
export async function addOffer(offerId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_OFFERS, 'readwrite');
    const request = store.put({ id: offerId });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeOffer(offerId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_OFFERS, 'readwrite');
    const request = store.delete(offerId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllOffers() {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_OFFERS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.map(item => item.id));
    request.onerror = () => reject(request.error);
  });
}

export async function hasOffer(offerId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORE_OFFERS);
    const request = store.get(offerId);
    request.onsuccess = () => resolve(request.result !== undefined);
    request.onerror = () => reject(request.error);
  });
}

// Bulk operations
export async function clearAll() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_USERS, STORE_OFFERS], 'readwrite');
    transaction.objectStore(STORE_USERS).clear();
    transaction.objectStore(STORE_OFFERS).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function exportAll() {
  const users = await getAllUsers();
  const offers = await getAllOffers();
  return { users, offers };
}
