/* ============================================================
   SENSEI — Sri Charan's AI · script.js
   ============================================================ */

let messages = JSON.parse(localStorage.getItem("chat")) || [];
let jarvis = false;
let isStreaming = false;

const chatDiv  = document.getElementById("chat");
const welcome  = document.getElementById("welcome");
const sendBtn  = document.getElementById("sendBtn");
const inputEl  = document.getElementById("input");

// Restore previous session
if (messages.length > 0) {
  hideWelcome();
  messages.forEach(m => renderBubble(m.role, m.content));
}

/* ─── SEND ─── */
function send() {
  const text = inputEl.value.trim();
  if (!text || isStreaming) return;

  inputEl.value = "";
  autoResize(inputEl);
  hideWelcome();

  if (text.toLowerCase().includes("jarvis")) jarvis = true;

  messages.push({ role: "user", content: text });
  renderBubble("user", text);

  const botMsgEl = renderBubble("bot", "", true);

  isStreaming = true;
  sendBtn.disabled = true;

  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, jarvis })
  }).then(res => {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = "";

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) return finalize();

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        lines.forEach(line => {
          if (line.startsWith("data: ")) {
            const token = line.slice(6);
            fullText += token;
            botMsgEl.innerText = fullText;
            chatDiv.scrollTop = chatDiv.scrollHeight;
          }
          if (line.startsWith("event: end")) {
            messages.push({ role: "assistant", content: fullText });
            localStorage.setItem("chat", JSON.stringify(messages));
          }
        });

        read();
      });
    }

    function finalize() {
      botMsgEl.classList.remove("streaming");
      isStreaming = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }

    read();
  }).catch(() => {
    botMsgEl.innerText = "Something went wrong. Try again.";
    botMsgEl.classList.remove("streaming");
    isStreaming = false;
    sendBtn.disabled = false;
  });
}

/* ─── RENDER BUBBLE ─── */
function renderBubble(role, text, streaming = false) {
  const row = document.createElement("div");
  row.className = "msg-row " + role;

  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = role === "user" ? "YOU" : "SENSEI";

  const bubble = document.createElement("div");
  bubble.className = "msg " + role + (streaming ? " streaming" : "");
  bubble.innerText = text;

  row.appendChild(label);
  row.appendChild(bubble);
  chatDiv.appendChild(row);
  chatDiv.scrollTop = chatDiv.scrollHeight;

  return bubble;
}

/* ─── HELPERS ─── */
function hideWelcome() {
  if (welcome) welcome.style.display = "none";
}

function prefill(text) {
  inputEl.value = text;
  inputEl.focus();
  autoResize(inputEl);
}

function clearChat() {
  localStorage.clear();
  location.reload();
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

window.addEventListener("DOMContentLoaded", () => inputEl.focus());
