from flask import Flask, render_template, request, Response, stream_with_context
import requests
import json

app = Flask(__name__)

API_KEY = "YOUR_API_KEY"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    messages = data.get("messages", [])
    jarvis = data.get("jarvis", False)

    if jarvis:
        messages.insert(0, {
            "role": "system",
            "content": "You are Sensei, personal AI of Sri Charan. Talk calm, intelligent, slightly witty."
        })

    def generate():
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "minimax/minimax-m2.5:free",
                "stream": True,
                "reasoning": {"enabled": True},
                "messages": messages
            },
            stream=True
        )

        full_content = ""
        reasoning_data = None

        for line in response.iter_lines():
            if line:
                decoded = line.decode("utf-8")

                if decoded.startswith("data: "):
                    chunk = decoded.replace("data: ", "")

                    if chunk == "[DONE]":
                        break

                    try:
                        data = json.loads(chunk)
                        delta = data["choices"][0]["delta"]

                        if "content" in delta:
                            token = delta["content"]
                            full_content += token
                            yield f"data: {token}\n\n"

                        if "reasoning_details" in delta:
                            reasoning_data = delta["reasoning_details"]

                    except:
                        continue

        yield f"event: end\ndata: {json.dumps({'content': full_content, 'reasoning': reasoning_data})}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(debug=True)
