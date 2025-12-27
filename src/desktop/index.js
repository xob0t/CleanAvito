import { setCatalogData } from '../core/state.js';
import { parseInitialData, getSellerId, getSellerIdFromUrl, decodeHtmlEntities } from './parser.js';
import { processSearchPage } from './pages/search.js';
import { processSellerPage } from './pages/seller.js';
import { initPagination } from './pagination.js';

const LOG_PREFIX = '[ave]';
const OFFERS_ROOT_SELECTOR_VALUE = 'bx.catalog.container';

// Try to extract catalog data from a parsed JSON object
function extractCatalogData(initData) {
  // Helper to extract items + extraBlockItems from a catalog object
  function extractFromCatalog(catalog) {
    if (!catalog) return null;
    const catalogItems = catalog.items || [];
    const extraItems = catalog.extraBlockItems || [];
    let allItems = catalogItems.concat(extraItems);
    // Filter to only items with expected properties
    allItems = allItems.filter((item) => item.id || item.categoryId);
    if (allItems.length > 0) {
      console.log(`${LOG_PREFIX} Extracted ${catalogItems.length} items + ${extraItems.length} extraBlockItems`);
      return allItems;
    }
    return null;
  }

  // Try path: data.catalog (original extension format)
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

  // Search recursively for catalog object with items
  function findCatalog(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return null;

    // Check if this object has 'items' array with expected structure
    if (Array.isArray(obj.items) && obj.items.length > 0) {
      const firstItem = obj.items[0];
      if (firstItem && (firstItem.id || firstItem.categoryId || firstItem.iva)) {
        return obj; // Return the parent object so we can get extraBlockItems too
      }
    }

    // Recurse into object properties
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        const result = findCatalog(obj[key], depth + 1);
        if (result) return result;
      }
    }
    return null;
  }

  const catalog = findCatalog(initData);
  if (catalog) {
    const result = extractFromCatalog(catalog);
    if (result) return result;
  }

  return null;
}

