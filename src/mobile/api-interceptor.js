import { appendMobileCatalogData } from '../core/state.js';

const LOG_PREFIX = '[ave]';

// Callback to be set by initMobile() for triggering page processing
let onDataReceived = null;

export function setOnDataReceived(callback) {
  onDataReceived = callback;
}

function processApiResponse(url, responseText) {
  // Check if this is the items API (matches /api/11/items, /api/9/items, etc.)
  if (url && /\/api\/\d+\/items/.test(url)) {
    try {
      const data = JSON.parse(responseText);
      if (data.result?.items && Array.isArray(data.result.items)) {
        // Filter out banners and other non-item types, only keep actual items
        const items = data.result.items.filter(item => item.type === 'item');
        if (items.length > 0) {
          console.log(`${LOG_PREFIX} Intercepted ${items.length} items from API`);
        }
        appendMobileCatalogData(items);

        // Trigger page processing if callback is set
        if (onDataReceived) {
          setTimeout(() => onDataReceived(), 50);
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
}

export function installFetchInterceptor() {
  // Don't install twice
  if (window.__aveFetchIntercepted) {
    console.log(`${LOG_PREFIX} Fetch interceptor already installed`);
    return;
  }
  window.__aveFetchIntercepted = true;

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const response = await originalFetch.call(this, input, init);
    const url = typeof input === 'string' ? input : input.url;

    if (url && /\/api\/\d+\/items/.test(url)) {
      const clone = response.clone();
      try {
        const text = await clone.text();
        processApiResponse(url, text);
      } catch (e) {
        // Ignore
      }
    }

    return response;
  };

  // Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._aveUrl = url;
    return originalXhrOpen.call(this, method, url, ...args);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (this._aveUrl && /\/api\/\d+\/items/.test(this._aveUrl)) {
        processApiResponse(this._aveUrl, this.responseText);
      }
    });
    return originalXhrSend.call(this, ...args);
  };

  console.log(`${LOG_PREFIX} Fetch/XHR interceptor installed`);
}
