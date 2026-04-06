export class Plugin {
  constructor(editor, options = {}) {
    this.editor = editor;
    this.options = options;
    this.name = this.constructor.name;
  }

  /**
   * Called when the plugin is registered with the editor.
   * Use this to attach listeners, initialize state, etc.
   */
  init() {}

  /**
   * Called when the plugin is removed or the editor is destroyed.
   * Clean up listeners and state here.
   */
  destroy() {}

  /**
   * Helper to add an event listener that will be automatically cleaned up on destroy.
   */
  addDisposableListener(target, type, handler) {
    if (!this._listeners) this._listeners = [];
    target.addEventListener(type, handler);
    this._listeners.push({ target, type, handler });
  }

  /**
   * Helper to remove all listeners added via addDisposableListener.
   */
  disposeListeners() {
    if (this._listeners) {
      this._listeners.forEach(({ target, type, handler }) => {
        target.removeEventListener(type, handler);
      });
      this._listeners = [];
    }
  }
}
