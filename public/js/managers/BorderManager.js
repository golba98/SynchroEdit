import { ptToPx } from '/js/core/utils.js';

export class BorderManager {
  constructor(editor) {
    this.editor = editor;
    this.currentBorderStyle = 'solid';
    this.currentBorderWidth = '1pt';
    this.currentBorderColor = '#333333';
    this.currentBorderType = 'box';

    this.setupEventListeners();
  }

  setupEventListeners() {
    const addEvent = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    addEvent('borderNone', 'click', () => this.updateBorders(null, null, null, 'none'));
    addEvent('borderBox', 'click', () => this.updateBorders(null, null, null, 'box'));
    addEvent('borderShadow', 'click', () => this.updateBorders(null, null, null, 'shadow'));
    addEvent('border3D', 'click', () => this.updateBorders(null, null, null, '3d'));

    addEvent('borderStyleSelect', 'change', (e) => this.updateBorders(e.target.value));
    addEvent('borderWidthSelect', 'change', (e) => this.updateBorders(null, e.target.value));

    const colorPicker = document.getElementById('borderColorPicker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        const indicator = document.getElementById('borderColorIndicator');
        if (indicator) indicator.style.background = color;
        this.updateBorders(null, null, color);
      });
    }

    const colorBtn = document.getElementById('borderColorBtn');
    if (colorBtn && colorPicker) {
      colorBtn.addEventListener('click', () => colorPicker.click());
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

    if (!fromServer) {
      this.editor.onContentChange('update-borders', {
        style: this.currentBorderStyle,
        width: this.currentBorderWidth,
        color: this.currentBorderColor,
        type: this.currentBorderType,
      });
    }
  }
}
