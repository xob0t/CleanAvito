import { exportAll, clearAll, importAll, getAllUsers, getAllOffers } from '../core/db.js';
import {
  setBlacklistUsers,
  setBlacklistOffers,
  isPaginationEnabled,
  setPaginationEnabled,
  getPublishedListId,
  getPublishedEditCode,
  getSubscriptions,
  removeSubscription,
  toggleSubscription
} from '../core/state.js';
import { checkPaginationVisibility } from '../desktop/pagination.js';
import {
  publishToSupabase,
  syncSubscriptions,
  subscribeToList,
  importEditableList
} from '../core/sync.js';
import { forceSyncNow } from '../core/periodic-sync.js';
import { fetchList } from '../core/supabase.js';

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

// ==================== Supabase UI Functions ====================

async function publishToSupabaseUI() {
  try {
    const existingId = getPublishedListId();
    const existingEditCode = getPublishedEditCode();

    let name, description;

    if (existingId) {
      // Already enabled
      alert(
        'Синхронизация уже включена!\n\n' +
        'Для подключения другого устройства используйте:\n' +
        '"☁️ Получить данные для синхронизации"'
      );
      return;
    }

    // Creating new list
    name = prompt('Включение синхронизации\n\nВведите название списка:', 'Мой черный список');
    if (!name) return; // User cancelled

    description = prompt('Описание (необязательно):') || '';

    const result = await publishToSupabase(name, description);

    alert(
      `✅ Синхронизация включена!\n\n` +
      `Изменения будут автоматически синхронизироваться между устройствами.\n\n` +
      `Для подключения другого устройства используйте:\n` +
      `"☁️ Получить данные для синхронизации"`
    );

    console.log(`${LOG_PREFIX} Published to Supabase: ${result.id}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error publishing to Supabase:`, error);
    alert('Ошибка публикации: ' + error.message);
  }
}

async function showCredentialsUI() {
  const listId = getPublishedListId();
  const editCode = getPublishedEditCode();

  if (!listId || !editCode) {
    alert('Синхронизация не включена.\n\nИспользуйте "☁️ Включить синхронизацию" для настройки.');
    return;
  }

  // Export as JSON for easy copy/paste
  const credentialsJSON = JSON.stringify({ listId, editCode });

  try {
    await navigator.clipboard.writeText(credentialsJSON);
    alert(
      `✅ Данные для синхронизации скопированы!\n\n` +
      `Для подключения другого устройства:\n` +
      `1. Откройте меню на другом устройстве\n` +
      `2. Выберите "☁️ Подключить синхронизацию"\n` +
      `3. Вставьте эти данные из буфера обмена`
    );
  } catch (clipboardError) {
    prompt('Скопируйте данные для синхронизации:', credentialsJSON);
  }
}

async function importEditableListUI() {
  const input = prompt(
    'Подключение синхронизации\n\n' +
    'Вставьте данные из буфера обмена:\n' +
    '{"listId":"...","editCode":"..."}\n\n' +
    'Получить данные можно на другом устройстве:\n' +
    '"☁️ Получить данные для синхронизации"'
  );

  if (!input || !input.trim()) return;

  let listId, editCode;

  // Parse JSON credentials
  try {
    const parsed = JSON.parse(input.trim());
    if (!parsed.listId || !parsed.editCode) {
      throw new Error('JSON должен содержать listId и editCode');
    }
    listId = parsed.listId;
    editCode = parsed.editCode;
  } catch (e) {
    alert(`Ошибка формата JSON:\n\n${e.message}\n\nОжидается: {"listId":"...","editCode":"..."}`);
    return;
  }

  try {
    const result = await importEditableList(listId, editCode);

    alert(
      `✅ Синхронизация подключена!\n\n` +
      `📋 Список: ${result.name}\n` +
      `👥 Пользователей: ${result.users}\n` +
      `📦 Объявлений: ${result.offers}\n\n` +
      `Изменения автоматически синхронизируются между устройствами.`
    );

    // Sync immediately
    await forceSyncNow();
    location.reload();
  } catch (error) {
    console.error(`${LOG_PREFIX} Error importing editable list:`, error);
    alert('Ошибка подключения: ' + error.message);
  }
}

async function subscribeToListUI() {
  const listId = prompt(
    'Введите List ID для подписки:\n\n' +
    'Это read-only подписка.\n' +
    'Вы будете получать обновления, но не сможете редактировать список.'
  );

  if (!listId || !listId.trim()) return;

  try {
    const result = await subscribeToList(listId.trim());

    alert(
      `✅ Подписка добавлена!\n\n` +
      `📋 Название: ${result.name}\n` +
      `📝 Описание: ${result.description}\n` +
      `👥 Пользователей: ${result.users}\n` +
      `📦 Объявлений: ${result.offers}`
    );

    // Sync immediately
    await forceSyncNow();
    location.reload();
  } catch (error) {
    console.error(`${LOG_PREFIX} Error subscribing to list:`, error);
    alert('Ошибка подписки: ' + error.message);
  }
}

