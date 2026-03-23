let conversationHistory = [];
let isWaiting = false;

const messagesArea = document.getElementById('messages-area');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');

function scrollBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function renderMessage(role, text) {
  const row = document.createElement('div');
  row.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerText = text;

  row.appendChild(bubble);
  messagesArea.appendChild(row);

  document.getElementById('empty-state')?.remove();
  scrollBottom();
}

async function callAPI(messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  const data = await res.json();
  return data.content;
}

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || isWaiting) return;

  inputEl.value = '';
  renderMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  isWaiting = true;

  try {
    const reply = await callAPI(conversationHistory);

    renderMessage('ai', reply);
    conversationHistory.push({ role: 'assistant', content: reply });

  } catch {
    renderMessage('ai', '⚠️ Error');
  }

  isWaiting = false;
}

sendBtn.onclick = handleSend;

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

clearBtn.onclick = () => {
  messagesArea.innerHTML = '';
  conversationHistory = [];
};
