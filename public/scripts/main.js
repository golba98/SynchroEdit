function detectPage() {
  const declaredPage = document.body?.dataset?.page;
  if (declaredPage) return declaredPage;

  const path = window.location.pathname;
  if (path.endsWith('/login.html')) return 'login';
  if (path.endsWith('/signup.html')) return 'signup';
  if (path.endsWith('/forgot-password.html')) return 'forgot-password';
  if (path.endsWith('/reset-password.html')) return 'reset-password';
  if (path.endsWith('/verify.html')) return 'verify';
  if (path.endsWith('/start.html')) return 'start';
  return 'editor';
}

const pageInitializers = {
  editor: () => import('./editor/editor.js').then(({ initEditorPage }) => initEditorPage()),
  login: () => import('./auth/login.js').then(({ initLoginPage }) => initLoginPage()),
  signup: () => import('./auth/signup.js').then(({ initSignupPage }) => initSignupPage()),
  'forgot-password': () =>
    import('./auth/forgotPassword.js').then(({ initForgotPasswordPage }) =>
      initForgotPasswordPage()
    ),
  'reset-password': () =>
    import('./auth/resetPassword.js').then(({ initResetPasswordPage }) => initResetPasswordPage()),
  verify: () => import('./auth/verify.js').then(({ initVerifyPage }) => initVerifyPage()),
  start: () => import('./auth/start.js').then(({ initStartPage }) => initStartPage()),
};

async function initializeCurrentPage() {
  const page = detectPage();
  const initializer = pageInitializers[page];
  if (!initializer) return;
  await initializer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeCurrentPage().catch(logInitError), {
    once: true,
  });
} else {
  initializeCurrentPage().catch(logInitError);
}

function logInitError(error) {
  console.error('Failed to initialize SyncroEdit page:', error);
}
