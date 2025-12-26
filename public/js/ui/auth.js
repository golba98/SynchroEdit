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
      this.removeToken();
      return false;
    }

    try {
      let response = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Attempt Refresh on 401
      if (response.status === 401) {
          try {
              const refreshResponse = await fetch('/api/auth/refresh-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
              });
              
              if (refreshResponse.ok) {
                  const data = await refreshResponse.json();
                  this.setToken(data.token);
                  token = data.token;
                  
                  // Retry Profile Fetch
                  response = await fetch('/api/user/profile', {
                      headers: { Authorization: `Bearer ${token}` },
                  });
              }
          } catch (e) {
              // Refresh failed
          }
      }

      if (response.status === 401 || response.status === 403 || response.status === 404) {
        this.removeToken();
        return false;
      }
      return await response.json();
    } catch (err) {
      console.error('Token verification error:', err);
      return false;
    }
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
