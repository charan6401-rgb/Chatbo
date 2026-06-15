/**
 * Sri Charan · AI Chatbot — script.js
 * Three.js 3D scene · Chat interface · Animations
 */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. THREE.JS — 3D LANDING SCENE
   ══════════════════════════════════════════════════════════ */
const ThreeScene = (() => {
  let scene, camera, renderer, clock;
  let coreSphere, coreGlow;
  let rings = [];
  let particles, particlePositions;
  let mouseX = 0, mouseY = 0;
  let targetMouseX = 0, targetMouseY = 0;
  let animId = null;
  let isInit = false;

  // Reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas || isInit) return;
    isInit = true;

    // Scene
    scene = new THREE.Scene();
    clock  = new THREE.Clock();

    // Camera
    camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    buildScene();
    addLights();
    bindEvents();
    animate();
  }

  function buildScene() {
    // ── Core sphere ───────────────────────────────────────
    const coreGeo = new THREE.SphereGeometry(0.7, 64, 64);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x0a0a0f,
      emissive: 0xc0192e,
      emissiveIntensity: 0.18,
      shininess: 120,
      transparent: true,
      opacity: 0.92,
    });
    coreSphere = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreSphere);

    // Wireframe overlay on core
    const wireGeo = new THREE.IcosahedronGeometry(0.72, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xc0192e,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    coreSphere.add(wireMesh);

    // ── Glow halo ─────────────────────────────────────────
    const glowGeo = new THREE.SphereGeometry(1.1, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xc0192e,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
    });
    coreGlow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(coreGlow);

    // ── Energy rings ──────────────────────────────────────
    const ringDefs = [
      { radius: 1.15, tube: 0.012, color: 0xc0192e, opacity: 0.7, axis: new THREE.Vector3(1, 0, 0), speed: 0.4 },
      { radius: 1.35, tube: 0.008, color: 0xe82038, opacity: 0.45, axis: new THREE.Vector3(0.6, 1, 0.3).normalize(), speed: -0.25 },
      { radius: 1.65, tube: 0.005, color: 0xc9a84c, opacity: 0.3, axis: new THREE.Vector3(0.2, 0.8, 1).normalize(), speed: 0.15 },
    ];

    ringDefs.forEach(def => {
      const geo = new THREE.TorusGeometry(def.radius, def.tube, 8, 80);
      const mat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: def.opacity,
      });
      const mesh = new THREE.Mesh(geo, mat);
      // Random initial rotation
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;
      rings.push({ mesh, axis: def.axis, speed: def.speed });
      scene.add(mesh);
    });

    // ── Orbiting particles ────────────────────────────────
    const PARTICLE_COUNT = prefersReducedMotion ? 300 : 900;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors    = new Float32Array(PARTICLE_COUNT * 3);
    const sizes     = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Distribute in spherical shell 2–5 units out
      const r     = 2 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Blend between red and gold
      const t = Math.random();
      colors[i * 3]     = 0.75 * (1 - t) + 0.79 * t;   // R
      colors[i * 3 + 1] = 0.10 * (1 - t) + 0.66 * t;   // G
      colors[i * 3 + 2] = 0.18 * (1 - t) + 0.30 * t;   // B

      sizes[i] = Math.random() * 2.5 + 0.5;
    }

    particlePositions = positions;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });

    particles = new THREE.Points(geo, mat);
    scene.add(particles);
  }

  function addLights() {
    const ambient = new THREE.AmbientLight(0x0a0a0f, 0.6);
    scene.add(ambient);

    const redLight = new THREE.PointLight(0xc0192e, 3, 8);
    redLight.position.set(2, 1, 2);
    scene.add(redLight);

    const goldLight = new THREE.PointLight(0xc9a84c, 1.5, 6);
    goldLight.position.set(-2, -1, 1);
    scene.add(goldLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 3, -2);
    scene.add(rimLight);
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    const t  = clock.getElapsedTime();
    const dt = clock.getDelta ? 0.016 : 0.016;

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
      return;
    }

    // Smooth mouse tracking
    targetMouseX += (mouseX - targetMouseX) * 0.04;
    targetMouseY += (mouseY - targetMouseY) * 0.04;

    // Camera sway
    camera.position.x = targetMouseX * 0.6;
    camera.position.y = -targetMouseY * 0.4;
    camera.lookAt(0, 0, 0);

    // Core sphere rotation + breathe
    coreSphere.rotation.y = t * 0.12;
    coreSphere.rotation.x = Math.sin(t * 0.3) * 0.15;
    const breathe = 1 + Math.sin(t * 0.8) * 0.03;
    coreSphere.scale.setScalar(breathe);
    coreGlow.scale.setScalar(breathe * 1.05);

    // Ring rotation
    rings.forEach(r => {
      r.mesh.rotateOnAxis(r.axis, r.speed * 0.016);
    });

    // Particles slow drift
    particles.rotation.y = t * 0.02;
    particles.rotation.x = Math.sin(t * 0.1) * 0.05;

    renderer.render(scene, camera);
  }

  function bindEvents() {
    window.addEventListener('mousemove', e => {
      mouseX =  (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    window.addEventListener('resize', () => {
      const canvas = renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, { passive: true });

    // Touch support
    window.addEventListener('touchmove', e => {
      const t = e.touches[0];
      mouseX =  (t.clientX / window.innerWidth  - 0.5) * 2;
      mouseY = -(t.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  function start() {
    if (!animId && isInit) animate();
  }

  return { init, stop, start };
})();

/* ══════════════════════════════════════════════════════════
   2. SCROLL ANIMATIONS
   ══════════════════════════════════════════════════════════ */
const ScrollReveal = (() => {
  let observer;

  function init() {
    const targets = document.querySelectorAll(
      '.project-card, .section-header, .about-quote, .about-cta'
    );
    targets.forEach(el => el.classList.add('reveal'));

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => observer.observe(el));
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════
   3. CARD TILT EFFECT
   ══════════════════════════════════════════════════════════ */
const CardTilt = (() => {
  const MAX_TILT = 8;

  function apply(card) {
    card.addEventListener('mousemove', e => {
      const rect  = card.getBoundingClientRect();
      const cx    = rect.left + rect.width  / 2;
      const cy    = rect.top  + rect.height / 2;
      const dx    = (e.clientX - cx) / (rect.width  / 2);
      const dy    = (e.clientY - cy) / (rect.height / 2);
      const rotX  = -dy * MAX_TILT;
      const rotY  =  dx * MAX_TILT;
      card.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
      setTimeout(() => { card.style.transition = ''; }, 550);
    });
  }

  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach(apply);
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════
   4. CHAT INTERFACE
   ══════════════════════════════════════════════════════════ */
const Chat = (() => {

  // ── Config ─────────────────────────────────────────────
  const BACKEND_URL = '/chat';
  const WELCOME_MSG = `Hey! 👋 I'm Sri Charan's AI assistant.\n\nAsk me anything — his projects, skills, education, or how to get in touch. I know it all.`;

  // ── State ──────────────────────────────────────────────
  let history    = [];   // [{role, content}]
  let streaming  = false;
  let sidebarOpen = window.innerWidth > 768;

  // ── DOM refs ───────────────────────────────────────────
  const overlay      = document.getElementById('chatOverlay');
  const messagesEl   = document.getElementById('chatMessages');
  const inputEl      = document.getElementById('chatInput');
  const sendBtn      = document.getElementById('sendBtn');
  const typingWrap   = document.getElementById('typingWrap');
  const clearBtn     = document.getElementById('clearChatBtn');
  const closeBtn     = document.getElementById('closeChat');
  const sidebar      = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const chatBackdrop = document.getElementById('chatBackdrop');

  // ── Helpers ────────────────────────────────────────────
  function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Convert plain text with basic markdown (**bold**, *italic*, `code`, newlines) */
  function formatText(text) {
    return escapeHTML(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       `<code style="font-family:var(--font-mono);font-size:12px;background:var(--surface-2);padding:1px 6px;border-radius:4px;">$1</code>`)
      .replace(/\n/g,            '<br>');
  }

  function scrollBottom(smooth = true) {
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }

  // ── Message rendering ──────────────────────────────────
  function appendWelcome() {
    messagesEl.innerHTML = '';
    const state = document.createElement('div');
    state.className = 'welcome-state';
    state.innerHTML = `
      <div class="welcome-icon" aria-hidden="true">SC</div>
      <div class="welcome-title">Sri Charan's AI</div>
      <p class="welcome-sub">${escapeHTML(WELCOME_MSG).replace(/\n/g, '<br>')}</p>
    `;
    messagesEl.appendChild(state);
  }

  /**
   * Appends a message row and returns the bubble element
   * @param {'user'|'ai'} role
   * @param {string} [text]
   * @returns {{ row: Element, bubble: Element }}
   */
  function appendMessage(role, text = '') {
    // Remove welcome state on first real message
    const welcome = messagesEl.querySelector('.welcome-state');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `message-row message-row--${role}`;
    row.setAttribute('aria-label', role === 'user' ? 'Your message' : 'AI response');

    const avatarLabel = role === 'ai' ? 'SC' : 'U';
    const avatarClass = role === 'ai' ? 'msg-avatar--ai' : 'msg-avatar--user';
    const bubbleClass = role === 'ai' ? 'msg-bubble--ai' : 'msg-bubble--user';

    row.innerHTML = `
      <div class="msg-avatar ${avatarClass}" aria-hidden="true">${avatarLabel}</div>
      <div class="msg-content">
        <div class="msg-bubble ${bubbleClass}">${text ? formatText(text) : ''}</div>
        <div class="msg-meta">
          <span class="msg-time">${getTime()}</span>
          ${role === 'ai' ? `<button class="copy-btn" aria-label="Copy message">Copy</button>` : ''}
        </div>
      </div>
    `;

    const bubble = row.querySelector('.msg-bubble');
    const copyBtn = row.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(bubble.innerText).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1800);
        });
      });
    }

    messagesEl.appendChild(row);
    scrollBottom();
    return { row, bubble };
  }

  // ── Typing indicator ───────────────────────────────────
  function showTyping(show) {
    typingWrap.classList.toggle('visible', show);
    typingWrap.setAttribute('aria-hidden', String(!show));
    if (show) scrollBottom();
  }

  // ── Textarea auto-resize ───────────────────────────────
  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  }

  // ── Send flow ──────────────────────────────────────────
  async function send(text) {
    text = text.trim();
    if (!text || streaming) return;

    streaming = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    autoResize();

    // User bubble
    appendMessage('user', text);
    history.push({ role: 'user', content: text });

    showTyping(true);

    // AI bubble (will stream into)
    let aiBubble = null;
    let fullText  = '';

    try {
      const res = await fetch(BACKEND_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      showTyping(false);
      const { bubble } = appendMessage('ai');
      aiBubble = bubble;

      // Add streaming cursor
      const cursor = document.createElement('span');
      cursor.className = 'cursor-blink';
      cursor.setAttribute('aria-hidden', 'true');
      aiBubble.appendChild(cursor);

      // Stream read
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        // Update bubble text (before cursor)
        aiBubble.innerHTML = formatText(fullText);
        aiBubble.appendChild(cursor);
        scrollBottom(false);
      }

      // Remove cursor when done
      cursor.remove();
      aiBubble.innerHTML = formatText(fullText);
      history.push({ role: 'assistant', content: fullText });

    } catch (err) {
      showTyping(false);
      const errText = '⚠️ Could not reach the server. Please check your connection and try again.';
      if (aiBubble) {
        aiBubble.textContent = errText;
        aiBubble.style.color = 'var(--red-bright)';
      } else {
        const { bubble } = appendMessage('ai');
        bubble.textContent = errText;
        bubble.style.color = 'var(--red-bright)';
      }
      console.error('[Chat] Send error:', err);
    } finally {
      streaming = false;
      sendBtn.disabled = false;
      inputEl.focus();
      scrollBottom();
    }
  }

  // ── Sidebar ────────────────────────────────────────────
  function setSidebar(open) {
    sidebarOpen = open;
    sidebar.classList.toggle('open', open);
    sidebarToggle.setAttribute('aria-expanded', String(open));
  }

  // ── Overlay open/close ─────────────────────────────────
  function openChat() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    ThreeScene.stop();
    // Focus first focusable element
    setTimeout(() => inputEl.focus(), 350);
    // Show sidebar only on wide screens initially
    setSidebar(window.innerWidth > 768);
  }

  function closeChat() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    ThreeScene.start();
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    // Welcome state
    appendWelcome();

    // Open triggers
    document.getElementById('openChatBtn').addEventListener('click',  openChat);
    document.getElementById('openChatBtn2').addEventListener('click', openChat);

    // Close triggers
    closeBtn.addEventListener('click', closeChat);
    chatBackdrop.addEventListener('click', closeChat);

    // Keyboard close
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeChat();
    });

    // Clear chat
    clearBtn.addEventListener('click', () => {
      history = [];
      appendWelcome();
    });

    // Sidebar
    sidebarToggle.addEventListener('click', () => setSidebar(!sidebarOpen));
    sidebarClose.addEventListener('click',  () => setSidebar(false));

    // Sidebar chips → send prompt
    document.querySelectorAll('.sidebar-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          // Close sidebar on mobile after selection
          if (window.innerWidth <= 768) setSidebar(false);
          send(prompt);
        }
      });
    });

    // New chat
    document.querySelector('[data-action="newchat"]').addEventListener('click', () => {
      history = [];
      appendWelcome();
    });

    // Input
    inputEl.addEventListener('input', () => {
      autoResize();
      sendBtn.disabled = inputEl.value.trim() === '' || streaming;
    });

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) send(inputEl.value);
      }
    });

    sendBtn.addEventListener('click', () => {
      if (!sendBtn.disabled) send(inputEl.value);
    });

    // Responsive sidebar handling
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && overlay.classList.contains('open')) {
        setSidebar(true);
      }
    }, { passive: true });
  }

  return { init, open: openChat, close: closeChat };
})();

/* ══════════════════════════════════════════════════════════
   5. MAGNETIC BUTTON EFFECT
   ══════════════════════════════════════════════════════════ */
const MagneticBtn = (() => {
  function apply(btn) {
    btn.addEventListener('mousemove', e => {
      const rect  = btn.getBoundingClientRect();
      const dx    = e.clientX - rect.left - rect.width  / 2;
      const dy    = e.clientY - rect.top  - rect.height / 2;
      btn.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  }

  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.btn--primary, .btn--ghost').forEach(apply);
  }

  return { init };
})();

/* ══════════════════════════════════════════════════════════
   6. SMOOTH ANCHOR SCROLLING
   ══════════════════════════════════════════════════════════ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════
   7. BOOT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  ThreeScene.init();
  ScrollReveal.init();
  CardTilt.init();
  MagneticBtn.init();
  Chat.init();
  initSmoothScroll();
});
