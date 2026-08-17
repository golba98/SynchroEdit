/**
 * SyncroBot - Animated mascot with eye tracking and state-based animations
 */
export class SyncroBot {
  constructor(options = {}) {
    this.authFlow = options.authFlow || 'login';
    this.container = null;
    this.botRig = null;
    this.pupils = [];
    this.eyeTargets = new Map();
    this.eyePositions = new Map();
    this.eyeAnimationFrame = null;
    this.mouseMoveHandler = null;
    this.targetElement = null;
    this.currentState = 'idle';
    this.focusTarget = 'none';
    this.formCompleteness = 'empty';
    this.isProcessing = false;
    this.idleTimer = null;
    this.blinkTimer = null;
    this.passwordToggleTimer = null;
    this.blinking = false;
    this.passwordVisible = false;
    this.playCount = 0;
    this.annoyedTimer = null;
    this.idleGestureTimer = null;
    this.gestureResetTimer = null;

    this.config = {
      eyeMaxMove: 8, // Maximum pupil movement from center (pixels)
      eyeSmoothing: 0.16,
      transitionDuration: 300, // ms
      idleTimeout: 10000, // 10 seconds
      blinkMinDelay: 3500,
      blinkMaxDelay: 7500,
      blinkDuration: 140,
    };

    // Special state for forgot password flow
    if (this.authFlow === 'forgot') {
      this.currentState = 'empathy';
    }
  }

  init(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.warn('SyncroBot: Container not found');
      return false;
    }

    this.botRig = document.getElementById('botRig');
    this.pupils = Array.from(document.querySelectorAll('.pupil'));
    this.pupils.forEach((pupil) => {
      this.eyeTargets.set(pupil, { x: 0, y: 0 });
      this.eyePositions.set(pupil, { x: 0, y: 0 });
    });
    this.mouseMoveHandler = this.handleMouseMove.bind(this);

    if (!this.botRig || this.pupils.length === 0) {
      console.warn('SyncroBot: Bot elements not found');
      return false;
    }

    this.setupEventListeners();
    this.startIdleTimer();
    this.applyState(this.currentState);