async function manageSubscriptionsUI() {
  const subs = getSubscriptions();

  if (subs.length === 0) {
    alert('У вас нет подписок.\n\nИспользуйте "📥 Добавить подписку" для добавления списков.');
    return;
  }

  let message = '📋 Управление подписками:\n\n';

  subs.forEach((sub, index) => {
    const status = sub.enabled ? '✓' : '✗';
    const lastSynced = sub.lastSynced
      ? new Date(sub.lastSynced).toLocaleString('ru-RU')
      : 'Никогда';

    message += `${index + 1}. [${status}] ${sub.name}\n`;
    message += `   ID: ${sub.id.substring(0, 8)}...\n`;
    message += `   Синхронизировано: ${lastSynced}\n\n`;
  });

  message += '\nДействия:\n';
  message += '• Введите номер (1-9) для вкл/выкл\n';
  message += '• Введите D1-D9 для удаления\n';
  message += '• Нажмите Cancel для выхода';

  const action = prompt(message);

  if (!action) return;

  const actionTrimmed = action.trim().toUpperCase();

  // Delete action (D1, D2, etc.)
  if (actionTrimmed.startsWith('D')) {
    const numStr = actionTrimmed.substring(1);
    const num = parseInt(numStr);

    if (num >= 1 && num <= subs.length) {
      const sub = subs[num - 1];
      if (confirm(`Удалить подписку "${sub.name}"?`)) {
        removeSubscription(sub.id);
        alert('Подписка удалена!');
        await forceSyncNow();
        location.reload();
      }
    } else {
      alert('Неверный номер');
    }
    return;
  }

  // Toggle action (1, 2, etc.)
  const num = parseInt(actionTrimmed);
  if (num >= 1 && num <= subs.length) {
    const sub = subs[num - 1];
    toggleSubscription(sub.id);
    alert(`Подписка "${sub.name}" ${sub.enabled ? 'отключена' : 'включена'}!`);
    await forceSyncNow();
    location.reload();
  } else {
    alert('Неверный ввод');
  }
}

async function forceSyncUI() {
  try {
    alert('Синхронизация начата...');

    const result = await forceSyncNow();

    alert(
      `✅ Синхронизация завершена!\n\n` +
      `👥 Пользователей: ${result.users}\n` +
      `📦 Объявлений: ${result.offers}`
    );

    location.reload();
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during force sync:`, error);
    alert('Ошибка синхронизации: ' + error.message);
  }
}

async function debugSyncStateUI() {
  try {
    console.log('=== AVE SYNC DEBUG STATE ===');

    // Local DB state
    const localUsers = await getAllUsers();
    const localOffers = await getAllOffers();
    console.log('📦 LOCAL DB:');
    console.log(`  Users: ${localUsers.length}`, localUsers);
    console.log(`  Offers: ${localOffers.length}`, localOffers);

    // Published list credentials
    const publishedId = getPublishedListId();
    const publishedEditCode = getPublishedEditCode();
    console.log('\n📤 PUBLISHED LIST:');
    if (publishedId && publishedEditCode) {
      console.log(`  List ID: ${publishedId}`);
      console.log(`  Edit Code: ${publishedEditCode}`);

      // Fetch remote state
      try {
        const remoteList = await fetchList(publishedId);
        console.log('\n☁️ REMOTE STATE (Published List):');
        console.log(`  Name: ${remoteList.name}`);
        console.log(`  Description: ${remoteList.description}`);
        console.log(`  Users: ${remoteList.users.length}`, remoteList.users);
        console.log(`  Offers: ${remoteList.offers.length}`, remoteList.offers);
        console.log(`  Created: ${remoteList.created_at}`);
        console.log(`  Updated: ${remoteList.updated_at}`);
      } catch (error) {
        console.error('  ❌ Failed to fetch remote list:', error.message);
      }
    } else {
      console.log('  Not published');
    }

    // Subscriptions
    const subs = getSubscriptions();
    console.log('\n📥 SUBSCRIPTIONS:');
    if (subs.length > 0) {
      for (const sub of subs) {
        console.log(`\n  ${sub.enabled ? '✓' : '✗'} ${sub.name}`);
        console.log(`    ID: ${sub.id}`);
        console.log(`    Last Synced: ${sub.lastSynced ? new Date(sub.lastSynced).toLocaleString() : 'Never'}`);

        // Fetch remote subscription state
        try {
          const remoteList = await fetchList(sub.id);
          console.log(`    Remote Users: ${remoteList.users.length}`);
          console.log(`    Remote Offers: ${remoteList.offers.length}`);
          console.log(`    Remote Updated: ${remoteList.updated_at}`);
        } catch (error) {
          console.error(`    ❌ Failed to fetch: ${error.message}`);
        }
      }
    } else {
      console.log('  No subscriptions');
    }

    console.log('\n=== END DEBUG STATE ===');

    alert(
      `🐛 Debug info logged to console!\n\n` +
      `Open browser console (F12) to view detailed state.\n\n` +
      `📦 Local DB: ${localUsers.length} users, ${localOffers.length} offers\n` +
      `📤 Published: ${publishedId ? 'Yes' : 'No'}\n` +
      `📥 Subscriptions: ${subs.length}`
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Debug error:`, error);
    alert('Ошибка отладки: ' + error.message);
  }
}

export function registerMenuCommands() {
  // Auto-pagination only available on desktop
  if (!isMobile) {
    GM_registerMenuCommand('Авто-пагинация вкл/выкл', togglePagination);
  }

  GM_registerMenuCommand('Статистика', showStats);

  // Supabase Sync commands
  GM_registerMenuCommand('☁️ Включить синхронизацию', publishToSupabaseUI);
  GM_registerMenuCommand('☁️ Получить данные для синхронизации', showCredentialsUI);
  GM_registerMenuCommand('☁️ Подключить синхронизацию', importEditableListUI);
  GM_registerMenuCommand('📥 Добавить подписку', subscribeToListUI);
  GM_registerMenuCommand('📋 Управление подписками', manageSubscriptionsUI);
  GM_registerMenuCommand('🔄 Принудительная синхронизация', forceSyncUI);
  GM_registerMenuCommand('🐛 Debug: Log Sync State', debugSyncStateUI);

  // Local data commands
  GM_registerMenuCommand('Экспорт в файл JSON', exportDatabase);
  GM_registerMenuCommand('Импорт из файла', importFromFile);
  GM_registerMenuCommand('Очистить базу данных', clearDatabase);
}
