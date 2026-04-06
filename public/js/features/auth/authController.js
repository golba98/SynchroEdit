/**
 * Authentication Controller
 * Manages login/signup forms and integrates with SynchroBot
 */
import { SynchroBot } from './synchro/SynchroBot.js';

class AuthController {
  constructor() {
    this.synchro = null;
    this.currentForm = 'login';
    this.init();
  }
  
  init() {
    // Determine which auth flow we're in based on the page
    const pageTitle = document.title;
    let authFlow = 'login';
    
    if (pageTitle.includes('Forgot')) {
      authFlow = 'forgot';
    } else if (pageTitle.includes('Reset')) {
      authFlow = 'reset';
    } else if (pageTitle.includes('Verify')) {
      authFlow = 'verify';
    } else if (pageTitle.includes('Start')) {
      authFlow = 'start';
    }
    
    // Initialize SynchroBot
    this.synchro = new SynchroBot({ authFlow });
    this.synchro.init('.character-container');
    
    // Setup form event listeners
    this.setupFormListeners();
  }
  
  setupFormListeners() {
    // Get all input fields
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    
    inputs.forEach(input => {
      // Focus events
      input.addEventListener('focus', (e) => {
        const fieldName = this.getFieldName(e.target);
        this.synchro.onFieldFocus(fieldName, e.target.value);
      });
      
      // Blur events
      input.addEventListener('blur', () => {
        this.synchro.onFieldBlur();
      });
      
      // Input events
      input.addEventListener('input', (e) => {
        const fieldName = this.getFieldName(e.target);
        const validation = this.validateField(e.target);
        this.synchro.onFieldInput(fieldName, e.target.value, validation);
        this.updateFormCompleteness();
      });
    });
    
    // Password visibility toggles
    const toggleButtons = document.querySelectorAll('.password-toggle, .toggle-password, [data-toggle-password]');
    toggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        // Find the closest input-wrapper or input-group
        const wrapper = e.target.closest('.input-wrapper') || e.target.closest('.input-group');
        const input = wrapper?.querySelector('input[type="password"], input[type="text"]');
        
        if (input && input.id?.toLowerCase().includes('password')) {
          const isCurrentlyPassword = input.type === 'password';
          input.type = isCurrentlyPassword ? 'text' : 'password';
          
          // Update icon
          const icon = button.querySelector('i');
          if (icon) {
            icon.className = isCurrentlyPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
          }
          
          this.synchro.onPasswordToggle(isCurrentlyPassword);
        }
      });
    });
    
    // Submit buttons
    const submitButtons = document.querySelectorAll('button[type="submit"], .login-btn, #loginBtn, #signupBtn');
    submitButtons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        this.synchro.onButtonHover(true);
      });
      
      button.addEventListener('mouseleave', () => {
        this.synchro.onButtonHover(false);
      });
      
      button.addEventListener('click', (e) => {
        // Check if form is valid before submitting
        const form = e.target.closest('form') || e.target.closest('.form-section');
        if (form) {
          e.preventDefault();
          this.handleSubmit(form);
        }
      });
    });
    
    // Form toggle (login <-> signup)
    const showSignup = document.getElementById('showSignup');
    const showLogin = document.getElementById('showLogin');
    
    if (showSignup) {
      showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleForm('signup');
      });
    }
    
    if (showLogin) {
      showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleForm('login');
      });
    }
  }
  
  getFieldName(input) {
    // Try to get a meaningful field name for synchro tracking
    if (input.id) {
      const id = input.id.toLowerCase();
      if (id.includes('password')) return 'password';
      if (id.includes('email') || id.includes('username')) return 'username';
    }
    if (input.type === 'password') return 'password';
    if (input.type === 'email') return 'username';
    return input.name || input.id || 'text';
  }
  
  validateField(input) {
    // Basic validation
    const value = input.value;
    const type = input.type;
    
    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return { isValid: emailRegex.test(value), message: 'Invalid email' };
    }
    
    if (type === 'password' || input.id?.toLowerCase().includes('password')) {
      return { isValid: value.length >= 8, message: 'Password too short' };
    }
    
    return { isValid: value.length > 0 };
  }
  
  updateFormCompleteness() {
    // Check if all required fields are filled
    const currentFormSection = this.currentForm === 'login' 
      ? document.getElementById('loginForm') 
      : document.getElementById('signupForm');
    
    if (!currentFormSection) return;
    
    const requiredInputs = Array.from(currentFormSection.querySelectorAll('input[required], input[type="email"], input[type="password"]'));
    const allFilled = requiredInputs.every(input => input.value.length > 0);
    const allValid = requiredInputs.every(input => {
      const validation = this.validateField(input);
      return validation.isValid !== false;
    });
    
    if (allFilled && allValid) {
      this.synchro.formCompleteness = 'valid';
    } else if (allFilled) {
      this.synchro.formCompleteness = 'partial';
    } else if (requiredInputs.some(input => input.value.length > 0)) {
      this.synchro.formCompleteness = 'partial';
    } else {
      this.synchro.formCompleteness = 'empty';
    }
  }
  
  toggleForm(formType) {
    this.currentForm = formType;
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (formType === 'signup') {
      loginForm?.classList.remove('active');
      signupForm?.classList.add('active');
    } else {
      signupForm?.classList.remove('active');
      loginForm?.classList.add('active');
    }
    
    this.synchro.formCompleteness = 'empty';
    this.synchro.applyState('idle');
  }
  
  async handleSubmit(form) {
    this.synchro.onSubmit();
    
    // Here you would normally make an API call
    // For now, just simulate it
    setTimeout(() => {
      // Simulate success/failure
      const success = Math.random() > 0.3; // 70% success rate for demo
      
      if (success) {
        this.synchro.onSuccess();
      } else {
        this.synchro.onError();
        setTimeout(() => {
          this.synchro.applyState('idle');
        }, 2000);
      }
    }, 2000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AuthController();
  });
} else {
  new AuthController();
}

export default AuthController;
