import { Auth } from '/js/features/auth/auth.js';
import { Network } from '/js/app/network.js';
import { SynchroBot } from '/js/features/auth/synchro/SynchroBot.js';
import { SynchroRenderer } from '/js/features/auth/synchro/SynchroRenderer.js';

export class AuthController {
  constructor() {
    // Initialize SynchroBot
    this.synchro = null;
    this.renderer = null;

    // Legacy references (for compatibility)
    this.botRig = document.getElementById('botRig');
    this.pupils = document.querySelectorAll('.pupil');

    // State flags
    this.isProcessing = false;

    this.setupEventListeners();
    this.init();
  }

  init() {
    // Initialize SynchroBot if container exists
    const container = document.querySelector('.character-container');
    if (container) {
      this.synchro = new SynchroBot({ authFlow: this.detectAuthFlow() });
      this.synchro.init('.character-container');

      this.renderer = new SynchroRenderer(container);
      this.renderer.injectParticleCSS();

      // Listen for sleep to create Zzz particles
      this.synchro.on('sleep', () => {
        this.renderer.startParticleLoop('zzz', 2500);
      });

      this.synchro.on('wakeUp', () => {
        this.renderer.stopParticleLoop();
      });
    }

    this.checkExistingSession();
    this.checkAutoLogin();
  }

  detectAuthFlow() {
    // Detect which form is active
    if (document.getElementById('signupForm')?.classList.contains('active')) {
      return 'signup';
    }
    return 'login';
  }

  checkAutoLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (urlParams.get('autologin') === 'true' && isLocal) {
      const userField = document.getElementById('loginUsername');
      const passField = document.getElementById('loginPassword');

      if (userField && passField) {
        userField.value = 'tester';
        passField.value = 'TesterPassword123!';
        // Trigger input events to update UI/Bot state
        userField.dispatchEvent(new Event('input'));
        passField.dispatchEvent(new Event('input'));

        // Small delay to let UI settle then login
        setTimeout(() => {
          this.handleLogin();
        }, 500);
      }
    }
  }

  async checkExistingSession() {
    try {
      const data = await Network.fetchAPI('/api/auth/refresh-token', { method: 'POST' });
      Auth.setToken(data.token);
      const docId = new URLSearchParams(window.location.search).get('doc');
      window.location.href = docId ? `../index.html?doc=${docId}` : '../index.html';
    } catch (e) {
      /* Ignore */
    }
  }

  setupEventListeners() {
    // Form Toggles
    document.getElementById('showSignup').onclick = () => this.toggleForm('signup');
    document.getElementById('showLogin').onclick = () => this.toggleForm('login');
    document.getElementById('signupBackBtn').onclick = () => this.toggleForm('login');

    // Login Actions
    document.getElementById('loginBtn').onclick = () => this.handleLogin();

    // Signup Actions
    document.getElementById('signupBtn').onclick = () => this.handleSignup();
    document.getElementById('verifyCodeBtn').onclick = () => this.handleVerifyEmail();

    // Magnetic Hover & Progressive Glow
    document.querySelectorAll('.glow-on-hover').forEach((el) => {
      el.onmousemove = (e) => this.handleMagneticHover(e, el);
      el.onmouseleave = () => el.parentElement.style.setProperty('--glow-intensity', '0');
      el.oninput = () => this.updateTypingGlow(el);
    });

    // Bot Interactions
    document.addEventListener('mousemove', () => this.wakeUp());
    document.addEventListener('keydown', () => this.wakeUp());

    // Password Interactions - use SynchroBot
    const pInputs = ['loginPassword', 'signupPassword', 'signupPasswordConfirm'];
    pInputs.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('focus', () => {
        if (this.synchro) {
          const fieldType = id.includes('Confirm') ? 'confirmPassword' : 'password';
          this.synchro.onFieldFocus(fieldType, el.value);
        }
      });

      el.addEventListener('input', () => {
        if (this.synchro) {
          const fieldType = id.includes('Confirm') ? 'confirmPassword' : 'password';
          this.synchro.onFieldInput(fieldType, el.value, {
            strength: this.getPasswordStrength(el.value),
            passwordsMatch: this.checkPasswordsMatch(),
            formData: this.getFormData(),
          });
        }
        if (id === 'signupPassword') this.validatePassword(el.value);
        if (id === 'signupPasswordConfirm') this.checkPasswordMatch();
      });

      el.addEventListener('blur', () => {
        if (this.synchro) {
          this.synchro.onFieldBlur();
        }
      });
    });

    // Password Toggles
    document.querySelectorAll('.password-toggle').forEach((toggle) => {
      toggle.onclick = () => {
        const input = toggle.parentElement.querySelector('input');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggle.innerHTML = isPassword
          ? '<i class="fas fa-eye-slash"></i>'
          : '<i class="fas fa-eye"></i>';

        if (this.synchro) {
          this.synchro.onPasswordToggle(!isPassword);
        }
      };
    });

    // Username/Email Interactions
    ['loginUsername', 'signupUsername', 'signupEmail'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('focus', () => {
        if (this.synchro) {
          const fieldType = id.includes('Email') ? 'email' : 'username';
          this.synchro.onFieldFocus(fieldType, el.value);
        }
      });

      el.addEventListener('input', () => {
        if (this.synchro) {
          const fieldType = id.includes('Email') ? 'email' : 'username';
          this.synchro.onFieldInput(fieldType, el.value, {
            formData: this.getFormData(),
          });
        }
      });

      el.addEventListener('blur', () => {
        if (this.synchro) {
          this.synchro.onFieldBlur();
        }
      });
    });

    // Submit button hover
    ['loginBtn', 'signupBtn'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      btn.addEventListener('mouseenter', () => {
        if (this.synchro) {
          this.synchro.onButtonHover(true);
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (this.synchro) {
          this.synchro.onButtonHover(false);
        }
      });
    });

    // Username Availability (Debounced)
    const signupUsername = document.getElementById('signupUsername');
    let usernameTimeout;
    signupUsername?.addEventListener('input', (e) => {
      clearTimeout(usernameTimeout);
      usernameTimeout = setTimeout(() => this.checkUsernameAvailability(e.target.value), 500);
    });

    // Email Typo Suggestion
    const signupEmail = document.getElementById('signupEmail');
    signupEmail?.addEventListener('blur', (e) => this.checkEmailTypo(e.target.value));
  }

  toggleForm(type) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (type === 'signup') {
      loginForm.classList.remove('active');
      signupForm.classList.add('active');
    } else {
      signupForm.classList.remove('active');
      loginForm.classList.add('active');
    }
    if (this.botRig) this.botRig.className = 'bot-rig';
  }

  handleMagneticHover(e, el) {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const intensity = Math.max(0, 1 - dist / 100);
    el.parentElement.style.setProperty('--glow-intensity', intensity);
  }

  updateTypingGlow(el) {
    const length = el.value.length;
    const intensity = Math.min(length / 15, 1.5);
    el.style.boxShadow = `0 0 ${10 + intensity * 10}px rgba(var(--accent-color-rgb), ${0.2 + intensity * 0.3})`;
  }

  // Legacy method - delegates to SynchroBot
  wakeUp() {
    if (this.synchro) {
      this.synchro.resetIdleTimer();
    }
  }

  // Legacy method - kept for backward compatibility
  resetSleepTimer() {
    // Now handled by SynchroBot idle timer
    if (this.synchro) {
      this.synchro.resetIdleTimer();
    }
  }

  // Legacy method - now handled by SynchroRenderer
  createZzz() {
    // Particles are now created by SynchroRenderer via sleep event
  }

  // Legacy method - delegates to SynchroBot
  updatePupils(length) {
    if (this.synchro) {
      this.synchro.updatePupils(length);
    }
  }

  // Legacy method - now handled by SynchroBot state machine
  updateBotState(input, force = false) {
    // State is now managed by SynchroBot
    if (this.synchro && (force || document.activeElement === input)) {
      const isPassword = input.type === 'password' || input.classList.contains('password-input');
      if (isPassword) {
        this.synchro.onPasswordToggle(input.type === 'text');
      }
    }
  }

  validatePassword(password) {
    const reqs = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[!@#$%^&*]/.test(password),
    };

    let score = 0;
    Object.keys(reqs).forEach((key) => {
      const el = document.querySelector(`.requirement-item[data-req="${key}"]`);
      if (reqs[key]) {
        score++;
        el.classList.add('met');
        el.querySelector('i').className = 'fas fa-check-circle';
      } else {
        el.classList.remove('met');
        el.querySelector('i').className = 'fas fa-circle';
      }
    });

    const segment = document.getElementById('entropySegment');
    const colors = ['#ef4444', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
    const percentage = (score / 5) * 100;
    segment.style.width = `${percentage}%`;
    segment.className = 'entropy-segment';
    if (score > 0) segment.style.backgroundColor = colors[score - 1];
    if (score === 5) segment.classList.add('entropy-elite');
  }

  checkPasswordMatch() {
    const p1 = document.getElementById('signupPassword').value;
    const p2 = document.getElementById('signupPasswordConfirm').value;
    const el = document.getElementById('signupPasswordConfirm');
    if (p1 === p2 && p1 !== '') {
      el.style.borderColor = 'var(--success-color)';
      el.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
    } else {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }
  }

  async checkUsernameAvailability(username) {
    if (username.length < 3) return;
    const icon = document.getElementById('usernameStatusIcon');
    const suggestions = document.getElementById('usernameSuggestions');
    icon.style.display = 'block';
    icon.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: #666;"></i>';

    try {
      const data = await Network.fetchAPI('/api/auth/check-username', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      if (data.available) {
        icon.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>';
        suggestions.style.display = 'none';
      } else {
        icon.innerHTML = '<i class="fas fa-times-circle" style="color: var(--error-color);"></i>';
        suggestions.style.display = 'block';
        suggestions.innerHTML =
          'Taken! Try: ' +
          data.suggestions
            .map(
              (s) =>
                `<span class="suggest-link" style="text-decoration: underline; cursor: pointer; margin-right: 8px;">${s}</span>`
            )
            .join('');
        suggestions.querySelectorAll('.suggest-link').forEach((link) => {
          link.onclick = () => {
            document.getElementById('signupUsername').value = link.textContent;
            this.checkUsernameAvailability(link.textContent);
          };
        });
      }
    } catch (e) {
      icon.style.display = 'none';
    }
  }

  checkEmailTypo(email) {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const [user, domain] = email.split('@');
    if (!domain) return;

    const suggestion = document.getElementById('emailSuggestion');
    const match = domains.find((d) => this.isSimilar(domain, d) && domain !== d);

    if (match) {
      suggestion.style.display = 'block';
      suggestion.innerHTML = `Did you mean <span style="font-weight: bold;">${user}@${match}</span>?`;
      suggestion.onclick = () => {
        document.getElementById('signupEmail').value = `${user}@${match}`;
        suggestion.style.display = 'none';
      };
    } else {
      suggestion.style.display = 'none';
    }
  }

  isSimilar(s1, s2) {
    let diff = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
      if (s1[i] !== s2[i]) diff++;
    }
    return diff === 1 && Math.abs(s1.length - s2.length) <= 1;
  }

  async handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    this.setProcessing(true);
    try {
      const data = await Network.fetchAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      this.successSequence(data);
    } catch (e) {
      let msg = e.message;
      if (msg.includes('401')) msg = 'Invalid username or password';
      else msg = msg.replace('API error: ', 'Error ');
      this.errorSequence(msg, 'loginForm');
    }
  }

  async handleSignup() {
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupPasswordConfirm').value;

    if (password !== confirm) return this.errorSequence('Passwords do not match', 'signupForm');

    this.setProcessing(true);
    try {
      const data = await Network.fetchAPI('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      if (data.token) this.successSequence(data);
      else {
        this.setProcessing(false);
        document.getElementById('emailVerificationModal').style.display = 'flex';
        window.pendingSignupEmail = email;
      }
    } catch (e) {
      this.errorSequence(
        e.message.replace('API error: ', 'Error ') || 'Signup failed',
        'signupForm'
      );
    }
  }

  async handleVerifyEmail() {
    const code = document.getElementById('verificationCode').value;
    const msg = document.getElementById('verificationMessage');
    try {
      const data = await Network.fetchAPI('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: window.pendingSignupEmail, verificationCode: code }),
      });
      document.getElementById('emailVerificationModal').style.display = 'none';
      this.successSequence(data);
    } catch (e) {
      msg.textContent = e.message.replace('API error: ', 'Error ') || 'Verification failed';
      msg.style.color = 'var(--error-color)';
    }
  }

  setProcessing(val) {
    this.isProcessing = val;

    if (this.synchro) {
      if (val) {
        this.synchro.onSubmit();
      }
    }

    // Keep existing button disable logic
    const btns = ['loginBtn', 'signupBtn'];
    btns.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = val;
      el.style.opacity = val ? '0.7' : '1';
      if (val) el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      else el.innerHTML = id === 'loginBtn' ? 'Login' : 'Create Account';
    });
  }

  successSequence(data) {
    Auth.setToken(data.token);

    if (this.synchro) {
      this.synchro.onSuccess();
      this.renderer?.burst('star', 5);
    }

    const msgId = document.getElementById('loginForm').classList.contains('active')
      ? 'loginStatusMessage'
      : 'signupStatusMessage';
    document.getElementById(msgId).textContent = '✓ Welcome!';
    document.getElementById(msgId).className = 'status-message success';

    const overlay = document.getElementById('redirectOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(() => (overlay.style.opacity = '1'), 10);
    }

    setTimeout(() => {
      const docId = new URLSearchParams(window.location.search).get('doc');
      window.location.href = docId ? `../index.html?doc=${docId}` : '../index.html';
    }, 1500);
  }

  errorSequence(message, formId) {
    this.setProcessing(false);

    if (this.synchro) {
      this.synchro.onError();
    }

    const form = document.getElementById(formId);
    form.classList.add('shake-animation');

    // Highlight inputs in red
    const inputs = form.querySelectorAll('input');
    inputs.forEach((input) => {
      input.style.borderColor = 'var(--error-color)';
      input.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
    });

    setTimeout(() => {
      if (this.botRig) this.botRig.classList.remove('error');
      form.classList.remove('shake-animation');
      inputs.forEach((input) => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
      });
    }, 1000);

    const msgId = formId === 'loginForm' ? 'loginStatusMessage' : 'signupStatusMessage';
    const msg = document.getElementById(msgId);
    msg.textContent = '✗ ' + message;
    msg.className = 'status-message error';
  }

  getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;
    return score;
  }

  checkPasswordsMatch() {
    const p1 = document.getElementById('signupPassword')?.value || '';
    const p2 = document.getElementById('signupPasswordConfirm')?.value || '';
    return p1 === p2 && p1 !== '';
  }

  getFormData() {
    const loginForm = document.getElementById('loginForm');
    const isLogin = loginForm?.classList.contains('active');

    if (isLogin) {
      return {
        username: document.getElementById('loginUsername')?.value || '',
        password: document.getElementById('loginPassword')?.value || '',
        _hasErrors: false,
      };
    } else {
      const password = document.getElementById('signupPassword')?.value || '';
      return {
        username: document.getElementById('signupUsername')?.value || '',
        email: document.getElementById('signupEmail')?.value || '',
        password: password,
        confirmPassword: document.getElementById('signupPasswordConfirm')?.value || '',
        _hasErrors: this.getPasswordStrength(password) < 5 || !this.checkPasswordsMatch(),
      };
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AuthController();
});
