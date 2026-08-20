/**
 * @jest-environment jsdom
 */

import * as Y from 'yjs';
import { ChatManager } from '/js/features/editor/managers/ChatManager.js';

function renderChatShell() {
  document.body.innerHTML = `
    <button id="chatToggle" aria-expanded="false"></button>
    <span id="chatUnreadBadge" hidden></span>
    <div id="pagesContainer"></div>
    <aside id="documentChat" hidden>
      <button id="chatClose"></button>
      <div id="chatMessages"></div>
      <button id="chatNewMessages" hidden>New messages</button>
      <form id="chatForm">
        <textarea id="chatInput"></textarea>
        <button id="chatSend" type="submit">Send</button>
      </form>
    </aside>
  `;
}

describe('ChatManager', () => {
  let doc;
  let manager;

  beforeEach(() => {
    renderChatShell();
    doc = new Y.Doc();
    manager = new ChatManager({
      doc,
      canEdit: true,
      user: { _id: 'alice-id', username: 'alice' },
    });
    manager.init();
  });

  afterEach(() => manager.destroy());

  it('keeps the panel unmounted from layout until explicitly opened', () => {
    const panel = document.getElementById('documentChat');
    expect(panel.hidden).toBe(true);
    document.getElementById('chatToggle').click();
    expect(panel.hidden).toBe(false);
    expect(document.getElementById('chatToggle').getAttribute('aria-expanded')).toBe('true');
    expect(panel.dataset.chatState).toBe('opening');
    expect(document.activeElement).not.toBe(document.getElementById('chatInput'));
  });

  it('stores safe document-scoped messages in Yjs and renders remote messages', () => {
    document.getElementById('chatInput').value = 'Hello Bob';
    document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true }));

    const local = doc.getArray('chat').get(0);
    expect(local).toMatchObject({ username: 'alice', text: 'Hello Bob' });

    doc.getArray('chat').push([
      {
        id: 'remote',
        userId: 'bob-id',
        username: 'bob',
        text: '<img onerror=alert(1)>',
        createdAt: 1,
      },
    ]);
    expect(document.getElementById('chatMessages').textContent).toContain('<img onerror=alert(1)>');
    expect(document.querySelector('#chatMessages img')).toBeNull();
    expect(document.getElementById('chatUnreadBadge').hidden).toBe(false);
  });

  it('does not let a read-only participant send chat updates', () => {
    manager.editor.canEdit = false;
    manager.updatePermission();
    expect(document.getElementById('chatInput').disabled).toBe(true);
    expect(document.getElementById('chatSend').disabled).toBe(true);
    document.getElementById('chatInput').value = 'rejected';
    document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(doc.getArray('chat')).toHaveLength(0);
  });

  it('closes with Escape and returns focus to the toggle', async () => {
    await manager.setOpen(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();

    expect(document.getElementById('documentChat').hidden).toBe(true);
    expect(document.getElementById('chatToggle').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(document.getElementById('chatToggle'));
  });

  it('preserves existing message nodes when new messages arrive', () => {
    doc.getArray('chat').push([
      {
        id: 'first',
        userId: 'bob',
        username: 'bob',
        text: 'First',
        createdAt: 1,
      },
    ]);
    const firstNode = document.querySelector('[data-message-id="first"]');

    doc.getArray('chat').push([
      {
        id: 'second',
        userId: 'bob',
        username: 'bob',
        text: 'Second',
        createdAt: 2,
      },
    ]);

    expect(document.querySelector('[data-message-id="first"]')).toBe(firstNode);
    expect(document.querySelector('[data-message-id="second"]')).not.toBeNull();
  });
});
