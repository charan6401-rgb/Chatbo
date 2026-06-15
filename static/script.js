// =========================================
// Sri Charan AI Portfolio Chatbot
// =========================================

const BACKEND_URL = "/chat";

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("msgInput");
const typingBubble = document.getElementById("typingBubble");
const sendBtn = document.getElementById("sendBtn");

let conversationHistory = [];
let isSending = false;

// =========================================
// Time
// =========================================

function getTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// =========================================
// Scroll
// =========================================

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// =========================================
// Typing Indicator
// =========================================

function showTyping(show) {
  if (show) {
    typingBubble.classList.add("visible");
  } else {
    typingBubble.classList.remove("visible");
  }

  scrollToBottom();
}

// =========================================
// Create Message Bubble
// =========================================

function createMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = getTime();

  msg.appendChild(bubble);
  msg.appendChild(time);

  messagesEl.appendChild(msg);

  scrollToBottom();

  return {
    msg,
    bubble,
    time
  };
}

// =========================================
// Auto Resize Textarea
// =========================================

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height =
    Math.min(inputEl.scrollHeight, 100) + "px";
}

inputEl.addEventListener("input", autoResize);

// =========================================
// Enter To Send
// =========================================

inputEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// =========================================
// Quick Prompt Chips
// =========================================

async function sendPrompt(text) {
  inputEl.value = text;
  autoResize();
  await handleSend();
}

window.sendPrompt = sendPrompt;

// =========================================
// Send Message
// =========================================

async function handleSend() {
  if (isSending) return;

  const userText = inputEl.value.trim();

  if (!userText) return;

  inputEl.value = "";
  autoResize();

  isSending = true;

  sendBtn.disabled = true;
  sendBtn.style.opacity = "0.5";

  // Add User Bubble

  createMessage("user", userText);

  // Save Conversation

  conversationHistory.push({
    role: "user",
    content: userText
  });

  showTyping(true);

  let botMessage = null;
  let fullResponse = "";

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    showTyping(false);

    botMessage = createMessage("bot", "");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, {
        stream: true
      });

      fullResponse += chunk;

      botMessage.bubble.textContent = fullResponse;

      scrollToBottom();
    }

    conversationHistory.push({
      role: "assistant",
      content: fullResponse
    });

    botMessage.time.textContent = getTime();

  } catch (error) {
    console.error("Chat Error:", error);

    showTyping(false);

    if (!botMessage) {
      botMessage = createMessage("bot", "");
    }

    botMessage.bubble.textContent =
      "⚠️ Unable to connect to the AI server. Please try again.";

    botMessage.bubble.style.color = "#ff6b8a";
  }

  finally {
    isSending = false;

    sendBtn.disabled = false;
    sendBtn.style.opacity = "1";

    inputEl.focus();

    scrollToBottom();
  }
}

// Make Available To HTML

window.handleSend = handleSend;

// =========================================
// Startup
// =========================================

window.addEventListener("load", () => {
  inputEl.focus();
});

// =========================================
// Optional Health Check
// =========================================

async function checkServer() {
  try {
    const response = await fetch("/ping");

    if (response.ok) {
      const data = await response.json();
      console.log("Server Online:", data);
    }
  } catch (err) {
    console.warn("Server Offline");
  }
}

checkServer();
