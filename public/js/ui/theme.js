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
    this.showThemeToast(theme === 'light' ? 'Applying Light Mode...' : 'Applying Dark Mode...');
    this.currentTheme = theme;
    localStorage.setItem('synchroEditTheme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
      // Ensure background-specific overrides are cleared
      document.body.classList.remove('bg-code-mode');
    }
    this.updateThemeButtons();
  }

  showThemeToast(text) {
    const toast = document.getElementById('themeToast');
    const toastText = document.getElementById('themeToastText');
    if (!toast || !toastText) return;

    toastText.textContent = text;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.bottom = '40px';
    }, 10);

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.bottom = '30px';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }, 1500);
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
    // Fallback if legacy rainbow value exists in local storage
    if (color === 'rainbow') color = '#39ff14';

    this.showThemeToast('Applying Accent Color...');
    this.currentAccentColor = color;
    localStorage.setItem('synchroEditAccentColor', color);

    let rgbString, lightColor, lighterColor, hexColor;

    document.body.classList.remove('theme-rainbow');
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    hexColor = color;
    lightColor = this.lightenColor(color, 20);
    lighterColor = this.lightenColor(color, 40);

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
    styleEl.innerHTML = `
            body { background: rgba(10, 10, 10, 0.8) !important; transition: background 0.45s ease-in-out !important; }
            body.light-theme { background: rgba(233, 236, 239, 0.8) !important; }
            body.glow-enabled { background: linear-gradient(135deg, rgba(10, 10, 10, 0.8) 0%, ${hexColor}22 15%, rgba(13, 13, 13, 0.7) 30%, ${hexColor}15 50%, rgba(13, 13, 13, 0.7) 70%, rgba(10, 10, 15, 0.8) 100%) !important; }
            body.light-theme.glow-enabled { background: radial-gradient(circle at 50% 30%, ${hexColor}08 0%, rgba(233, 236, 239, 0.8) 70%) !important; }
            
            /* Selection Highlight */
            ::selection { background-color: rgba(${rgbString}, 0.4) !important; color: inherit !important; }
            ::-moz-selection { background-color: rgba(${rgbString}, 0.4) !important; color: inherit !important; }
            body.light-theme ::selection { background-color: rgba(${rgbString}, 0.3) !important; }
            body.light-theme ::-moz-selection { background-color: rgba(${rgbString}, 0.3) !important; }

            /* Header & Logo */
            .header { border-bottom: 1px solid ${hexColor} !important; box-shadow: 0 4px 12px rgba(${rgbString}, 0.25) !important; }
            body.light-theme .header { border-bottom: 1px solid #ced4da !important; background: rgba(255, 255, 255, 0.95) !important; backdrop-filter: blur(20px) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important; }
            
            .logo { color: ${hexColor} !important; text-shadow: 0 0 15px rgba(${rgbString}, 0.5) !important; }
            body.light-theme .logo { color: #1a1a1a !important; text-shadow: none !important; font-weight: 800 !important; }

            .doc-title { color: ${hexColor} !important; }
            body.light-theme .doc-title { color: #1a1a1a !important; font-weight: 600 !important; }
            .doc-title:focus { background: rgba(${rgbString}, 0.1) !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.3) !important; }
            
            /* Ribbon & Tabs */
            .ribbon-tabs { border-bottom: 1px solid ${hexColor}40 !important; }
            body.light-theme .ribbon-tabs { border-bottom: 1px solid #ced4da !important; background: #f8f9fa !important; }

            .ribbon-tab.active { color: ${hexColor} !important; border-bottom: 2px solid ${hexColor} !important; background: linear-gradient(180deg, rgba(${rgbString}, 0.1) 0%, transparent 100%) !important; }
            body.light-theme .ribbon-tab.active { background: #ffffff !important; color: ${hexColor} !important; border-bottom-color: ${hexColor} !important; box-shadow: inset 0 2px 0 ${hexColor} !important; }

            .ribbon-tab:hover { color: ${lightColor} !important; background: rgba(${rgbString}, 0.05) !important; }
            .ribbon-content { border-bottom: 1px solid ${hexColor}20 !important; box-shadow: 0 4px 12px rgba(${rgbString}, 0.1) !important; }
            body.light-theme .ribbon-content { border-bottom: 1px solid #ced4da !important; background: #ffffff !important; box-shadow: 0 2px 4px rgba(0,0,0,0.02) !important; }

            .ribbon-section { border-right-color: ${hexColor} !important; }
            body.light-theme .ribbon-section { border-right-color: #dee2e6 !important; }

            .ribbon-section-title { color: ${lightColor} !important; border-bottom-color: ${hexColor} !important; }
            body.light-theme .ribbon-section-title { color: #6c757d !important; border-bottom-color: #e9ecef !important; }
            
            /* Toolbar Buttons */
            .toolbar-btn:hover { color: ${hexColor} !important; background: rgba(${rgbString}, 0.15) !important; box-shadow: 0 0 10px rgba(${rgbString}, 0.2) !important; }
            body.light-theme .toolbar-btn:hover { background: #f1f3f5 !important; border-color: #ced4da !important; color: #1a1a1a !important; }
            
            .toolbar-btn.active { background: linear-gradient(135deg, ${hexColor} 0%, ${lightColor} 100%) !important; color: white !important; box-shadow: 0 0 15px rgba(${rgbString}, 0.4) !important; }
            
            /* Editor Container & Background */
            .main-workspace { background: linear-gradient(135deg, #050505 0%, #111111 50%, #050505 100%) !important; }
            body.light-theme .main-workspace { background: #e9ecef !important; }
            .pages-container { background: transparent !important; }

            .page-scaler { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important; }
            body.light-theme .page-scaler { 
                background: #ffffff !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04) !important;
            }

            /* Page Glow Overrides (Only if classes are present) */
            .editor-container { background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important; transition: outline-color 0.3s ease, box-shadow 0.3s ease !important; }
            body.light-theme .editor-container { 
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }

            .editor-container:hover { outline: none !important; box-shadow: none !important; }
            body.light-theme .editor-container:hover { border-color: #adb5bd !important; box-shadow: 0 15px 45px rgba(0, 0, 0, 0.1) !important; }
            
            .editor-container.border-enabled .page-scaler { outline: 2px solid ${hexColor} !important; }
            .editor-container.border-enabled:hover .page-scaler { outline-color: ${lightColor} !important; }
            
            .editor-container.glow-effect .page-scaler { box-shadow: 0 0 40px rgba(${rgbString}, 0.15) !important; }
            body.light-theme .editor-container.glow-effect .page-scaler { box-shadow: 0 0 40px rgba(${rgbString}, 0.08), 0 10px 30px rgba(0,0,0,0.08) !important; }

            .editor-container.glow-effect .page-scaler::after { background: radial-gradient(ellipse at center, rgba(${rgbString}, 0.3) 0%, rgba(${rgbString}, 0.1) 40%, transparent 70%) !important; opacity: 0.6; }
            
            body.light-theme .editor-container.glow-effect .page-scaler::after { background: linear-gradient(90deg, transparent 0%, ${hexColor} 20%, ${hexColor} 80%, transparent 100%) !important; }
            
            /* Page Navigator & Status Bar */
            .page-navigator { border-bottom-color: ${hexColor}40 !important; }
            body.light-theme .page-navigator { border-bottom-color: #ced4da !important; background: #f8f9fa !important; }

            .page-tab.active { background: ${hexColor} !important; border-color: ${hexColor} !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.4) !important; color: white !important; }
            
            .status-bar { border-top: 1px solid ${hexColor}40 !important; }
            body.light-theme .status-bar { border-top: 1px solid #d1d5db !important; background: #ffffff !important; box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05) !important; }
            
            /* Dropdowns & Inputs */
            select, .ql-picker, .ql-align { border: 1px solid ${hexColor}60 !important; color: ${lighterColor} !important; }
            body.light-theme select, body.light-theme .ql-picker, body.light-theme .ql-align { border: 1px solid #ced4da !important; color: #1f2937 !important; background: #fff !important; }

            /* Library / File Management Overrides */
            body.light-theme #docLibrary { background: #f8f9fa !important; transition: background 0.45s ease-in-out !important; }
            body.light-theme .doc-item { background: #ffffff !important; border: 1px solid #e9ecef !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important; transition: all 0.3s ease !important; }
            body.light-theme .doc-item:hover { border-color: ${hexColor} !important; box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important; transform: translateY(-2px) !important; }
            body.light-theme #docSearch { background: #f1f3f5 !important; border: 1px solid #ced4da !important; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05) !important; }
            body.light-theme #docSearch:focus { background: #fff !important; border-color: ${hexColor} !important; box-shadow: 0 0 0 2px rgba(${rgbString}, 0.1) !important; }
            
            body.light-theme .doc-title-text { color: #1a1a1a !important; font-weight: 600 !important; }
            body.light-theme .doc-meta-text { color: #6c757d !important; }
            body.light-theme .doc-icon-container i { color: #dee2e6 !important; }
            body.light-theme .doc-item:hover .doc-icon-container i { color: ${hexColor} !important; }

            body.light-theme #createNewDoc { background: #ffffff !important; border: 1px solid #dee2e6 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important; }
            body.light-theme #createNewDoc:hover { border-color: ${hexColor} !important; box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important; }
            body.light-theme #createNewDoc > div { background: #f8f9fa !important; color: ${hexColor} !important; }

            /* Modals */
            #profileModal > div, #historyModal > div, #shareModal > div { 
                background: linear-gradient(135deg, #050505 0%, #111111 50%, #0d0d0d 100%) !important;
                border-color: ${hexColor}40 !important; 
                box-shadow: 0 0 50px rgba(0, 0, 0, 0.6) !important; 
            }
            body.light-theme #profileModal > div, body.light-theme #historyModal > div, body.light-theme #shareModal > div {
                background: #ffffff !important;
                border: 1px solid #ced4da !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.15) !important;
            }

            .profile-tab { border-bottom: 2px solid transparent !important; }
            .profile-tab.active { 
                background: transparent !important; 
                border-bottom: 2px solid ${hexColor} !important; 
                color: ${hexColor} !important;
                box-shadow: none !important;
            }
            
            /* Scrollbars */
            ::-webkit-scrollbar-thumb { background: ${hexColor}60 !important; border: 1px solid ${hexColor}20 !important; }
            body.light-theme ::-webkit-scrollbar-thumb { background: #ced4da !important; border: 4px solid #f8f9fa !important; }
            ::-webkit-scrollbar-thumb:hover { background: ${hexColor} !important; }

            /* Theme Toast Light Mode */
            body.light-theme #themeToast { background: rgba(255, 255, 255, 0.95) !important; border-color: #ced4da !important; box-shadow: 0 10px 30px rgba(0,0,0,0.1), 0 0 20px rgba(${rgbString}, 0.1) !important; }
            body.light-theme #themeToastText { color: #1a1a1a !important; }
            
            /* Color Picker Buttons */
            .accent-color-btn[data-color="${color}"] { border: 2px solid #ffffff !important; transform: scale(1.1); box-shadow: 0 0 20px rgba(${rgbString}, 0.6) !important; }
            body.light-theme .accent-color-btn[data-color="${color}"] { border: 2px solid #1a1a1a !important; box-shadow: 0 0 15px rgba(0,0,0,0.1) !important; }
        `;

    this.updateThemeButtons();
    window.dispatchEvent(new CustomEvent('theme-update'));
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
