/**
 * SyncroBot is a deterministic view of authentication state.
 * Application events own state changes; animation never advances the auth flow.
 */
export class SyncroBot {
  constructor(options = {}) {
    this.authFlow = options.authFlow || 'login';
    this.container = null;
    this.botRig = null;
    this.pupils = [];
    this.currentState = 'idle';
    this.focusTarget = 'none';
    this.formCompleteness = 'empty';
    this.passwordVisible = false;
    this.isProcessing = false;
    this.targetElement = null;
    this.rafId = null;
    this.blinkTimer = null;
    this.blinkEndTimer = null;
    this.typingTimer = null;
    this.blinking = false;
    this.config = {
      eyeMaxMove: 7,
      blinkMinDelay: 4200,
      blinkMaxDelay: 7800,
      blinkDuration: 130,
      typingSettleDelay: 500,
    };
  }

  init(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.botRig = this.container?.querySelector('.bot-rig') || null;
    this.pupils = Array.from(this.container?.querySelectorAll('.pupil') || []);
    if (!this.container || !this.botRig || this.pupils.length === 0) {
      console.warn('SyncroBot: Bot elements not found');
      return false;
    }
    this.applyState('idle');
    return true;
  }

  applyState(state, options = {}) {
    if (!this.botRig) return;
    const normalizedState = this.normalizeState(state);
    const isSameState = normalizedState === this.currentState;
    this.currentState = normalizedState;
    this.botRig.dataset.syncroState = normalizedState;
    for (const className of Array.from(this.botRig.classList)) {
      if (className !== 'bot-rig' && className !== 'blinking')
        this.botRig.classList.remove(className);
    }
    this.botRig.classList.add(normalizedState);

    if (this.blocksBlink(normalizedState)) {
      this.clearBlinkTimer();
      this.botRig.classList.remove('blinking');
      this.blinking = false;
    } else if (!isSameState || !this.blinkTimer) {
      this.scheduleBlink();
    }

    if (options.target) {
      this.setTargetElement(options.target);
    } else if (this.usesFixedGaze(normalizedState)) {
      this.stopTrackingLoop();
      this.targetElement = null;
      this.setGazeForState(normalizedState);
    }
  }

  normalizeState(state) {
    const aliases = {
      tracking: 'username-focus',
      typing: 'username-typing',
      secure: 'password-focus',
      peeking: 'password-visible',
      processing: 'submitting',
      empathy: 'idle',
      'hover-ready': this.focusTarget === 'password' ? 'password-focus' : 'username-focus',
      'hover-blocked': 'invalid-field',
      bored: 'idle',
    };
    return aliases[state] || state;
  }

  usesFixedGaze(state) {
    return ['idle', 'password-focus', 'submitting', 'success', 'error', 'invalid-field'].includes(
      state
    );
  }

  blocksBlink(state) {
    return ['submitting', 'success', 'error'].includes(state);
  }

  setGazeForState(state) {
    const gaze = {
      idle: [0, 0],
      'password-focus': [-3, 5],
      submitting: [0, -2],
      success: [0, -2],
      error: [-6, 5],
      'invalid-field': [-7, 4],
    }[state] || [0, 0];
    this.setPupilOffset(gaze[0], gaze[1]);
  }

  setPupilOffset(x, y) {
    this.pupils.forEach((pupil) => {
      pupil.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    });
  }

