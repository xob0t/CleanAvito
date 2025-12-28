import { exportAll, clearAll, importAll, getAllUsers, getAllOffers } from '../core/db.js';
import { setBlacklistUsers, setBlacklistOffers, isPaginationEnabled, setPaginationEnabled } from '../core/state.js';
import { checkPaginationVisibility } from '../desktop/pagination.js';
import { exportToPastebin, importFromPastebin } from '../core/sync.js';

const isMobile = window.location.hostname === 'm.avito.ru';

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
  const newState = !isPaginationEnabled();
  setPaginationEnabled(newState);
  alert(`Авто-пагинация ${newState ? 'включена' : 'выключена'}`);
  if (newState && !isMobile) {
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

async function exportToPastebinUI() {
  try {
    const url = await exportToPastebin();

    // Copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      alert(`База экспортирована в Pastebin!\n\nURL скопирован в буфер обмена:\n${url}\n\nИспользуйте этот URL для импорта на другом устройстве.`);
    } catch (clipboardError) {
      // Fallback if clipboard API fails
      prompt('База экспортирована! Скопируйте этот URL:', url);
    }

    console.log(`${LOG_PREFIX} Pastebin export successful: ${url}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error exporting to pastebin:`, error);
    alert('Ошибка экспорта в Pastebin: ' + error.message);
  }
}

async function importFromPastebinUI() {
  const url = prompt('Введите URL из Pastebin:\n(например: https://dpaste.com/XXXXX)');

  if (!url) {
    return; // User cancelled
  }

  if (!url.trim()) {
    alert('URL не может быть пустым');
    return;
  }

  try {
    const stats = await importFromPastebin(url.trim());
    alert(`Импортировано из Pastebin:\n\n${stats.users} пользователей\n${stats.offers} объявлений`);
    location.reload();
  } catch (error) {
    console.error(`${LOG_PREFIX} Error importing from pastebin:`, error);
    alert(error.message);
  }
}

export function registerMenuCommands() {
  // Auto-pagination only available on desktop
  if (!isMobile) {
    GM_registerMenuCommand('Авто-пагинация вкл/выкл', togglePagination);
  }
  GM_registerMenuCommand('Статистика', showStats);
  GM_registerMenuCommand('Экспорт базы данных', exportDatabase);
  GM_registerMenuCommand('Импорт из файла', importFromFile);
  GM_registerMenuCommand('📤 Экспорт в Pastebin', exportToPastebinUI);
  GM_registerMenuCommand('📥 Импорт из Pastebin', importFromPastebinUI);
  GM_registerMenuCommand('Очистить базу данных', clearDatabase);
}
