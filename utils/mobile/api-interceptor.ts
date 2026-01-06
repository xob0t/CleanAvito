/**
 * API interceptor receiver for mobile Avito
 * Receives catalog data from the MAIN world script via custom events
 */

import { appendMobileCatalogData, type MobileCatalogItem } from '../state';

const LOG_PREFIX = '[ave]';

// Callback to be set by initMobile() for triggering page processing
let onDataReceived: (() => void) | null = null;
let listenerInstalled = false;

export function setOnDataReceived(callback: () => void): void {
  onDataReceived = callback;
}

export function installFetchInterceptor(): void {
  // Install listener for data from MAIN world script
  if (listenerInstalled) {
    console.log(`${LOG_PREFIX} API data listener already installed`);
    return;
  }
  listenerInstalled = true;

  window.addEventListener('ave:api-data', ((event: CustomEvent<{ items: MobileCatalogItem[] }>) => {
    const { items } = event.detail;
    if (items && items.length > 0) {
      console.log(`${LOG_PREFIX} Received ${items.length} items from MAIN world`);
      appendMobileCatalogData(items);

      // Trigger page processing if callback is set
      if (onDataReceived) {
        setTimeout(() => onDataReceived!(), 50);
      }
    }
  }) as EventListener);

  console.log(`${LOG_PREFIX} API data listener installed`);
}
