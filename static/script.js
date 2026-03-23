const messages = document.getElementById("messages");
const input = document.getElementById("input");
const send = document.getElementById("send");

let history = [];

/* ADD MESSAGE */
function addMessage(role, text) {
  document.querySelector(".empty")?.remove();

  const row = document.createElement("div");
  row.className = "msg " + role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  row.appendChild(bubble);
  messages.appendChild(row);

  typeText(bubble, text);
}

/* SMOOTH STREAM */
function typeText(el, text) {
  let i = 0;
  function type() {
    if (i < text.length) {
      el.innerText += text[i];
      i++;
      messages.scrollTop = messages.scrollHeight;
      requestAnimationFrame(type);
    }
  }
  type();
}

/* API */
async function chat() {
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage("user", text);
  history.push({ role: "user", content: text });

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ messages: history })
    });

    const data = await res.json();

    addMessage("ai", data.content);
    history.push({ role: "assistant", content: data.content });

  } catch {
    addMessage("ai", "⚠️ Error");
  }
}

/* EVENTS */
send.onclick = chat;

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chat();
  }
});

/* SUGGESTIONS */
document.querySelectorAll(".suggestions button").forEach(btn=>{
  btn.onclick = ()=>{
    input.value = btn.innerText;
    chat();
  }
});
