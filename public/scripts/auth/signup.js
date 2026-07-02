import { initLoginPage } from './login.js';

export function initSignupPage() {
  return initLoginPage({ initialForm: 'signup' });
}
