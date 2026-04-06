/**
 * @jest-environment jsdom
 */
import { SynchroBot } from '../../../public/js/features/auth/synchro/SynchroBot.js';

describe('SynchroBot', () => {
  let synchro;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div class="character-container">
        <div class="bot-rig" id="botRig">
          <div class="pupil"></div>
          <div class="pupil"></div>
        </div>
      </div>
    `;

    synchro = new SynchroBot({ authFlow: 'login' });
  });

  afterEach(() => {
    synchro?.destroy();
  });

  describe('initialization', () => {
    test('should initialize with default state', () => {
      expect(synchro.currentState).toBe('idle');
      expect(synchro.focusTarget).toBe('none');
      expect(synchro.formCompleteness).toBe('empty');
    });

    test('should initialize with forgot flow state', () => {
      const forgotSynchro = new SynchroBot({ authFlow: 'forgot' });
      forgotSynchro.init('.character-container');
      expect(forgotSynchro.currentState).toBe('empathy');
      forgotSynchro.destroy();
    });

    test('should return false if container not found', () => {
      document.body.innerHTML = '';
      const result = synchro.init('.character-container');
      expect(result).toBe(false);
    });
  });

  describe('state transitions', () => {
    beforeEach(() => {
      synchro.init('.character-container');
    });

    test('should transition to tracking on username focus', () => {
      synchro.onFieldFocus('username', '');
      expect(synchro.currentState).toBe('tracking');
    });

    test('should transition to secure on password focus (hidden)', () => {
      synchro.onFieldFocus('password', '');
      expect(synchro.currentState).toBe('secure');
    });

    test('should transition to peeking when password visible', () => {
      jest.useFakeTimers();
      synchro.onFieldFocus('password', '');
      // Wait for transition to complete
      jest.advanceTimersByTime(synchro.config.transitionDuration + 10);
      synchro.onPasswordToggle(true);
      jest.advanceTimersByTime(synchro.config.transitionDuration + 10);
      expect(synchro.currentState).toBe('peeking');
      jest.useRealTimers();
    });

    test('should transition to processing on submit', () => {
      synchro.onSubmit();
      expect(synchro.currentState).toBe('processing');
      expect(synchro.isProcessing).toBe(true);
    });

    test('should transition to success after submit success', () => {
      synchro.onSubmit();
      synchro.onSuccess();
      expect(synchro.currentState).toBe('success');
      expect(synchro.isProcessing).toBe(false);
    });

    test('should transition to error after submit error', () => {
      synchro.onSubmit();
      synchro.onError();
      expect(synchro.currentState).toBe('error');
      expect(synchro.isProcessing).toBe(false);
    });
  });

  describe('idle timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      synchro.init('.character-container');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should transition to bored after 10s idle', () => {
      jest.advanceTimersByTime(11000);
      expect(synchro.currentState).toBe('bored');
    });

    test('should reset idle timer on input', () => {
      jest.advanceTimersByTime(9000);
      synchro.onFieldInput('username', 'test', {});
      jest.advanceTimersByTime(9000);
      expect(synchro.currentState).not.toBe('bored');
    });
  });

  describe('button hover', () => {
    beforeEach(() => {
      synchro.init('.character-container');
    });

    test('should show hover-blocked when form empty', () => {
      synchro.formCompleteness = 'empty';
      synchro.onButtonHover(true);
      expect(synchro.currentState).toBe('hover-blocked');
    });

    test('should show hover-ready when form valid', () => {
      synchro.formCompleteness = 'valid';
      synchro.onButtonHover(true);
      expect(synchro.currentState).toBe('hover-ready');
    });
  });
});
