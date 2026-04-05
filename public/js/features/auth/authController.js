import { Auth } from '/js/features/auth/auth.js';
import { Network } from '/js/app/network.js';

export class AuthController {
    constructor() {
        this.botRig = document.getElementById('botRig');
        this.pupils = document.querySelectorAll('.pupil');
        this.sleepTimer = null;
        this.isSleeping = false;
        this.isProcessing = false;
        
        this.setupEventListeners();
        this.init();
    }

    init() {
        if (this.botRig) this.resetSleepTimer();
        this.checkExistingSession();
        this.checkAutoLogin();
    }

    checkAutoLogin() {
        const urlParams = new URLSearchParams(window.location.search);
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
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
        } catch (e) { /* Ignore */ }
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
        document.querySelectorAll('.glow-on-hover').forEach(el => {
            el.onmousemove = (e) => this.handleMagneticHover(e, el);
            el.onmouseleave = () => el.parentElement.style.setProperty('--glow-intensity', '0');
            el.oninput = () => this.updateTypingGlow(el);
        });

        // Bot Interactions
        document.addEventListener('mousemove', () => this.wakeUp());
        document.addEventListener('keydown', () => this.wakeUp());

        // Password Interactions
        const pInputs = ['loginPassword', 'signupPassword', 'signupPasswordConfirm'];
        pInputs.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('focus', () => this.updateBotState(el));
            el.addEventListener('input', () => {
                this.updateBotState(el);
                if (id === 'signupPassword') this.validatePassword(el.value);
                if (id === 'signupPasswordConfirm') this.checkPasswordMatch();
            });
            el.addEventListener('blur', () => {
                setTimeout(() => {
                    if (this.botRig && !document.activeElement.classList.contains('password-toggle')) {
                        this.botRig.classList.remove('secure', 'peeking', 'searching');
                    }
                }, 100);
            });
        });

        // Password Toggles
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.onclick = () => {
                const input = toggle.parentElement.querySelector('input');
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggle.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
                this.updateBotState(input, true);
            };
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

    wakeUp() {
        if (this.isSleeping) {
            this.isSleeping = false;
            this.botRig.classList.remove('sleeping');
            this.botRig.style.transform = 'scale(1.1)';
            setTimeout(() => this.botRig.style.transform = '', 200);
        }
        this.resetSleepTimer();
    }

    resetSleepTimer() {
        clearTimeout(this.sleepTimer);
        this.sleepTimer = setTimeout(() => {
            if (!this.isProcessing) {
                this.isSleeping = true;
                this.botRig.classList.add('sleeping');
                this.createZzz();
            }
        }, 30000);
    }

    createZzz() {
        if (!this.isSleeping) return;
        const z = document.createElement('div');
        z.textContent = 'Zzz';
        z.className = 'zzz-particle';
        z.style.left = '60%';
        z.style.top = '-20px';
        this.botRig.appendChild(z);
        setTimeout(() => { z.remove(); this.createZzz(); }, 2000);
    }

    updatePupils(length) {
        const maxOffset = 10;
        const limit = 20;
        const normalized = Math.min(length, limit) / limit;
        const offset = (normalized * maxOffset * 2) - maxOffset;
        this.pupils.forEach(p => p.style.transform = `translate(calc(-50% + ${offset}px), -50%)`);
    }

    updateBotState(input, force = false) {
        if (!force && document.activeElement !== input) return;
        if (!this.botRig) return;
        this.botRig.classList.remove('secure', 'peeking', 'confused', 'searching');
        if (input.type === 'text') {
            if (input.value.length === 0) this.botRig.classList.add('searching');
            else {
                this.botRig.classList.add('peeking');
                this.updatePupils(input.value.length);
            }
        } else {
            this.botRig.classList.add('secure');
        }
    }

    validatePassword(password) {
        const reqs = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            symbol: /[!@#$%^&*]/.test(password)
        };

        let score = 0;
        Object.keys(reqs).forEach(key => {
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
                body: JSON.stringify({ username })
            });
            if (data.available) {
                icon.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>';
                suggestions.style.display = 'none';
            } else {
                icon.innerHTML = '<i class="fas fa-times-circle" style="color: var(--error-color);"></i>';
                suggestions.style.display = 'block';
                suggestions.innerHTML = 'Taken! Try: ' + data.suggestions.map(s => `<span class="suggest-link" style="text-decoration: underline; cursor: pointer; margin-right: 8px;">${s}</span>`).join('');
                suggestions.querySelectorAll('.suggest-link').forEach(link => {
                    link.onclick = () => {
                        document.getElementById('signupUsername').value = link.textContent;
                        this.checkUsernameAvailability(link.textContent);
                    };
                });
            }
        } catch (e) { icon.style.display = 'none'; }
    }

    checkEmailTypo(email) {
        const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        const [user, domain] = email.split('@');
        if (!domain) return;
        
        const suggestion = document.getElementById('emailSuggestion');
        const match = domains.find(d => this.isSimilar(domain, d) && domain !== d);
        
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
                body: JSON.stringify({ username, password })
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
                body: JSON.stringify({ username, email, password })
            });
            if (data.token) this.successSequence(data);
            else {
                this.setProcessing(false);
                document.getElementById('emailVerificationModal').style.display = 'flex';
                window.pendingSignupEmail = email;
            }
        } catch (e) { 
            this.errorSequence(e.message.replace('API error: ', 'Error ') || 'Signup failed', 'signupForm'); 
        }
    }

    async handleVerifyEmail() {
        const code = document.getElementById('verificationCode').value;
        const msg = document.getElementById('verificationMessage');
        try {
            const data = await Network.fetchAPI('/api/auth/verify-email', {
                method: 'POST',
                body: JSON.stringify({ email: window.pendingSignupEmail, verificationCode: code })
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
        if (this.botRig) this.botRig.classList.toggle('processing', val);
        const btns = ['loginBtn', 'signupBtn'];
        btns.forEach(id => {
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
        if (this.botRig) this.botRig.className = 'bot-rig success';
        const msgId = document.getElementById('loginForm').classList.contains('active') ? 'loginStatusMessage' : 'signupStatusMessage';
        document.getElementById(msgId).textContent = '✓ Welcome!';
        document.getElementById(msgId).className = 'status-message success';

        const overlay = document.getElementById('redirectOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.opacity = '1', 10);
        }

        setTimeout(() => {
            const docId = new URLSearchParams(window.location.search).get('doc');
            window.location.href = docId ? `../index.html?doc=${docId}` : '../index.html';
        }, 1500);
    }

    errorSequence(message, formId) {
        this.setProcessing(false);
        if (this.botRig) this.botRig.classList.add('error');
        
        const form = document.getElementById(formId);
        form.classList.add('shake-animation');
        
        // Highlight inputs in red
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            input.style.borderColor = 'var(--error-color)';
            input.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
        });

        setTimeout(() => {
            if (this.botRig) this.botRig.classList.remove('error');
            form.classList.remove('shake-animation');
            inputs.forEach(input => {
                input.style.borderColor = '';
                input.style.boxShadow = '';
            });
        }, 1000);

        const msgId = formId === 'loginForm' ? 'loginStatusMessage' : 'signupStatusMessage';
        const msg = document.getElementById(msgId);
        msg.textContent = '✗ ' + message;
        msg.className = 'status-message error';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthController();
});

