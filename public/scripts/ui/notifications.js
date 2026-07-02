export function showToast(message, type = 'info') {
  window.dispatchEvent(
    new CustomEvent('syncroedit:toast', {
      detail: { message, type },
    })
  );
}

export function showError(message) {
  showToast(message, 'error');
}

export function showSuccess(message) {
  showToast(message, 'success');
}
