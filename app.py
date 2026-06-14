from flask import Flask, request, Response, stream_with_context, render_template
import requests
import json
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY", "your_api_key_here")
URL = "https://openrouter.ai/api/v1/chat/completions"

FREE_MODELS = [
    "openrouter/free",
    "openai/gpt-oss-120b:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-8b:free",
    "mistralai/mistral-7b-instruct:free",
]

REASONING_MODELS = {"openai/gpt-oss-120b:free"}


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

3. Mates (Upcoming Project)

Mates is an upcoming social platform being built by Sri Charan with a focus on meaningful connections and real-time interaction.

Unlike traditional social apps that prioritize endless scrolling, Mates aims to create a cleaner and more engaging space where users can connect with friends, chat instantly, manage friend requests, and stay connected through a modern and responsive interface.

The project is currently under active development and serves as one of Sri Charan's most ambitious full-stack projects so far. It is being built to strengthen his skills in frontend development, backend architecture, authentication systems, databases, and real-time communication.

Planned Features:

* User authentication and account management
* Friend requests and friend management
* Real-time messaging
* Online/offline status indicators
* User profiles and customization
* Responsive design for desktop and mobile
* Secure backend and database integration

Status: In Development 🚧

Tech Stack:

* React / Next.js
* JavaScript / TypeScript
* Supabase
* Real-time APIs
* Modern web technologies

Goal:
To build a complete social networking experience while learning how large-scale web applications are designed, developed, and deployed.


ACHIEVEMENTS:
- Deployed a live AI chatbot accessible at a real public URL
- Hand-coded a personal portfolio from scratch
- Completed foundational C & OOP concepts
- Consistently practising data structures and algorithms

CONTACT:
- Email: charan6401@gmail.com
- GitHub: https://github.com/charan6401-rgb
- Portfolio: https://portfolio-fn9z.onrender.com
- AI Chatbot: https://sri-charans-ai.onrender.com

Keep answers concise and conversational. Use emojis sparingly. If you don't know something, say so honestly."""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/ping")
def ping():
    return {"status": "ok", "version": "2.1", "fallbacks": FREE_MODELS}


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_messages = data.get("messages", [])
        messages = [{"role": "system", "content": build_system_prompt()}] + user_messages

        def generate():
            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sri-charans-ai.onrender.com",
                "X-Title": "Sri Charan AI Chatbot",
            }

            for index, model in enumerate(FREE_MODELS):
                if index == 0:
                    print(f"Trying model: {model}")
                else:
                    print(f"Switching to fallback...")
                    print(f"Trying model: {model}")

                try:
                    payload = {
                        "model": model,
                        "messages": messages,
                        "stream": True,
                    }

                    if model in REASONING_MODELS:
                        payload["reasoning"] = {"enabled": True}

                    with requests.post(
                        URL,
                        headers=headers,
                        json=payload,
                        stream=True,
                        timeout=30,
                    ) as r:
                        if r.status_code in (404, 429, 503):
                            print(f"Model failed: {model} (HTTP {r.status_code})")
                            continue

                        if r.status_code != 200:
                            print(f"Model failed: {model} (HTTP {r.status_code})")
                            continue

                        # Streamed successfully — begin forwarding chunks
                        print(f"Using model: {model}")
                        streamed_any = False

                        for line in r.iter_lines():
                            if not line:
                                continue
                            decoded = line.decode("utf-8")
                            if not decoded.startswith("data: "):
                                continue
                            chunk = decoded[6:]
                            if chunk.strip() == "[DONE]":
                                return
                            try:
                                json_data = json.loads(chunk)
                                # Skip reasoning/thinking tokens — only forward content
                                delta = json_data["choices"][0]["delta"].get("content", "")
                                if delta:
                                    streamed_any = True
                                    yield delta
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue

                        # If we exited the loop without [DONE] but did stream content,
                        # treat it as success. If nothing was streamed, try next model.
                        if streamed_any:
                            return

                        print(f"Model failed: {model} (empty response)")

                except requests.exceptions.Timeout:
                    print(f"Model failed: {model} (timeout)")
                    continue
                except requests.exceptions.ConnectionError:
                    print(f"Model failed: {model} (connection error)")
                    continue
                except Exception as e:
                    print(f"Model failed: {model} (unexpected error: {e})")
                    continue

            # All models exhausted
            print("All models failed. Sending error to client.")
            yield "⚠️ All models are currently unavailable. Please try again in a moment."

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)
