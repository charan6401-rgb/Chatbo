// DOM Elements
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');

// Conversation history
let conversationHistory = [];

async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message) return;

    addMessage(message, 'user');

    // Store message for backend
    conversationHistory.push({
        role: "user",
        content: message
    });

    messageInput.value = '';

    sendBtn.disabled = true;
    typingIndicator.classList.add('active');

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: conversationHistory
            })
        });

        typingIndicator.classList.remove('active');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Create empty bot message
        const botMessageDiv = createBotMessage();
        let botResponse = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            botResponse += chunk;

            botMessageDiv.innerHTML = formatMessage(botResponse);

            messagesContainer.scrollTop =
                messagesContainer.scrollHeight;
        }

        conversationHistory.push({
            role: "assistant",
            content: botResponse
        });

    } catch (error) {
        console.error(error);

        typingIndicator.classList.remove('active');

        addMessage(
            '⚠️ Unable to connect to the AI server. Please try again.',
            'bot'
        );
    }

    sendBtn.disabled = false;
    messageInput.focus();
}

function createBotMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    return contentDiv;
}

function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    contentDiv.innerHTML = formatMessage(text);

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}

function formatMessage(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\n/g, '<br>');
    return text;
}

function sendPrompt(promptText) {
    messageInput.value = promptText;
    sendMessage();
}

messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

window.addEventListener('load', () => {
    messageInput.focus();
});
