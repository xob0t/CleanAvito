import { setMobileCatalogData } from '../core/state.js';

const LOG_PREFIX = '[ave]';

let initialDataParsed = false;

// Extract initial catalog data from the page's embedded initialData script
// This should be called FIRST as it contains the correct items for the current page
export async function fetchMobileCatalogIfNeeded() {
  // Only parse initialData once - don't overwrite appended API data
  if (initialDataParsed) {
    return;
  }

  // Look for the initialData script tag (URL-encoded JSON)
  const initialDataScript = document.getElementById('initialData');
  if (initialDataScript) {
    try {
      const encodedData = initialDataScript.textContent;
      const decodedData = decodeURIComponent(encodedData);
      const data = JSON.parse(decodedData);

      // Items are in search.allItems as an object with item IDs as keys
      const allItems = data?.search?.allItems;
      if (allItems && typeof allItems === 'object') {
        const items = Object.values(allItems).filter(item => item.type === 'item');
        if (items.length > 0) {
          console.log(`${LOG_PREFIX} Found ${items.length} items in initialData`);
          setMobileCatalogData(items);
          initialDataParsed = true;
          return;
        }
      }
    } catch (e) {
      console.log(`${LOG_PREFIX} Failed to parse initialData:`, e);
    }
  }

  console.log(`${LOG_PREFIX} No catalog data available yet - waiting for API calls`);
}

// Extract userId (userKey) from cached mobile catalog data
export function extractUserIdFromMobileData(catalogData, offerId) {
  if (catalogData.length === 0) {
    return null;
  }

  const item = catalogData.find(item => {
    const itemId = item.value?.id;
    return itemId === Number(offerId) || String(itemId) === String(offerId);
  });

  if (!item) {
    return null;
  }

  const userKey = item.value?.sellerInfo?.userKey;
  return userKey || null;
}

// Get offer ID from mobile DOM element
// Mobile uses data-item-id or similar attributes
export function getMobileOfferId(element) {
  // Try direct attribute
  let offerId = element.getAttribute('data-item-id');
  if (offerId) return offerId;

  // Try finding child with data-item-id
  const child = element.querySelector('[data-item-id]');
  if (child) {
    offerId = child.getAttribute('data-item-id');
    if (offerId) return offerId;
  }

  // Try href-based extraction (link to item page)
  const itemLink = element.querySelector('a[href*="/"]');
  if (itemLink) {
    const href = itemLink.getAttribute('href');
    // Match pattern like /category/item-title_1234567890
    const match = href?.match(/_(\d{8,})(?:\?|$)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Decode HTML entities (shared utility)
export function decodeHtmlEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
