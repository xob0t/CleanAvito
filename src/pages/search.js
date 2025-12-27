import { catalogData, isUserBlacklisted, isOfferBlacklisted } from '../core/state.js';
import { getOfferId, extractUserIdFromCatalogData } from '../features/parser.js';
import { createHiddenContainer } from '../ui/hidden-container.js';
import {
  insertBlockSellerButton,
  insertBlockOfferButton,
  insertUnblockSellerButton,
  insertUnblockOfferButton
} from '../ui/buttons.js';

const OFFERS_SELECTOR = '[data-marker="item"]';
const LOG_PREFIX = '[ave]';

export function updateOfferState(offerElement, offerInfo) {
  const hiddenContainer = createHiddenContainer();
  if (!hiddenContainer) return;

  const offerIsHidden = hiddenContainer.contains(offerElement);
  const userIsBlacklisted = offerInfo?.userId && isUserBlacklisted(offerInfo.userId);
  const offerIsBlacklisted = offerInfo?.offerId && isOfferBlacklisted(offerInfo.offerId);

  // Helper to add buttons to an element
  const addButtons = (element) => {
    // Remove existing button container if any
    const existingContainer = element.querySelector('.button-container');
    if (existingContainer) existingContainer.remove();

    const refreshCallback = () => processSearchPage();

    if (offerInfo.userId) {
      if (userIsBlacklisted) {
        insertUnblockSellerButton(element, offerInfo, refreshCallback);
      } else {
        insertBlockSellerButton(element, offerInfo, refreshCallback);
      }
    }

    if (offerIsBlacklisted) {
      insertUnblockOfferButton(element, offerInfo, refreshCallback);
    } else {
      insertBlockOfferButton(element, offerInfo, refreshCallback);
    }
  };

  if (!offerIsHidden && (userIsBlacklisted || offerIsBlacklisted)) {
    // Clone the original offer
    const offerElementClone = offerElement.cloneNode(true);
    // Add buttons to clone BEFORE appending to hidden container
    addButtons(offerElementClone);
    // Hide the original offer
    offerElement.style.display = 'none';
    // Put clone in hidden container
    hiddenContainer.appendChild(offerElementClone);
    console.log(`${LOG_PREFIX} offer ${offerInfo.offerId} hidden`);
    return; // Don't add buttons to original (it's hidden)
  } else if (offerIsHidden && !userIsBlacklisted && !offerIsBlacklisted) {
    // Remove offer from hidden container
    offerElement.remove();
    // Find the original hidden offer
    offerElement = document.querySelector(`[data-item-id="${offerInfo.offerId}"]`);
    if (offerElement) {
      offerElement.style.display = 'block';
    }
  }

  if (!offerElement) return;

  // Add buttons to the visible offer
  addButtons(offerElement);
}

export function processSearchPage() {
  const hiddenContainer = createHiddenContainer();
  const offerElements = document.querySelectorAll(OFFERS_SELECTOR);
  console.log(`${LOG_PREFIX} Processing ${offerElements.length} offers`);

  // First, check hidden container for offers that should be restored
  if (hiddenContainer) {
    const hiddenOffers = hiddenContainer.querySelectorAll(OFFERS_SELECTOR);
    for (const hiddenOffer of hiddenOffers) {
      const offerId = getOfferId(hiddenOffer);
      if (!offerId) continue;

      const userId = extractUserIdFromCatalogData(catalogData, offerId);
      const userIsBlacklisted = userId && isUserBlacklisted(userId);
      const offerIsBlacklisted = offerId && isOfferBlacklisted(offerId);

      // If neither seller nor offer is blacklisted, restore this offer
      if (!userIsBlacklisted && !offerIsBlacklisted) {
        updateOfferState(hiddenOffer, { offerId, userId });
      }
    }
  }

  // Then process visible offers
  for (const offerElement of offerElements) {
    const offerId = getOfferId(offerElement);
    if (!offerId) continue;

    // Skip offers in the hidden container (handled above)
    if (hiddenContainer && hiddenContainer.contains(offerElement)) continue;

    const userId = extractUserIdFromCatalogData(catalogData, offerId);
    const userIsBlacklisted = userId && isUserBlacklisted(userId);
    const offerIsBlacklisted = offerId && isOfferBlacklisted(offerId);

    // Check if this element already has buttons
    const hasButtons = offerElement.querySelector('.button-container');

    // If offer should be hidden (seller or offer blacklisted), always process it
    // Otherwise, skip if already has buttons
    if (hasButtons && !userIsBlacklisted && !offerIsBlacklisted) continue;

    updateOfferState(offerElement, { offerId, userId });
  }
}
