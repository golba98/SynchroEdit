const AUTH_STATES = new Set([
  'idle',
  'username-focus',
  'username-typing',
  'password-focus',
  'password-visible',
  'invalid-field',
  'submitting',
  'success',
  'error',
]);

const LOCKED_STATES = new Set(['submitting', 'success', 'error']);

/**
 * One deterministic Syncrobot controller shared by every authentication route.
 * Authentication state always wins; pointer and tap reactions are supplementary.
 */
export class SyncroBot {
  constructor(options = {}) {
    this.authFlow = options.authFlow || 'login';
    this.container = null;
    this.botRig = null;
    this.pupils = [];
    this.primaryState = 'idle';
    this.currentState = 'idle';
    this.focusTarget = 'none';
    this.formCompleteness = 'empty';
    this.passwordVisible = false;
    this.isProcessing = false;
    this.targetElement = null;
    this.pointer = null;
    this.gaze = { x: 0, y: 0 };
    this.rafId = null;
    this.blinkTimer = null;
    this.blinkEndTimer = null;
    this.typingTimer = null;
    this.reaction = null;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
    this.config = {
      eyeMaxX: 7,
      eyeMaxY: 6,
      gazeEase: 0.18,
      blinkMinDelay: 4200,
      blinkMaxDelay: 7600,
      blinkDuration: 120,
      typingSettleDelay: 420,
    };

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onCharacterPress = this.onCharacterPress.bind(this);
    this.onCharacterKeydown = this.onCharacterKeydown.bind(this);
    this.onReactionEnd = this.onReactionEnd.bind(this);
    this.tickGaze = this.tickGaze.bind(this);
  }

  init(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.botRig = this.container?.querySelector('.bot-rig') || null;
    this.pupils = Array.from(this.container?.querySelectorAll('.pupil') || []);
    if (!this.container || !this.botRig || this.pupils.length === 0) {
      console.warn('SyncroBot: Bot elements not found');
      return false;
    }

    this.pointerSurface = this.container.closest('.right-section') || this.container;
    this.container.setAttribute('role', 'button');
    this.container.setAttribute('tabindex', '0');
    this.container.setAttribute('aria-label', 'Play with Syncrobot');
    this.botRig.setAttribute('aria-hidden', 'true');

    this.pointerSurface.addEventListener('pointermove', this.onPointerMove, {
      passive: true,
    });
    this.pointerSurface.addEventListener('pointerleave', this.onPointerLeave, {
      passive: true,
    });
    this.container.addEventListener('pointerdown', this.onCharacterPress);
    this.container.addEventListener('keydown', this.onCharacterKeydown);
    this.botRig.addEventListener('animationend', this.onReactionEnd);

    this.setAuthState('idle');
    this.rafId = requestAnimationFrame(this.tickGaze);
    return true;
  }

  normalizeState(state) {
    const aliases = {
      tracking: 'username-focus',
      typing: 'username-typing',
      secure: 'password-focus',
      peeking: 'password-visible',
      processing: 'submitting',
      empathy: 'idle',
      'hover-ready': this.focusTarget.includes('password') ? 'password-focus' : 'username-focus',
      'hover-blocked': 'invalid-field',
      bored: 'idle',
    };
    const normalized = aliases[state] || state;
    return AUTH_STATES.has(normalized) ? normalized : 'idle';
  }

  setAuthState(state, options = {}) {
    if (!this.botRig) return;
    const normalized = this.normalizeState(state);
    this.primaryState = normalized;
    this.currentState = normalized;
    this.targetElement = options.target || null;
    this.clearReaction();

    this.botRig.dataset.syncroState = normalized;
    for (const className of Array.from(this.botRig.classList)) {
      if (className.startsWith('syncro-state--') || className.startsWith('syncro-reaction--')) {
        this.botRig.classList.remove(className);
      }
    }
    this.botRig.classList.add(`syncro-state--${normalized}`);

    if (LOCKED_STATES.has(normalized)) {
      this.clearBlinkTimer();
      this.botRig.classList.remove('blinking');
    } else {
      this.scheduleBlink();
    }
  }

  applyState(state, options = {}) {
    this.setAuthState(state, options);
  }

  onPointerMove(event) {
    this.pointer = { x: event.clientX, y: event.clientY };
  }

  onPointerLeave() {
    this.pointer = null;
  }

  onCharacterPress(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = this.container.getBoundingClientRect();
    const side = event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
    this.react(`poke-${side}`);
  }

  onCharacterKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.react('pleased');
  }

  react(kind) {
    if (!this.botRig || LOCKED_STATES.has(this.primaryState)) return;
    const allowed = new Set(['poke-left', 'poke-right', 'pleased']);
    const reaction = allowed.has(kind) ? kind : 'pleased';
    this.clearReaction();
    this.reaction = reaction;
    this.botRig.classList.add(`syncro-reaction--${reaction}`);
    if (this.reducedMotion?.matches) queueMicrotask(() => this.clearReaction());
  }

  onReactionEnd(event) {
    if (!this.reaction || event.target !== this.botRig) return;
    this.clearReaction();
  }

  clearReaction() {
    if (!this.botRig) return;
    for (const className of Array.from(this.botRig.classList)) {
      if (className.startsWith('syncro-reaction--')) this.botRig.classList.remove(className);
    }
    this.reaction = null;
  }

  resolveGazeTarget() {
    const fixed = {
      'password-focus': { x: -0.32, y: 0.52 },
      'password-visible': { x: -0.5, y: 0.05 },
      submitting: { x: 0, y: -0.25 },
      success: { x: 0, y: -0.2 },
      error: { x: -0.65, y: 0.48 },
    };
    if (fixed[this.primaryState]) return fixed[this.primaryState];

    const rect = this.botRig?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    let targetPoint = null;
    if (this.targetElement?.isConnected) {
      const targetRect = this.targetElement.getBoundingClientRect();
      targetPoint = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      };
    } else if (this.pointer) {
      targetPoint = this.pointer;
    }

    if (!targetPoint) return { x: 0, y: 0 };
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height * 0.42;
    return {
      x: Math.max(-1, Math.min(1, (targetPoint.x - centerX) / Math.max(rect.width, 1))),
      y: Math.max(-1, Math.min(1, (targetPoint.y - centerY) / Math.max(rect.height, 1))),
    };
  }

  tickGaze() {
    const target = this.resolveGazeTarget();
    const ease = this.reducedMotion?.matches ? 1 : this.config.gazeEase;
    this.gaze.x += (target.x - this.gaze.x) * ease;
    this.gaze.y += (target.y - this.gaze.y) * ease;
    const x = this.gaze.x * this.config.eyeMaxX;
    const y = this.gaze.y * this.config.eyeMaxY;
    this.pupils.forEach((pupil) => {
      pupil.style.setProperty('--pupil-x', `${x.toFixed(2)}px`);
      pupil.style.setProperty('--pupil-y', `${y.toFixed(2)}px`);
    });
    this.rafId = requestAnimationFrame(this.tickGaze);
  }

  onFieldFocus(fieldName) {
    if (this.isProcessing) return;
    this.focusTarget = fieldName;
    const input = document.activeElement?.matches?.('input, textarea')
      ? document.activeElement
      : null;
    if (fieldName.toLowerCase().includes('password')) {
      this.setAuthState(this.passwordVisible ? 'password-visible' : 'password-focus');
    } else {
      this.setAuthState('username-focus', { target: input });
    }
  }

  onFieldInput(fieldName, fieldValue, validation = {}) {
    if (this.isProcessing) return;
    const invalid = validation.isValid === false || validation.formData?._hasErrors === true;
    this.formCompleteness = invalid ? 'invalid' : fieldValue ? 'partial' : 'empty';
    this.focusTarget = fieldName;
    const input = document.activeElement?.matches?.('input, textarea')
      ? document.activeElement
      : null;

    if (invalid) {
      this.setAuthState('invalid-field', { target: input });
      return;
    }
    if (fieldName.toLowerCase().includes('password')) {
      this.setAuthState(this.passwordVisible ? 'password-visible' : 'password-focus');
      return;
    }

    this.setAuthState('username-typing', { target: input });
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      if (!this.isProcessing && this.focusTarget === fieldName) {
        this.setAuthState('username-focus', { target: input });
      }
    }, this.config.typingSettleDelay);
  }

  onFieldBlur() {
    queueMicrotask(() => {
      if (this.isProcessing || document.activeElement?.matches?.('input, textarea')) return;
      this.focusTarget = 'none';
      this.targetElement = null;
      this.setAuthState('idle');
    });
  }

  onPasswordToggle(visible, input = null) {
    if (this.isProcessing) return;
    this.passwordVisible = visible;
    this.setAuthState(visible ? 'password-visible' : 'password-focus', {
      target: visible ? input : null,
    });
  }

  onButtonHover(active) {
    if (!active || this.isProcessing || this.focusTarget !== 'none') return;
    this.targetElement = document.activeElement?.matches?.('button')
      ? document.activeElement
      : null;
  }

  onInvalidField(element) {
    if (!this.isProcessing) this.setAuthState('invalid-field', { target: element || null });
  }

  onSubmit() {
    this.isProcessing = true;
    clearTimeout(this.typingTimer);
    this.setAuthState('submitting');
  }

  onSuccess() {
    this.isProcessing = false;
    this.setAuthState('success');
  }

  onError() {
    this.isProcessing = false;
    this.setAuthState('error');
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
    if (!this.botRig || LOCKED_STATES.has(this.primaryState)) return;
    this.botRig.classList.add('blinking');
    clearTimeout(this.blinkEndTimer);
    this.blinkEndTimer = setTimeout(() => {
      this.botRig?.classList.remove('blinking');
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
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.pointerSurface?.removeEventListener('pointermove', this.onPointerMove);
    this.pointerSurface?.removeEventListener('pointerleave', this.onPointerLeave);
    this.container?.removeEventListener('pointerdown', this.onCharacterPress);
    this.container?.removeEventListener('keydown', this.onCharacterKeydown);
    this.botRig?.removeEventListener('animationend', this.onReactionEnd);
  }
}