// Try to find catalog data from existing scripts on the page
async function findExistingCatalogData() {
  console.log(`${LOG_PREFIX} === Starting catalog data search ===`);

  // Step 1: Try abCentral JSON script in DOM
  console.log(`${LOG_PREFIX} Step 1: Checking for abCentral script in DOM...`);
  const scripts = document.querySelectorAll('script');
  let abCentralFound = false;
  for (const script of scripts) {
    if (script.textContent && script.textContent.includes('abCentral') && script.textContent.trim().startsWith('{')) {
      abCentralFound = true;
      try {
        const decodedJson = decodeHtmlEntities(script.textContent);
        const initData = JSON.parse(decodedJson);
        console.log(`${LOG_PREFIX} Found abCentral script in DOM, top keys:`, Object.keys(initData).slice(0, 8));
        const catalogData = extractCatalogData(initData);
        if (catalogData && catalogData.length > 0) {
          console.log(`${LOG_PREFIX} SUCCESS: Parsed ${catalogData.length} items from abCentral (DOM)`);
          return catalogData;
        } else {
          console.log(`${LOG_PREFIX} abCentral found but no catalog items extracted`);
        }
      } catch (error) {
        console.log(`${LOG_PREFIX} Could not parse abCentral script:`, error.message);
      }
    }
  }
  if (!abCentralFound) {
    console.log(`${LOG_PREFIX} No abCentral script found in DOM`);
  }

  // Step 2: Try MFE state script in DOM
  console.log(`${LOG_PREFIX} Step 2: Checking for MFE state script in DOM...`);
  const mfeStateScript = document.querySelector('script[type="mime/invalid"][data-mfe-state="true"]');
  if (mfeStateScript && mfeStateScript.textContent) {
    console.log(`${LOG_PREFIX} Found MFE state script in DOM (length: ${mfeStateScript.textContent.length})`);
    try {
      const decodedJson = decodeHtmlEntities(mfeStateScript.textContent);
      const initData = JSON.parse(decodedJson);
      console.log(`${LOG_PREFIX}   Top keys:`, Object.keys(initData).slice(0, 8));
      if (initData.data) {
        console.log(`${LOG_PREFIX}   data.* keys:`, Object.keys(initData.data).slice(0, 8));
      }
      const catalogData = extractCatalogData(initData);
      if (catalogData && catalogData.length > 0) {
        console.log(`${LOG_PREFIX} SUCCESS: Parsed ${catalogData.length} items from MFE state (DOM)`);
        return catalogData;
      } else {
        console.log(`${LOG_PREFIX} MFE state found but no catalog items extracted`);
      }
    } catch (error) {
      console.log(`${LOG_PREFIX} Could not parse MFE state script:`, error.message);
    }
  } else {
    console.log(`${LOG_PREFIX} No MFE state script found in DOM`);
  }

  // Step 3: Fetch page source and try again
  console.log(`${LOG_PREFIX} Step 3: Fetching page source...`);
  try {
    const response = await fetch(window.location.href);
    const html = await response.text();
    console.log(`${LOG_PREFIX} Fetched page source (${html.length} bytes)`);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Step 3a: Look for abCentral script in fetched HTML
    console.log(`${LOG_PREFIX} Step 3a: Checking for abCentral in fetched HTML...`);
    const fetchedScripts = doc.querySelectorAll('script');
    let fetchedAbCentralFound = false;
    for (const script of fetchedScripts) {
      if (script.textContent && script.textContent.includes('abCentral') && script.textContent.trim().startsWith('{')) {
        fetchedAbCentralFound = true;
        try {
          const decodedJson = decodeHtmlEntities(script.textContent);
          const initData = JSON.parse(decodedJson);
          console.log(`${LOG_PREFIX} Found abCentral in fetched HTML, top keys:`, Object.keys(initData).slice(0, 8));
          const catalogData = extractCatalogData(initData);
          if (catalogData && catalogData.length > 0) {
            console.log(`${LOG_PREFIX} SUCCESS: Parsed ${catalogData.length} items from abCentral (fetched)`);
            return catalogData;
          } else {
            console.log(`${LOG_PREFIX} abCentral found but no catalog items extracted`);
          }
        } catch (error) {
          console.log(`${LOG_PREFIX} Could not parse fetched abCentral:`, error.message);
        }
      }
    }
    if (!fetchedAbCentralFound) {
      console.log(`${LOG_PREFIX} No abCentral script found in fetched HTML`);
    }

    // Step 3b: Try MFE state script in fetched HTML
    console.log(`${LOG_PREFIX} Step 3b: Checking for MFE state in fetched HTML...`);
    const mfeScript = doc.querySelector('script[type="mime/invalid"][data-mfe-state="true"]');
    if (mfeScript && mfeScript.textContent) {
      console.log(`${LOG_PREFIX} Found MFE state in fetched HTML (length: ${mfeScript.textContent.length})`);
      try {
        const decodedJson = decodeHtmlEntities(mfeScript.textContent);
        const initData = JSON.parse(decodedJson);
        console.log(`${LOG_PREFIX}   Top keys:`, Object.keys(initData).slice(0, 8));
        const catalogData = extractCatalogData(initData);
        if (catalogData && catalogData.length > 0) {
          console.log(`${LOG_PREFIX} SUCCESS: Parsed ${catalogData.length} items from MFE state (fetched)`);
          return catalogData;
        } else {
          console.log(`${LOG_PREFIX} MFE state found but no catalog items extracted`);
        }
      } catch (error) {
        console.log(`${LOG_PREFIX} Could not parse fetched MFE state:`, error.message);
      }
    } else {
      console.log(`${LOG_PREFIX} No MFE state script found in fetched HTML`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching page source:`, error);
  }

  // Step 4: Fallback - Extract catalog data directly from DOM elements
  console.log(`${LOG_PREFIX} Step 4: Extracting catalog data from DOM elements...`);
  const domCatalogData = getCatalogDataFromDOM();
  if (domCatalogData && domCatalogData.length > 0) {
    console.log(`${LOG_PREFIX} SUCCESS: Extracted ${domCatalogData.length} items from DOM elements`);
    return domCatalogData;
  }

  console.warn(`${LOG_PREFIX} FAILED: Could not find catalog data anywhere`);
  return null;
}

// Extract catalog data directly from DOM elements (fallback method)
function getCatalogDataFromDOM() {
  const catalogData = [];
  let withSeller = 0;
  let withoutSeller = 0;

  // Method 1: Extract from elements with data-item-id
  const offerElements = document.querySelectorAll('[data-item-id]');
  console.log(`${LOG_PREFIX} DOM: Found ${offerElements.length} elements with data-item-id`);

  offerElements.forEach((element) => {
    const offerId = element.getAttribute('data-item-id');
    if (offerId) {
      // Find seller link (supports both /user/ and /brands/)
      const sellerLinkElement =
        element.querySelector('a[href*="/user/"]') || element.querySelector('a[href*="/brands/"]');

      let userId = null;
      if (sellerLinkElement) {
        const sellerHref = sellerLinkElement.href;
        const userMatch = sellerHref.match(/\/user\/([^\/]+)/);
        const brandMatch = sellerHref.match(/\/brands\/([^\/]+)/);

        if (userMatch) {
          userId = userMatch[1].split('?')[0];
        } else if (brandMatch) {
          userId = brandMatch[1].split('?')[0];
        }
      }

      if (userId) {
        withSeller++;
      } else {
        withoutSeller++;
      }

      catalogData.push({
        id: parseInt(offerId),
        userId: userId,
        // Create minimal structure for compatibility with extractUserIdFromCatalogData
        iva: {
          UserInfoStep: [
            {
              payload: {
                profile: {
                  link: sellerLinkElement?.href || ''
                }
              }
            }
          ]
        }
      });
    }
  });

  console.log(`${LOG_PREFIX} DOM extraction: ${withSeller} with seller, ${withoutSeller} without seller`);
  return catalogData;
}

// Try to find initialData for seller pages from existing scripts
function findExistingInitialData() {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    if (script.textContent && script.textContent.includes('__initialData__')) {
      return parseInitialData(script.textContent);
    }
  }
  return null;
}

export async function initDesktop() {
  const currentUrl = window.location.toString();
  const userPageStrings = ['www.avito.ru/user/', 'sellerId', 'brands'];
  const isUserPage = userPageStrings.some((str) => currentUrl.includes(str));

  if (isUserPage) {
    console.log(`${LOG_PREFIX} page detected: seller`);
  } else {
    console.log(`${LOG_PREFIX} page detected: search`);
    // Initialize auto-pagination for search pages
    initPagination();
  }

  let initialData;

  // Check for existing data on page load
  if (isUserPage) {
    // Primary method: extract seller ID from URL
    let userId = getSellerIdFromUrl();
    if (userId) {
      console.log(`${LOG_PREFIX} Seller userId from URL: ${userId}`);
      // Delay processing to wait for sidebar DOM to be ready
      setTimeout(() => processSellerPage(userId), 500);
    } else {
      // Fallback: try to get from initialData
      initialData = findExistingInitialData();
      if (initialData) {
        console.log(`${LOG_PREFIX} Found existing initialData on page load`);
        userId = getSellerId(initialData);
        console.log(`${LOG_PREFIX} Seller userId from initialData: ${userId}`);
        if (userId) {
          setTimeout(() => processSellerPage(userId), 500);
        }
      } else {
        console.log(`${LOG_PREFIX} No userId found, waiting for MutationObserver`);
      }
    }
  } else {
    // Try to find catalog data
    const existingCatalogData = await findExistingCatalogData();
    if (existingCatalogData && existingCatalogData.length > 0) {
      console.log(`${LOG_PREFIX} Found existing catalogData on page load (${existingCatalogData.length} items)`);
      setCatalogData(existingCatalogData);
    }

    // Check if there are already offers on the page
    const existingOffers = document.querySelectorAll('[data-marker="item"]');
    if (existingOffers.length > 0) {
      console.log(`${LOG_PREFIX} Found ${existingOffers.length} existing offers on page`);
      processSearchPage();
    }
  }

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(async function (node) {
          if (isUserPage) {
            // Seller page
            if (node instanceof Element) {
              // Check if sidebar container appeared
              const isSidebar = node.matches?.('[class^="ExtendedProfileStickyContainer-"]') ||
                                node.querySelector?.('[class^="ExtendedProfileStickyContainer-"]');
              // Check for profile badge appearing
              const hasBadge = node.matches?.('[class^="ProfileBadge-root-"]') ||
                               node.querySelector?.('[class^="ProfileBadge-root-"]');
              // Check for subscribe/contact buttons
              const hasButtons = node.querySelector?.('[class*="SubscribeInfo-module-subscribe"]') ||
                                 node.querySelector?.('[class*="ContactBar-module-controls"]');

              if (isSidebar || hasBadge || hasButtons) {
                console.log(`${LOG_PREFIX} seller page sidebar/badge/buttons detected`);
                // Use URL as primary source
                const userId = getSellerIdFromUrl();
                if (userId) {
                  processSellerPage(userId);
                }
              }
            }
            if (node?.nodeName === 'SCRIPT' && node?.textContent?.includes('__initialData__')) {
              const initialDataContent = node.textContent;
              initialData = parseInitialData(initialDataContent);
              console.log(`${LOG_PREFIX} initialData found`);
              // Use URL as primary source, initialData as fallback
              let userId = getSellerIdFromUrl();
              if (!userId) {
                userId = getSellerId(initialData);
              }
              console.log(`${LOG_PREFIX} Seller userId: ${userId}`);
              if (userId) {
                processSellerPage(userId);
              }
            }
          } else {
            // Search page
            if (node instanceof Element) {
              // Skip mutations inside the hidden container to prevent infinite loops
              const hiddenContainer = document.querySelector('.hidden-container');
              if (hiddenContainer && (hiddenContainer.contains(node) || node.closest?.('.hidden-container'))) {
                return; // Skip - this is our own DOM manipulation
              }

              // Skip if this is the hidden container itself or its parent elements (details, summary, hr)
              if (node.classList?.contains('hidden-container') ||
                  node.classList?.contains('custom-hr') ||
                  node.classList?.contains('custom-summary') ||
                  (node.tagName === 'DETAILS' && node.querySelector('.hidden-container'))) {
                return; // Skip - this is our own DOM manipulation
              }

              // Check if this node or its children contain offer items
              if (node.getAttribute('elementtiming') === OFFERS_ROOT_SELECTOR_VALUE ||
                  node.classList?.toString().includes('styles-singlePageWrapper') ||
                  node.querySelector?.('[data-marker="item"]') ||
                  node.getAttribute?.('data-marker') === 'item') {
                console.log(`${LOG_PREFIX} Offers detected in DOM`);
                processSearchPage();
              }
            }
            // Watch for MFE state script or abCentral script being added
            if (node instanceof HTMLScriptElement) {
              const isMfeStateScript = node.type === 'mime/invalid' && node.dataset.mfeState === 'true';
              const isAbCentralScript = node.textContent?.includes('abCentral') && node.textContent?.trim().startsWith('{');

              if (isMfeStateScript || isAbCentralScript) {
                try {
                  const decodedJson = decodeHtmlEntities(node.textContent);
                  const initData = JSON.parse(decodedJson);
                  const catalogData = extractCatalogData(initData);
                  if (catalogData && catalogData.length > 0) {
                    setCatalogData(catalogData);
                    console.log(`${LOG_PREFIX} catalogData received (${catalogData.length} items)`);
                    processSearchPage();
                  }
                } catch (error) {
                  console.error(`${LOG_PREFIX} Error processing catalog data:`, error);
                }
              }
            }
          }
        });
      }
    });
  });

  const config = { attributes: false, childList: true, subtree: true };
  observer.observe(document, config);
}
