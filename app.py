from flask import Flask, request, Response, stream_with_context, render_template
import requests
import json
import os
import re

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY", "your_api_key_here")
URL = "https://openrouter.ai/api/v1/chat/completions"

PORTFOLIO_URL = "https://portfolio-fn9z.onrender.com"

FREE_MODELS = [
    "openrouter/free",
    "openai/gpt-oss-120b:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-8b:free",
    "mistralai/mistral-7b-instruct:free",
]

REASONING_MODELS = {"openai/gpt-oss-120b:free"}

# ── Portfolio context cache ────────────────────────────────────────────────
_portfolio_cache = {"text": "", "ts": 0}
CACHE_TTL = 3 * 3600  # 3 hours


def scrape_portfolio_text():
    """Fetch and strip the live portfolio page to plain text for context."""
    import time
    now = time.time()
    if _portfolio_cache["text"] and (now - _portfolio_cache["ts"]) < CACHE_TTL:
        return _portfolio_cache["text"]
    try:
        r = requests.get(PORTFOLIO_URL, timeout=10, headers={"User-Agent": "PortfolioBot/1.0"})
        if r.ok:
            # Strip HTML tags, compress whitespace
            text = re.sub(r"<[^>]+>", " ", r.text)
            text = re.sub(r"\s{2,}", " ", text).strip()
            text = text[:6000]  # keep context manageable
            _portfolio_cache["text"] = text
            _portfolio_cache["ts"] = now
            return text
    except Exception as e:
        print(f"Portfolio fetch failed: {e}")
    return ""


def build_system_prompt():
    live_context = scrape_portfolio_text()
    portfolio_section = ""
    if live_context:
        portfolio_section = f"""

LIVE PORTFOLIO DATA (scraped in real-time from {PORTFOLIO_URL}):
---
{live_context}
---
Prefer this live data when it conflicts with the static info below, as it reflects Sri Charan's most current updates.
"""

    return f"""You are an intelligent, friendly AI assistant for Sri Charan's personal portfolio chatbot.
Answer questions about Sri Charan naturally, warmly, and in a conversational tone.
{portfolio_section}
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
   A modern social platform for students — real-time messaging, friend requests, profiles.
   Status: In Development | Tech: React/Next.js, TypeScript, Supabase, Real-time APIs

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

Keep answers concise and conversational. Use emojis sparingly.
If Sri Charan has updated his portfolio with new info, reflect that in your answers.
If you don't know something, say so honestly."""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/ping")
def ping():
    return {"status": "ok", "version": "3.0", "fallbacks": FREE_MODELS}


@app.route("/proxy-portfolio")
def proxy_portfolio():
    """Relay the portfolio page so the frontend can read live content cross-origin."""
    try:
        target = request.args.get("url", PORTFOLIO_URL)
        # Safety: only allow our own portfolio domain
        if "portfolio-fn9z.onrender.com" not in target:
            return "Forbidden", 403
        r = requests.get(target, timeout=10, headers={"User-Agent": "PortfolioBot/1.0"})
        # Strip HTML, return plain text
        text = re.sub(r"<[^>]+>", " ", r.text)
        text = re.sub(r"\s{2,}", " ", text).strip()
        return Response(text[:8000], content_type="text/plain")
    except Exception as e:
        return str(e), 500


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
                                delta = json_data["choices"][0]["delta"].get("content", "")
                                if delta:
                                    streamed_any = True
                                    yield delta
                            except (json.JSONDecodeError, KeyError, IndexError):
                                continue

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

            print("All models failed. Sending error to client.")
            yield "⚠️ All models are currently unavailable. Please try again in a moment."

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)
    
