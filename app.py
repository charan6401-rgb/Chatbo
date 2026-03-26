from flask import Flask, render_template, request, Response, stream_with_context
import requests
import json
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    req_data = request.json
    messages = req_data.get("messages", [])
    jarvis = req_data.get("jarvis", False)

    if jarvis:
        messages.insert(0, {
            "role": "system",
            "content": "You are Sensei, personal AI of Sri Charan. Talk calm, intelligent, slightly witty."
        })

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
                    "messages": messages
                },
                stream=True
            )

            full_content = ""

            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")

                    if decoded.startswith("data: "):
                        chunk = decoded[6:]  # strip "data: "

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
