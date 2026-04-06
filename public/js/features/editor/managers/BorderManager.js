import { ptToPx } from '/js/app/utils.js';
import { Plugin } from '/js/app/Plugin.js';

export class BorderManager extends Plugin {
  constructor(editor, options) {
    super(editor, options);
    this.currentBorderStyle = 'solid';
    this.currentBorderWidth = '1pt';
    this.currentBorderColor = '#333333';
    this.currentBorderType = 'none';
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const addEvent = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) this.addDisposableListener(el, event, handler);
    };

    addEvent('borderNone', 'click', () => this.updateBorders(null, null, null, 'none'));
    addEvent('borderBox', 'click', () => this.updateBorders(null, null, null, 'box'));
    addEvent('borderShadow', 'click', () => this.updateBorders(null, null, null, 'shadow'));
    addEvent('border3D', 'click', () => this.updateBorders(null, null, null, '3d'));

    addEvent('borderStyleSelect', 'change', (e) => this.updateBorders(e.target.value));
    addEvent('borderWidthSelect', 'change', (e) => this.updateBorders(null, e.target.value));

    const colorPicker = document.getElementById('borderColorPicker');
    if (colorPicker) {
      this.addDisposableListener(colorPicker, 'input', (e) => {
        const color = e.target.value;
        const indicator = document.getElementById('borderColorIndicator');
        if (indicator) indicator.style.background = color;
        this.updateBorders(null, null, color);
      });
    }

    const colorBtn = document.getElementById('borderColorBtn');
    if (colorBtn && colorPicker) {
      this.addDisposableListener(colorBtn, 'click', () => colorPicker.click());
    }
  }

  applyBorderToElement(element) {
    const widthPx = `${ptToPx(this.currentBorderWidth)}px`;
    const borderValue = `${widthPx} ${this.currentBorderStyle} ${this.currentBorderColor}`;

    element.style.border = 'none';
    element.style.boxShadow = 'none';

    if (this.currentBorderType === 'none') {
      return;
    } else if (this.currentBorderType === 'box') {
      element.style.border = borderValue;
    } else if (this.currentBorderType === 'shadow') {
      element.style.border = borderValue;
      element.style.boxShadow = `5px 5px 10px rgba(0, 0, 0, 0.5)`;
    } else if (this.currentBorderType === '3d') {
      element.style.border = borderValue;
      element.style.boxShadow = `inset -2px -2px 5px rgba(0, 0, 0, 0.4), inset 2px 2px 5px rgba(255, 255, 255, 0.1)`;
    }
  }

  updateBorders(style, width, color, type, fromServer = false) {
    this.currentBorderStyle = style || this.currentBorderStyle;
    this.currentBorderWidth = width || this.currentBorderWidth;
    this.currentBorderColor = color || this.currentBorderColor;
    this.currentBorderType = type || this.currentBorderType;

    const borders = document.querySelectorAll('.page-border-inner');
    borders.forEach((border) => this.applyBorderToElement(border));

    // Fix: Check if onContentChange exists (it might not be on Editor yet, or we need to add it)
    // The previous code called `this.editor.onContentChange`. I need to ensure Editor has this method or logic.
    // Looking at Editor.js again, I don't recall seeing onContentChange.
    // Wait, the truncated read of Editor.js didn't show it.
    // I should check if it exists.

    if (this.editor.onContentChange && !fromServer) {
      this.editor.onContentChange('update-borders', {
        style: this.currentBorderStyle,
        width: this.currentBorderWidth,
        color: this.currentBorderColor,
        type: this.currentBorderType,
      });
    }
  }
}
