import { Plugin } from '/js/app/Plugin.js';

const MAX_MESSAGES = 200;

export class ChatManager extends Plugin {
  init() {
    this.messages = this.editor.doc.getArray('chat');
    this.panel = document.getElementById('documentChat');
    this.list = document.getElementById('chatMessages');
    this.form = document.getElementById('chatForm');
    this.input = document.getElementById('chatInput');
    this.toggle = document.getElementById('chatToggle');
    this.closeButton = document.getElementById('chatClose');
    this.badge = document.getElementById('chatUnreadBadge');
    this.unread = 0;

    if (!this.panel || !this.list || !this.form || !this.input || !this.toggle) return;

    this.panel.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.render();

    this.observe = (event) => {
      const added = event.changes?.added?.size || 0;
      if (this.panel.hidden && added > 0) this.setUnread(this.unread + added);
      this.render();
    };
    this.messages.observe(this.observe);

    this.addDisposableListener(this.toggle, 'click', () => this.setOpen(this.panel.hidden));
    if (this.closeButton) {
      this.addDisposableListener(this.closeButton, 'click', () => this.setOpen(false));
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
  }

  setOpen(open) {
    if (!this.panel) return;
    this.panel.hidden = !open;
    this.toggle?.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('chat-open', open);
    if (open) {
      this.setUnread(0);
      requestAnimationFrame(() => {
        this.scrollToLatest();
        this.input?.focus();
      });
    }
  }

  setUnread(count) {
    this.unread = Math.max(0, count);
    if (!this.badge) return;
    this.badge.textContent = String(Math.min(this.unread, 99));
    this.badge.hidden = this.unread === 0;
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
    this.input.focus();
  }

  render() {
    if (!this.list || !this.messages) return;
    const fragment = document.createDocumentFragment();
    const currentUserId = String(this.editor.user?._id || this.editor.user?.id || '');

    this.messages
      .toArray()
      .slice(-MAX_MESSAGES)
      .forEach((message) => {
        if (!message || typeof message.text !== 'string') return;
        const isMine = Boolean(currentUserId && String(message.userId || '') === currentUserId);
        const item = document.createElement('article');
        item.className = 'chat-message';
        if (isMine) {
          item.classList.add('chat-message--mine');
        }

        // Avatar / Initial circle
        const avatar = document.createElement('div');
        avatar.className = 'chat-message__avatar';
        const initial =
          String(message.username || '?')
            .trim()
            .charAt(0)
            .toUpperCase() || '?';
        avatar.textContent = initial;

        const contentWrap = document.createElement('div');
        contentWrap.className = 'chat-message__content';

        const meta = document.createElement('div');
        meta.className = 'chat-message__meta';
        const name = document.createElement('strong');
        name.textContent = isMine ? 'You' : String(message.username || 'Anonymous').slice(0, 80);
        const time = document.createElement('time');
        const date = new Date(Number(message.createdAt) || Date.now());
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        meta.append(name, time);

        const bubble = document.createElement('div');
        bubble.className = 'chat-message__bubble';
        const body = document.createElement('p');
        body.textContent = message.text.slice(0, 1000);
        bubble.appendChild(body);

        contentWrap.append(meta, bubble);
        item.append(avatar, contentWrap);
        fragment.appendChild(item);
      });

    if (!fragment.childNodes.length) {
      const empty = document.createElement('div');
      empty.className = 'document-chat__empty';
      empty.innerHTML = `
        <div class="document-chat__empty-icon"><i class="far fa-comments"></i></div>
        <div class="document-chat__empty-title">No messages yet</div>
        <div class="document-chat__empty-subtitle">Collaborate in real-time with everyone on this document.</div>
      `;
      fragment.appendChild(empty);
    }
    this.list.replaceChildren(fragment);
    this.scrollToLatest();
  }

  scrollToLatest() {
    if (this.list) {
      this.list.scrollTop = this.list.scrollHeight;
    }
  }

  destroy() {
    this.messages?.unobserve(this.observe);
    this.disposeListeners();
    this.setOpen(false);
    if (this.list) this.list.replaceChildren();
    this.messages = null;
  }
}
