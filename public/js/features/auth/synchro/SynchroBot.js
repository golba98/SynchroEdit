/**
 * SynchroBot - State Machine Controller for the Synchro mascot
 * Manages state transitions based on user input, focus, and form state
 */
export class SynchroBot {
  constructor(options = {}) {
    // DOM references
    this.botRig = null;
    this.pupils = [];
    this.container = null;

    // State tracking
    this.currentState = 'idle';
    this.previousState = null;
    this.focusTarget = 'none'; // 'username' | 'email' | 'password' | 'confirmPassword' | 'button' | 'none'
    this.formCompleteness = 'empty'; // 'empty' | 'partial' | 'valid' | 'invalid'
    this.authFlow = options.authFlow || 'login'; // 'login' | 'signup' | 'forgot' | 'reset' | 'verify'

    // Password state
    this.passwordVisible = false;
    this.passwordStrength = 0; // 0-5 for signup
    this.passwordsMatch = false;

    // Idle tracking
    this.idleTime = 0;
    this.idleTimer = null;
    this.sleepTimer = null;
    this.isProcessing = false;

    // Animation state
    this.isTransitioning = false;
    this.stateQueue = [];

    // Configuration
    this.config = {
      boredTimeout: 10000, // 10s until bored
      sleepTimeout: 30000, // 30s until sleep
      attentionTimeout: 10000, // 10s idle in field before knock
      transitionDuration: 300, // ms for state transitions
      ...options.config,
    };

    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.tick = this.tick.bind(this);
  }

  /**
   * Initialize the bot with DOM references
   */
  init(containerSelector = '.character-container') {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.warn('SynchroBot: Container not found');
      return false;
    }

    this.botRig =
      this.container.querySelector('.bot-rig') || this.container.querySelector('#botRig');
    this.pupils = this.container.querySelectorAll('.pupil');

    if (!this.botRig) {
      console.warn('SynchroBot: Bot rig not found');
      return false;
    }

    // Set up global listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('keydown', this.handleKeyDown);

    // Start idle timer
    this.startIdleTimer();

    // Set initial state based on auth flow
    this.setInitialState();

