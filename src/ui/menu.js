import { exportAll, clearAll, importAll, getAllUsers, getAllOffers } from '../core/db.js';
import { setBlacklistUsers, setBlacklistOffers, isPaginationEnabled, setPaginationEnabled } from '../core/state.js';
import { checkPaginationVisibility } from '../features/pagination.js';

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
    alert('База данных экспортирована!');
  } catch (error) {
    console.error(`${LOG_PREFIX} Error exporting database:`, error);
    alert('Ошибка экспорта: ' + error.message);
  }
}

async function processImport(jsonText) {
  try {
    const data = JSON.parse(jsonText);

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
    console.log(`${LOG_PREFIX} Database imported: ${usersCount} users, ${offersCount} offers`);
    alert(`Импортировано: ${usersCount} пользователей, ${offersCount} объявлений`);
    location.reload();
  } catch (error) {
    console.error(`${LOG_PREFIX} Error importing database:`, error);
    alert('Ошибка импорта: ' + error.message);
  }
}

async function importFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      await processImport(event.target.result);
    };
    reader.onerror = () => {
      alert('Ошибка чтения файла');
    };
    reader.readAsText(file);
  };

  input.click();
}

async function showStats() {
  try {
    const users = await getAllUsers();
    const offers = await getAllOffers();
    alert(`Статистика базы данных:\n\nПользователей в ЧС: ${users.length}\nОбъявлений в ЧС: ${offers.length}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting stats:`, error);
    alert('Ошибка получения статистики: ' + error.message);
  }
}

function togglePagination() {
  const newState = !isPaginationEnabled;
  setPaginationEnabled(newState);
  console.log(`${LOG_PREFIX} Auto-pagination ${newState ? 'enabled' : 'disabled'}`);
  alert(`Авто-пагинация ${newState ? 'включена' : 'выключена'}`);
  if (newState) {
    checkPaginationVisibility();
  }
}

async function clearDatabase() {
  if (confirm('База данных будет очищена, вы уверены?')) {
    try {
      await clearAll();
      setBlacklistUsers([]);
      setBlacklistOffers([]);
      console.log(`${LOG_PREFIX} Database cleared`);
      alert('База данных очищена!');
      location.reload();
    } catch (error) {
      console.error(`${LOG_PREFIX} Error clearing database:`, error);
      alert('Ошибка очистки: ' + error.message);
    }
  }
}

export function registerMenuCommands() {
  GM_registerMenuCommand('Авто-пагинация вкл/выкл', togglePagination);
  GM_registerMenuCommand('Статистика', showStats);
  GM_registerMenuCommand('Экспорт базы данных', exportDatabase);
  GM_registerMenuCommand('Импорт из файла', importFromFile);
  GM_registerMenuCommand('Очистить базу данных', clearDatabase);
}
