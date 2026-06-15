document.addEventListener('DOMContentLoaded', () => {
  
  // --- 1. Navbar Scroll Effect ---
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // --- 2. GSAP Scroll Animations ---
  gsap.registerPlugin(ScrollTrigger);

  // Animate text reveal in Features section
  gsap.from(".reveal-text", {
    scrollTrigger: {
      trigger: "#explore",
      start: "top 80%",
    },
    y: 50,
    opacity: 0,
    duration: 1,
    ease: "power3.out"
  });

  // Animate cards staggered reveal
  gsap.from(".reveal-card", {
    scrollTrigger: {
      trigger: "#explore",
      start: "top 60%",
    },
    y: 100,
    opacity: 0,
    rotationX: -15, // 3D flip effect on scroll
    duration: 1.2,
    stagger: 0.2,
    ease: "power4.out"
  });

  // --- 3. 3D Parallax Tilt Effect (Vanilla JS) ---
  const tiltElements = document.querySelectorAll('.tilt-card, #hero-content');

  tiltElements.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position within the element.
      const y = e.clientY - rect.top;  // y position within the element.
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate rotation based on cursor position (max 10 degrees)
      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;

      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    el.addEventListener('mouseleave', () => {
      // Smooth reset
      el.style.transition = 'transform 0.5s ease-out';
      el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      
      // Remove transition so mousemove is instantaneous again
      setTimeout(() => { el.style.transition = ''; }, 500);
    });
  });

  // --- 4. Massive Interactive 3D Canvas Matrix ---
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  
  // Mouse tracking for the canvas
  let mouse = { x: -1000, y: -1000 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.z = Math.random() * 200 + 50; // Pseudo 3D depth
      this.baseX = this.x;
      this.baseY = this.y;
      
      // Speed based on Z depth (parallax)
      this.speed = 100 / this.z;
      this.angle = Math.random() * Math.PI * 2;
    }

    update() {
      // Auto movement
      this.angle += 0.01;
      this.x = this.baseX + Math.cos(this.angle) * 20;
      this.y = this.baseY + Math.sin(this.angle) * 20;

      // Mouse interactivity (particles run away from mouse in 3D space)
      let dx = mouse.x - this.x;
      let dy = mouse.y - this.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 200) {
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;
        let force = (200 - distance) / 200;
        
        this.x -= forceDirectionX * force * 50 * this.speed;
        this.y -= forceDirectionY * force * 50 * this.speed;
      }
    }

    draw() {
      // Size and opacity scale with Z depth
      const scale = 100 / this.z;
      const alpha = 1 - (this.z / 250);
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, scale * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.8})`; // Blue accent
      ctx.fill();
    }
  }

  function initParticles() {
    particles = [];
    const particleCount = window.innerWidth < 768 ? 50 : 150;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function animateCanvas() {
    // Semi-transparent black for trail effect
    ctx.fillStyle = 'rgba(3, 3, 5, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // Update and draw particles
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    // Draw connecting lines (The "Neural Matrix" effect)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i; j < particles.length; j++) {
        let dx = particles[i].x - particles[j].x;
        let dy = particles[i].y - particles[j].y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 - distance / 800})`;
          ctx.lineWidth = 1;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animateCanvas);
  }

  initParticles();
  animateCanvas();
});
