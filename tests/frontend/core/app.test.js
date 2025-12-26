/**
 * @jest-environment jsdom
 */

import { App } from '/js/core/app.js';
import { Network } from '/js/core/network.js';
import { Auth } from '/js/ui/auth.js';
import { Profile } from '/js/ui/profile.js';
import * as Utils from '/js/core/utils.js';

// Mocks
jest.mock('/js/core/network.js');
jest.mock('/js/ui/auth.js');
jest.mock('/js/ui/ui.js');
jest.mock('/js/editor/editor.js');
jest.mock('/js/ui/theme.js');
jest.mock('/js/ui/profile.js');
jest.mock('/js/ui/background.js');
jest.mock('/js/core/utils.js', () => ({
    ...jest.requireActual('/js/core/utils.js'),
    navigateTo: jest.fn(),
}));

describe('App Core Initialization', () => {
  const originalURLSearchParams = global.URLSearchParams;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="docLibrary"></div>
      <div id="libraryOverlay"></div>
      <button id="closeLibrary"></button>
      <div id="documentList"></div>
      <div id="activeCollaborators"></div>
      <div id="serverOfflineOverlay"></div>
      
      <div id="userProfileTrigger">
        <img id="headerPfp" />
        <div id="headerInitials"></div>
        <i id="headerUserIcon"></i>
      </div>
      
      <div id="profileModal">
        <img id="profilePfp" />
        <div id="profileInitials"></div>
        <div id="profilePfpPlaceholder"></div>
        <input id="profileEmailInput" />
        <input id="profileUsernameInput" />
        <textarea id="profileBioInput"></textarea>
        <button id="saveGeneralBtn"></button>
      </div>
    `;
    
    // Default Profile load success
    Profile.prototype.loadProfile = jest.fn().mockResolvedValue({ _id: 'user1', username: 'TestUser' });
    
    // Default Network mocks
    Network.getDocuments.mockResolvedValue({ documents: [] });
    Network.addToRecent.mockResolvedValue({});

    // Mock URLSearchParams globally
    global.URLSearchParams = jest.fn(() => ({
        get: jest.fn().mockReturnValue(null) // Default no doc param
    }));
  });

  afterAll(() => {
      global.URLSearchParams = originalURLSearchParams;
  });

  it('should show library if no document ID in URL', async () => {
    global.URLSearchParams = jest.fn(() => ({
        get: jest.fn().mockReturnValue(null)
    }));

    const app = new App();
    
    // Wait for async init
    await new Promise(process.nextTick);

    const lib = document.getElementById('docLibrary');
    expect(lib.style.display).toBe('block');
    expect(Network.getDocuments).toHaveBeenCalled();
  });

  it('should load document if document ID is present', async () => {
    global.URLSearchParams = jest.fn(() => ({
        get: jest.fn().mockReturnValue('123')
    }));

    const app = new App();
    
    // Wait for async init
    await new Promise(process.nextTick);
    await new Promise(process.nextTick); 

    const lib = document.getElementById('docLibrary');
    expect(lib.style.display).toBe('none');
    expect(Network.addToRecent).toHaveBeenCalledWith('123');
  });

  it('should redirect to login if profile load fails', async () => {
    Profile.prototype.loadProfile = jest.fn().mockResolvedValue(null);

    const app = new App();
    await new Promise(process.nextTick);

    expect(Utils.navigateTo).toHaveBeenCalledWith('pages/login.html');
  });

  it('should not show connection overlay if page is hidden', async () => {
    jest.useFakeTimers();
    global.URLSearchParams = jest.fn(() => ({
      get: jest.fn().mockReturnValue('123')
    }));

    // Mock hidden state
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true
    });

    const app = new App();
    // Use runAllTicks instead of nextTick promise for fake timers
    jest.runAllTicks();

    const overlay = document.getElementById('serverOfflineOverlay');
    overlay.style.display = 'none';
    app.handleWSStatusChange('connecting');
    
    expect(overlay.style.display).toBe('none');

    // Change to visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });

    app.handleWSStatusChange('connecting');
    
    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000);
    
    expect(overlay.style.display).toBe('flex');
    jest.useRealTimers();
  });
});