/**
 * @jest-environment jsdom
 */

import { SyncroBot } from '/js/features/auth/syncro/SyncroBot.js';

function renderBot() {
  document.body.innerHTML = `
    <section class="right-section">
      <div class="character-container">
        <div class="bot-rig">
          <div class="antenna-stalk"></div><div class="antenna-bulb"></div>
          <div class="head"><div class="face-screen">
            <div class="eyes-container">
              <div class="eye"><div class="eyelid top"></div><div class="pupil"></div><div class="eyelid bottom"></div></div>
              <div class="eye"><div class="eyelid top"></div><div class="pupil"></div><div class="eyelid bottom"></div></div>
            </div><div class="mouth"></div>
          </div></div>
          <div class="hands-container"><div class="hand left"></div><div class="hand right"></div></div>
        </div>
      </div>
    </section>
    <input id="email" />
    <input id="password" type="password" />
  `;
  document.querySelector('.bot-rig').getBoundingClientRect = () => ({
    left: 500,
    top: 200,
    width: 160,
    height: 176,
  });
  document.querySelector('.character-container').getBoundingClientRect = () => ({
    left: 430,
    top: 140,
    width: 300,
    height: 300,
  });
}

describe('SyncroBot', () => {
  let bot;
  let animationFrameSpy;

  beforeEach(() => {
    renderBot();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    animationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    bot = new SyncroBot();
    bot.init('.character-container');
  });

  afterEach(() => {
    bot.destroy();
    jest.restoreAllMocks();
  });

  it('maintains exactly one authoritative auth state class', () => {
    bot.setAuthState('username-focus', {
      target: document.getElementById('email'),
    });
    bot.setAuthState('password-focus');
    const stateClasses = Array.from(bot.botRig.classList).filter((name) =>
      name.startsWith('syncro-state--')
    );

    expect(bot.botRig.dataset.syncroState).toBe('password-focus');
    expect(stateClasses).toEqual(['syncro-state--password-focus']);
  });

  it('interpolates pupil gaze toward pointer movement', () => {
    bot.onPointerMove({ clientX: 760, clientY: 260 });
    bot.tickGaze();

    expect(bot.gaze.x).toBeGreaterThan(0);
    expect(bot.pupils[0].style.getPropertyValue('--pupil-x')).not.toBe('0.00px');
    expect(animationFrameSpy).toHaveBeenCalled();
  });

  it('lets field state override pointer gaze', () => {
    const email = document.getElementById('email');
    email.getBoundingClientRect = () => ({
      left: 30,
      top: 300,
      width: 240,
      height: 48,
    });
    email.focus();
    bot.onPointerMove({ clientX: 900, clientY: 200 });
    bot.onFieldFocus('email');

    const target = bot.resolveGazeTarget();
    expect(target.x).toBeLessThan(0);
  });

  it('plays a bounded tap reaction and cancels it for submitting', () => {
    bot.onCharacterPress({ button: 0, clientX: 450 });
    expect(bot.botRig.classList.contains('syncro-reaction--poke-left')).toBe(true);

    bot.onSubmit();
    expect(bot.botRig.dataset.syncroState).toBe('submitting');
    expect(
      Array.from(bot.botRig.classList).some((name) => name.startsWith('syncro-reaction--'))
    ).toBe(false);

    bot.react('pleased');
    expect(
      Array.from(bot.botRig.classList).some((name) => name.startsWith('syncro-reaction--'))
    ).toBe(false);
  });

  it('exposes the character as a keyboard-operable playful control', () => {
    expect(bot.container.getAttribute('role')).toBe('button');
    expect(bot.container.tabIndex).toBe(0);
    bot.onCharacterKeydown({ key: 'Enter', preventDefault: jest.fn() });
    expect(bot.botRig.classList.contains('syncro-reaction--pleased')).toBe(true);
  });
});
