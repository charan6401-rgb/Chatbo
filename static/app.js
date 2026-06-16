/* ═══════════════════════════════════════════════════════════
   JARVIS — Frontend App
   Features: Streaming SSE, Markdown, Code Blocks, Themes, History
═══════════════════════════════════════════════════════════ */

"use strict";

// ── DOM refs ──────────────────────────────────────────────
const messagesContainer = document.getElementById("messagesContainer");
const messagesList      = document.getElementById("messagesList");
const welcomeScreen     = document.getElementById("welcomeScreen");
const messageInput      = document.getElementById("messageInput");
const sendBtn           = document.getElementById("sendBtn");
const clearBtn          = document.getElementById("clearBtn");
const newChatBtn        = document.getElementById("newChatBtn");
const chatHistory       = document.getElementById("chatHistory");
const headerStatus      = document.getElementById("headerStatus");
const sidebar           = document.getElementById("sidebar");
const sidebarToggle     = document.getElementById("sidebarToggle");
const mobileMenuBtn     = document.getElementById("mobileMenuBtn");
const sidebarOverlay    = document.getElementById("sidebarOverlay");
const copyToast         = document.getElementById("copyToast");
const themePills        = document.querySelectorAll(".theme-pill");
const suggestionChips   = document.querySelectorAll(".suggestion-chip");

// ── State ─────────────────────────────────────────────────
let conversationHistory = [];  // [{role, content}]
let isStreaming = false;
let sessions = JSON.parse(localStorage.getItem("jarvis_sessions") || "[]");
let currentSessionId = null;

// ── Marked.js configuration ───────────────────────────────
if (typeof marked !== "undefined") {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Custom renderer for code blocks
  const renderer = new marked.Renderer();

  renderer.code = function (code, language) {
    // Handle new marked.js API which passes an object
    if (typeof code === "object" && code !== null) {
      language = code.lang || "";
      code = code.text || "";
    }
    const lang = (language || "").toLowerCase().trim();
    const displayLang = lang || "code";
    const escapedCode = escapeHtml(typeof code === "string" ? code : String(code));

    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="code-dots">
              <div class="code-dot"></div>
              <div class="code-dot"></div>
              <div class="code-dot"></div>
            </div>
            <span class="code-lang">${escapeHtml(displayLang)}</span>
          </div>
          <button class="copy-code-btn" onclick="copyCode(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
        </div>
        <pre><code class="language-${escapeHtml(lang || "plaintext")}">${escapedCode}</code></pre>
      </div>`;
  };

  marked.use({ renderer });
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Parse + highlight markdown ─────────────────────────────
function renderMarkdown(text) {
  if (typeof marked === "undefined") return escapeHtml(text);
  try {
    const html = marked.parse(text);
    return html;
  } catch (e) {
    return escapeHtml(text);
  }
}

function highlightCodeBlocks(container) {
  if (typeof hljs === "undefined") return;
  container.querySelectorAll("pre code").forEach((el) => {
    hljs.highlightElement(el);
  });
}

// ── Copy code ─────────────────────────────────────────────
window.copyCode = function (btn) {
  const pre = btn.closest(".code-block-wrapper").querySelector("pre");
  const text = pre.innerText || pre.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      btn.classList.remove("copied");
    }, 2000);
  });
};

// ── Toast ─────────────────────────────────────────────────
function showToast(msg) {
  copyToast.textContent = msg;
  copyToast.classList.add("show");
  setTimeout(() => copyToast.classList.remove("show"), 2000);
}

// ── Time formatter ─────────────────────────────────────────
function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Welcome screen ─────────────────────────────────────────
function hideWelcome() {
  welcomeScreen.classList.add("hidden");
}

// ── Scroll to bottom ───────────────────────────────────────
function scrollToBottom(smooth = true) {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: smooth ? "smooth" : "instant",
  });
}

// ── Build a message bubble element ────────────────────────
function createMessageEl(role, content) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = role === "ai" ? "msg-avatar ai-avatar" : "msg-avatar user-avatar";
  avatar.textContent = role === "ai" ? "J" : "U";

  const bubbleWrap = document.createElement("div");
  bubbleWrap.style.display = "flex";
  bubbleWrap.style.flexDirection = "column";
  bubbleWrap.style.gap = "4px";
  bubbleWrap.style.maxWidth = "min(700px, 75vw)";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  const contentDiv = document.createElement("div");
  contentDiv.className = "msg-content";

  if (role === "user") {
    // User messages: plain text, escaped
    const p = document.createElement("p");
    p.style.marginBottom = "0";
    p.textContent = content;
    contentDiv.appendChild(p);
  } else {
    // AI messages: rendered markdown
    contentDiv.innerHTML = renderMarkdown(content);
    highlightCodeBlocks(contentDiv);
  }

  bubble.appendChild(contentDiv);

  // Metadata row
  const meta = document.createElement("div");
  meta.className = "msg-meta";

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = formatTime();

  const copyBtn = document.createElement("button");
  copyBtn.className = "msg-copy-btn";
  copyBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(content).then(() => showToast("Copied to clipboard!"));
  });

  meta.appendChild(time);
  if (role === "ai") meta.appendChild(copyBtn);

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(meta);

  if (role === "ai") {
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubbleWrap);
  } else {
    wrapper.appendChild(bubbleWrap);
    wrapper.appendChild(avatar);
  }

  return { wrapper, contentDiv, bubble };
}

// ── Typing indicator ──────────────────────────────────────
function createTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "message ai";
  wrapper.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar ai-avatar";
  avatar.textContent = "J";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  return wrapper;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// ── Status indicator ──────────────────────────────────────
function setStatus(state) {
  const indicator = headerStatus.querySelector(".status-indicator");
  const text = headerStatus.childNodes[headerStatus.childNodes.length - 1];
  if (state === "typing") {
    indicator.className = "status-indicator typing";
    headerStatus.lastChild.textContent = " Typing…";
  } else {
    indicator.className = "status-indicator online";
    headerStatus.lastChild.textContent = " Online";
  }
}

// ── Session management ─────────────────────────────────────
function saveSession() {
  if (conversationHistory.length === 0) return;

  const firstUser = conversationHistory.find((m) => m.role === "user");
  const title = firstUser
    ? firstUser.content.substring(0, 45) + (firstUser.content.length > 45 ? "…" : "")
    : "Chat";

  const session = {
    id: currentSessionId,
    title,
    history: [...conversationHistory],
    timestamp: Date.now(),
  };

  const idx = sessions.findIndex((s) => s.id === currentSessionId);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);

  // Keep latest 20
  sessions = sessions.slice(0, 20);
  localStorage.setItem("jarvis_sessions", JSON.stringify(sessions));
  renderHistory();
}

function renderHistory() {
  chatHistory.innerHTML = "";
  sessions.forEach((s) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${escapeHtml(s.title)}</span>`;
    item.title = s.title;
    item.addEventListener("click", () => loadSession(s.id));
    chatHistory.appendChild(item);
  });
}

