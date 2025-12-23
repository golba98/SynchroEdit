export class DynamicBackground {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: null, y: null, radius: 150 };
    this.resizeTimeout = null;
    this.animationFrameId = null;
    
    // Configuration
    this.config = {
        particleCount: 60, // Number of particles
        connectionDistance: 120, // Max distance to draw line
        mouseDistance: 180, // Interaction radius
        baseSpeed: 0.3,
        sizeRange: [1, 2.5],
        color: 'rgba(139, 92, 246, 0.4)', // Default accent color (purple)
        lineColor: 'rgba(139, 92, 246, 0.15)'
    };

    this.init();
  }

  init() {
    // Setup Canvas
    this.canvas.id = 'dynamic-background';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '-2'; // Behind everything (pages-container is -1 usually, let's check)
    this.canvas.style.pointerEvents = 'none';
    
    // Insert into body
    document.body.prepend(this.canvas);
    
    // Listeners
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('mousemove', (e) => {
        this.mouse.x = e.x;
        this.mouse.y = e.y;
    });
    window.addEventListener('mouseout', () => {
        this.mouse.x = undefined;
        this.mouse.y = undefined;
    });

    this.resize();
    this.createParticles();
    this.animate();
    
    // Theme listener (optional integration)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                this.updateThemeColors();
            }
        });
    });
    observer.observe(document.body, { attributes: true });
    this.updateThemeColors();
  }

  updateThemeColors() {
      const isLight = document.body.classList.contains('light-theme');
      // We can grab CSS variables if we want to be precise
      const styles = getComputedStyle(document.body);
      const accent = styles.getPropertyValue('--accent-color').trim() || '#8b5cf6';
      
      // Parse hex to rgb for opacity handling if needed, or just use css var
      // Canvas needs explicit colors usually for performance in loop
      this.config.color = isLight ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.4)';
      this.config.lineColor = isLight ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)';
  }

  handleResize() {
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
          this.resize();
          this.createParticles();
      }, 100);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticles() {
    this.particles = [];
    const count = (this.canvas.width * this.canvas.height) / 15000; // Density based
    const particleCount = Math.min(Math.max(count, 40), 120); // Clamp count
    
    for (let i = 0; i < particleCount; i++) {
      const size = Math.random() * (this.config.sizeRange[1] - this.config.sizeRange[0]) + this.config.sizeRange[0];
      const x = Math.random() * ((this.canvas.width - size * 2) - (size * 2)) + size * 2;
      const y = Math.random() * ((this.canvas.height - size * 2) - (size * 2)) + size * 2;
      const directionX = (Math.random() * 2) - 1; // -1 to 1
      const directionY = (Math.random() * 2) - 1; 
      
      this.particles.push({
          x, y, 
          directionX: directionX * this.config.baseSpeed, 
          directionY: directionY * this.config.baseSpeed, 
          size
      });
    }
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (let i = 0; i < this.particles.length; i++) {
        let p = this.particles[i];
        
        // Movement
        p.x += p.directionX;
        p.y += p.directionY;
        
        // Bounce
        if (p.x > this.canvas.width || p.x < 0) p.directionX = -p.directionX;
        if (p.y > this.canvas.height || p.y < 0) p.directionY = -p.directionY;
        
        // Interaction with mouse
        // (Optional: push away or attract)
        
        // Draw Particle
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = this.config.color;
        this.ctx.fill();
        
        // Connections
        for (let j = i; j < this.particles.length; j++) {
            let p2 = this.particles[j];
            let distance = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
            
            if (distance < this.config.connectionDistance) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = this.config.lineColor;
                this.ctx.lineWidth = 1; // max width
                // Fade out based on distance
                const opacity = 1 - (distance / this.config.connectionDistance);
                this.ctx.globalAlpha = opacity;
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
            }
        }
        
        // Connect to mouse
        if (this.mouse.x != null) {
            let distance = Math.sqrt((p.x - this.mouse.x) ** 2 + (p.y - this.mouse.y) ** 2);
             if (distance < this.config.mouseDistance) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = this.config.lineColor;
                const opacity = 1 - (distance / this.config.mouseDistance);
                this.ctx.globalAlpha = opacity;
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(this.mouse.x, this.mouse.y);
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
             }
        }
    }
  }
}
