/**
 * Popup script for AVE Script browser extension
 */

import { storage } from 'wxt/storage';

// Storage items (must match utils/storage.ts)
const paginationEnabled = storage.defineItem<boolean>('local:paginationEnabled', { fallback: false });
const publishedListId = storage.defineItem<string | null>('local:publishedListId', { fallback: null });
const publishedEditCode = storage.defineItem<string | null>('local:publishedEditCode', { fallback: null });

interface Subscription {
  id: string;
  name: string;
  enabled: boolean;
  lastSynced: number | null;
}

const subscriptions = storage.defineItem<Subscription[]>('local:subscriptions', { fallback: [] });

// Helper to send message to content script
async function sendToContentScript(action: string, data?: unknown): Promise<unknown> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  return browser.tabs.sendMessage(tab.id, { action, data });
}

// Load and display stats
async function loadStats(): Promise<void> {
  try {
    // Get stats from content script via message
    const result = await sendToContentScript('getStats') as { users: number; offers: number } | null;

    if (result) {
      document.getElementById('stat-users')!.textContent = String(result.users);
      document.getElementById('stat-offers')!.textContent = String(result.offers);
    }
  } catch {
    // Content script might not be loaded, show placeholders
    document.getElementById('stat-users')!.textContent = '-';
    document.getElementById('stat-offers')!.textContent = '-';
  }

  // Get subscriptions count
  const subs = await subscriptions.getValue();
  document.getElementById('stat-subs')!.textContent = String(subs.length);
  document.getElementById('badge-subs')!.textContent = String(subs.length);
}

// Initialize pagination toggle
async function initPaginationToggle(): Promise<void> {
  const toggle = document.getElementById('toggle-pagination')!;
  const enabled = await paginationEnabled.getValue();

  if (enabled) {
    toggle.classList.add('active');
  }

  document.getElementById('btn-pagination')!.addEventListener('click', async () => {
    const current = await paginationEnabled.getValue();
    await paginationEnabled.setValue(!current);
    toggle.classList.toggle('active');

    // Notify content script
    try {
      await sendToContentScript('togglePagination', !current);
    } catch {
      // Content script might not be available
    }
  });
}

