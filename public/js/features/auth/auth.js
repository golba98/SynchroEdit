import { Network } from '/js/app/network.js';

let _accessToken = null;

export const Auth = {
  getToken() {
    return _accessToken;
  },
  setToken(token) {
    _accessToken = token;
  },
  removeToken() {
    _accessToken = null;
    // Clear any legacy local storage just in case
    localStorage.removeItem('synchroEditToken');
  },
  async verifyToken() {
    let token = this.getToken();

    // If no token in memory, try to refresh immediately (Restore Session)
    if (!token) {
      // Network.fetchAPI will handle refresh if we call an endpoint that requires auth
      // but here we want to explicitly try it to see if we HAVE a session
    }

    try {
      const data = await Network.fetchAPI('/api/user/profile');
      return data;
    } catch (err) {
      console.error('Token verification error:', err);
      this.removeToken();
      return false;
    }
  },

  async tryRefresh() {
    try {
      const data = await Network.fetchAPI('/api/auth/refresh-token', {
        method: 'POST',
      });
      if (data.token) {
        this.setToken(data.token);
        return data.token;
      }
    } catch (e) {
      console.error('Refresh attempt failed', e);
    }
    return false;
  },
  async logout() {
    try {
      await Network.fetchAPI('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    this.removeToken();
    window.location.href = '/pages/login.html';
  },
};
