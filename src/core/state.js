export let catalogData = [];
export let mobileCatalogData = [];
export let blacklistUsers = new Set();
export let blacklistOffers = new Set();
// Load pagination state from storage (default to true if not set)
let _isPaginationEnabled = GM_getValue('paginationEnabled', true);
let _isLoading = false;

export function isPaginationEnabled() {
  return _isPaginationEnabled;
}

export function isLoading() {
  return _isLoading;
}

export function setCatalogData(data) {
  catalogData = data;
}

export function appendCatalogData(data) {
  catalogData = [...catalogData, ...data];
}

// Mobile catalog data - stores raw API response items
export function setMobileCatalogData(items) {
  mobileCatalogData = items;
}

export function appendMobileCatalogData(items) {
  // Deduplicate by item ID when appending
  const existingIds = new Set(mobileCatalogData.map(item => item.value?.id));
  const newItems = items.filter(item => !existingIds.has(item.value?.id));
  mobileCatalogData = [...mobileCatalogData, ...newItems];
}

export function setBlacklistUsers(users) {
  blacklistUsers = new Set(users);
}

export function setBlacklistOffers(offers) {
  blacklistOffers = new Set(offers);
}

export function addToBlacklistUsers(userId) {
  blacklistUsers.add(userId);
}

export function removeFromBlacklistUsers(userId) {
  blacklistUsers.delete(userId);
}

export function addToBlacklistOffers(offerId) {
  blacklistOffers.add(offerId);
}

export function removeFromBlacklistOffers(offerId) {
  blacklistOffers.delete(offerId);
}

export function isUserBlacklisted(userId) {
  return blacklistUsers.has(userId);
}

export function isOfferBlacklisted(offerId) {
  return blacklistOffers.has(offerId);
}

export function setPaginationEnabled(enabled) {
  _isPaginationEnabled = enabled;
  GM_setValue('paginationEnabled', enabled);
}

export function setLoading(loading) {
  _isLoading = loading;
}
