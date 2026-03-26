from flask import Flask, render_template, request, Response, stream_with_context
import requests
import json
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# ── Load portfolio data once at startup ──────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE_DIR, "portfolio_data.json"), "r") as f:
    PORTFOLIO = json.load(f)

PORTFOLIO_TEXT = json.dumps(PORTFOLIO, indent=2)

SYSTEM_PROMPT = f"""You are Sensei — the personal AI assistant on Sri Charan's portfolio website.
You speak ON BEHALF of Sri Charan in first person ("I built...", "My goal is...").
Tone: calm, intelligent, slightly witty. Never robotic.

Answer ONLY using the portfolio data below. Do not make anything up.
If info is not in the data, say so and invite them to reach out via email: charan6401@gmail.com

PORTFOLIO DATA:
{PORTFOLIO_TEXT}

Rules:
- Speak as Sri Charan's voice/representative.
- Be concise unless detail is asked for.
- Share real URLs from the data when relevant.
- Never invent skills, projects, or achievements not listed."""


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    req_data = request.json
    user_messages = req_data.get("messages", [])

    # Belt-and-suspenders: for the very first user message, prepend context
    # directly into the user turn so models that ignore system prompts still work
    augmented_messages = []
    for i, msg in enumerate(user_messages):
        if i == 0 and msg["role"] == "user":
            augmented_messages.append({
                "role": "user",
                "content": (
                    f"[Context: You are Sensei, Sri Charan's portfolio AI. "
                    f"Answer only from this data: {PORTFOLIO_TEXT}]\n\n"
                    f"{msg['content']}"
                )
            })
        else:
            augmented_messages.append(msg)

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + augmented_messages

    def generate():
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://portfolio-fn9z.onrender.com",
                    "X-Title": "Sri Charan Portfolio AI"
                },
                json={
                    "model": "mistralai/mistral-7b-instruct:free",
                    "stream": True,
                    "messages": full_messages
                },
                stream=True
            )

            full_content = ""

            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")

                    if decoded.startswith("data: "):
                        chunk = decoded[6:]

                        if chunk == "[DONE]":
                            break

                        try:
                            chunk_data = json.loads(chunk)
                            delta = chunk_data["choices"][0]["delta"]

                            if "content" in delta and delta["content"]:
                                token = delta["content"]
                                full_content += token
                                yield f"data: {token}\n\n"

                        except Exception:
                            continue

            yield f"event: end\ndata: done\n\n"

        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
