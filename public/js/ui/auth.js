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
      token = await this.tryRefresh();
      if (!token) {
          // Final check: is there a legacy token we should migrate?
          // (Optional, but good for UX during transition)
          const legacy = localStorage.getItem('synchroEditToken');
          if (legacy) {
              localStorage.removeItem('synchroEditToken'); // Migrate once
              // We could try to use it, but safer to just fail and force re-login if refresh failed
          }
          return false;
      }
    }

    try {
      let response = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Attempt Refresh on 401
      if (response.status === 401) {
          const newToken = await this.tryRefresh();
          if (newToken) {
              response = await fetch('/api/user/profile', {
                  headers: { Authorization: `Bearer ${newToken}` },
              });
          }
      }

      if (!response.ok) {
        this.removeToken();
        return false;
      }
      return await response.json();
    } catch (err) {
      console.error('Token verification error:', err);
      return false;
    }
  },

  async tryRefresh() {
      try {
          const refreshResponse = await fetch('/api/auth/refresh-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
          });
          
          if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              if (data.token) {
                  this.setToken(data.token);
                  return data.token; // Return the token
              }
          }
      } catch (e) {
          console.error('Refresh attempt failed', e);
      }
      return false;
  },
  async logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout failed:', err);
    }
    this.removeToken();
    window.location.href = 'pages/login.html';
  },
};