    return true;
  }

  setupEventListeners() {
    // Mouse tracking for cursor following
    document.addEventListener('mousemove', this.mouseMoveHandler);

    const play = (event) => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      this.playWithBot();
    };

    this.botRig.addEventListener('click', play);
    this.botRig.addEventListener('keydown', play);
    this.botPlayHandler = play;

    // Requestanimationframe for smooth updates
    this.rafId = null;
    this.pendingUpdate = null;
  }

  playWithBot() {
    if (!this.botRig || this.isProcessing) return;

    this.playCount += 1;
    this.botRig.dataset.playCount = String(this.playCount);
    this.botRig.setAttribute(
      'aria-label',
      this.playCount > 1 ? 'SyncroBot is annoyed. Tap again to tease it.' : 'SyncroBot is reacting'
    );
    this.clearAnnoyedTimer();
    this.clearIdleGestureTimers();
    this.applyState(this.playCount === 1 ? 'startled' : 'annoyed');

    this.annoyedTimer = setTimeout(
      () => {
        this.annoyedTimer = null;
        if (this.focusTarget === 'password' && !this.passwordVisible) {
          this.applyState('secure');
        } else if (this.focusTarget !== 'none') {
          this.applyState('tracking');
        } else {
          this.applyState('idle');
        }
        this.botRig?.setAttribute('aria-label', 'Play with SyncroBot');
      },
      Math.min(2200, 900 + this.playCount * 180)
    );
  }

  clearAnnoyedTimer() {
    if (this.annoyedTimer) {
      clearTimeout(this.annoyedTimer);
      this.annoyedTimer = null;
    }
  }

  scheduleIdleGesture() {
    this.clearIdleGestureTimers();
    if (!this.botRig || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    if (!['idle', 'bored'].includes(this.currentState)) return;

    const delay = 2200 + Math.floor(Math.random() * 2800);
    this.idleGestureTimer = setTimeout(() => {
      if (!this.botRig || !['idle', 'bored'].includes(this.currentState) || this.targetElement) {
        this.scheduleIdleGesture();
        return;
      }

      const gestures = ['gesture-wave-left', 'gesture-wave-right', 'gesture-lean'];
      const gesture = gestures[Math.floor(Math.random() * gestures.length)];
      this.botRig.classList.add(gesture);

      const rect = this.botRig.getBoundingClientRect();
      this.updateEyePosition({
        x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 90,
        y: rect.top + rect.height / 2 + (Math.random() - 0.5) * 48,
      });

      this.gestureResetTimer = setTimeout(() => {
        this.botRig?.classList.remove(...gestures);
        this.resetEyePosition();
        this.scheduleIdleGesture();
      }, 1050);
    }, delay);
  }

  clearIdleGestureTimers() {
    if (this.idleGestureTimer) clearTimeout(this.idleGestureTimer);
    if (this.gestureResetTimer) clearTimeout(this.gestureResetTimer);
    this.idleGestureTimer = null;
    this.gestureResetTimer = null;
    this.botRig?.classList.remove('gesture-wave-left', 'gesture-wave-right', 'gesture-lean');
  }

  handleMouseMove(e) {
    // Only track mouse in idle/tracking states
    if (['idle', 'tracking', 'bored'].includes(this.currentState) && !this.targetElement) {
      this.updateEyePosition({ x: e.clientX, y: e.clientY });
    }
  }

  /**
   * Updates eye position to look at a target point
   * @param {Object} target - {x, y} coordinates in viewport/client space
   */
  updateEyePosition(target) {
    if (this.pupils.length === 0) return;

    this.pupils.forEach((pupil) => {
      // Get the center position of the pupil's eye container
      const eye = pupil.closest('.eye');
      const eyeRect = eye.getBoundingClientRect();

      // Calculate the center of the eye in viewport coordinates
      const eyeCenterX = eyeRect.left + eyeRect.width / 2;
      const eyeCenterY = eyeRect.top + eyeRect.height / 2;

      // Calculate the delta from eye center to target
      const deltaX = target.x - eyeCenterX;
      const deltaY = target.y - eyeCenterY;

      // Calculate angle and distance
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Clamp the movement to max range
      const moveDistance = Math.min(distance, this.config.eyeMaxMove);

      // Calculate the pupil offset from its center position
      const offsetX = Math.cos(angle) * moveDistance;
      const offsetY = Math.sin(angle) * moveDistance;

      this.eyeTargets.set(pupil, { x: offsetX, y: offsetY });
    });

    this.startEyeSmoothing();
  }

  /**
   * Smooths pupil movement in its own animation loop so rapid mouse events
   * feel like a gaze settling on a target instead of a cursor-controlled jump.
   */
  startEyeSmoothing() {
    if (this.eyeAnimationFrame) return;

    const tick = () => {
      let isMoving = false;

      this.pupils.forEach((pupil) => {
        const target = this.eyeTargets.get(pupil) || { x: 0, y: 0 };
        const position = this.eyePositions.get(pupil) || { x: 0, y: 0 };
        const x = position.x + (target.x - position.x) * this.config.eyeSmoothing;
        const y = position.y + (target.y - position.y) * this.config.eyeSmoothing;

        this.eyePositions.set(pupil, { x, y });
        pupil.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px))`;

        if (Math.abs(target.x - x) > 0.05 || Math.abs(target.y - y) > 0.05) {
          isMoving = true;
        }
      });

      if (isMoving) {
        this.eyeAnimationFrame = requestAnimationFrame(tick);
      } else {
        this.eyeAnimationFrame = null;
      }
    };

    this.eyeAnimationFrame = requestAnimationFrame(tick);
  }

  /**
   * Sets a specific element as the focus target for eye tracking
   * @param {HTMLElement} element - The element to track
   */
  setTargetElement(element) {
    this.targetElement = element;
    if (element) {
      this.startTrackingLoop();
      this.trackElement(element);
    }
  }

  /**
   * Tracks an element's position (for input fields)
   */
  trackElement(element) {
    if (!element) {
      this.targetElement = null;
      return;
    }

    const rect = element.getBoundingClientRect();

    // Target the center of the element
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // Validate that we got valid coordinates
    if (isNaN(targetX) || isNaN(targetY) || !isFinite(targetX) || !isFinite(targetY)) {
      console.warn('SyncroBot: Invalid element coordinates, resetting to center');
      // Reset to center if coordinates are invalid
      this.resetEyePosition();
      return;
    }

    this.updateEyePosition({ x: targetX, y: targetY });
  }

  /**
   * Resets eyes to center position
   */
  resetEyePosition() {
    this.pupils.forEach((pupil) => {
      this.eyeTargets.set(pupil, { x: 0, y: 0 });
    });
    this.startEyeSmoothing();
    this.stopTrackingLoop();
  }

  startTrackingLoop() {
    if (this.rafId || !this.targetElement) return;

    const tick = () => {
      if (!this.targetElement || ['processing', 'success', 'error'].includes(this.currentState)) {
        this.rafId = null;
        return;
      }

      this.trackElement(this.targetElement);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stopTrackingLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  scheduleBlink() {
    this.clearBlinkTimer();

    if (['processing', 'success', 'error'].includes(this.currentState)) {
      return;
    }

    const delay =
      this.config.blinkMinDelay +
      Math.floor(Math.random() * (this.config.blinkMaxDelay - this.config.blinkMinDelay));

    this.blinkTimer = setTimeout(() => {
      this.triggerBlink();
      this.scheduleBlink();
    }, delay);
  }

  clearBlinkTimer() {
    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  triggerBlink() {
    if (
      !this.botRig ||
      this.blinking ||
      ['processing', 'success', 'error'].includes(this.currentState)
    ) {
      return;
    }

    this.blinking = true;
    this.botRig.classList.add('blinking');

    setTimeout(() => {
      if (!this.botRig) return;
      this.botRig.classList.remove('blinking');
      this.blinking = false;
    }, this.config.blinkDuration);
  }

  /**
   * Apply a state class to the bot
   */
  applyState(state) {
    if (!this.botRig) return;

    // Remove all state classes
    const stateClasses = [
      'idle',
      'tracking',
      'secure',
      'peeking',
      'processing',
      'success',
      'error',
      'bored',
      'confused',
      'hover-ready',
      'hover-blocked',
      'startled',
      'annoyed',
    ];

    stateClasses.forEach((cls) => this.botRig.classList.remove(cls));

    // Add the new state
    this.botRig.classList.add(state);
    this.currentState = state;

    if (['processing', 'success', 'error'].includes(state)) {
      this.clearIdleGestureTimers();
      this.clearBlinkTimer();
      this.botRig.classList.remove('blinking');
      this.blinking = false;
    } else {
      this.scheduleBlink();
      if (['idle', 'bored'].includes(state)) {
        this.scheduleIdleGesture();
      } else {
        this.clearIdleGestureTimers();
      }
    }
  }

  /**
   * Called when a field receives focus
   */
  onFieldFocus(fieldName) {
    this.clearPasswordToggleTimer();
    this.focusTarget = fieldName;
    this.resetIdleTimer();

    // Find the focused input element - try multiple approaches
    let inputElement = document.activeElement;

    // Verify it's an input and it matches the field type
    if (!inputElement || inputElement.tagName !== 'INPUT') {
      // Fallback: search for the input by type
      if (fieldName === 'password') {
        inputElement =
          document.querySelector('input[type="password"]:focus') ||
          document.querySelector('input[id*="Password"]');
      } else {
        inputElement =
          document.querySelector('input[type="email"]:focus, input[type="text"]:focus') ||
          document.querySelector('input[id*="Username"], input[id*="Email"]');
      }
    }

    if (fieldName === 'password') {
      this.applyState('secure');
      this.resetEyePosition(); // Look at center when password field focused
      this.targetElement = null;
      this.stopTrackingLoop();
    } else {
      this.applyState('tracking');
      if (inputElement) {
        this.setTargetElement(inputElement);
      }
    }
  }

  /**
   * Called when a field loses focus
   */
  onFieldBlur() {
    this.clearPasswordToggleTimer();
    this.focusTarget = 'none';
    this.targetElement = null;
    this.stopTrackingLoop();
    this.resetEyePosition();
    this.resetIdleTimer();

    setTimeout(() => {
      if (this.focusTarget === 'none') {
        const protectStates = new Set(['processing', 'success', 'error']);
        if (protectStates.has(this.currentState) || this.isProcessing) {
          return;
        }
        if (this.passwordVisible) {
          this.applyState('peeking');
        } else {
          this.applyState('idle');
        }
      }
    }, 50);
  }

  /**
   * Called when field value changes
   */
  onFieldInput(fieldName, fieldValue, validation) {
    this.resetIdleTimer();

    // Update form completeness based on validation
    if (validation.isValid === false) {
      this.formCompleteness = 'invalid';
    } else if (fieldValue.length > 0) {
      this.formCompleteness = 'partial';
    }
  }

  /**
   * Called when password visibility is toggled
   */
  onPasswordToggle(visible) {
    this.passwordVisible = visible;
    this.clearPasswordToggleTimer();

    this.passwordToggleTimer = setTimeout(() => {
      if (visible) {
        this.applyState('peeking');
        const passwordInput = document.querySelector(
          'input[type="text"][id*="password"], input[type="password"]'
        );
        if (passwordInput) {
          this.setTargetElement(passwordInput);
        }
      } else {
        if (this.focusTarget === 'password') {
          this.applyState('secure');
        } else {
          this.applyState('idle');
        }
        this.resetEyePosition();
        this.targetElement = null;
      }
    }, this.config.transitionDuration);
  }

  /**
   * Called when submit button is hovered
   */
  onButtonHover(isHovering) {
    if (!isHovering) {
      // Restore previous state
      if (this.focusTarget !== 'none') {
        if (this.focusTarget === 'password' && !this.passwordVisible) {
          this.applyState('secure');
        } else {
          this.applyState('tracking');
        }
      } else {
        this.applyState('idle');
      }
      return;
    }

    if (this.formCompleteness === 'empty' || this.formCompleteness === 'invalid') {
      this.applyState('hover-blocked');
    } else if (this.formCompleteness === 'valid' || this.formCompleteness === 'partial') {
      this.applyState('hover-ready');
    }
  }

  /**
   * Called when form is submitted
   */
  onSubmit() {
    this.clearPasswordToggleTimer();
    this.isProcessing = true;
    this.targetElement = null;
    this.stopTrackingLoop();
    this.applyState('processing');
    this.clearIdleTimer();
  }

  /**
   * Called on successful submission
   */
  onSuccess() {
    this.clearPasswordToggleTimer();
    this.isProcessing = false;
    this.stopTrackingLoop();
    this.applyState('success');
    this.clearIdleTimer();
  }

  /**
   * Called on submission error
   */
  onError() {
    this.clearPasswordToggleTimer();
    this.isProcessing = false;
    this.stopTrackingLoop();
    this.applyState('error');
    this.resetIdleTimer();
  }

  /**
   * Idle timer management
   */
  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.currentState === 'idle') {
        this.applyState('bored');
      }
    }, this.config.idleTimeout);
  }

  resetIdleTimer() {
    this.startIdleTimer();
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  clearPasswordToggleTimer() {
    if (this.passwordToggleTimer) {
      clearTimeout(this.passwordToggleTimer);
      this.passwordToggleTimer = null;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clearAnnoyedTimer();
    this.clearIdleGestureTimers();
    if (this.botRig && this.botPlayHandler) {
      this.botRig.removeEventListener('click', this.botPlayHandler);
      this.botRig.removeEventListener('keydown', this.botPlayHandler);
    }
    if (this.eyeAnimationFrame) {
      cancelAnimationFrame(this.eyeAnimationFrame);
      this.eyeAnimationFrame = null;
    }
    this.clearIdleTimer();
    this.clearBlinkTimer();
    this.clearPasswordToggleTimer();
    this.stopTrackingLoop();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
    }
  }
}
