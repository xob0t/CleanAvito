const OFFERS_ROOT_SELECTOR = '[elementtiming="bx.catalog.container"]';

export function createHiddenContainer() {
  const offersRoot = document.querySelector(OFFERS_ROOT_SELECTOR);
  if (!offersRoot) return null;

  const existingContainerEl = document.querySelector('.hidden-container');
  if (existingContainerEl) return existingContainerEl;

  const hr = document.createElement('hr');
  hr.classList.add('custom-hr');

  const detailsElement = document.createElement('details');

  const summaryElement = document.createElement('summary');
  summaryElement.textContent = 'Скрытые объявления';
  summaryElement.classList.add('custom-summary');

  const contentElement = document.createElement('div');
  contentElement.classList.add('hidden-container');

  detailsElement.appendChild(summaryElement);
  detailsElement.appendChild(contentElement);

  offersRoot.appendChild(hr);
  offersRoot.appendChild(detailsElement);

  return contentElement;
}
