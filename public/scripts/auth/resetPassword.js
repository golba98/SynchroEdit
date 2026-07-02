import { Network } from '/js/app/network.js';
import { SynchroBot } from '/js/features/auth/synchro/SynchroBot.js';
import { SynchroRenderer } from '/js/features/auth/synchro/SynchroRenderer.js';
import { PASSWORD_REGEX } from '../utils/validation.js';
import { stripApiErrorPrefix } from '../utils/errors.js';

export function initResetPasswordPage() {
  const container = document.querySelector('.character-container');
  let synchro = null;
  let renderer = null;

  if (container) {
    synchro = new SynchroBot({ authFlow: 'reset' });
    synchro.init('.character-container');

    renderer = new SynchroRenderer(container);
    renderer.injectParticleCSS();
  }

  const usernameInput = document.getElementById('usernameConfirm');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const mfaInput = document.getElementById('mfaCode');
  const mfaGroup = document.getElementById('mfaGroup');
  const resetBtn = document.getElementById('resetBtn');
  const statusMessage = document.getElementById('statusMessage');
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    statusMessage.textContent = '✗ Invalid or missing reset token.';
    statusMessage.className = 'status-message error';
    resetBtn.disabled = true;
    document.querySelector('.subtitle').textContent = 'Please request a new link.';
    synchro?.onError();
  }

  usernameInput?.addEventListener('focus', () => {
    synchro?.onFieldFocus('username', usernameInput.value);
  });

  usernameInput?.addEventListener('input', () => {
    synchro?.onFieldInput('username', usernameInput.value, {
      formData: {
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
      },
    });
  });

  usernameInput?.addEventListener('blur', () => {
    synchro?.onFieldBlur();
  });

  passwordInput?.addEventListener('focus', () => {
    synchro?.onFieldFocus('password', passwordInput.value);
  });

  passwordInput?.addEventListener('input', () => {
    const isStrong = PASSWORD_REGEX.test(passwordInput.value);
    synchro?.onFieldInput('password', passwordInput.value, {
      formData: {
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
        _hasErrors: !isStrong && passwordInput.value.length > 0,
      },
    });
  });

  passwordInput?.addEventListener('blur', () => {
    synchro?.onFieldBlur();
  });

  confirmInput?.addEventListener('focus', () => {
    synchro?.onFieldFocus('confirmPassword', confirmInput.value);
  });

  confirmInput?.addEventListener('input', () => {
    const passwordsMatch = passwordInput.value === confirmInput.value;
    synchro?.onFieldInput('confirmPassword', confirmInput.value, {
      formData: {
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
        _hasErrors: !passwordsMatch && confirmInput.value.length > 0,
      },
    });
  });

  confirmInput?.addEventListener('blur', () => {
    synchro?.onFieldBlur();
  });

  resetBtn?.addEventListener('mouseenter', () => {
    synchro?.onButtonHover(true);
  });

  resetBtn?.addEventListener('mouseleave', () => {
    synchro?.onButtonHover(false);
  });

  const handleReset = async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const mfaCode = mfaInput.value;

    if (!username || !password || !confirm) {
      statusMessage.textContent = 'Please fill in all fields.';
      statusMessage.className = 'status-message error';
      synchro?.onError();
      return;
    }

    if (password !== confirm) {
      statusMessage.textContent = '✗ Passwords do not match.';
      statusMessage.className = 'status-message error';
      synchro?.onError();
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      statusMessage.textContent =
        '✗ Password too weak (Min 8 chars, Upper, Lower, Number, Symbol).';
      statusMessage.className = 'status-message error';
      synchro?.onError();
      return;
    }

    synchro?.onSubmit();
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    statusMessage.textContent = '';

    try {
      await Network.fetchAPI('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, username, mfaCode }),
      });

      synchro?.onSuccess();
      renderer?.burst('star', 5);
      statusMessage.textContent = '✓ Password reset! Redirecting to login...';
      statusMessage.className = 'status-message success';

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } catch (error) {
      synchro?.onError();
      if (error.data?.mfaRequired) {
        mfaGroup.style.display = 'block';
        statusMessage.textContent = '✗ 2FA code required for this account.';
      } else {
        statusMessage.textContent = '✗ ' + (stripApiErrorPrefix(error.message) || 'Reset failed.');
      }
      statusMessage.className = 'status-message error';
      resetBtn.disabled = false;
      resetBtn.textContent = 'Set New Password';
    }
  };

  resetBtn?.addEventListener('click', handleReset);
  passwordInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') confirmInput?.focus();
  });
  confirmInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') handleReset();
  });
}
