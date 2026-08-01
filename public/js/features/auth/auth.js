import { apiGet, apiPost, setAuthHooks } from '../../core/api.js';
import { LOGIN_PAGE_PATH } from '../../core/config.js';

let accessToken = null;

export function normalizeVerificationUser(user) {
  if (!user || typeof user !== 'object') return user;

  const emailVerified = user.email_verified_at !== null && user.email_verified_at !== undefined;
  return { ...user, emailVerified, isEmailVerified: emailVerified };
}

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token || null;
}

export function storeSession(session = {}) {
  if (session.token) setToken(session.token);
  return session;
}

export function clearSession() {
  accessToken = null;
  // Legacy key, kept with the historical "syncro" spelling: tokens now live in memory only, and
  // this clears the stale value still sitting in existing users' browsers.
  localStorage.removeItem('syncroEditToken');
}

export const removeToken = clearSession;

export async function verifyToken() {
  try {
    return normalizeVerificationUser(await apiGet('/api/user/profile'));
  } catch (error) {
    if (error.code === 'EMAIL_VERIFICATION_REQUIRED' || error.status === 403) {
      return { isEmailVerified: false, emailVerified: false };
    }
    console.error('Token verification error:', error);
    clearSession();
    return false;
  }
}

export async function getCurrentUser() {
  return (await verifyToken()) || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) window.location.href = LOGIN_PAGE_PATH;
  return user;
}

export async function tryRefresh() {
  try {
    const data = await apiPost('/api/auth/refresh-token');
    if (data?.token) {
      setToken(data.token);
      return data.token;
    }
  } catch (error) {
    console.error('Refresh attempt failed', error);
  }
  return false;
}

export async function logout() {
  try {
    await apiPost('/api/auth/logout');
  } catch (error) {
    console.error('Logout failed:', error);
  }
  clearSession();
  window.location.href = LOGIN_PAGE_PATH;
}

export const Auth = {
  getToken,
  setToken,
  removeToken,
  clearSession,
  storeSession,
  verifyToken,
  tryRefresh,
  logout,
};

setAuthHooks({ getToken, setToken, logout });
