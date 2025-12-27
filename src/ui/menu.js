import { exportAll, clearAll } from '../core/db.js';
import { setBlacklistUsers, setBlacklistOffers } from '../core/state.js';

const LOG_PREFIX = '[ave]';

async function exportDatabase() {
  try {
    const data = await exportAll();
    const serializedData = JSON.stringify(data, null, 2);
    const blob = new Blob([serializedData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'avito_blacklist_database.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`${LOG_PREFIX} Database exported successfully`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error exporting database:`, error);
  }
}

async function clearDatabase() {
  if (confirm('База данных будет очищена, вы уверены?')) {
    try {
      await clearAll();
      setBlacklistUsers([]);
      setBlacklistOffers([]);
      console.log(`${LOG_PREFIX} Database cleared`);
      location.reload();
    } catch (error) {
      console.error(`${LOG_PREFIX} Error clearing database:`, error);
    }
  }
}

export function registerMenuCommands() {
  GM_registerMenuCommand('Export Database', exportDatabase);
  GM_registerMenuCommand('Clear Database', clearDatabase);
}
