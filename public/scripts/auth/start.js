export function initStartPage() {
  setTimeout(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.location.href = 'login.html?autologin=true';
    } else {
      window.location.href = 'login.html';
    }
  }, 2000);
}
