from flask import Flask, render_template, request, Response, stream_with_context
import requests
import json

app = Flask(__name__)

API_KEY = "YOUR_OPENROUTER_API_KEY"
URL = "https://openrouter.ai/api/v1/chat/completions"


# ✅ Load JSON (ONLY SOURCE OF TRUTH)
def load_profile():
    with open("data/profile.json", "r", encoding="utf-8") as f:
        return json.load(f)


# ✅ GENERIC SYSTEM PROMPT (NO HARD-CODED FIELDS)
def build_system_prompt(profile_data):
    return f"""
You are a personal AI assistant for the person described below.

Instructions:
- Use ONLY the provided data to answer
- Do NOT assume or hallucinate missing info
- Speak professionally, clearly, and confidently
- If information is not available, say "I don't have that information yet"

Data:
{json.dumps(profile_data, indent=2)}
"""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_messages = data.get("messages", [])

    # ✅ Always reload JSON (so updates reflect instantly)
    profile_data = load_profile()

    messages = [
        {"role": "system", "content": build_system_prompt(profile_data)}
    ] + user_messages


    def generate():
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "mistralai/mixtral-8x7b-instruct",
            "messages": messages,
            "stream": True
        }

        with requests.post(URL, headers=headers, json=payload, stream=True) as r:
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
                        except:
                            continue

    return Response(stream_with_context(generate()), content_type="text/plain")


if __name__ == "__main__":
    app.run(debug=True, threaded=True)
