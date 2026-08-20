import { Plugin } from '/js/app/Plugin.js';

const MAX_MESSAGES = 200;
const BOTTOM_THRESHOLD = 56;

export class ChatManager extends Plugin {
  init() {
    this.messages = this.editor.doc.getArray('chat');
    this.panel = document.getElementById('documentChat');
    this.list = document.getElementById('chatMessages');
    this.form = document.getElementById('chatForm');
    this.input = document.getElementById('chatInput');
    this.sendButton = document.getElementById('chatSend');
    this.toggle = document.getElementById('chatToggle');
    this.closeButton = document.getElementById('chatClose');
    this.newMessagesButton = document.getElementById('chatNewMessages');
    this.badge = document.getElementById('chatUnreadBadge');
    this.unread = 0;
    this.isOpen = false;
    this.closeSequence = 0;

    if (!this.panel || !this.list || !this.form || !this.input || !this.toggle) return;

    this.panel.hidden = true;
    this.panel.inert = true;
    this.panel.dataset.chatState = 'closed';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.updatePermission();
    this.render({ forceLatest: true });

    this.observe = (event) => {
      const added = event.changes?.added?.size || 0;
      const shouldStick = this.isNearBottom();
      if (!this.isOpen && added > 0) this.setUnread(this.unread + added);
      this.render({ forceLatest: shouldStick });
      if (this.isOpen && added > 0 && !shouldStick) this.showNewMessages(true);
    };
    this.messages.observe(this.observe);

    this.addDisposableListener(this.toggle, 'click', () => this.setOpen(!this.isOpen));
    if (this.closeButton) {
      this.addDisposableListener(this.closeButton, 'click', () => this.setOpen(false));
    }
    if (this.newMessagesButton) {
      this.addDisposableListener(this.newMessagesButton, 'click', () => this.scrollToLatest());
    }
    this.addDisposableListener(this.form, 'submit', (event) => this.send(event));
    this.addDisposableListener(this.input, 'keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.send(event);
      }
    });
    this.addDisposableListener(this.input, 'input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = `${Math.min(this.input.scrollHeight, 120)}px`;
    });
    this.addDisposableListener(this.list, 'scroll', () => {
      if (this.isNearBottom()) this.showNewMessages(false);
    });
    this.addDisposableListener(document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.setOpen(false);
    });
  }

  async setOpen(open) {
    if (!this.panel || open === this.isOpen) return;
    const pages = document.getElementById('pagesContainer');
    const preservedScrollTop = pages?.scrollTop || 0;
    const sequence = ++this.closeSequence;
    this.isOpen = open;
    this.toggle?.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('chat-open', open);

    if (open) {
      this.panel.hidden = false;
      this.panel.inert = false;
      this.panel.dataset.chatState = 'opening';
      this.setUnread(0);
      requestAnimationFrame(() => {
        if (!this.isOpen || sequence !== this.closeSequence) return;
        this.panel.dataset.chatState = 'open';
        if (pages) pages.scrollTop = preservedScrollTop;
        this.scrollToLatest();
      });
      return;
    }

    this.panel.inert = true;
    this.panel.dataset.chatState = 'closing';
    const animations = this.panel.getAnimations?.() || [];
    if (animations.length)
      await Promise.allSettled(animations.map((animation) => animation.finished));
    if (sequence !== this.closeSequence || this.isOpen) return;
    this.panel.hidden = true;
    this.panel.dataset.chatState = 'closed';
    if (pages) pages.scrollTop = preservedScrollTop;
    this.toggle?.focus({ preventScroll: true });
  }

  updatePermission() {
    const canEdit = Boolean(this.editor.canEdit);
    if (this.input) {
      this.input.disabled = !canEdit;
      this.input.placeholder = canEdit ? 'Message collaborators' : 'Chat is read-only for viewers';
    }
    if (this.sendButton) this.sendButton.disabled = !canEdit;
    this.form?.classList.toggle('is-read-only', !canEdit);
  }

  setUnread(count) {
    this.unread = Math.max(0, count);
    if (!this.badge) return;
    this.badge.textContent = String(Math.min(this.unread, 99));
    this.badge.hidden = this.unread === 0;
  }

  showNewMessages(visible) {
    if (this.newMessagesButton) this.newMessagesButton.hidden = !visible;
  }

  isNearBottom() {
    if (!this.list) return true;
    return (
      this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight <= BOTTOM_THRESHOLD
    );
  }

  send(event) {
    event?.preventDefault();
    const text = String(this.input?.value || '').trim();
    if (!text || !this.editor.canEdit) return;

    const user = this.editor.user || {};
    this.editor.doc.transact(() => {
      this.messages.push([
        {
          id:
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          userId: String(user._id || user.id || ''),
          username: String(user.username || 'Anonymous').slice(0, 80),
          text: text.slice(0, 1000),
          createdAt: Date.now(),
        },
      ]);
      if (this.messages.length > MAX_MESSAGES) {
        this.messages.delete(0, this.messages.length - MAX_MESSAGES);
      }
    }, this);
    this.input.value = '';
    this.input.style.height = 'auto';
    this.scrollToLatest();
    this.input.focus({ preventScroll: true });
  }

  createMessage(message, currentUserId) {
    const isMine = Boolean(currentUserId && String(message.userId || '') === currentUserId);
    const item = document.createElement('article');
    item.className = 'chat-message';
    item.dataset.messageId = String(message.id || `${message.createdAt}-${message.userId}`);
    if (isMine) item.classList.add('chat-message--mine');

    const avatar = document.createElement('div');
    avatar.className = 'chat-message__avatar';
    avatar.textContent =
      String(message.username || '?')
        .trim()
        .charAt(0)
        .toUpperCase() || '?';

    const contentWrap = document.createElement('div');
    contentWrap.className = 'chat-message__content';
    const meta = document.createElement('div');
    meta.className = 'chat-message__meta';
    const name = document.createElement('strong');
    name.textContent = isMine ? 'You' : String(message.username || 'Anonymous').slice(0, 80);
    const time = document.createElement('time');
    const date = new Date(Number(message.createdAt) || Date.now());
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    meta.append(name, time);

    const bubble = document.createElement('div');
    bubble.className = 'chat-message__bubble';
    const body = document.createElement('p');
    body.textContent = message.text.slice(0, 1000);
    bubble.appendChild(body);
    contentWrap.append(meta, bubble);
    item.append(avatar, contentWrap);
    return item;
  }

  render({ forceLatest = false } = {}) {
    if (!this.list || !this.messages) return;
    const previousHeight = this.list.scrollHeight;
    const previousTop = this.list.scrollTop;
    const currentUserId = String(this.editor.user?._id || this.editor.user?.id || '');
    const messages = this.messages
      .toArray()
      .slice(-MAX_MESSAGES)
      .filter((message) => message && typeof message.text === 'string');

    const existing = new Map(
      Array.from(this.list.querySelectorAll('.chat-message[data-message-id]')).map((node) => [
        node.dataset.messageId,
        node,
      ])
    );
    const nextIds = new Set();
    this.list.querySelector('.document-chat__empty')?.remove();

    messages.forEach((message) => {
      const id = String(message.id || `${message.createdAt}-${message.userId}`);
      nextIds.add(id);
      const node = existing.get(id) || this.createMessage(message, currentUserId);
      this.list.appendChild(node);
    });
    existing.forEach((node, id) => {
      if (!nextIds.has(id)) node.remove();
    });

    if (!messages.length) {
      const empty = document.createElement('div');
      empty.className = 'document-chat__empty';
      const icon = document.createElement('div');
      icon.className = 'document-chat__empty-icon';
      icon.innerHTML = '<i class="far fa-comments" aria-hidden="true"></i>';
      const title = document.createElement('div');
      title.className = 'document-chat__empty-title';
      title.textContent = 'No messages yet';
      const subtitle = document.createElement('div');
      subtitle.className = 'document-chat__empty-subtitle';
      subtitle.textContent = 'Collaborate in real time with everyone in this document.';
      empty.append(icon, title, subtitle);
      this.list.appendChild(empty);
    }

    if (forceLatest) {
      this.scrollToLatest();
    } else {
      this.list.scrollTop = previousTop + Math.max(0, this.list.scrollHeight - previousHeight);
    }
  }

  scrollToLatest() {
    if (!this.list) return;
    this.list.scrollTop = this.list.scrollHeight;
    this.showNewMessages(false);
  }

  destroy() {
    this.messages?.unobserve(this.observe);
    this.disposeListeners();
    if (this.panel) {
      this.panel.hidden = true;
      this.panel.inert = true;
      this.panel.dataset.chatState = 'closed';
    }
    document.body.classList.remove('chat-open');
    if (this.list) this.list.replaceChildren();
    this.messages = null;
  }
}
