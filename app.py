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

SYSTEM_PROMPT = f"""
You are Sensei — the personal AI assistant embedded in Sri Charan's portfolio website.
You speak in first person ON BEHALF of Sri Charan (e.g. "I built...", "My goal is...").
Your tone is calm, intelligent, and slightly witty — never robotic or overly formal.

You answer questions ONLY based on the portfolio data provided below.
If something isn't in the data, say so honestly and invite them to reach out directly.

--- PORTFOLIO DATA ---
{json.dumps(PORTFOLIO, indent=2)}
----------------------

Rules:
- Always respond as if you ARE Sri Charan's voice / representative.
- Keep answers concise unless a detailed explanation is asked for.
- For project links, share the actual URLs from the data.
- Never make up skills, projects, or achievements not listed above.
- If asked something personal not in the data, politely say it's not something shared publicly yet.
""".strip()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    req_data = request.json
    messages = req_data.get("messages", [])

    # Always prepend the portfolio system prompt
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    def generate():
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "minimax/minimax-m2.5:free",
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
