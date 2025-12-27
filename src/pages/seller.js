import { isUserBlacklisted } from '../core/state.js';
import { addUserToBlacklist, removeUserFromBlacklist } from '../core/blacklist.js';

const SELLER_PAGE_SIDEBAR_SELECTOR = '[class^="ExtendedProfileStickyContainer-"]';

function checkButton() {
  const texts = ['Скрыть пользователя', 'Показать пользователя'];
  const button = Array.from(document.querySelectorAll('button')).find(
    (btn) => texts.includes(btn.textContent.trim())
  );
  return button !== undefined;
}

export function insertBlockedSellerUI(userId) {
  if (checkButton()) return;

  const sidebar = document.querySelector(SELLER_PAGE_SIDEBAR_SELECTOR);
  if (!sidebar) return;

  const unblockButtonHtml =
    '<button type="button" class="sellerPageControlButton removeSellerFromBlacklist styles-module-root-EEwdX styles-module-root_size_m-Joz68 styles-module-root_preset_secondary-_ysdV styles-module-root_fullWidth-jnoCY"><span class="styles-module-wrapper-_6mED"><span class="styles-module-text-G2ghF styles-module-text_size_m-DUDcO">Показать пользователя</span></span></button>';

  const badgeHtml =
    '<div class="ProfileBadge-root-bcR8G ProfileBadge-cloud-vOPD1 ProfileBadge-activatable-_4_K8 bad_badge" style="--badge-font-color:#000000;--badge-bgcolor:#f8cbcb;--badge-hover-bgcolor:#fd8181" data-marker="badge-102">❌ Пользователь в ЧС</div><div class="ProfileBadge-content-o2hDn"><div class="ProfileBadge-title-_Z4By" data-marker="badge-title-102"></div><div class="ProfileBadge-description-_lbMb" data-marker="badge-description-102"></div></div>';

  const firstBadge = sidebar.querySelector('[class^="ProfileBadge-"]');
  if (firstBadge) {
    const badgeBar = firstBadge.parentElement;
    badgeBar.insertAdjacentHTML('beforeend', badgeHtml);
  }

  sidebar.insertAdjacentHTML('beforeend', unblockButtonHtml);

  const actionButton = sidebar.querySelector('.removeSellerFromBlacklist');
  if (actionButton) {
    actionButton.addEventListener('click', async () => {
      await removeUserFromBlacklist(userId);
      const badge = sidebar.querySelector('.bad_badge');
      if (badge) badge.remove();
      actionButton.remove();
      insertSellerUI(userId);
    });
  }
}

export function insertSellerUI(userId) {
  if (checkButton()) return;

  const sidebar = document.querySelector(SELLER_PAGE_SIDEBAR_SELECTOR);
  if (!sidebar) return;

  const blockButtonHtml =
    '<button type="button" class="sellerPageControlButton addSellerToBlacklist styles-module-root-EEwdX styles-module-root_size_m-Joz68 styles-module-root_preset_secondary-_ysdV styles-module-root_fullWidth-jnoCY"><span class="styles-module-wrapper-_6mED"><span class="styles-module-text-G2ghF styles-module-text_size_m-DUDcO">Скрыть пользователя</span></span></button>';

  sidebar.insertAdjacentHTML('beforeend', blockButtonHtml);

  const actionButton = sidebar.querySelector('.addSellerToBlacklist');
  if (actionButton) {
    actionButton.addEventListener('click', async () => {
      await addUserToBlacklist(userId);
      actionButton.remove();
      insertBlockedSellerUI(userId);
    });
  }
}

export function processSellerPage(userId) {
  if (isUserBlacklisted(userId)) {
    insertBlockedSellerUI(userId);
  } else {
    insertSellerUI(userId);
  }
}
