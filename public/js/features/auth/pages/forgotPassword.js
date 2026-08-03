import { Network } from '/js/app/network.js';
import { SyncroBot } from '/js/features/auth/syncro/SyncroBot.js';
import { SyncroRenderer } from '/js/features/auth/syncro/SyncroRenderer.js';
import { isValidEmail } from '/js/core/validation.js';
import { stripApiErrorPrefix } from '/js/core/errors.js';

export function initForgotPasswordPage() {
  const container = document.querySelector('.character-container');
  let syncro = null;
  let renderer = null;

  if (container) {
    syncro = new SyncroBot({ authFlow: 'forgot' });
    syncro.init('.character-container');

    renderer = new SyncroRenderer(container);
    renderer.injectParticleCSS();
  }

  const emailInput = document.getElementById('email');
  const sendBtn = document.getElementById('sendBtn');
  const statusMessage = document.getElementById('statusMessage');

  emailInput?.addEventListener('focus', () => {
    syncro?.onFieldFocus('email', emailInput.value);
  });

  emailInput?.addEventListener('input', () => {
    syncro?.onFieldInput('email', emailInput.value, {
      formData: { email: emailInput.value, _hasErrors: !emailInput.value.includes('@') },
    });
  });

  emailInput?.addEventListener('blur', () => {
    syncro?.onFieldBlur();
  });

  sendBtn?.addEventListener('mouseenter', () => {
    syncro?.onButtonHover(true);
  });

  sendBtn?.addEventListener('mouseleave', () => {
    syncro?.onButtonHover(false);
  });

  const handleForgot = async () => {
    const email = emailInput.value.trim();
    if (!email) {
      statusMessage.textContent = 'Please enter your email.';
      statusMessage.className = 'status-message error';
      syncro?.onError();
      return;
    }

    if (!isValidEmail(email)) {
      statusMessage.textContent = 'Please enter a valid email address.';
      statusMessage.className = 'status-message error';
      syncro?.onError();
      setTimeout(() => syncro?.applyState('empathy'), 2000);
      return;
    }

    syncro?.onSubmit();
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    statusMessage.textContent = '';

    try {
      const data = await Network.fetchAPI('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      syncro?.onSuccess();
      renderer?.burst('star', 3);
      statusMessage.textContent = '✓ ' + data.message;
      statusMessage.className = 'status-message success';
      emailInput.value = '';
    } catch (error) {
      syncro?.onError();
      statusMessage.textContent =
        '✗ ' + (stripApiErrorPrefix(error.message) || 'Failed to send request.');
      statusMessage.className = 'status-message error';
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Reset Link';
    }
  };

  sendBtn?.addEventListener('click', handleForgot);
  emailInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') handleForgot();
  });
}
