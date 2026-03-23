/* ═══════════════════════════════════════════════════════════════
   script.js — Sri Charan's AI
   Handles: chat logic, API calls, UI rendering, typewriter,
            localStorage persistence, multi-turn reasoning
═══════════════════════════════════════════════════════════════ */

/* ─── STATE ──────────────────────────────────────────────────── */
let conversationHistory = []; // Stores full history including reasoning_details
let isWaiting = false;

/* ─── DOM REFS ───────────────────────────────────────────────── */
const messagesArea = document.getElementById('messages-area');
const inputEl      = document.getElementById('user-input');
const sendBtn      = document.getElementById('send-btn');
const clearBtn     = document.getElementById('clear-btn');
const toastEl      = document.getElementById('toast');

/* ═══════════════════════════════════════════════════════════════
   PERSISTENCE — localStorage
═══════════════════════════════════════════════════════════════ */

/** Save conversation history + rendered UI to localStorage */
function saveChat() {
  try {
    localStorage.setItem('sca_history', JSON.stringify(conversationHistory));
    // Save rendered HTML so UI persists across reloads
    localStorage.setItem('sca_ui', messagesArea.innerHTML);
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

/** Load saved chat on page init */
function loadChat() {
  try {
    const savedHistory = localStorage.getItem('sca_history');
    const savedUI      = localStorage.getItem('sca_ui');
    if (savedHistory && savedUI) {
      conversationHistory = JSON.parse(savedHistory);
      messagesArea.innerHTML = savedUI;
      if (conversationHistory.length > 0) {
        // Remove empty state since we have messages
        const es = document.getElementById('empty-state');
        if (es) es.remove();
        scrollBottom();
      }
    }
  } catch (e) {
    console.warn('localStorage load failed:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════ */

/** Returns formatted time string e.g. "03:45 PM" */
function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Smooth-scroll messages area to bottom */
function scrollBottom() {
  setTimeout(() => {
    messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
  }, 50);
}

/** Show a brief toast notification */
function showToast(message, duration = 2200) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

/** Escape HTML entities to prevent XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Basic markdown-like formatter
 * Handles: code blocks, inline code, bold, italic, line breaks
 */
function formatText(text) {
  let t = escapeHtml(text);
  t = t.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  t = t.replace(/\n/g, '<br>');
  return t;
}

/* ═══════════════════════════════════════════════════════════════
   TYPEWRITER EFFECT
   Animates AI response character-by-character with variable speed
═══════════════════════════════════════════════════════════════ */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typewriterEffect(bubbleEl, finalText) {
  bubbleEl.innerHTML = '<span class="typewriter-cursor"></span>';
  let displayed = '';
  const chars = finalText.split('');

  for (let i = 0; i < chars.length; i++) {
    displayed += chars[i];
    bubbleEl.innerHTML = formatText(displayed) + '<span class="typewriter-cursor"></span>';

    // Variable speed: slower on punctuation, faster on spaces
    let delay = 18;
    if (chars[i] === '\n')                  delay = 30;
    else if (/[.!?]/.test(chars[i]))       delay = 55;
    else if (/[,;:]/.test(chars[i]))       delay = 35;
    else if (chars[i] === ' ')              delay = 10;

    await sleep(delay);
    scrollBottom();
  }

  // Final clean render without cursor
  bubbleEl.innerHTML = formatText(finalText);
}

/* ═══════════════════════════════════════════════════════════════
   RENDER MESSAGES
═══════════════════════════════════════════════════════════════ */

/**
 * Appends a chat bubble to the messages area.
 * @param {string} role        - 'user' or 'ai'
 * @param {string} text        - Message content
 * @param {Array|null} reasoning - reasoning_details from API (optional)
 * @returns {{ row, bubble }} DOM elements
 */
function renderMessage(role, text, reasoning = null) {
  // Remove empty state on first message
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();

  const isUser = role === 'user';
  const ts     = getTimestamp();
  const uid    = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2);

  /* ── Row container ── */
  const row = document.createElement('div');
  row.className = `message-row ${isUser ? 'user' : 'ai'}`;
  row.id = uid;

  /* ── Avatar ── */
  const avDiv = document.createElement('div');
  avDiv.className = `avatar ${isUser ? 'user-av' : 'ai-av'}`;

  if (isUser) {
    avDiv.textContent = 'YOU';
  } else {
    // Mini neural SVG for AI avatar
    avDiv.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 46 46" fill="none">
        <defs>
          <linearGradient id="avG${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4fc3f7"/>
            <stop offset="100%" stop-color="#a78bfa"/>
          </linearGradient>
        </defs>
        <circle cx="23" cy="23" r="7" fill="url(#avG${uid})" opacity="0.9"/>
        <line x1="23" y1="10" x2="23" y2="16" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="23" y1="30" x2="23" y2="36" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="23" x2="16" y2="23" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="30" y1="23" x2="36" y2="23" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
  }

  /* ── Bubble wrapper ── */
  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';

  /* ── Chat bubble ── */
  const bubble = document.createElement('div');
  bubble.className = `bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`;
  bubble.innerHTML = formatText(text);

  /* ── Reasoning block (collapsible) ── */
  if (reasoning && reasoning.length > 0) {
    const rText = reasoning
      .map(r => r.thinking || r.text || JSON.stringify(r))
      .join('\n');

    const reasoningEl = document.createElement('div');
    reasoningEl.className = 'reasoning-block';
    reasoningEl.innerHTML = `<span class="reasoning-label">⚡ Reasoning (click to expand)</span>${escapeHtml(rText)}`;
    reasoningEl.addEventListener('click', () => {
      reasoningEl.classList.toggle('open');
    });
    wrap.appendChild(bubble);
    wrap.appendChild(reasoningEl);
  } else {
    wrap.appendChild(bubble);
  }

  /* ── Meta row: timestamp + copy button ── */
  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const tsSpan = document.createElement('span');
  tsSpan.className = 'timestamp';
  tsSpan.textContent = ts;
  meta.appendChild(tsSpan);

  // Copy button only for AI messages
  if (!isUser) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg> Copy`;

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text)
        .then(() => {
          copyBtn.textContent = '✓ Copied';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg> Copy`;
            copyBtn.classList.remove('copied');
          }, 2000);
        })
        .catch(() => showToast('Copy failed'));
    });
    meta.appendChild(copyBtn);
  }

  wrap.appendChild(meta);
  row.appendChild(avDiv);
  row.appendChild(wrap);
  messagesArea.appendChild(row);
  scrollBottom();

  return { row, bubble };
}

