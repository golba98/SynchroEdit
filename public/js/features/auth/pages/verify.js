import { Network } from '/js/app/network.js';
import { Auth } from '/js/features/auth/auth.js';
import { SyncroBot } from '/js/features/auth/syncro/SyncroBot.js';
import {
  getEmailConfigurationErrorMessage,
  isEmailConfigurationError,
  stripApiErrorPrefix,
} from '/js/core/errors.js';

export function initVerifyPage() {
  const container = document.querySelector('.character-container');
  let syncro = null;

  if (container) {
    syncro = new SyncroBot({ authFlow: 'verify' });
    syncro.init('.character-container');
  }

  const params = new URLSearchParams(window.location.search);
  const storedEmail = sessionStorage.getItem('verificationEmail');
  const email = storedEmail || params.get('email');
  const verificationMessage =
    sessionStorage.getItem('verificationMessage') || 'Use the code we just sent to continue.';
  const docId = sessionStorage.getItem('postLoginDocId');

  const emailValueEl = document.getElementById('emailValue');
  const introTextEl = document.getElementById('introText');
  const codeInput = document.getElementById('codeInput');
  const verifyBtn = document.getElementById('verifyBtn');
  const resendBtn = document.getElementById('resendBtn');
  const statusMessage = document.getElementById('statusMessage');
  const lastMessage = document.getElementById('lastMessage');

  const setStatus = (text, type = '') => {
    statusMessage.textContent = text;
    statusMessage.className = 'status ' + type;
    if (type === 'error') {
      syncro?.onError();
    }
  };

  const startResendCooldown = () => {
    let remaining = 30;
    resendBtn.textContent = `Resend in ${remaining}s`;
    resendBtn.disabled = true;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend code';
        return;
      }
      resendBtn.textContent = `Resend in ${remaining}s`;
    }, 1000);
  };

  if (!email) {
    window.location.href = 'login.html';
    return;
  }

  emailValueEl.textContent = email;
  lastMessage.textContent = verificationMessage;

  const codeSent = sessionStorage.getItem('codeSent') === 'true';
  const signupSuccess = sessionStorage.getItem('signupSuccess') === 'true';
  const verificationErrorCode = sessionStorage.getItem('verificationErrorCode');

  sessionStorage.removeItem('codeSent');
  sessionStorage.removeItem('signupSuccess');
  sessionStorage.removeItem('verificationErrorCode');

  if (codeSent) {
    if (signupSuccess) {
      introTextEl.textContent = `Account created.\nWe sent a 6-digit verification code to ${email}.`;
    } else {
      introTextEl.textContent = `We sent a 6-digit verification code to ${email}.`;
    }
    resendBtn.textContent = 'Resend code';
    setStatus('Code sent. Check your email.', 'success');
    startResendCooldown();
  } else {
    if (signupSuccess) {
      introTextEl.textContent = `Account created.\nSend a verification code to ${email}.`;
    } else {
      introTextEl.textContent = `Send a verification code to ${email}.`;
    }
    resendBtn.textContent = 'Send code';

    if (verificationErrorCode === 'EMAIL_NOT_CONFIGURED') {
      setStatus(getEmailConfigurationErrorMessage(), 'error');
    }
  }

  codeInput?.addEventListener('focus', () => {
    syncro?.onFieldFocus('code', codeInput.value);
  });

  codeInput?.addEventListener('input', () => {
    const isComplete = codeInput.value.length === 6;
    syncro?.onFieldInput('code', codeInput.value, {
      formData: {
        code: codeInput.value,
        _hasErrors: false,
      },
    });
    if (isComplete) {
      syncro?.applyState('hover-ready');
    }
  });

  codeInput?.addEventListener('blur', () => {
    syncro?.onFieldBlur();
  });

  verifyBtn?.addEventListener('mouseenter', () => {
    syncro?.onButtonHover(true);
  });

  verifyBtn?.addEventListener('mouseleave', () => {
    syncro?.onButtonHover(false);
  });

  const sendCode = async () => {
    setStatus('Sending code...', '');
    syncro?.onSubmit();
    resendBtn.disabled = true;
    const isResend = resendBtn.textContent === 'Resend code';
    resendBtn.textContent = isResend ? 'Resending...' : 'Sending...';

    try {
      await Network.fetchAPI('/api/auth/send-verification', {
        method: 'POST',
        body: JSON.stringify({ email, purpose: 'signup' }),
      });
      syncro?.applyState('idle');
      setStatus('Code sent. Check your email.', 'success');
      introTextEl.textContent = `We sent a 6-digit verification code to ${email}.`;
      resendBtn.textContent = 'Resend code';
      codeInput.value = '';
      codeInput.focus();
      startResendCooldown();
    } catch (error) {
      console.error('Resend error:', error);
      syncro?.onError();
      resendBtn.textContent = isResend ? 'Resend code' : 'Send code';

      const code = error.data?.code;
      if (isEmailConfigurationError(code)) {
        setStatus(getEmailConfigurationErrorMessage(), 'error');
      } else {
        setStatus(stripApiErrorPrefix(error.message) || 'Unable to send code. Try again.', 'error');
      }
      resendBtn.disabled = false;
    }
  };

  const verifyCode = async () => {
    const code = codeInput.value.trim();
    if (!code || code.length < 6) {
      setStatus('Enter the 6-digit code.', 'error');
      codeInput.focus();
      return;
    }

    syncro?.onSubmit();
    setStatus('Verifying...', '');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';

    try {
      const data = await Network.fetchAPI('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code, purpose: 'signup' }),
      });

      syncro?.onSuccess();
      setStatus(data.message || 'Email verified. Please sign in.', 'success');
      Auth.removeToken();
      sessionStorage.removeItem('verificationEmail');
      sessionStorage.removeItem('verificationUsername');
      sessionStorage.removeItem('verificationMessage');
      const redirectUrl = docId
        ? `login.html?verified=1&doc=${encodeURIComponent(docId)}`
        : 'login.html?verified=1';
      sessionStorage.removeItem('postLoginDocId');
      window.location.href = redirectUrl;
    } catch (error) {
      console.error('Verification error:', error);
      syncro?.onError();
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify code';

      const code = error.data?.code;
      if (isEmailConfigurationError(code)) {
        setStatus(getEmailConfigurationErrorMessage(), 'error');
      } else {
        setStatus(stripApiErrorPrefix(error.message) || 'Invalid code. Try again.', 'error');
      }
    }
  };

  resendBtn?.addEventListener('click', sendCode);
  verifyBtn?.addEventListener('click', verifyCode);
  codeInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') verifyCode();
  });
  codeInput?.focus();
}
