document.addEventListener('DOMContentLoaded', () => {
  const CHAT_API = '/chat';
  const PORTFOLIO_URL = 'https://portfolio-fn9z.onrender.com';
  
  let history = [];
  let streaming = false;

  const conv = document.getElementById('conversation');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const welcome = document.getElementById('welcome');
  const prompts = document.getElementById('prompts');

  // Setup Input Interactions
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  prompts.addEventListener('click', (e) => {
    const chip = e.target.closest('.prompt-chip');
    if (!chip) return;
    input.value = chip.dataset.q;
    send();
  });

  sendBtn.addEventListener('click', send);

  async function send() {
    const text = input.value.trim();
    if (!text || streaming) return;

    streaming = true;
    setInputState(false);
    hideWelcome();

    // 1. Render User Message
    addUserMessage(text);
    history.push({ role: 'user', content: text });
    input.value = '';

    // 2. Render Loading State
    const typingId = 'typing-' + Date.now();
    addTypingIndicator(typingId);

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

      removeEl(typingId);
      const bubble = addAIBubble();

      // Stream Reading Logic
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        bubble.innerHTML = renderMarkdown(fullText);
        scrollBottom();
      }

      history.push({ role: 'assistant', content: fullText });

    } catch (err) {
      removeEl(typingId);
      const errBubble = addAIBubble();
      errBubble.innerHTML = `<span class="text-red-400">Connection error. Please try again.</span>`;
      history.pop(); // Remove the user message from history on failure
    } finally {
      streaming = false;
      setInputState(true);
      scrollBottom();
    }
  }

  // UI Control Helpers
  function setInputState(enabled) {
    sendBtn.disabled = !enabled;
    input.disabled = !enabled;
    if (enabled) setTimeout(() => input.focus(), 10);
  }

  function hideWelcome() {
    if (welcome && welcome.parentNode) {
      welcome.style.opacity = '0';
      welcome.style.transform = 'scale(0.95)';
      setTimeout(() => welcome.remove(), 300);
    }
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      conv.scrollTo({ top: conv.scrollHeight, behavior: 'smooth' });
    });
  }

  // DOM Node Generators
  function addUserMessage(text) {
    const wrap = document.createElement('div');
    wrap.className = 'flex justify-end w-full mb-4 animate-fade-in-up';
    wrap.innerHTML = `
      <div class="max-w-[80%] md:max-w-[70%]">
        <div class="msg-user px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-lg">${escapeHTML(text)}</div>
        <div class="text-[10px] text-gray-500 mt-1 text-right pr-2">${nowTime()}</div>
      </div>
    `;
    conv.appendChild(wrap);
    scrollBottom();
  }

  function addAIBubble() {
    const wrap = document.createElement('div');
    wrap.className = 'flex justify-start w-full mb-4 animate-fade-in-up';
    
    const content = document.createElement('div');
    content.className = 'max-w-[85%] md:max-w-[75%]';
    
    const bubble = document.createElement('div');
    bubble.className = 'msg-ai px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-md';
    
    const time = document.createElement('div');
    time.className = 'text-[10px] text-gray-500 mt-1 pl-2';
    time.innerText = nowTime();

    content.appendChild(bubble);
    content.appendChild(time);
    wrap.appendChild(content);
    conv.appendChild(wrap);
    
    scrollBottom();
    return bubble; 
  }

  function addTypingIndicator(id) {
    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'flex justify-start w-full mb-4 animate-fade-in-up';
    wrap.innerHTML = `
      <div class="msg-ai px-5 py-4 rounded-2xl flex items-center gap-1.5 shadow-lg">
        <div class="w-2 h-2 rounded-full bg-blue-400 typing-dot"></div>
        <div class="w-2 h-2 rounded-full bg-blue-400 typing-dot"></div>
        <div class="w-2 h-2 rounded-full bg-blue-400 typing-dot"></div>
      </div>
    `;
    conv.appendChild(wrap);
    scrollBottom();
  }

  function removeEl(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
  }

  // Minimal Markdown Parser for Stream Text
  function renderMarkdown(text) {
    let s = escapeHTML(text);
    s = s.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-semibold text-white"><em>$1</em></strong>');
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
    s = s.replace(/\*(.*?)\*/g, '<em class="text-gray-200">$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded-md text-blue-300 font-mono text-xs border border-white/5">$1</code>');
    const paras = s.split(/\n{2,}/);
    return paras.map(p => p.trim()).filter(Boolean).map(p => `<p class="mb-3 last:mb-0">${p.replace(/\n/g, '<br>')}</p>`).join('');
  }
});
