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
        const token = this.getToken();
        if (!token || token === 'local-preview-token') {
            this.removeToken();
            return false;
        }

        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
    logout() {
        this.removeToken();
        window.location.href = 'login.html';
    }
};
