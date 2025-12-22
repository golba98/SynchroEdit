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
        
        // Simplified style override (keeping the core logic)
        styleEl.innerHTML = `
            body { background: linear-gradient(135deg, #0a0a0a 0%, ${color}22 15%, #0d0d0d 30%, ${color}15 50%, #0d0d0d 70%, #0a0a0f 100%) !important; }
            .header { border-bottom: 1px solid ${color} !important; box-shadow: 0 4px 12px rgba(${rgbString}, 0.25) !important; }
            .logo { color: ${color} !important; }
            .doc-title { color: ${color} !important; }
            .ribbon-tab.active { color: ${color} !important; border-bottom-color: ${color} !important; }
            .editor-container { border-color: ${color} !important; }
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
