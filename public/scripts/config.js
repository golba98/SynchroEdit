export const API_BASE_PATH = '';
export const DEFAULT_REALTIME_BACKEND = 'durable-object';
export const LOGIN_PAGE_PATH = '/pages/login.html';
export const EDITOR_PAGE_PATH = '/';

export function getRuntimeConfig() {
  return window.SYNCROEDIT_CONFIG || {};
}

export function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url);
}

export function buildApiUrl(url) {
  if (isAbsoluteUrl(url)) return url;

  const apiBaseUrl = trimTrailingSlash(getRuntimeConfig().API_BASE_URL || API_BASE_PATH);
  if (!apiBaseUrl) return url;

  const requestPath = String(url).replace(/^\/+/, '');
  return `${apiBaseUrl}/${requestPath}`;
}

export function getWebSocketBaseUrl() {
  const config = getRuntimeConfig();
  const explicitWsBaseUrl = trimTrailingSlash(config.WS_BASE_URL);

  if (explicitWsBaseUrl) return explicitWsBaseUrl;

  const apiBaseUrl = trimTrailingSlash(config.API_BASE_URL);
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export function getRealtimeBackend() {
  return getRuntimeConfig().REALTIME_BACKEND || DEFAULT_REALTIME_BACKEND;
}

export function isProductionHost() {
  return (
    window.location.hostname === 'syncroedit.online' ||
    window.location.hostname === 'www.syncroedit.online'
  );
}
