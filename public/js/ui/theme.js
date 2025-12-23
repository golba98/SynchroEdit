export class Theme {
  constructor() {
    this.currentTheme = localStorage.getItem('synchroEditTheme') || 'dark';
    this.currentAccentColor = localStorage.getItem('synchroEditAccentColor') || '#8b5cf6';
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.applyAccentColor(this.currentAccentColor);
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('synchroEditTheme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    this.updateThemeButtons();
  }

  updateThemeButtons() {
    const darkBtn = document.getElementById('darkThemeBtn');
    const lightBtn = document.getElementById('lightThemeBtn');
    if (!darkBtn || !lightBtn) return;

    if (this.currentTheme === 'dark') {
      darkBtn.style.background = this.currentAccentColor;
      darkBtn.style.color = 'white';
      lightBtn.style.background = '#f0f0f0';
      lightBtn.style.color = '#1a1a1a';
    } else {
      lightBtn.style.background = this.currentAccentColor;
      lightBtn.style.color = 'white';
      darkBtn.style.background = '#f0f0f0';
      darkBtn.style.color = '#1a1a1a';
    }
  }

  applyAccentColor(color) {
    this.currentAccentColor = color;
    localStorage.setItem('synchroEditAccentColor', color);

    let rgbString, lightColor, lighterColor, hexColor;
    const isRainbow = color === 'rainbow';

    if (isRainbow) {
      document.body.classList.add('theme-rainbow');
      // Use purple as base for calculations
      hexColor = '#8b5cf6';
      rgbString = '139, 92, 246';
      lightColor = '#a78bfa';
      lighterColor = '#c4b5fd';
    } else {
      document.body.classList.remove('theme-rainbow');
      const rgb = this.hexToRgb(color);
      if (!rgb) return;
      rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
      hexColor = color;
      lightColor = this.lightenColor(color, 20);
      lighterColor = this.lightenColor(color, 40);
    }

    document.documentElement.style.setProperty('--accent-color', hexColor);
    document.documentElement.style.setProperty('--accent-color-rgb', rgbString);
    document.documentElement.style.setProperty('--accent-color-light', lightColor);
    document.documentElement.style.setProperty('--accent-color-lighter', lighterColor);

    let styleEl = document.getElementById('accentColorStyle');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'accentColorStyle';
      document.head.appendChild(styleEl);
    }

    // Dynamic CSS generation
    const mainColor = isRainbow ? `var(--rainbow-gradient)` : hexColor;
    const hoverColor = isRainbow ? `var(--rainbow-gradient-light)` : lightColor;
    const borderColor = isRainbow ? hexColor : hexColor; // Use hex for borders to avoid border-image complexity issues

    styleEl.innerHTML = `
            ${isRainbow ? `
            :root {
                --rainbow-gradient: linear-gradient(135deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);
                --rainbow-gradient-light: linear-gradient(135deg, #ff4d4d, #ff9f4d, #ffff4d, #4dff4d, #4d4dff, #7a4dff, #bf4dff);
                animation: rainbow-bg 10s ease infinite;
            }
            @keyframes rainbow-border { 0% { border-color: #ff0000; } 50% { border-color: #00ff00; } 100% { border-color: #ff0000; } }
            @keyframes rainbow-text { 0% { color: #ff0000; } 50% { color: #0000ff; } 100% { color: #ff0000; } }
            ` : ''}

            body { background: linear-gradient(135deg, #0a0a0a 0%, ${hexColor}22 15%, #0d0d0d 30%, ${hexColor}15 50%, #0d0d0d 70%, #0a0a0f 100%) !important; }
            body.light-theme { background: linear-gradient(135deg, #f5f5f5 0%, ${hexColor}11 15%, #f8f8f8 30%, ${hexColor}08 50%, #f8f8f8 70%, #f5f5f5 100%) !important; }
            
            /* Header & Logo */
            .header { border-bottom: 1px solid ${borderColor} !important; box-shadow: 0 4px 12px rgba(${rgbString}, 0.25) !important; }
            .logo { color: ${hexColor} !important; text-shadow: 0 0 15px rgba(${rgbString}, 0.5) !important; ${isRainbow ? 'background: var(--rainbow-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;' : ''} }
            .doc-title { color: ${hexColor} !important; }
            .doc-title:focus { background: rgba(${rgbString}, 0.1) !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.3) !important; }
            
            /* Ribbon & Tabs */
            .ribbon-tabs { border-bottom: 1px solid ${hexColor}40 !important; }
            .ribbon-tab.active { color: ${hexColor} !important; border-bottom: 2px solid ${hexColor} !important; background: linear-gradient(180deg, rgba(${rgbString}, 0.1) 0%, transparent 100%) !important; }
            .ribbon-tab:hover { color: ${lightColor} !important; background: rgba(${rgbString}, 0.05) !important; }
            .ribbon-content { border-bottom: 1px solid ${hexColor}20 !important; box-shadow: 0 4px 12px rgba(${rgbString}, 0.1) !important; }
            .ribbon-section { border-right-color: ${hexColor}40 !important; }
            .ribbon-section-title { color: ${lightColor} !important; border-bottom-color: ${hexColor}40 !important; }
            
            /* Toolbar Buttons */
            .toolbar-btn:hover { color: ${hexColor} !important; background: rgba(${rgbString}, 0.15) !important; box-shadow: 0 0 10px rgba(${rgbString}, 0.2) !important; }
            .toolbar-btn.active { background: ${isRainbow ? 'var(--rainbow-gradient)' : `linear-gradient(135deg, ${hexColor} 0%, ${lightColor} 100%)`} !important; color: white !important; box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important; }
            
            /* Editor Container & Background */
            .editor-container { border-color: ${borderColor} !important; box-shadow: 0 0 40px rgba(${rgbString}, 0.15) !important; }
            .editor-container::before { background: linear-gradient(90deg, transparent 0%, rgba(${rgbString}, 0.6) 50%, transparent 100%) !important; }
            .editor-container::after { background: ${isRainbow ? 'linear-gradient(90deg, transparent 0%, #ff0000 20%, #00ff00 50%, #0000ff 80%, transparent 100%)' : `radial-gradient(ellipse at center, rgba(${rgbString}, 0.3) 0%, rgba(${rgbString}, 0.1) 40%, transparent 70%)`} !important; opacity: 0.6; }
            .editor-container:hover { border-color: ${lightColor} !important; box-shadow: 0 0 60px rgba(${rgbString}, 0.3) !important; }
            body.light-theme .editor-container::after { background: linear-gradient(90deg, transparent 0%, ${hexColor} 20%, ${hexColor} 80%, transparent 100%) !important; }
            
            /* Page Navigator & Status Bar */
            .page-navigator { border-bottom-color: ${hexColor}40 !important; }
            .page-tab.active { background: ${isRainbow ? 'var(--rainbow-gradient)' : hexColor} !important; border-color: ${hexColor} !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.4) !important; color: white !important; }
            .page-tab:hover:not(.active) { color: ${lightColor} !important; border-color: ${hexColor}60 !important; }
            .new-page-btn { background: ${isRainbow ? 'var(--rainbow-gradient)' : hexColor} !important; color: white !important; }
            .new-page-btn:hover { box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important; opacity: 0.9; }
            
            .status-bar { border-top: 1px solid ${hexColor}40 !important; }
            
            /* Buttons */
            #saveBtn { background: ${isRainbow ? 'var(--rainbow-gradient)' : hexColor} !important; box-shadow: 0 0 10px rgba(${rgbString}, 0.3) !important; color: white !important; }
            #saveBtn:hover { box-shadow: 0 0 20px rgba(${rgbString}, 0.5) !important; opacity: 0.9; }
            
            /* Dropdowns & Inputs */
            select, .ql-picker, .ql-align { border: 1px solid ${hexColor}60 !important; color: ${lighterColor} !important; }
            select:hover, .ql-picker:hover, .ql-align:hover { border-color: ${lightColor} !important; box-shadow: 0 0 15px rgba(${rgbString}, 0.3) !important; }
            select:focus, .ql-picker:focus, .ql-align:focus { border-color: ${hexColor} !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.5) !important; }
            
            /* Quill specific overrides */
            .ql-picker-label { color: ${lighterColor} !important; }
            .ql-picker-label:hover { color: ${lightColor} !important; }
            .ql-picker-options { border-color: ${hexColor} !important; box-shadow: 0 4px 15px rgba(${rgbString}, 0.3) !important; }
            .ql-picker-item:hover { color: ${lightColor} !important; background-color: rgba(${rgbString}, 0.1) !important; }
            .ql-picker-item.ql-selected { color: ${hexColor} !important; font-weight: bold; }
            
            /* Library / File Management Overrides */
            #docLibrary h1 { color: ${lightColor} !important; text-shadow: 0 0 20px rgba(${rgbString}, 0.5) !important; }
            #createNewDoc { border-color: ${borderColor} !important; }
            #createNewDoc:hover { box-shadow: 0 0 50px rgba(${rgbString}, 0.4) !important; background: rgba(${rgbString}, 0.05) !important; }
            #createNewDoc > div { border-color: ${borderColor} !important; color: ${lightColor} !important; }
            
            #docSearch { border-color: ${hexColor}60 !important; }
            #docSearch:focus { border-color: ${borderColor} !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.4) !important; }
            
            #docLibrary div[style*="border: 1px solid #1a1a1a"] { border-color: ${hexColor}40 !important; box-shadow: 0 0 30px rgba(${rgbString}, 0.1) !important; }
            
            #docLibrary th { color: ${lightColor} !important; border-bottom-color: ${hexColor}40 !important; }
            
            .doc-item { border-bottom-color: ${hexColor}20 !important; }
            .doc-item:hover { background: rgba(${rgbString}, 0.1) !important; border-bottom-color: ${hexColor}60 !important; }
            .doc-item.active { background: rgba(${rgbString}, 0.15) !important; }

            .delete-doc-btn:hover { background: rgba(${rgbString}, 0.2) !important; color: ${lightColor} !important; }

            /* Modals */
            #profileModal > div, #historyModal > div, #shareModal > div { border-color: ${borderColor} !important; box-shadow: 0 0 50px rgba(${rgbString}, 0.4) !important; }
            .profile-tab.active { background: ${isRainbow ? 'var(--rainbow-gradient)' : `linear-gradient(135deg, ${hexColor}, ${lightColor})`} !important; box-shadow: 0 4px 15px rgba(${rgbString}, 0.4) !important; }
            
            /* Scrollbars */
            ::-webkit-scrollbar-thumb { background: ${hexColor}60 !important; border: 1px solid ${hexColor}20 !important; }
            ::-webkit-scrollbar-thumb:hover { background: ${hexColor} !important; }
            
            /* Color Picker Buttons */
            .accent-color-btn[data-color="${color}"] { border: 2px solid #ffffff !important; transform: scale(1.1); box-shadow: 0 0 20px rgba(${rgbString}, 0.6) !important; }
        `;

    this.updateThemeButtons();
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  lightenColor(hex, percent) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
    const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
    const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}