function loadSession(id) {
  const session = sessions.find((s) => s.id === id);
  if (!session) return;

  currentSessionId = id;
  conversationHistory = [...session.history];
  messagesList.innerHTML = "";
  welcomeScreen.classList.add("hidden");

  conversationHistory.forEach((msg) => {
    const { wrapper } = createMessageEl(msg.role === "user" ? "user" : "ai", msg.content);
    messagesList.appendChild(wrapper);
  });

  scrollToBottom(false);
  closeSidebarMobile();
}

function startNewSession() {
  currentSessionId = "session_" + Date.now();
  conversationHistory = [];
  messagesList.innerHTML = "";
  welcomeScreen.classList.remove("hidden");
}

// ── Send message ───────────────────────────────────────────
async function sendMessage(text) {
  if (isStreaming || !text.trim()) return;

  hideWelcome();

  // Add user message to UI
  const { wrapper: userEl } = createMessageEl("user", text);
  messagesList.appendChild(userEl);
  scrollToBottom();

  // Add to history
  conversationHistory.push({ role: "user", content: text });

  // Update UI state
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.querySelector(".send-icon").style.display = "none";
  sendBtn.querySelector(".send-spinner").style.display = "flex";
  setStatus("typing");

  // Show typing indicator briefly
  const typingEl = createTypingIndicator();
  messagesList.appendChild(typingEl);
  scrollToBottom();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("No response body");

    // Remove typing indicator and create streaming bubble
    removeTypingIndicator();

    const { wrapper: aiEl, contentDiv } = createMessageEl("ai", "");
    messagesList.appendChild(aiEl);

    // Add streaming cursor
    const cursor = document.createElement("span");
    cursor.className = "stream-cursor";
    contentDiv.appendChild(cursor);
    scrollToBottom();

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let renderBuffer = "";
    let lastRenderTime = 0;
    const RENDER_INTERVAL = 30; // ms — smooth streaming

    const flushBuffer = () => {
      if (renderBuffer.length === 0) return;
      fullText += renderBuffer;
      renderBuffer = "";

      // Re-render markdown with current accumulated text
      // Remove cursor first, re-add after
      const cursorExists = contentDiv.contains(cursor);
      if (cursorExists) contentDiv.removeChild(cursor);

      contentDiv.innerHTML = renderMarkdown(fullText);
      highlightCodeBlocks(contentDiv);

      // Re-append cursor
      contentDiv.appendChild(cursor);
      scrollToBottom();
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      renderBuffer += chunk;

      const now = Date.now();
      if (now - lastRenderTime >= RENDER_INTERVAL) {
        flushBuffer();
        lastRenderTime = now;
      }
    }

    // Final flush
    flushBuffer();

    // Remove cursor on complete
    if (contentDiv.contains(cursor)) contentDiv.removeChild(cursor);

    // Final clean render
    contentDiv.innerHTML = renderMarkdown(fullText);
    highlightCodeBlocks(contentDiv);

    // Save to history
    conversationHistory.push({ role: "assistant", content: fullText });
    saveSession();

  } catch (err) {
    removeTypingIndicator();
    const { wrapper: errEl, contentDiv: errContent } = createMessageEl(
      "ai",
      `⚠️ Connection error: ${err.message}. Please try again.`
    );
    messagesList.appendChild(errEl);
    scrollToBottom();
    console.error("Stream error:", err);
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    sendBtn.querySelector(".send-icon").style.display = "";
    sendBtn.querySelector(".send-spinner").style.display = "none";
    setStatus("online");
    messageInput.focus();
  }
}

