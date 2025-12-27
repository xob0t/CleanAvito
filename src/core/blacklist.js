import { addUser, removeUser, addOffer, removeOffer } from './db.js';
import {
  addToBlacklistUsers,
  removeFromBlacklistUsers,
  addToBlacklistOffers,
  removeFromBlacklistOffers
} from './state.js';

const LOG_PREFIX = '[ave]';

export async function addUserToBlacklist(userId) {
  addToBlacklistUsers(userId);
  await addUser(userId);
  console.log(`${LOG_PREFIX} seller ${userId} added to blacklist`);
}

export async function removeUserFromBlacklist(userId) {
  removeFromBlacklistUsers(userId);
  await removeUser(userId);
  console.log(`${LOG_PREFIX} seller ${userId} removed from blacklist`);
}

export async function addOfferToBlacklist(offerId) {
  addToBlacklistOffers(offerId);
  await addOffer(offerId);
  console.log(`${LOG_PREFIX} offer ${offerId} added to blacklist`);
}

export async function removeOfferFromBlacklist(offerId) {
  removeFromBlacklistOffers(offerId);
  await removeOffer(offerId);
  console.log(`${LOG_PREFIX} offer ${offerId} removed from blacklist`);
}
