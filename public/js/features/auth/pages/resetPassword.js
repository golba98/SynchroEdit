import { Network } from '/js/app/network.js';
import { SyncroBot } from '/js/features/auth/syncro/SyncroBot.js';
import { PASSWORD_REGEX } from '/js/core/validation.js';
import { stripApiErrorPrefix } from '/js/core/errors.js';

export function initResetPasswordPage() {
  const container = document.querySelector('.character-container');
  let syncro = null;

  if (container) {
    syncro = new SyncroBot({ authFlow: 'reset' });
    syncro.init('.character-container');
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
    syncro?.onError();
  }

  usernameInput?.addEventListener('focus', () => {
    syncro?.onFieldFocus('username', usernameInput.value);
  });

  usernameInput?.addEventListener('input', () => {
    syncro?.onFieldInput('username', usernameInput.value, {
      formData: {
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
      },
    });
  });

  usernameInput?.addEventListener('blur', () => {
    syncro?.onFieldBlur();
  });

  passwordInput?.addEventListener('focus', () => {
    syncro?.onFieldFocus('password', passwordInput.value);
  });

  passwordInput?.addEventListener('input', () => {
    const isStrong = PASSWORD_REGEX.test(passwordInput.value);
    syncro?.onFieldInput('password', passwordInput.value, {
      formData: {
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
        _hasErrors: !isStrong && passwordInput.value.length > 0,
      },
    });
  });

  passwordInput?.addEventListener('blur', () => {
    syncro?.onFieldBlur();
  });

  confirmInput?.addEventListener('focus', () => {
    syncro?.onFieldFocus('confirmPassword', confirmInput.value);
  });

  confirmInput?.addEventListener('input', () => {
    const passwordsMatch = passwordInput.value === confirmInput.value;
    syncro?.onFieldInput('confirmPassword', confirmInput.value, {
      formData: {
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
        _hasErrors: !passwordsMatch && confirmInput.value.length > 0,
      },
    });
  });

  confirmInput?.addEventListener('blur', () => {
    syncro?.onFieldBlur();
  });

  resetBtn?.addEventListener('mouseenter', () => {
    syncro?.onButtonHover(true);
  });

  resetBtn?.addEventListener('mouseleave', () => {
    syncro?.onButtonHover(false);
  });

  const handleReset = async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const mfaCode = mfaInput.value;

    if (!username || !password || !confirm) {
      statusMessage.textContent = 'Please fill in all fields.';
      statusMessage.className = 'status-message error';
      syncro?.onError();
      return;
    }

    if (password !== confirm) {
      statusMessage.textContent = '✗ Passwords do not match.';
      statusMessage.className = 'status-message error';
      syncro?.onError();
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      statusMessage.textContent =
        '✗ Password too weak (Min 8 chars, Upper, Lower, Number, Symbol).';
      statusMessage.className = 'status-message error';
      syncro?.onError();
      return;
    }

    syncro?.onSubmit();
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    statusMessage.textContent = '';

    try {
      await Network.fetchAPI('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, username, mfaCode }),
      });

      syncro?.onSuccess();
      statusMessage.textContent = '✓ Password reset! Redirecting to login...';
      statusMessage.className = 'status-message success';
      window.location.href = 'login.html';
    } catch (error) {
      syncro?.onError();
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
