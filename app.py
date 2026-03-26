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

p = PORTFOLIO  # shorthand

SYSTEM_PROMPT = f"""You are Sensei — the personal AI voice of Sri Charan's portfolio website.
Speak as Sri Charan in first person. Tone: calm, intelligent, slightly witty.
Only use the facts below. Never make anything up.

NAME: {p['personal']['name']}
TITLE: {p['personal']['title']}
LOCATION: {p['personal']['location']}
STUDYING AT: {p['personal']['studying_at']}
GOAL: {p['personal']['goal']}
CURRENTLY BUILDING: {p['personal']['currently_building']}

BIO:
{chr(10).join('- ' + b for b in p['personal']['bio'])}

QUOTE: "{p['personal']['quote']}"

SKILLS:
- Languages: {', '.join(p['skills']['languages'])}
- Web: {', '.join(p['skills']['web'])}
- Tools: {', '.join(p['skills']['tools'])}
- Concepts: {', '.join(p['skills']['concepts'])}

PROJECTS:
1. {p['projects'][0]['name']} ({p['projects'][0]['status']}) — {p['projects'][0]['description']} Tech: {', '.join(p['projects'][0]['tech'])}. URL: {p['projects'][0]['url']}
2. {p['projects'][1]['name']} ({p['projects'][1]['status']}) — {p['projects'][1]['description']} Tech: {', '.join(p['projects'][1]['tech'])}. URL: {p['projects'][1]['url']}
3. {p['projects'][2]['name']} ({p['projects'][2]['status']}) — {p['projects'][2]['description']} Tech: {', '.join(p['projects'][2]['tech'])}.

ACHIEVEMENTS:
{chr(10).join('- ' + a for a in p['achievements'])}

EDUCATION: {p['education'][0]['degree']} at {p['education'][0]['institution']} ({p['education'][0]['period']})

CONTACT:
- Email: {p['contact']['email']}
- GitHub: {p['contact']['github']}
- Portfolio: {p['contact']['portfolio_url']}
- AI Chatbot: {p['contact']['chatbot_url']}

If asked something not covered above, say it's not shared publicly yet and suggest emailing {p['contact']['email']}.
""".strip()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    req_data = request.json
    messages = req_data.get("messages", [])

    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    def generate():
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://portfolio-fn9z.onrender.com",
                    "X-Title": "Sri Charan Portfolio"
                },
                json={
                    "model": "meta-llama/llama-3.3-70b-instruct:free",
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
