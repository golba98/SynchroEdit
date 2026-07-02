import { LOGIN_PAGE_PATH } from '../config.js';
import { apiGet, apiPost, setAuthHooks } from '../api.js';
import { setCurrentUser } from '../state.js';

let accessToken = null;

export function normalizeVerificationUser(user) {
  if (!user || typeof user !== 'object') return user;

  const emailVerified = user.email_verified_at !== null && user.email_verified_at !== undefined;

  return {
    ...user,
    emailVerified,
    isEmailVerified: emailVerified,
  };
}

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token || null;
}

export function storeSession(session = {}) {
  if (session.token) {
    setToken(session.token);
  }
  if (session.user) {
    setCurrentUser(normalizeVerificationUser(session.user));
  }
  return session;
}

export function clearSession() {
  accessToken = null;
  setCurrentUser(null);
  localStorage.removeItem('synchroEditToken');
}

export const removeToken = clearSession;

export async function verifyToken() {
  try {
    const data = await apiGet('/api/user/profile');
    const user = normalizeVerificationUser(data);
    setCurrentUser(user);
    return user;
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
  const user = await verifyToken();
  return user || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = LOGIN_PAGE_PATH;
  }
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

setAuthHooks({
  getToken,
  setToken,
  logout,
});
