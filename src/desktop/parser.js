const LOG_PREFIX = '[ave]';

export function decodeHtmlEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

export function parseInitialData(initialDataContent) {
  try {
    initialDataContent = decodeURIComponent(initialDataContent);

    const startIndex = initialDataContent.indexOf('window.__initialData__ = "') + 'window.__initialData__ = "'.length;
    const endIndex = initialDataContent.indexOf('";\nwindow.__mfe__');

    const jsonString = initialDataContent.substring(startIndex, endIndex);
    const initialData = JSON.parse(jsonString);
    return initialData;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error parsing __initialData__:`, error);
  }
  return null;
}

export function getCatalogDataFromInit(initialData) {
  if (!initialData?.data?.catalog) {
    console.warn(`${LOG_PREFIX} No catalog data found in initialData`);
    return null;
  }
  const catalogItems = initialData.data.catalog.items || [];
  const extraItems = initialData.data.catalog.extraBlockItems || [];
  let allItems = catalogItems.concat(extraItems);
  allItems = allItems.filter((item) => item.hasOwnProperty('categoryId'));
  return allItems;
}

export function getSellerId(initialData) {
  try {
    return initialData.data.ssrData.initData.result.value.data.customLink ||
           initialData.data.ssrData.initData.result.value.data.profileUserHash;
  } catch (error) {
    return null;
  }
}

// Extract seller ID directly from URL (more reliable than __initialData__)
export function getSellerIdFromUrl() {
  const pathname = window.location.pathname;
  const userMatch = pathname.match(/\/user\/([^\/]+)/);
  const brandMatch = pathname.match(/\/brands\/([^\/]+)/);

  if (userMatch) return userMatch[1].split('?')[0];
  if (brandMatch) return brandMatch[1].split('?')[0];
  return null;
}

export function getOfferId(offerElement) {
  return offerElement.getAttribute('data-item-id');
}

export function extractUserIdFromCatalogData(catalogData, offerId) {
  const currentOfferData = catalogData.find((item) => item.id === Number(offerId));
  if (!currentOfferData) return null;

  try {
    const sellerUrl = currentOfferData?.iva?.UserInfoStep[0]?.payload?.profile?.link;
    return sellerUrl?.split('/')[2]?.split('?')[0];
  } catch (error) {
    console.warn(`${LOG_PREFIX} Error extracting userId:`, error);
    return null;
  }
}

// Extract userId directly from DOM element (fallback when catalog data is unavailable)
export function extractUserIdFromElement(offerElement) {
  const sellerLinkElement =
    offerElement.querySelector('a[href*="/user/"]') ||
    offerElement.querySelector('a[href*="/brands/"]');

  if (!sellerLinkElement) return null;

  const sellerHref = sellerLinkElement.href;
  const userMatch = sellerHref.match(/\/user\/([^\/]+)/);
  const brandMatch = sellerHref.match(/\/brands\/([^\/]+)/);

  if (userMatch) return userMatch[1].split('?')[0];
  if (brandMatch) return brandMatch[1].split('?')[0];
  return null;
}
