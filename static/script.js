let messages = JSON.parse(localStorage.getItem("chat")) || [];
let jarvis = false;

const chatDiv = document.getElementById("chat");

messages.forEach(m => render(m.role, m.content));

function send(){
  const input = document.getElementById("input");
  const text = input.value.trim();
  if(!text) return;

  input.value = "";

  if(text.toLowerCase().includes("jarvis")){
    jarvis = true;
  }

  messages.push({role:"user", content:text});
  render("user", text);

  const botDiv = render("bot", "");

  fetch("/chat", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({messages, jarvis})
  }).then(res => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";

    function read(){
      reader.read().then(({done, value}) => {
        if(done) return;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        lines.forEach(line => {
          if(line.startsWith("data: ")){
            const token = line.replace("data: ","");
            fullText += token;
            botDiv.innerText = fullText;
          }

          if(line.startsWith("event: end")){
            messages.push({role:"assistant", content:fullText});
            localStorage.setItem("chat", JSON.stringify(messages));
          }
        });

        read();
      });
    }

    read();
  });
}

function render(role, text){
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.innerText = text;
  chatDiv.appendChild(div);
  chatDiv.scrollTop = chatDiv.scrollHeight;
  return div;
}

function clearChat(){
  localStorage.clear();
  location.reload();
}
