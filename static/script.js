let controller = null;

let history = [
    { role: "system", content: "You are a helpful assistant." }
];

async function sendMessage(customText=null) {
    const input = document.getElementById("input");
    const text = customText || input.value;

    if (!text) return;

    addMessage(text, "user");
    input.value = "";

    history.push({ role: "user", content: text });

    const aiDiv = addMessage("Thinking...", "ai");

    controller = new AbortController();

    const response = await fetch("/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ messages: history }),
        signal: controller.signal
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    aiDiv.innerHTML = "";

    let fullText = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullText += chunk;

        aiDiv.innerHTML = fullText + `<span class="cursor"></span>`;
        scrollBottom();
    }

    aiDiv.innerHTML = fullText;

    history.push({ role: "assistant", content: fullText });
}

function quickAsk(text) {
    sendMessage(text);
}

function stopStream() {
    if (controller) controller.abort();
}

function addMessage(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;

    document.getElementById("messages").appendChild(div);
    scrollBottom();
    return div;
}

function scrollBottom() {
    const box = document.getElementById("messages");
    box.scrollTop = box.scrollHeight;
}
