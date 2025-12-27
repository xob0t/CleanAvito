import {
  catalogData,
  appendCatalogData,
  isPaginationEnabled,
  isLoading,
  setLoading,
  isUserBlacklisted,
  isOfferBlacklisted
} from '../core/state.js';
import { getOfferId, decodeHtmlEntities, extractUserIdFromCatalogData, extractUserIdFromElement } from './parser.js';
import { updateOfferState } from './pages/search.js';

const LOG_PREFIX = '[ave]';
let checkTimeout = null;

function createSpinner() {
  const spinner = document.createElement('div');
  spinner.className = 'avito-auto-pagination-loader-spinner';
  spinner.style.display = 'none';
  spinner.style.position = 'absolute';
  spinner.style.right = '10px';
  spinner.style.top = '50%';
  spinner.style.transform = 'translateY(-50%)';
  spinner.style.border = '3px solid rgba(255, 255, 255, 0.3)';
  spinner.style.borderTop = '3px solid white';
  spinner.style.borderRadius = '50%';
  spinner.style.width = '16px';
  spinner.style.height = '16px';
  spinner.style.animation = 'spin 0.8s linear infinite';

  // Add keyframes for spinner if not already added
  if (!document.getElementById('avito-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'avito-spinner-style';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return spinner;
}

function getMainOffersContainer() {
  const containers = document.querySelectorAll('[class*="items-items-"]');
  return containers.length > 0 ? containers[0] : null;
}

function getOtherCitiesContainer() {
  const containers = document.querySelectorAll('[class*="items-items-"]');
  return containers.length > 1 ? containers[1] : null;
}

function isPaginatorVisible() {
  const paginator = document.querySelector('[class*="js-pages pagination-pagination-"]');
  if (!paginator) {
    return false;
  }

  const rect = paginator.getBoundingClientRect();
  const isVisible = rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0;
  return isVisible;
}

function getCurrentPage() {
  const currentPageElement = document.querySelector('[class*="styles-module-item_current-"]');
  if (currentPageElement) {
    const pageText = currentPageElement.querySelector('span')?.textContent;
    const page = parseInt(pageText, 10) || 1;
    return page;
  }
  return 1;
}

function getNextPageUrl() {
  const currentPage = getCurrentPage();
  const nextPageElement = document.querySelector(`[data-value="${currentPage + 1}"]`);
  return nextPageElement ? nextPageElement.href : null;
}

function removeBrokenElements(item) {
  item.querySelectorAll('[class*="photo-slider-extra"]').forEach((container) => {
    container.remove();
  });

  item.querySelectorAll('[class*="iva-item-actions-"]').forEach((container) => {
    container.remove();
  });
}

function fixItemImages(item) {
  const imageContainers = item.querySelectorAll('[class*="photo-slider-dotsCounter"]');
  imageContainers.forEach((container) => {
    const imageMarker = container.getAttribute('data-marker');
    if (!imageMarker || !imageMarker.startsWith('slider-image/image-')) return;

    const imageUrl = imageMarker.replace('slider-image/image-', '');
    const imageSpan = container.querySelector("[class*='photo-slider-image-']");

    if (imageSpan && imageSpan.tagName === 'SPAN') {
      const img = document.createElement('img');
      img.className = 'photo-slider-image';
      img.alt = item.querySelector('[itemprop="name"]')?.textContent || '';
      img.src = imageUrl;
      imageSpan.replaceWith(img);
    }
  });
}

// Extract catalog data from parsed JSON - handles multiple structures
function extractCatalogFromJson(initData) {
  function extractFromCatalog(catalog) {
    if (!catalog) return null;
    const catalogItems = catalog.items || [];
    const extraItems = catalog.extraBlockItems || [];
    let allItems = catalogItems.concat(extraItems);
    allItems = allItems.filter((item) => item.id || item.categoryId);
    return allItems.length > 0 ? allItems : null;
  }

  // Try path: data.catalog
  if (initData?.data?.catalog) {
    const result = extractFromCatalog(initData.data.catalog);
    if (result) return result;
  }

  // Try path: state.catalog (abCentral format)
  if (initData?.state?.catalog) {
    const result = extractFromCatalog(initData.state.catalog);
    if (result) return result;
  }

  // Try path: catalog (direct)
  if (initData?.catalog) {
    const result = extractFromCatalog(initData.catalog);
    if (result) return result;
  }

  return null;
}

function processNewItems(newItems, targetContainer) {
  console.log(`${LOG_PREFIX} Processing ${newItems.length} new items`);
  newItems.forEach((offer) => {
    const clone = offer.cloneNode(true);
    removeBrokenElements(clone);
    fixItemImages(clone);
    targetContainer.appendChild(clone);

    const offerId = getOfferId(clone);
    // Try catalog data first, fallback to DOM extraction
    let userId = extractUserIdFromCatalogData(catalogData, offerId);
    if (!userId) {
      userId = extractUserIdFromElement(clone);
    }
    updateOfferState(clone, { offerId, userId });
  });
}

async function fetchNextPage() {
  if (!isPaginationEnabled() || isLoading()) {
    console.log(`${LOG_PREFIX} Fetch aborted - disabled or already loading`);
    return;
  }

  const spinner = createSpinner();
  const nextPageUrl = getNextPageUrl();

  if (!nextPageUrl) {
    console.log(`${LOG_PREFIX} All pages loaded`);
    return;
  }

  setLoading(true);
  const nextPage = getCurrentPage() + 1;
  console.log(`${LOG_PREFIX} Loading page ${nextPage}`);

  const paginator = document.querySelector('[class*="js-pages pagination-pagination-"]');
  if (paginator) {
    paginator.style.position = 'relative';

    const statusText = document.createElement('span');
    statusText.className = 'avito-pagination-status';
    statusText.textContent = `Загрузка страницы ${nextPage}`;
    statusText.style.marginRight = '10px';
    statusText.style.color = '#999';
    statusText.style.fontSize = '14px';

    spinner.style.display = 'block';
    paginator.appendChild(statusText);
    paginator.appendChild(spinner);
  }

  try {
    const response = await fetch(nextPageUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newContainers = doc.querySelectorAll('[class*="items-items"]');
    console.log(`${LOG_PREFIX} Found ${newContainers.length} containers in new page`);

    if (newContainers.length === 0) {
      console.log(`${LOG_PREFIX} No containers found in new page`);
      return;
    }

    // Find catalog data in the new page - look for JSON script starting with {
    const scriptElements = doc.querySelectorAll('script');
    for (const script of scriptElements) {
      const content = script.textContent?.trim();
      if (content && content.includes('abCentral') && content.startsWith('{')) {
        try {
          const decodedJson = decodeHtmlEntities(content);
          const newInitialData = JSON.parse(decodedJson);
          const newCatalogData = extractCatalogFromJson(newInitialData);
          if (newCatalogData) {
            appendCatalogData(newCatalogData);
            console.log(`${LOG_PREFIX} Added ${newCatalogData.length} items to catalogData`);
          }
          break;
        } catch (error) {
          console.error(`${LOG_PREFIX} Error parsing catalog data from new page:`, error);
        }
      }
    }

    // Process main offers (first container)
    const newMainOffers = Array.from(newContainers[0].children).filter((el) => el.hasAttribute('data-item-id'));
    if (newMainOffers.length > 0) {
      const mainContainer = getMainOffersContainer();
      if (mainContainer) {
        console.log(`${LOG_PREFIX} Adding ${newMainOffers.length} main offers`);
        processNewItems(newMainOffers, mainContainer);
      }
    }

    // Process other cities offers (second container if exists)
    if (newContainers.length > 1) {
      const newOtherCitiesOffers = Array.from(newContainers[1].children).filter((el) => el.hasAttribute('data-item-id'));
      if (newOtherCitiesOffers.length > 0) {
        let targetContainer = getOtherCitiesContainer();

        if (!targetContainer) {
          const mainContainer = getMainOffersContainer();
          if (mainContainer) {
            const newContainer = document.createElement('div');
            newContainer.className = 'items-items-';
            mainContainer.after(newContainer);
            targetContainer = newContainer;
          }
        }

        if (targetContainer) {
          console.log(`${LOG_PREFIX} Adding ${newOtherCitiesOffers.length} other cities offers`);
          processNewItems(newOtherCitiesOffers, targetContainer);
        }
      }
    }

    // Update pagination controls
    const newPaginator = doc.querySelector('[class*="js-pages pagination-pagination-"]');
    if (newPaginator && paginator) {
      paginator.innerHTML = newPaginator.innerHTML;
      console.log(`${LOG_PREFIX} Updated pagination controls`);
    }

    console.log(`${LOG_PREFIX} Page loaded successfully`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error loading page:`, error);
  } finally {
    setLoading(false);

    spinner.style.display = 'none';
    if (spinner.parentNode) {
      const statusText = spinner.parentNode.querySelector('.avito-pagination-status');
      if (statusText) statusText.remove();
      spinner.parentNode.removeChild(spinner);
    }
  }
}

export function checkPaginationVisibility() {
  if (!isPaginationEnabled() || isLoading()) return;
  clearTimeout(checkTimeout);
  checkTimeout = setTimeout(() => {
    if (isPaginatorVisible()) {
      fetchNextPage();
    }
  }, 200);
}

function initPaginationObserver() {
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        checkPaginationVisibility();
      }
    });
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });

  return observer;
}

export function initPagination() {
  console.log(`${LOG_PREFIX} Initializing auto-pagination`);
  window.addEventListener('scroll', checkPaginationVisibility);
  initPaginationObserver();
}
