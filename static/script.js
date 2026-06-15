/* ─── Config ──────────────────────────────────────────────────────────────── */
const CHAT_API   = '/chat';
const PORTFOLIO_URL = 'https://portfolio-fn9z.onrender.com';
const CONTEXT_TTL   = 3 * 60 * 60 * 1000; // 3 hours

/* ─── State ───────────────────────────────────────────────────────────────── */
let history   = [];
let streaming = false;
let ctx       = '';
let ctxTs     = 0;

/* ─── DOM ─────────────────────────────────────────────────────────────────── */
const conv      = document.getElementById('conversation');
const input     = document.getElementById('chatInput');
const sendBtn   = document.getElementById('sendBtn');
const welcome   = document.getElementById('welcome');
const prompts   = document.getElementById('prompts');

/* ─── Init ────────────────────────────────────────────────────────────────── */
warmContext();

/* ─── Event listeners ─────────────────────────────────────────────────────── */
input.addEventListener('input', autoGrow);

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

sendBtn.addEventListener('click', send);

prompts.addEventListener('click', e => {
  const chip = e.target.closest('.prompt-chip');
  if (!chip) return;
  const q = chip.dataset.q;
  if (q) {
    input.value = q;
    autoGrow();
    send();
  }
});

/* ─── Auto-grow textarea ──────────────────────────────────────────────────── */
function autoGrow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 128) + 'px';
}

/* ─── Warm portfolio context ──────────────────────────────────────────────── */
async function warmContext() {
  const now = Date.now();
  if (ctx && now - ctxTs < CONTEXT_TTL) return ctx;
  try {
    const r = await fetch(`/proxy-portfolio?url=${encodeURIComponent(PORTFOLIO_URL)}`);
    if (r.ok) {
      ctx   = (await r.text()).slice(0, 4000);
      ctxTs = now;
    }
  } catch { /* silent — server handles fallback */ }
}

/* ─── Core send ───────────────────────────────────────────────────────────── */
async function send() {
  const text = input.value.trim();
  if (!text || streaming) return;

  streaming = true;
  setInputState(false);

  hideWelcome();
  addUserMessage(text);
  history.push({ role: 'user', content: text });

  input.value = '';
  autoGrow();

  const typingEl = addTyping();

  try {
    const res = await fetch(CHAT_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: history }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    removeEl(typingEl);
    const bubble = addAIBubble();

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      bubble.innerHTML = renderMarkdown(full);
      scrollBottom();
    }

    // Final clean render
    bubble.innerHTML = renderMarkdown(full);
    history.push({ role: 'assistant', content: full });

  } catch (err) {
    removeEl(typingEl);
    showToast('Connection error — please try again.');
    history.pop();
    console.error('[chat]', err);
  } finally {
    streaming = false;
    setInputState(true);
    scrollBottom();
  }
}

/* ─── UI helpers ──────────────────────────────────────────────────────────── */
function setInputState(enabled) {
  sendBtn.disabled = !enabled;
  input.disabled   = !enabled;
  if (enabled) input.focus();
}

function hideWelcome() {
  if (!welcome) return;
  welcome.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  welcome.style.opacity    = '0';
  welcome.style.transform  = 'translateY(-6px)';
  setTimeout(() => welcome.remove(), 260);
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addUserMessage(text) {
  const group = el('div', 'msg-group user');

  const sender = el('span', 'msg-sender');
  sender.textContent = 'You';

  const bubble = el('div', 'msg-bubble');
  bubble.textContent = text;

  const time = el('div', 'msg-time');
  time.textContent = nowTime();

  group.append(sender, bubble, time);
  conv.appendChild(group);
  scrollBottom();
  return bubble;
}

function addTyping() {
  const group = el('div', 'typing-group');
  group.id = 'typing';
  group.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
  conv.appendChild(group);
  scrollBottom();
  return group;
}

function addAIBubble() {
  const group = el('div', 'msg-group ai');

  const sender = el('span', 'msg-sender');
  sender.textContent = 'Sri Charan AI';

  const bubble = el('div', 'msg-bubble');

  const time = el('div', 'msg-time');
  time.textContent = nowTime();

  group.append(sender, bubble, time);
  conv.appendChild(group);
  scrollBottom();
  return bubble;
}

function removeEl(node) {
  node?.remove();
}

function scrollBottom() {
  requestAnimationFrame(() => {
    conv.scrollTo({ top: conv.scrollHeight, behavior: 'smooth' });
  });
}

function showToast(msg, ms = 4200) {
  const t = el('div', 'toast');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity   = '0';
    t.style.transform = 'translateX(-50%) translateY(6px)';
    t.style.transition = 'opacity 0.25s, transform 0.25s';
    setTimeout(() => t.remove(), 260);
  }, ms);
}

/* ─── Markdown renderer (minimal subset) ─────────────────────────────────── */
function renderMarkdown(text) {
  // Escape raw HTML
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold and italic
  s = s.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.*?)\*\*/g,     '<strong>$1</strong>');
  s = s.replace(/\*(.*?)\*/g,         '<em>$1</em>');

  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;font-size:12.5px;font-family:ui-monospace,monospace;">$1</code>');

  // Paragraphs
  const paras = s.split(/\n{2,}/);
  return paras
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* ─── Utility ─────────────────────────────────────────────────────────────── */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
    }
