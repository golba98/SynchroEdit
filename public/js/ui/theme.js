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
        
        const rgb = this.hexToRgb(color);
        if (!rgb) return;
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        
        const lightColor = this.lightenColor(color, 20);
        const lighterColor = this.lightenColor(color, 40);
        
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-color-rgb', rgbString);
        document.documentElement.style.setProperty('--accent-color-light', lightColor);
        document.documentElement.style.setProperty('--accent-color-lighter', lighterColor);

        let styleEl = document.getElementById('accentColorStyle');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'accentColorStyle';
            document.head.appendChild(styleEl);
        }
        
        // Comprehensive style override to ensure everything gets adjusted
        styleEl.innerHTML = `
            body { background: linear-gradient(135deg, #0a0a0a 0%, ${color}22 15%, #0d0d0d 30%, ${color}15 50%, #0d0d0d 70%, #0a0a0f 100%) !important; }
            body.light-theme { background: linear-gradient(135deg, #f5f5f5 0%, ${color}11 15%, #f8f8f8 30%, ${color}08 50%, #f8f8f8 70%, #f5f5f5 100%) !important; }
            
            .header { border-bottom: 1px solid ${color} !important; box-shadow: 0 4px 12px rgba(${rgbString}, 0.25) !important; }
            .logo { color: ${color} !important; text-shadow: 0 0 15px rgba(${rgbString}, 0.5) !important; }
            .doc-title { color: ${color} !important; }
            .ribbon-tab.active { color: ${color} !important; border-bottom: 2px solid ${color} !important; }
            .editor-container { border-color: ${color} !important; box-shadow: 0 0 20px rgba(${rgbString}, 0.2) !important; }
            
            #saveBtn { background: ${color} !important; box-shadow: 0 0 10px rgba(${rgbString}, 0.3) !important; }
            #saveBtn:hover { background: ${lightColor} !important; box-shadow: 0 0 15px rgba(${rgbString}, 0.5) !important; }
            
            .accent-color-btn[data-color="${color}"] { border: 2px solid #ffffff !important; transform: scale(1.1); }
            
            #docLibrary h1 { color: ${lightColor} !important; text-shadow: 0 0 20px rgba(${rgbString}, 0.5) !important; }
            #createNewDoc { border-color: ${color} !important; }
            #createNewDoc:hover { box-shadow: 0 0 40px rgba(${rgbString}, 0.5) !important; }
            #createNewDoc > div { border-color: ${color} !important; color: ${lightColor} !important; }
            
            .doc-item:hover { background: rgba(${rgbString}, 0.1) !important; }
            .doc-item.active { background: rgba(${rgbString}, 0.15) !important; }
            
            #profileModal > div, #historyModal > div, #shareModal > div { border-color: ${color} !important; box-shadow: 0 0 40px rgba(${rgbString}, 0.4) !important; }
            .profile-tab.active { background: linear-gradient(135deg, ${color}, ${lightColor}) !important; box-shadow: 0 4px 15px rgba(${rgbString}, 0.4) !important; }
            
            .ribbon-section-title { color: ${lightColor} !important; }
            
            input:focus, select:focus { border-color: ${color} !important; box-shadow: 0 0 10px rgba(${rgbString}, 0.3) !important; }
            
            ::-webkit-scrollbar-thumb { background: ${color}88 !important; }
            ::-webkit-scrollbar-thumb:hover { background: ${color} !important; }
        `;
        
        this.updateThemeButtons();
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    lightenColor(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
        const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
        const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
}