/* ═══════════════════════════════════════════════════════════════
   TYPING INDICATOR
═══════════════════════════════════════════════════════════════ */
function showTyping() {
  const row = document.createElement('div');
  row.className = 'typing-row';
  row.id = 'typing-indicator';

  const avDiv = document.createElement('div');
  avDiv.className = 'avatar ai-av';
  avDiv.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" fill="#4fc3f7" opacity="0.8">
        <animate attributeName="r" values="4;6;4" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>`;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'typing-bubble';
  bubbleEl.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>`;

  row.appendChild(avDiv);
  row.appendChild(bubbleEl);
  messagesArea.appendChild(row);
  scrollBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

/* ═══════════════════════════════════════════════════════════════
   API CALL — POST to Flask backend /api/chat
   Backend proxies to OpenRouter with reasoning enabled.
   Multi-turn: full history (with reasoning_details) is sent each time.
═══════════════════════════════════════════════════════════════ */
async function callAPI(messages) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}`);
  }

  return {
    content:           data.content || '',
    reasoning_details: data.reasoning_details || null
  };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SEND FLOW
═══════════════════════════════════════════════════════════════ */
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || isWaiting) return;

  // Lock UI
  isWaiting = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  // 1. Render user bubble
  renderMessage('user', text);

  // 2. Add to history
  conversationHistory.push({ role: 'user', content: text });

  // 3. Show typing animation
  showTyping();

  try {
    // 4. Call backend (includes full history with reasoning_details)
    const result = await callAPI(conversationHistory);
    hideTyping();

    const aiContent = result.content || '(No response received)';

    // 5. Render AI bubble + typewriter animation
    const { bubble } = renderMessage('ai', aiContent, result.reasoning_details);
    await typewriterEffect(bubble, aiContent);

    // 6. Push assistant message WITH reasoning_details back into history
    //    This is the multi-turn reasoning persistence — sent unmodified next turn.
    const assistantEntry = {
      role: 'assistant',
      content: aiContent
    };
    if (result.reasoning_details) {
      assistantEntry.reasoning_details = result.reasoning_details;
    }
    conversationHistory.push(assistantEntry);

    // 7. Persist to localStorage
    saveChat();

  } catch (err) {
    hideTyping();
    console.error('Chat error:', err);

    let errMsg = err.message;
    if (errMsg.includes('401')) errMsg = 'Authentication failed — check your API key.';
    if (errMsg.includes('429')) errMsg = 'Rate limit reached — please wait a moment.';
    if (errMsg.includes('Failed to fetch')) errMsg = 'Cannot reach the server. Is Flask running?';

    renderMessage('ai', `⚠️ ${errMsg}`);
    showToast('Request failed', 3000);
  }

  // Unlock UI
  isWaiting = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

/* ═══════════════════════════════════════════════════════════════
   CLEAR CHAT
═══════════════════════════════════════════════════════════════ */
function clearChat() {
  conversationHistory = [];
  try {
    localStorage.removeItem('sca_history');
    localStorage.removeItem('sca_ui');
  } catch(e) {}

  messagesArea.innerHTML = `
    <div class="empty-state" id="empty-state">
      <div class="empty-icon">
        <svg width="36" height="36" viewBox="0 0 46 46" fill="none">
          <defs>
            <linearGradient id="eg2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4fc3f7"/>
              <stop offset="100%" stop-color="#a78bfa"/>
            </linearGradient>
          </defs>
          <circle cx="23" cy="23" r="10" stroke="url(#eg2)" stroke-width="1.5" fill="none"/>
          <circle cx="23" cy="23" r="3.5" fill="url(#eg2)">
            <animate attributeName="r" values="3.5;5;3.5" dur="2s" repeatCount="indefinite"/>
          </circle>
          <line x1="23" y1="8"  x2="23" y2="13" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="23" y1="33" x2="23" y2="38" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8"  y1="23" x2="13" y2="23" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="33" y1="23" x2="38" y2="23" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="empty-title">Sri Charan's AI</div>
      <div class="empty-sub">Your intelligent companion — ask me anything about code, ideas, or the universe.</div>
      <div class="suggestions">
        <span class="suggestion-chip" data-text="What can you do?">What can you do?</span>
        <span class="suggestion-chip" data-text="Help me write Python code">Help me write code</span>
        <span class="suggestion-chip" data-text="Explain AI to me simply">Explain AI to me</span>
        <span class="suggestion-chip" data-text="Tell me a fun tech fact">Fun tech fact</span>
        <span class="suggestion-chip" data-text="Who is Sri Charan?">Who is Sri Charan?</span>
      </div>
    </div>`;

  // Re-attach suggestion chip listeners
  attachSuggestionListeners();
  showToast('Chat cleared ✓');
}

/* ═══════════════════════════════════════════════════════════════
   SUGGESTION CHIPS — click to pre-fill and send
═══════════════════════════════════════════════════════════════ */
function attachSuggestionListeners() {
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inputEl.value = chip.dataset.text || chip.textContent;
      handleSend();
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   TEXTAREA — auto-resize & Enter to send
═══════════════════════════════════════════════════════════════ */
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  // Enter sends, Shift+Enter adds new line
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */
sendBtn.addEventListener('click', handleSend);
clearBtn.addEventListener('click', clearChat);

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
loadChat();
attachSuggestionListeners();
inputEl.focus();
