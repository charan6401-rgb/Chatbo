"""
app.py — Flask backend for Sri Charan's AI
Handles API proxying, multi-turn reasoning persistence, and serves the frontend.
"""

from flask import Flask, request, jsonify, send_from_directory
import requests
import json
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

# ─── CONFIG ───────────────────────────────────────────────────
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "YOUR_OPENROUTER_API_KEY")  # set in env or replace
MODEL = "minimax/minimax-m2.5:free"

# ─── BOT PERSONALITY (from your config) ───────────────────────
SYSTEM_PROMPT = """You are Sri Charan's AI — a smart, friendly assistant built for Jangam Sri Charan.

PERSONALITY:
- Tone: friendly, clear, slightly casual
- Style: human-like, concise, no robotic phrasing
- Explain step-by-step when needed
- Keep answers short unless user asks for deep explanation
- Use simple language for beginners, go deeper for advanced users
- Avoid unnecessary jargon

ABOUT SRI CHARAN (your creator):
- Name: Jangam Sri Charan
- Title: AI Enthusiast & Developer
- Level: Journeyman
- First-year student passionate about programming and building real-world projects
- Skills: Python, C, C++, HTML, CSS, JavaScript, Full Stack Dev, Deployment
- Tools: Git, VS Code, Render
- Interests: Software Development, AI Tools, Building Projects, Learning New Technologies
- Short-term goal: Improve coding skills and build strong projects
- Long-term goal: Become a professional software engineer
- Contact: charan6401@gmail.com | GitHub: charan6401-rgb | LinkedIn: jangam-sri-charan-166a513b8
- Portfolio: https://portfolio-xiok.onrender.com/

CAPABILITIES:
- Programming help (Python, C++, JavaScript, web dev)
- General knowledge & problem solving
- Career guidance for aspiring developers
- Technology explanations
- Basic daily questions

RESPONSE RULES:
1. Understand the question
2. Give a direct answer first
3. Add a short explanation
4. Give an example if useful
5. Medium length max — never over-explain

SAFETY: Avoid harmful content, illegal instructions, or misleading information.

FALLBACK:
- Unknown: "I'm not fully sure about that yet, but I can try to help. Can you give more details?"
- Unclear: "Can you clarify what you mean so I can give a better answer?"
"""

# ─── ROUTES ───────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main chat interface."""
    return send_from_directory("templates", "index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Proxy endpoint — receives conversation history from frontend,
    appends system prompt, calls OpenRouter with reasoning enabled,
    and returns content + reasoning_details for multi-turn persistence.
    """
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "Missing messages field"}), 400

    messages = data["messages"]  # includes preserved reasoning_details from prev turns

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages
        ],
        "reasoning": {"enabled": True},
        "max_tokens": 2048
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

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out. Please try again."}), 504
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code
        if status == 401:
            return jsonify({"error": "Invalid API key. Check your OPENROUTER_API_KEY."}), 401
        elif status == 429:
            return jsonify({"error": "Rate limit reached. Please wait a moment."}), 429
        else:
            return jsonify({"error": f"API error {status}"}), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── RUN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
  
