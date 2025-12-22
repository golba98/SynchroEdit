import { Auth } from './auth.js';
import { Network } from '../core/network.js';

export class Profile {
  constructor() {
    this.user = null;
  }

  async loadProfile() {
    this.user = await Auth.verifyToken();
    if (this.user) {
      this.updateUI();
    }
    return this.user;
  }

  updateUI() {
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) profileUsername.textContent = this.user.username;

    const pfpElements = [
      document.getElementById('profilePfp'),
      document.getElementById('headerPfp'),
      document.getElementById('libraryHeaderPfp'),
    ];
    const iconElements = [
      document.getElementById('profilePfpPlaceholder'),
      document.getElementById('headerUserIcon'),
      document.getElementById('libraryHeaderUserIcon'),
    ];

    if (this.user.profilePicture) {
      pfpElements.forEach((el) => {
        if (el) {
          el.src = this.user.profilePicture;
          el.style.display = 'block';
        }
      });
      iconElements.forEach((el) => {
        if (el) el.style.display = 'none';
      });
    } else {
      pfpElements.forEach((el) => {
        if (el) el.style.display = 'none';
      });
      iconElements.forEach((el) => {
        if (el) el.style.display = 'flex';
      });
    }
  }

  async updateProfilePicture(base64String) {
    try {
      const data = await Network.fetchAPI('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ profilePicture: base64String }),
      });
      this.user.profilePicture = data.profilePicture;
      this.updateUI();
      alert('Profile picture updated!');
    } catch (err) {
      console.error('Error updating PFP:', err);
      alert('Failed to update profile picture');
    }
  }

  async updatePassword(currentPassword, newPassword) {
    try {
      await Network.fetchAPI('/api/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      alert('Password updated successfully!');
      return true;
    } catch (err) {
      console.error('Error updating password:', err);
      alert('Failed to update password');
      return false;
    }
  }
}
