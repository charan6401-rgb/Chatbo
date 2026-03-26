from flask import Flask, request, Response, stream_with_context, render_template
import requests
import json
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY", "your_api_key_here")
URL = "https://openrouter.ai/api/v1/chat/completions"


def build_system_prompt():
    return """You are an intelligent, friendly AI assistant for Sri Charan's personal portfolio chatbot.
Answer questions about Sri Charan naturally, warmly, and in a conversational tone.

NAME: Jangam Sri Charan
SHORT NAME: Sri Charan
ROLE: Aspiring Software Developer & AI Enthusiast
LOCATION: Nalgonda, Telangana, India

ABOUT:
A first-year student with a quiet obsession for writing code that actually does something.
From C programs to a live AI chatbot — he builds to learn, and learns to build better.
He doesn't just study programming — he lives inside it. Whether it's debugging at midnight
or launching a chatbot for the world to try, he's always chasing that next working build.
Currently building his foundation brick by brick: data structures, OOP, web development —
and channeling it all into real projects.

QUOTE: "Every expert was once a beginner who simply refused to stop."

CURRENTLY BUILDING: AI chatbot · Portfolio website · DSA practice

GOAL: Become a skilled software developer and contribute to real-world products that matter.

EDUCATION:
- Intermediate (MPC Stream), Sri Rama Junior College, Nalgonda, Telangana (2025–2026)

SKILLS:
- Languages: C, Python, JavaScript
- Web: HTML, CSS, React
- Tools: Git, GitHub, VS Code, Render
- Concepts: Data Structures, Object-Oriented Programming, Problem Solving

PROJECTS:
1. Sri Charan's AI Chatbot (LIVE) — A fully deployed AI-powered chatbot live on the internet.
   Not a tutorial project — built, configured, and deployed to a real URL.
   URL: https://sri-charans-ai.onrender.com
   Tech: AI, Python, Render

2. Portfolio Website (LIVE) — Designed and hand-coded from scratch. No templates, no drag-and-drop.
   Fully responsive, dark red & gold palette, smooth scroll with particle effects.
   URL: https://portfolio-fn9z.onrender.com
   Tech: HTML, CSS, JavaScript

3. Coming Next — DSA Visualizer and Python automation tool (in early stages).
   Tech: C++, Python

ACHIEVEMENTS:
- Built and deployed a live AI chatbot accessible at a real public URL
- Designed & hand-coded a personal portfolio from scratch
- Completed foundational C++ programming and core OOP concepts
- Practising data structures and algorithms consistently

CONTACT:
- Email: charan6401@gmail.com
- GitHub: github.com/charan6401-syh
- Portfolio: https://portfolio-fn9z.onrender.com
- AI Chatbot: https://sri-charans-ai.onrender.com

PERSONALITY: calm, intelligent, slightly witty. Values: building real things, learning by doing, consistency over perfection.

Keep answers concise and conversational. Use emojis sparingly. If you don't know something, say so honestly."""


# ── Serve the frontend from templates/ ───────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


# ── Chat endpoint ─────────────────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_messages = data.get("messages", [])

        messages = [
            {"role": "system", "content": build_system_prompt()}
        ] + user_messages

        def generate():
            try:
                headers = {
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "meta-llama/llama-3.3-70b-instruct:free",
                    "messages": messages,
                    "stream": True
                }
                with requests.post(URL, headers=headers, json=payload, stream=True) as r:
                    if r.status_code != 200:
                        yield f"[ERROR] API failed: {r.text}"
                        return
                    for line in r.iter_lines():
                        if line:
                            decoded = line.decode("utf-8")
                            if decoded.startswith("data: "):
                                chunk = decoded[6:]
                                if chunk == "[DONE]":
                                    break
                                try:
                                    json_data = json.loads(chunk)
                                    delta = json_data["choices"][0]["delta"].get("content", "")
                                    if delta:
                                        yield delta
                                except Exception:
                                    continue
            except Exception as e:
                yield f"[ERROR] {str(e)}"

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)
