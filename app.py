from flask import Flask, request, Response, stream_with_context, render_template
import requests
import json
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY", "your_api_key_here")
URL = "https://openrouter.ai/api/v1/chat/completions"

# openrouter/free = official OpenRouter auto-router (March 2026, confirmed working)
# It picks a live free model automatically — no more 404 or 429 from bad model IDs
FREE_MODELS = [
    "openrouter/free",                           # primary: auto-picks best free model
    "meta-llama/llama-3.3-70b-instruct:free",    # fallback 1
    "google/gemma-3-27b-it:free",                # fallback 2
    "mistralai/mistral-7b-instruct:free",        # fallback 3
    "qwen/qwen3-8b:free",                        # fallback 4
]


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
- Concepts: Data Structures, OOP, Problem Solving

PROJECTS:
1. Sri Charan's AI Chatbot (LIVE)
   A fully deployed AI-powered chatbot — live on the internet, not a tutorial project.
   URL: https://sri-charans-ai.onrender.com | Tech: AI, Python, Render

2. Portfolio Website (LIVE)
   Hand-coded from scratch. No templates. Fully responsive with dark red & gold palette.
   URL: https://portfolio-fn9z.onrender.com | Tech: HTML, CSS, JavaScript

3. Coming Next — DSA Visualizer + Python automation tool (in progress)
   Tech: C++, Python

ACHIEVEMENTS:
- Deployed a live AI chatbot accessible at a real public URL
- Hand-coded a personal portfolio from scratch
- Completed foundational C & OOP concepts
- Consistently practising data structures and algorithms

CONTACT:
- Email: charan6401@gmail.com
- GitHub: github.com/charan6401-syh
- Portfolio: https://portfolio-fn9z.onrender.com
- AI Chatbot: https://sri-charans-ai.onrender.com

Keep answers concise and conversational. Use emojis sparingly. If you don't know something, say so honestly."""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/ping")
def ping():
    return {"status": "ok", "model": "openrouter/free", "version": "2.0"}


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_messages = data.get("messages", [])
        messages = [
            {"role": "system", "content": build_system_prompt()}
        ] + user_messages

        def generate():
            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sri-charans-ai.onrender.com",
                "X-Title": "Sri Charan AI Chatbot"
            }

            for model in FREE_MODELS:
                try:
                    payload = {
                        "model": model,
                        "messages": messages,
                        "stream": True
                    }
                    with requests.post(URL, headers=headers, json=payload, stream=True, timeout=30) as r:
                        if r.status_code in (429, 404, 503):
                            continue  # rate limited or unavailable — try next

                        if r.status_code != 200:
                            continue  # any other error — try next

                        # Stream chunks back to frontend
                        for line in r.iter_lines():
                            if line:
                                decoded = line.decode("utf-8")
                                if decoded.startswith("data: "):
                                    chunk = decoded[6:]
                                    if chunk.strip() == "[DONE]":
                                        return
                                    try:
                                        json_data = json.loads(chunk)
                                        delta = json_data["choices"][0]["delta"].get("content", "")
                                        if delta:
                                            yield delta
                                    except Exception:
                                        continue
                        return  # streamed successfully — stop trying other models

                except Exception:
                    continue  # network/timeout error — try next model

            # All models failed
            yield "⚠️ All models are currently unavailable. Please try again in a moment."

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)
    
