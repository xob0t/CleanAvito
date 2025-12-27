import styles from './ui/styles.css';
import { registerMenuCommands } from './ui/menu.js';
import { initDB, getAllUsers, getAllOffers } from './core/db.js';
import { setBlacklistUsers, setBlacklistOffers } from './core/state.js';
import { initDesktop } from './desktop/index.js';
import { initMobile } from './mobile/index.js';
import { installFetchInterceptor } from './mobile/api-interceptor.js';

const LOG_PREFIX = '[ave]';
const isMobile = window.location.hostname === 'm.avito.ru';

// Install fetch interceptor IMMEDIATELY for mobile (before any API calls)
if (isMobile) {
  installFetchInterceptor();
}

console.log(`${LOG_PREFIX} Script loaded (readyState: ${document.readyState}, platform: ${isMobile ? 'mobile' : 'desktop'})`);

async function init() {
  console.log(`${LOG_PREFIX} Initializing AVE Blacklist v${__VERSION__}`);

  // Inject styles and register menu commands
  GM_addStyle(styles);
  registerMenuCommands();

  try {
    await initDB();
    console.log(`${LOG_PREFIX} IndexedDB initialized`);

    // Load blacklists into memory
    const users = await getAllUsers();
    const offers = await getAllOffers();
    setBlacklistUsers(users);
    setBlacklistOffers(offers);
    console.log(`${LOG_PREFIX} Loaded ${users.length} blocked users, ${offers.length} blocked offers`);

    if (isMobile) {
      await initMobile();
    } else {
      await initDesktop();
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error initializing:`, error);
  }
}

// Start as early as possible
if (document.readyState === 'loading') {
  // DOM not ready yet, wait for it
  document.addEventListener('DOMContentLoaded', init);
  console.log(`${LOG_PREFIX} Waiting for DOMContentLoaded...`);
} else {
  // DOM already ready
  init();
}
