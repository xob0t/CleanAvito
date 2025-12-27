export let catalogData = [];
export let blacklistUsers = new Set();
export let blacklistOffers = new Set();

export function setCatalogData(data) {
  catalogData = data;
}

export function appendCatalogData(data) {
  catalogData = [...catalogData, ...data];
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
