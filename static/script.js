const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

let history = [];

/* ADD MESSAGE */
function addMessage(role, text) {
  document.querySelector(".welcome-card")?.remove();

  const row = document.createElement("div");
  row.className = "msg " + role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  row.appendChild(bubble);
  chat.appendChild(row);

  streamText(bubble, text);
}

/* STREAMING EFFECT */
function streamText(el, text) {
  let i = 0;
  function type() {
    if (i < text.length) {
      el.innerText += text[i];
      i++;
      chat.scrollTop = chat.scrollHeight;
      setTimeout(type, 10); // speed
    }
  }
  type();
}

/* SEND */
async function sendMsg() {
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

    addMessage("bot", data.content);
    history.push({ role: "assistant", content: data.content });

  } catch {
    addMessage("bot", "Error...");
  }
}

send.onclick = sendMsg;

input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMsg();
});

/* CHIP CLICK */
document.querySelectorAll(".chips button").forEach(btn=>{
  btn.onclick = ()=>{
    input.value = btn.innerText;
    sendMsg();
  }
});
