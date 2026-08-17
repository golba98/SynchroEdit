(() => {
  const isLocalDevelopment = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  if (!isLocalDevelopment || !('serviceWorker' in navigator)) return;

  const resetLocalCache = async () => {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('syncroedit-'))
            .map((cacheName) => window.caches.delete(cacheName))
        );
      }

      const resetKey = 'syncroedit-dev-cache-reset';
      if (hadController && !sessionStorage.getItem(resetKey)) {
        sessionStorage.setItem(resetKey, 'true');
        window.location.reload();
      } else {
        sessionStorage.removeItem(resetKey);
      }
    } catch (error) {
      console.warn('Local SyncroEdit cache reset failed:', error);
    }
  };

  void resetLocalCache();
})();
