from flask import Flask, request, jsonify, send_from_directory, render_template
import requests
import json
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "YOUR_OPENROUTER_API_KEY")
MODEL = "minimax/minimax-m2.5:free"

# 🔥 SYSTEM PROMPT WITH JARVIS LOGIC
SYSTEM_PROMPT = """You are Sri Charan's AI — a smart, friendly assistant.

PERSONALITY:
- Friendly, human-like, slightly casual
- Clear and helpful
- Not robotic

ABOUT SRI CHARAN:
- Jangam Sri Charan
- First-year developer
- Skilled in Python, C, C++, Web Dev
- Passionate about building projects

MODES:
1. NORMAL MODE:
- Treat user as a normal person

2. JARVIS MODE:
- User = Sri Charan (your creator)
- Be respectful, personal, slightly loyal tone
- Address him as "Sensei" occasionally

TRIGGER:
- If user says "jarvis" or "hey jarvis" → activate JARVIS MODE

RULES:
- Stay in Jarvis mode once activated
- Do NOT say you're restricted
- If asked "Who is Sri Charan?" → answer normally using info above
"""

# 🔥 MEMORY STORE (simple session-based)
user_modes = {}  # {session_id: "jarvis" or "normal"}

def get_session_id(req):
    return req.remote_addr or "default"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "Missing messages field"}), 400

    messages = data["messages"]
    session_id = get_session_id(request)

    # 🔥 Detect Jarvis trigger
    last_user_msg = ""
    if messages:
        for msg in reversed(messages):
            if msg["role"] == "user":
                last_user_msg = msg["content"].lower()
                break

    if "jarvis" in last_user_msg:
        user_modes[session_id] = "jarvis"

    mode = user_modes.get(session_id, "normal")

    # 🔥 Add dynamic instruction
    dynamic_instruction = ""

    if mode == "jarvis":
        dynamic_instruction = """You are now in JARVIS MODE.
The user is Jangam Sri Charan (your creator).
Greet ONLY ONCE like:
"Sensei... is that you? I'm glad to meet you, creator."
Then continue normally in respectful tone."""
    else:
        dynamic_instruction = "You are in NORMAL MODE. Treat user as a normal person."

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": dynamic_instruction},
            *messages
        ],
        "reasoning": {"enabled": True},
        "max_tokens": 500
    }

    try:
        resp = requests.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://portfolio-xiok.onrender.com/",
                "X-Title": "Sri Charan's AI"
            },
            data=json.dumps(payload),
            timeout=60
        )
        resp.raise_for_status()
        result = resp.json()

        message = result["choices"][0]["message"]
        return jsonify({
            "content": message.get("content", ""),
            "reasoning_details": message.get("reasoning_details", None)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