  updateEyePosition(target) {
    if (!target) return;
    this.pupils.forEach((pupil) => {
      const eyeRect = pupil.closest('.eye')?.getBoundingClientRect();
      if (!eyeRect) return;
      const deltaX = target.x - (eyeRect.left + eyeRect.width / 2);
      const deltaY = target.y - (eyeRect.top + eyeRect.height / 2);
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.min(Math.hypot(deltaX, deltaY), this.config.eyeMaxMove);
      pupil.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px))`;
    });
  }

  setTargetElement(element) {
    this.targetElement = element || null;
    this.stopTrackingLoop();
    if (!this.targetElement) return;
    this.trackElement();
    const tick = () => {
      if (!this.targetElement || this.blocksBlink(this.currentState)) {
        this.rafId = null;
        return;
      }
      this.trackElement();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  trackElement() {
    const rect = this.targetElement?.getBoundingClientRect();
    if (rect)
      this.updateEyePosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  stopTrackingLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  resetEyePosition() {
    this.stopTrackingLoop();
    this.targetElement = null;
    this.setPupilOffset(0, 0);
  }

  onFieldFocus(fieldName) {
    if (this.isProcessing) return;
    this.focusTarget = fieldName;
    const input = document.activeElement?.tagName === 'INPUT' ? document.activeElement : null;
    if (fieldName.toLowerCase().includes('password')) {
      this.applyState(this.passwordVisible ? 'password-visible' : 'password-focus');
    } else {
      this.applyState('username-focus', { target: input });
    }
  }

  onFieldInput(fieldName, fieldValue, validation = {}) {
    if (this.isProcessing) return;
    const invalid = validation.isValid === false || validation.formData?._hasErrors === true;
    this.formCompleteness = invalid ? 'invalid' : fieldValue ? 'partial' : 'empty';
    if (fieldName.toLowerCase().includes('password')) {
      this.applyState(this.passwordVisible ? 'password-visible' : 'password-focus');
      return;
    }
    this.applyState('username-typing', { target: document.activeElement });
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      if (!this.isProcessing && this.focusTarget === fieldName) {
        this.applyState('username-focus', { target: document.activeElement });
      }
    }, this.config.typingSettleDelay);
  }

  onFieldBlur() {
    queueMicrotask(() => {
      if (this.isProcessing || document.activeElement?.tagName === 'INPUT') return;
      this.focusTarget = 'none';
      this.resetEyePosition();
      this.applyState('idle');
    });
  }

  onPasswordToggle(visible, input = null) {
    if (this.isProcessing) return;
    this.passwordVisible = visible;
    this.applyState(visible ? 'password-visible' : 'password-focus', {
      target: visible ? input : null,
    });
  }

  onButtonHover() {}

  onInvalidField(element) {
    if (!this.isProcessing) this.applyState('invalid-field', { target: element || null });
  }

  onSubmit() {
    this.isProcessing = true;
    clearTimeout(this.typingTimer);
    this.stopTrackingLoop();
    this.targetElement = null;
    this.applyState('submitting');
  }

  onSuccess() {
    this.isProcessing = false;
    this.applyState('success');
  }

  onError() {
    this.isProcessing = false;
    this.applyState('error');
  }

  scheduleBlink() {
    this.clearBlinkTimer();
    const range = this.config.blinkMaxDelay - this.config.blinkMinDelay;
    this.blinkTimer = setTimeout(
      () => {
        this.triggerBlink();
        this.scheduleBlink();
      },
      this.config.blinkMinDelay + Math.floor(Math.random() * range)
    );
  }

  triggerBlink() {
    if (!this.botRig || this.blinking || this.blocksBlink(this.currentState)) return;
    this.blinking = true;
    this.botRig.classList.add('blinking');
    clearTimeout(this.blinkEndTimer);
    this.blinkEndTimer = setTimeout(() => {
      this.botRig?.classList.remove('blinking');
      this.blinking = false;
    }, this.config.blinkDuration);
  }

  clearBlinkTimer() {
    clearTimeout(this.blinkTimer);
    clearTimeout(this.blinkEndTimer);
    this.blinkTimer = null;
    this.blinkEndTimer = null;
  }

  startIdleTimer() {}
  resetIdleTimer() {}
  clearIdleTimer() {}
  clearPasswordToggleTimer() {}

  destroy() {
    clearTimeout(this.typingTimer);
    this.clearBlinkTimer();
    this.stopTrackingLoop();
  }
}
