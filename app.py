from flask import Flask, render_template, request, Response, stream_with_context
import requests
import json
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# ── Load portfolio data ───────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE_DIR, "portfolio_data.json"), "r") as f:
    PORTFOLIO = json.load(f)

p = PORTFOLIO

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

If asked something not covered above, say it's not shared publicly yet and suggest emailing {p['contact']['email']}.
""".strip()

# Model fallback chain — tries each in order until one works
MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
]


def try_model(model, full_messages):
    """Try a single model, return (response_obj, error_str)."""
    try:
        resp = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://portfolio-fn9z.onrender.com",
                "X-Title": "Sri Charan Portfolio"
            },
            json={
                "model": model,
                "stream": True,
                "messages": full_messages
            },
            stream=True,
            timeout=30
        )
        # Peek at first line to detect errors
        first_line = None
        for raw in resp.iter_lines():
            if raw:
                first_line = raw.decode("utf-8")
                break

        if first_line is None:
            return None, f"{model}: empty response"

        # Check for error JSON in first line
        if first_line.startswith("data: "):
            chunk = first_line[6:]
            if chunk != "[DONE]":
                try:
                    data = json.loads(chunk)
                    if "error" in data:
                        return None, f"{model}: {data['error']}"
                    # Has valid content structure — good
                    delta = data.get("choices", [{}])[0].get("delta", {})
                    # Return the response + the already-read first_line
                    return (resp, first_line), None
                except Exception:
                    pass

        return (resp, first_line), None

    except Exception as e:
        return None, f"{model}: {str(e)}"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    req_data = request.json
    messages = req_data.get("messages", [])
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    def generate():
        # Try each model in fallback chain
        working = None
        first_line_cache = None
        errors = []

        for model in MODELS:
            result, err = try_model(model, full_messages)
            if result:
                working, first_line_cache = result
                print(f"[OK] Using model: {model}", flush=True)
                break
            else:
                print(f"[FAIL] {err}", flush=True)
                errors.append(err)

        if not working:
            yield f"data: Sorry, all models are currently unavailable. Errors: {' | '.join(errors)}\n\n"
            yield f"event: end\ndata: done\n\n"
            return

        full_content = ""

        def stream_lines(resp_obj, cached_first):
            """Yield decoded lines from response, prepending cached first line."""
            yield cached_first
            for raw in resp_obj.iter_lines():
                if raw:
                    yield raw.decode("utf-8")

        try:
            for decoded in stream_lines(working, first_line_cache):
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

        except Exception as e:
            yield f"data: Stream error: {str(e)}\n\n"

        yield f"event: end\ndata: done\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


# ── Debug route — visit /debug in browser to test API key + models ───────────
@app.route("/debug")
def debug():
    if not API_KEY:
        return {"error": "OPENROUTER_API_KEY env var is not set"}, 500

    results = {}
    test_messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say only: hello"}
    ]

    for model in MODELS:
        try:
            resp = requests.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"model": model, "stream": False, "messages": test_messages, "max_tokens": 10},
                timeout=15
            )
            body = resp.json()
            if "error" in body:
                results[model] = f"ERROR: {body['error']}"
            else:
                content = body["choices"][0]["message"]["content"]
                results[model] = f"OK: {content}"
        except Exception as e:
            results[model] = f"EXCEPTION: {str(e)}"

    return {"api_key_set": bool(API_KEY), "models": results}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
