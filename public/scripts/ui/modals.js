export function openModal(modalOrSelector, display = 'flex') {
  const modal =
    typeof modalOrSelector === 'string' ? document.querySelector(modalOrSelector) : modalOrSelector;
  if (modal) modal.style.display = display;
}

export function closeModal(modalOrSelector) {
  const modal =
    typeof modalOrSelector === 'string' ? document.querySelector(modalOrSelector) : modalOrSelector;
  if (modal) modal.style.display = 'none';
}

export function bindModalClose(modalOrSelector, closeSelector) {
  const modal =
    typeof modalOrSelector === 'string' ? document.querySelector(modalOrSelector) : modalOrSelector;
  const closeButton = modal?.querySelector(closeSelector);
  closeButton?.addEventListener('click', () => closeModal(modal));
}
