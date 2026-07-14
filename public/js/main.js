function detectPage() {
  const declaredPage = document.body?.dataset?.page;
  if (declaredPage) return declaredPage;

  const path = window.location.pathname;
  if (path.endsWith('/login.html')) return 'login';
  if (path.endsWith('/forgot-password.html')) return 'forgot-password';
  if (path.endsWith('/reset-password.html')) return 'reset-password';
  if (path.endsWith('/verify.html')) return 'verify';
  return 'editor';
}

const pageInitializers = {
  editor: () => import('./app/bootstrap.js').then(({ initEditorPage }) => initEditorPage()),
  login: () =>
    import('./features/auth/pages/login.js').then(({ initLoginPage }) => initLoginPage()),
  'forgot-password': () =>
    import('./features/auth/pages/forgotPassword.js').then(({ initForgotPasswordPage }) =>
      initForgotPasswordPage()
    ),
  'reset-password': () =>
    import('./features/auth/pages/resetPassword.js').then(({ initResetPasswordPage }) =>
      initResetPasswordPage()
    ),
  verify: () =>
    import('./features/auth/pages/verify.js').then(({ initVerifyPage }) => initVerifyPage()),
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