// Setup menu button handlers
function setupMenuHandlers(): void {
  // Enable sync
  document.getElementById('btn-enable-sync')!.addEventListener('click', async () => {
    const existingId = await publishedListId.getValue();

    if (existingId) {
      alert(
        'Синхронизация уже включена!\n\n' +
        'Для подключения другого устройства используйте:\n' +
        '"Получить данные синхронизации"'
      );
      return;
    }

    const name = prompt('Включение синхронизации\n\nВведите название списка:', 'Мой черный список');
    if (!name) return;

    const description = prompt('Описание (необязательно):') || '';

    try {
      const result = await sendToContentScript('publishToSupabase', { name, description }) as { id: string };
      alert(
        `✅ Синхронизация включена!\n\n` +
        `Изменения будут автоматически синхронизироваться между устройствами.\n\n` +
        `Для подключения другого устройства используйте:\n` +
        `"Получить данные синхронизации"`
      );
      console.log('Published to Supabase:', result.id);
    } catch (error) {
      alert('Ошибка публикации: ' + (error as Error).message);
    }
  });

  // Get sync data
  document.getElementById('btn-get-sync-data')!.addEventListener('click', async () => {
    const listId = await publishedListId.getValue();
    const editCode = await publishedEditCode.getValue();

    if (!listId || !editCode) {
      alert('Синхронизация не включена.\n\nИспользуйте "Включить синхронизацию" для настройки.');
      return;
    }

    const credentialsJSON = JSON.stringify({ listId, editCode });

    try {
      await navigator.clipboard.writeText(credentialsJSON);
      alert(
        `✅ Данные для синхронизации скопированы!\n\n` +
        `Для подключения другого устройства:\n` +
        `1. Откройте меню на другом устройстве\n` +
        `2. Выберите "Подключить синхронизацию"\n` +
        `3. Вставьте эти данные из буфера обмена`
      );
    } catch {
      prompt('Скопируйте данные для синхронизации:', credentialsJSON);
    }
  });

  // Connect sync
  document.getElementById('btn-connect-sync')!.addEventListener('click', async () => {
    const input = prompt(
      'Подключение синхронизации\n\n' +
      'Вставьте данные из буфера обмена:\n' +
      '{"listId":"...","editCode":"..."}\n\n' +
      'Получить данные можно на другом устройстве:\n' +
      '"Получить данные синхронизации"'
    );

    if (!input || !input.trim()) return;

    let listId: string, editCode: string;

    try {
      const parsed = JSON.parse(input.trim()) as { listId?: string; editCode?: string };
      if (!parsed.listId || !parsed.editCode) {
        throw new Error('JSON должен содержать listId и editCode');
      }
      listId = parsed.listId;
      editCode = parsed.editCode;
    } catch (e) {
      alert(`Ошибка формата JSON:\n\n${(e as Error).message}\n\nОжидается: {"listId":"...","editCode":"..."}`);
      return;
    }

    try {
      const result = await sendToContentScript('importEditableList', { listId, editCode }) as {
        name: string;
        users: number;
        offers: number;
      };

      alert(
        `✅ Синхронизация подключена!\n\n` +
        `📋 Список: ${result.name}\n` +
        `👥 Пользователей: ${result.users}\n` +
        `📦 Объявлений: ${result.offers}\n\n` +
        `Изменения автоматически синхронизируются между устройствами.`
      );

      // Reload the active tab
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        browser.tabs.reload(tab.id);
      }
    } catch (error) {
      alert('Ошибка подключения: ' + (error as Error).message);
    }
  });

  // Force sync
  document.getElementById('btn-force-sync')!.addEventListener('click', async () => {
    try {
      alert('Синхронизация начата...');
      const result = await sendToContentScript('forceSync') as { users: number; offers: number };

      alert(
        `✅ Синхронизация завершена!\n\n` +
        `👥 Пользователей: ${result.users}\n` +
        `📦 Объявлений: ${result.offers}`
      );

      // Reload stats
      await loadStats();
    } catch (error) {
      alert('Ошибка синхронизации: ' + (error as Error).message);
    }
  });

  // Add subscription
  document.getElementById('btn-add-subscription')!.addEventListener('click', async () => {
    const listId = prompt(
      'Введите List ID для подписки:\n\n' +
      'Это read-only подписка.\n' +
      'Вы будете получать обновления, но не сможете редактировать список.'
    );

    if (!listId || !listId.trim()) return;

    try {
      const result = await sendToContentScript('subscribeToList', { listId: listId.trim() }) as {
        name: string;
        description: string;
        users: number;
        offers: number;
      };

      alert(
        `✅ Подписка добавлена!\n\n` +
        `📋 Название: ${result.name}\n` +
        `📝 Описание: ${result.description}\n` +
        `👥 Пользователей: ${result.users}\n` +
        `📦 Объявлений: ${result.offers}`
      );

      await loadStats();
    } catch (error) {
      alert('Ошибка подписки: ' + (error as Error).message);
    }
  });

  // Manage subscriptions
  document.getElementById('btn-manage-subscriptions')!.addEventListener('click', async () => {
    const subs = await subscriptions.getValue();

    if (subs.length === 0) {
      alert('У вас нет подписок.\n\nИспользуйте "Добавить подписку" для добавления списков.');
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

    if (actionTrimmed.startsWith('D')) {
      const num = parseInt(actionTrimmed.substring(1));

      if (num >= 1 && num <= subs.length) {
        const sub = subs[num - 1];
        if (confirm(`Удалить подписку "${sub.name}"?`)) {
          await sendToContentScript('removeSubscription', { id: sub.id });
          alert('Подписка удалена!');
          await loadStats();
        }
      } else {
        alert('Неверный номер');
      }
      return;
    }

    const num = parseInt(actionTrimmed);
    if (num >= 1 && num <= subs.length) {
      const sub = subs[num - 1];
      await sendToContentScript('toggleSubscription', { id: sub.id });
      alert(`Подписка "${sub.name}" ${sub.enabled ? 'отключена' : 'включена'}!`);
      await loadStats();
    } else {
      alert('Неверный ввод');
    }
  });

  // Export
  document.getElementById('btn-export')!.addEventListener('click', async () => {
    try {
      await sendToContentScript('exportDatabase');
    } catch (error) {
      alert('Ошибка экспорта: ' + (error as Error).message);
    }
  });

  // Import
  document.getElementById('btn-import')!.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonText = event.target?.result as string;
          await sendToContentScript('importDatabase', { jsonText });

          // Reload the active tab
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            browser.tabs.reload(tab.id);
          }
        } catch (error) {
          alert('Ошибка импорта: ' + (error as Error).message);
        }
      };
      reader.onerror = () => {
        alert('Ошибка чтения файла');
      };
      reader.readAsText(file);
    };

    input.click();
  });

  // Clear database
  document.getElementById('btn-clear')!.addEventListener('click', async () => {
    if (confirm('База данных будет очищена, вы уверены?')) {
      try {
        await sendToContentScript('clearDatabase');
        alert('База данных очищена!');

        // Reload the active tab
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          browser.tabs.reload(tab.id);
        }
      } catch (error) {
        alert('Ошибка очистки: ' + (error as Error).message);
      }
    }
  });

  // Debug
  document.getElementById('btn-debug')!.addEventListener('click', async () => {
    try {
      await sendToContentScript('debugSyncState');
      alert('Debug info logged to console!\n\nOpen browser console (F12) on the Avito page to view detailed state.');
    } catch (error) {
      alert('Ошибка отладки: ' + (error as Error).message);
    }
  });
}

// Check if we're on an Avito page
async function checkAvitaPage(): Promise<boolean> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      return tab.url.includes('avito.ru');
    }
  } catch {
    // Ignore
  }
  return false;
}

// Initialize popup
async function init(): Promise<void> {
  await loadStats();
  await initPaginationToggle();
  setupMenuHandlers();

  // Check if we're on Avito - show warning if not
  const isAvito = await checkAvitaPage();
  if (!isAvito) {
    // Disable some buttons that require content script
    const contentScriptButtons = [
      'btn-export', 'btn-import', 'btn-clear', 'btn-debug',
      'btn-force-sync', 'btn-enable-sync'
    ];

    for (const id of contentScriptButtons) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.add('disabled');
        btn.style.pointerEvents = 'none';
      }
    }
  }
}

// Run on load
document.addEventListener('DOMContentLoaded', init);
