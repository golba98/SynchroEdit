export function openSettings(app, options = {}) {
  return app?.profile?.openProfileModal?.(options);
}

export function updateProfileAccent(app, color) {
  return app?.profile?.updateAccentColor?.(color);
}
