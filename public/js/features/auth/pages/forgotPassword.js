import { Network } from '/js/app/network.js';
import { SynchroBot } from '/js/features/auth/synchro/SynchroBot.js';
import { SynchroRenderer } from '/js/features/auth/synchro/SynchroRenderer.js';
import { isValidEmail } from '/js/core/validation.js';
import { stripApiErrorPrefix } from '/js/core/errors.js';

export function initForgotPasswordPage() {
  const container = document.querySelector('.character-container');
  let synchro = null;
  let renderer = null;

  if (container) {
    synchro = new SynchroBot({ authFlow: 'forgot' });
    synchro.init('.character-container');

    renderer = new SynchroRenderer(container);
    renderer.injectParticleCSS();
  }

  const emailInput = document.getElementById('email');
  const sendBtn = document.getElementById('sendBtn');
  const statusMessage = document.getElementById('statusMessage');

  emailInput?.addEventListener('focus', () => {
    synchro?.onFieldFocus('email', emailInput.value);
  });

  emailInput?.addEventListener('input', () => {
    synchro?.onFieldInput('email', emailInput.value, {
      formData: { email: emailInput.value, _hasErrors: !emailInput.value.includes('@') },
    });
  });

  emailInput?.addEventListener('blur', () => {
    synchro?.onFieldBlur();
  });

  sendBtn?.addEventListener('mouseenter', () => {
    synchro?.onButtonHover(true);
  });

  sendBtn?.addEventListener('mouseleave', () => {
    synchro?.onButtonHover(false);
  });

  const handleForgot = async () => {
    const email = emailInput.value.trim();
    if (!email) {
      statusMessage.textContent = 'Please enter your email.';
      statusMessage.className = 'status-message error';
      synchro?.onError();
      return;
    }

    if (!isValidEmail(email)) {
      statusMessage.textContent = 'Please enter a valid email address.';
      statusMessage.className = 'status-message error';
      synchro?.onError();
      setTimeout(() => synchro?.applyState('empathy'), 2000);
      return;
    }

    synchro?.onSubmit();
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    statusMessage.textContent = '';

    try {
      const data = await Network.fetchAPI('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      synchro?.onSuccess();
      renderer?.burst('star', 3);
      statusMessage.textContent = '✓ ' + data.message;
      statusMessage.className = 'status-message success';
      emailInput.value = '';
    } catch (error) {
      synchro?.onError();
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
