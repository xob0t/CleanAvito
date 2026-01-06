/**
 * Main world script for intercepting fetch/XHR
 * Runs in the page's JavaScript context to intercept API calls
 * Injected via injectScript from content.ts
 */

export default defineUnlistedScript(() => {
  const LOG_PREFIX = '[ave:main]';
  const isMobile = window.location.hostname === 'm.avito.ru';

  if (!isMobile) {
    // Only need fetch interception on mobile
    return;
  }

  // Don't install twice
  if ((window as Window & { __aveFetchIntercepted?: boolean }).__aveFetchIntercepted) {
    return;
  }
  (window as Window & { __aveFetchIntercepted?: boolean }).__aveFetchIntercepted = true;

  interface MobileCatalogItem {
    id: number;
    type: string;
    value?: {
      userId?: number;
    };
  }

  interface ApiResponse {
    result?: {
      items?: MobileCatalogItem[];
    };
  }

  function processApiResponse(url: string, responseText: string): void {
    if (url && /\/api\/\d+\/items/.test(url)) {
      try {
        const data = JSON.parse(responseText) as ApiResponse;
        if (data.result?.items && Array.isArray(data.result.items)) {
          const items = data.result.items.filter(item => item.type === 'item');
          if (items.length > 0) {
            console.log(`${LOG_PREFIX} Intercepted ${items.length} items from API`);
            // Send to isolated world via custom event
            window.dispatchEvent(new CustomEvent('ave:api-data', {
              detail: { items }
            }));
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch.call(this, input, init);
    const url = typeof input === 'string' ? input : (input as Request).url;

    if (url && /\/api\/\d+\/items/.test(url)) {
      const clone = response.clone();
      try {
        const text = await clone.text();
        processApiResponse(url, text);
      } catch {
        // Ignore
      }
    }

    return response;
  };

  // Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  interface ExtendedXHR extends XMLHttpRequest {
    _aveUrl?: string;
  }

  XMLHttpRequest.prototype.open = function(
    this: ExtendedXHR,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ): void {
    this._aveUrl = url.toString();
    return originalXhrOpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function(this: ExtendedXHR, body?: Document | XMLHttpRequestBodyInit | null): void {
    this.addEventListener('load', function(this: ExtendedXHR) {
      if (this._aveUrl && /\/api\/\d+\/items/.test(this._aveUrl)) {
        processApiResponse(this._aveUrl, this.responseText);
      }
    });
    return originalXhrSend.call(this, body);
  };

  console.log(`${LOG_PREFIX} Fetch/XHR interceptor installed at document_start`);
});