// ── Input handlers ─────────────────────────────────────────
messageInput.addEventListener("input", () => {
  // Auto-resize
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";

  // Enable/disable send
  sendBtn.disabled = messageInput.value.trim().length === 0 || isStreaming;
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text && !isStreaming) {
      messageInput.value = "";
      messageInput.style.height = "auto";
      sendBtn.disabled = true;
      sendMessage(text);
    }
  }
});

sendBtn.addEventListener("click", () => {
  const text = messageInput.value.trim();
  if (text && !isStreaming) {
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendBtn.disabled = true;
    sendMessage(text);
  }
});

// ── Suggestion chips ───────────────────────────────────────
suggestionChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.dataset.prompt;
    sendMessage(prompt);
  });
});

// ── Clear chat ─────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  if (isStreaming) return;
  messagesList.innerHTML = "";
  conversationHistory = [];
  welcomeScreen.classList.remove("hidden");
  currentSessionId = "session_" + Date.now();
});

// ── New chat ───────────────────────────────────────────────
newChatBtn.addEventListener("click", () => {
  if (isStreaming) return;
  startNewSession();
  closeSidebarMobile();
});

// ── Theme switching ────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("jarvis_theme", theme);

  // Switch hljs stylesheet for light mode
  const hljsTheme = document.getElementById("hljs-theme");
  if (theme === "light") {
    hljsTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css";
  } else if (theme === "neon") {
    hljsTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/green-screen.min.css";
  } else {
    hljsTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css";
  }

  themePills.forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.theme === theme);
  });
}

themePills.forEach((pill) => {
  pill.addEventListener("click", () => applyTheme(pill.dataset.theme));
});

// ── Sidebar (mobile) ───────────────────────────────────────
function openSidebarMobile() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
}

function closeSidebarMobile() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
}

mobileMenuBtn.addEventListener("click", openSidebarMobile);
sidebarToggle.addEventListener("click", openSidebarMobile);
sidebarOverlay.addEventListener("click", closeSidebarMobile);

// ── Init ──────────────────────────────────────────────────
(function init() {
  // Restore theme
  const savedTheme = localStorage.getItem("jarvis_theme") || "dark";
  applyTheme(savedTheme);

  // Load sessions history
  renderHistory();

  // Start a fresh session
  startNewSession();

  // Focus input
  messageInput.focus();
})();