    return true;
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.stopIdleTimer();
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
  }

  /**
   * Set initial state based on auth flow
   */
  setInitialState() {
    switch (this.authFlow) {
      case 'forgot':
        this.transition('empathy');
        break;
      case 'verify':
        this.transition('expectant');
        break;
      default:
        this.transition('idle');
    }
  }

  // ==================== STATE TRANSITIONS ====================

  /**
   * Main state transition method
   */
  transition(newState, options = {}) {
    if (this.isTransitioning && !options.force) {
      this.stateQueue.push({ state: newState, options });
      return;
    }

    if (newState === this.currentState && !options.force) return;

    this.isTransitioning = true;
    this.previousState = this.currentState;

    // Remove all state classes
    this.clearStateClasses();

    // Apply new state
    this.currentState = newState;
    this.botRig.classList.add(newState);

    // Emit state change event
    this.emit('stateChange', { from: this.previousState, to: newState });

    // End transition after duration
    setTimeout(() => {
      this.isTransitioning = false;
      this.processQueue();
    }, options.duration || this.config.transitionDuration);
  }

  /**
   * Process queued state transitions
   */
  processQueue() {
    if (this.stateQueue.length > 0) {
      const next = this.stateQueue.shift();
      this.transition(next.state, next.options);
    }
  }

  /**
   * Clear all state classes from bot rig
   */
  clearStateClasses() {
    const stateClasses = [
      'idle',
      'bored',
      'sleeping',
      'attention',
      'tracking',
      'reading',
      'secure',
      'peeking',
      'confused',
      'searching',
      'validating',
      'warning',
      'success-partial',
      'success-full',
      'mismatch',
      'hover-ready',
      'hover-blocked',
      'processing',
      'success',
      'error',
      'empathy',
      'hopeful',
      'salute',
      'shrug',
      'envelope',
      'expectant',
    ];
    stateClasses.forEach((cls) => this.botRig.classList.remove(cls));
  }

  // ==================== IDLE MANAGEMENT ====================

  startIdleTimer() {
    this.idleTime = 0;
    this.idleTimer = setInterval(this.tick, 1000);
  }

  stopIdleTimer() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  tick() {
    if (this.isProcessing) return;

    this.idleTime += 1000;

    // Check for bored state
    if (this.idleTime >= this.config.boredTimeout && this.currentState === 'idle') {
      this.transition('bored');
    }

    // Check for sleep state
    if (this.idleTime >= this.config.sleepTimeout && this.currentState === 'bored') {
      this.transition('sleeping');
      this.emit('sleep');
    }

    // Check for attention knock (idle in a focused field)
    if (
      this.focusTarget !== 'none' &&
      this.idleTime >= this.config.attentionTimeout &&
      !['sleeping', 'bored', 'processing'].includes(this.currentState)
    ) {
      this.transition('attention');
    }
  }

  resetIdleTimer() {
    this.idleTime = 0;

    // Wake up if sleeping or bored
    if (['sleeping', 'bored'].includes(this.currentState)) {
      this.wakeUp();
    }
  }

  wakeUp() {
    if (this.currentState === 'sleeping') {
      // Startled wake animation
      this.botRig.style.transform = 'scale(1.1)';
      setTimeout(() => (this.botRig.style.transform = ''), 200);
    }
    this.emit('wakeUp');
    this.determineState();
  }

  // ==================== INPUT HANDLERS ====================

  handleMouseMove() {
    this.resetIdleTimer();
  }

  handleKeyDown() {
    this.resetIdleTimer();
  }

  /**
   * Call when a form field receives focus
   */
  onFieldFocus(fieldType, fieldValue = '') {
    this.resetIdleTimer();
    this.focusTarget = fieldType;
    this.determineState();
  }

  /**
   * Call when a form field loses focus
   */
  onFieldBlur() {
    this.focusTarget = 'none';
    setTimeout(() => {
      if (this.focusTarget === 'none' && !this.isProcessing) {
        this.transition('idle');
      }
    }, 100);
  }

  /**
   * Call when user types in a field
   */
  onFieldInput(fieldType, value, additionalData = {}) {
    this.resetIdleTimer();
    this.focusTarget = fieldType;

    // Update form completeness
    this.updateFormCompleteness(additionalData.formData);

    // Update password state if applicable
    if (fieldType === 'password') {
      this.passwordStrength = additionalData.strength || 0;
    }
    if (additionalData.passwordsMatch !== undefined) {
      this.passwordsMatch = additionalData.passwordsMatch;
    }

    // Update pupil position based on input length
    if (value && this.currentState !== 'secure') {
      this.updatePupils(value.length);
    }

    this.determineState();
  }

  /**
   * Call when password visibility is toggled
   */
  onPasswordToggle(isVisible) {
    this.passwordVisible = isVisible;
    this.determineState();
  }

  /**
   * Call when hovering over submit button
   */
  onButtonHover(isHovering) {
    if (!isHovering) {
      if (this.currentState.startsWith('hover-')) {
        this.determineState();
      }
      return;
    }

    this.focusTarget = 'button';

    if (this.formCompleteness === 'valid') {
      this.transition('hover-ready');
    } else {
      this.transition('hover-blocked');
    }
  }

  /**
   * Call when form is submitted
   */
  onSubmit() {
    this.isProcessing = true;
    this.transition('processing', { force: true });
  }

  /**
   * Call when submission succeeds
   */
  onSuccess() {
    this.isProcessing = false;
    this.transition('success', { force: true });
  }

  /**
   * Call when submission fails
   */
  onError() {
    this.isProcessing = false;
    this.transition('error', { force: true });

    // Return to appropriate state after error animation
    setTimeout(() => {
      this.determineState();
    }, 1000);
  }

  // ==================== STATE DETERMINATION ====================

  /**
   * Determine the appropriate state based on current conditions
   */
  determineState() {
    if (this.isProcessing) return;

    // Flow-specific states
    if (this.authFlow === 'forgot') {
      return this.determineForgotState();
    }

    // Focus-based states
    switch (this.focusTarget) {
      case 'password':
      case 'confirmPassword':
        this.determinePasswordState();
        break;
      case 'username':
      case 'email':
        this.transition('tracking');
        break;
      case 'button':
        // Handled by onButtonHover
        break;
      case 'none':
      default:
        if (!['sleeping', 'bored', 'success', 'error'].includes(this.currentState)) {
          this.transition('idle');
        }
    }
  }

  determinePasswordState() {
    if (this.passwordVisible) {
      // Password is visible - snooping mode
      this.transition('peeking');
    } else {
      // Password is hidden - cover eyes
      this.transition('secure');
    }
  }

  determineForgotState() {
    if (this.focusTarget === 'email') {
      this.transition('hopeful');
    } else if (this.focusTarget === 'button') {
      if (this.formCompleteness === 'valid') {
        this.transition('salute');
      } else {
        this.transition('shrug');
      }
    } else {
      this.transition('empathy');
    }
  }

  // ==================== VISUAL UPDATES ====================

  /**
   * Update pupil position based on input length (reading effect)
   */
  updatePupils(length) {
    const maxOffset = 10;
    const limit = 20;
    const normalized = Math.min(length, limit) / limit;
    const offset = normalized * maxOffset * 2 - maxOffset;

    this.pupils.forEach((pupil) => {
      pupil.style.transform = `translate(calc(-50% + ${offset}px), -50%)`;
    });
  }

  /**
   * Update form completeness status
   */
  updateFormCompleteness(formData) {
    if (!formData) return;

    const values = Object.values(formData).filter((v) => v && v.trim());
    const required = Object.keys(formData).length;

    if (values.length === 0) {
      this.formCompleteness = 'empty';
    } else if (values.length < required) {
      this.formCompleteness = 'partial';
    } else {
      // Check for validation errors
      this.formCompleteness = formData._hasErrors ? 'invalid' : 'valid';
    }
  }

  // ==================== EVENTS ====================

  /**
   * Simple event emitter
   */
  emit(event, data = {}) {
    const customEvent = new CustomEvent(`synchro:${event}`, { detail: data });
    document.dispatchEvent(customEvent);
  }

  /**
   * Listen for Synchro events
   */
  on(event, callback) {
    document.addEventListener(`synchro:${event}`, (e) => callback(e.detail));
  }
}

export default SynchroBot;
