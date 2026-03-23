from flask import Flask, request, jsonify, send_from_directory
import requests
import json
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "YOUR_OPENROUTER_API_KEY")
MODEL = "minimax/minimax-m2.5:free"

SYSTEM_PROMPT = """You are Sri Charan's AI — a smart, friendly assistant built for Jangam Sri Charan.
(keep your full prompt here unchanged)
"""

@app.route("/")
def index():
    return send_from_directory("templates", "index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "Missing messages field"}), 400

    messages = data["messages"]

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages
        ],
        "reasoning": {"enabled": True},
        "max_tokens": 200
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
            return jsonify({"error": "Invalid API key"}), 401
        elif status == 429:
            return jsonify({"error": "Rate limit reached"}), 429
        else:
            return jsonify({"error": f"API error {status}"}), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ✅ FIXED PART (IMPORTANT FOR RENDER)
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
