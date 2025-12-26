export const Auth = {
  getToken() {
    return localStorage.getItem('synchroEditToken');
  },
  setToken(token) {
    localStorage.setItem('synchroEditToken', token);
  },
  removeToken() {
    localStorage.removeItem('synchroEditToken');
  },
  async verifyToken() {
    let token = this.getToken();
    if (!token || token === 'local-preview-token') {
      // If no token, we might still have a refresh cookie. 
      // Let's try to refresh once before giving up.
      const newToken = await this.tryRefresh();
      if (newToken) {
          // Retry with the new token immediately
          return this.verifyToken();
      }
      
      this.removeToken();
      return false;
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
