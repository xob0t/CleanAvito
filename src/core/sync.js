import { exportAll, importAll, getAllUsers, getAllOffers } from './db.js';
import { setBlacklistUsers, setBlacklistOffers } from './state.js';

const LOG_PREFIX = '[ave-sync]';

// Pastebin services configuration
const SERVICES = {
  dpaste: {
    name: 'dpaste.com',
    upload: async (data) => {
      const response = await fetch('https://dpaste.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          content: JSON.stringify(data, null, 2),
          syntax: 'json',
          expiry_days: 365, // 1 year expiration
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const url = await response.text();
      return url.trim();
    },
    getRawUrl: (url) => {
      // Convert dpaste.com/XXXX to dpaste.com/XXXX.txt (raw format)
      const match = url.match(/dpaste\.com\/([A-Za-z0-9]+)/);
      if (match) {
        return `https://dpaste.com/${match[1]}.txt`;
      }
      return url;
    },
  },
};

/**
 * Export database to pastebin and return the URL
 * @returns {Promise<string>} URL to the paste
 */
export async function exportToPastebin() {
  try {
    console.log(`${LOG_PREFIX} Starting export to pastebin...`);

    const data = await exportAll();
    const service = SERVICES.dpaste;

    const url = await service.upload(data);

    console.log(`${LOG_PREFIX} Export successful: ${url}`);
    return url;
  } catch (error) {
    console.error(`${LOG_PREFIX} Export error:`, error);
    throw new Error(`Не удалось экспортировать в pastebin: ${error.message}`);
  }
}

/**
 * Import database from pastebin URL
 * @param {string} url - URL to the paste
 * @returns {Promise<{users: number, offers: number}>} Import statistics
 */
export async function importFromPastebin(url) {
  try {
    console.log(`${LOG_PREFIX} Starting import from: ${url}`);

    // Try to get raw URL if it's a known service
    let fetchUrl = url;
    for (const service of Object.values(SERVICES)) {
      const rawUrl = service.getRawUrl(url);
      if (rawUrl !== url) {
        fetchUrl = rawUrl;
        break;
      }
    }

    // If user provided a raw URL already, use it
    if (url.includes('.txt') || url.includes('/raw/')) {
      fetchUrl = url;
    }

    console.log(`${LOG_PREFIX} Fetching from: ${fetchUrl}`);

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const data = JSON.parse(text);

    if (!data.users && !data.offers) {
      throw new Error('Неверный формат данных');
    }

    await importAll(data);

    // Update in-memory state
    const users = await getAllUsers();
    const offers = await getAllOffers();
    setBlacklistUsers(users);
    setBlacklistOffers(offers);

    const usersCount = data.users?.length || 0;
    const offersCount = data.offers?.length || 0;

    console.log(`${LOG_PREFIX} Import successful: ${usersCount} users, ${offersCount} offers`);

    return { users: usersCount, offers: offersCount };
  } catch (error) {
    console.error(`${LOG_PREFIX} Import error:`, error);
    throw new Error(`Ошибка импорта: ${error.message}`);
  }
}
