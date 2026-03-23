let chats = JSON.parse(localStorage.getItem("chats")) || [];
let currentChat = [];

/* DOM */
const messages = document.getElementById("messages");
const input = document.getElementById("input");
const send = document.getElementById("send");
const historyBox = document.getElementById("history");
const newChatBtn = document.getElementById("new-chat");

/* SAVE */
function saveChats() {
  localStorage.setItem("chats", JSON.stringify(chats));
}

/* LOAD SIDEBAR */
function loadSidebar() {
  historyBox.innerHTML = "";
  chats.forEach((chat, i) => {
    const div = document.createElement("div");
    div.innerText = chat.title || "New Chat";
    div.onclick = () => loadChat(i);
    historyBox.appendChild(div);
  });
}

/* LOAD CHAT */
function loadChat(index) {
  currentChat = chats[index].messages;
  messages.innerHTML = "";

  currentChat.forEach(msg => {
    addMessage(msg.role, msg.content, false);
  });
}

/* ADD MESSAGE */
function addMessage(role, text, save = true) {
  document.querySelector(".empty")?.remove();

  const row = document.createElement("div");
  row.className = "msg " + role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerText = text;

  row.appendChild(bubble);
  messages.appendChild(row);

  messages.scrollTop = messages.scrollHeight;

  if (save) {
    currentChat.push({ role, content: text });
  }
}

/* SEND */
async function chat() {
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage("user", text);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ messages: currentChat })
  });

  const data = await res.json();

  addMessage("ai", data.content);

  // Save chat
  if (chats.length === 0 || currentChat !== chats[chats.length - 1]?.messages) {
    chats.push({
      title: text.slice(0, 20),
      messages: currentChat
    });
  }

  saveChats();
  loadSidebar();
}

/* NEW CHAT */
newChatBtn.onclick = () => {
  currentChat = [];
  messages.innerHTML = `
    <div class="empty">
      <h2>Jarvis Online ⚡</h2>
      <p>Start a new conversation</p>
    </div>`;
};

/* EVENTS */
send.onclick = chat;

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chat();
  }
});

/* INIT */
loadSidebar();
