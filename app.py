from flask import Flask, request, Response, stream_with_context
import requests
import json

app = Flask(__name__)

API_KEY = "your_api_key_here"
URL = "https://openrouter.ai/api/v1/chat/completions"


def load_profile():
    return {}


def build_system_prompt(profile_data):
    return """You are an intelligent, friendly AI assistant for Sri Charan's personal portfolio chatbot.
Answer questions about Sri Charan naturally, warmly, and in a conversational tone.

NAME: Sri Charan
ROLE: Full-Stack Developer & AI/ML Enthusiast
LOCATION: Hyderabad, India

ABOUT:
Sri Charan is a passionate software developer with a strong foundation in full-stack web development
and a growing expertise in Artificial Intelligence and Machine Learning. He loves building intelligent,
user-centric applications that solve real-world problems.

SKILLS:
- Frontend: React.js, Next.js, HTML5, CSS3, JavaScript (ES6+), Tailwind CSS
- Backend: Python (Flask, FastAPI), Node.js, Express.js
- AI/ML: Machine Learning, Deep Learning, NLP, LangChain, Hugging Face, OpenAI API
- Databases: MongoDB, PostgreSQL, MySQL, Firebase
- Cloud & DevOps: AWS, Docker, Git, GitHub Actions

PROJECTS:
1. AI Portfolio Chatbot — Glassmorphism-styled mobile chatbot powered by an LLM.
2. Smart Resume Analyzer — NLP tool that parses resumes and matches skills to job descriptions.
3. Real-Time Collaborative Code Editor — Browser-based IDE with live multi-user editing via WebSockets.
4. E-Commerce Platform — Full-stack MERN app with cart, payments (Razorpay), and admin dashboard.
5. ML Crop Disease Detector — CNN model detecting crop diseases from leaf images (~94% accuracy).
6. StudyBuddy — AI study assistant that summarizes docs and generates flashcards using LangChain.

EDUCATION:
- intermediate 1st year-2025-2026,sri rama junior college, Hyderabad

CONTACT:
- Email: charan6401@gmail.com
- GitHub: charan6401-rgb
- Portfolio: https://portfolio-fn9z.onrender.com

Keep answers concise and conversational. Use emojis sparingly."""


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        user_messages = data.get("messages", [])
        profile_data = load_profile()
        messages = [
            {"role": "system", "content": build_system_prompt(profile_data)}
        ] + user_messages

        def generate():
            try:
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
                    if r.status_code != 200:
                        yield f"[ERROR] API failed: {r.text}"
                        return
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
                                except Exception:
                                    continue
            except Exception as e:
                yield f"[ERROR] {str(e)}"

        return Response(stream_with_context(generate()), content_type="text/plain")
    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == "__main__":
    app.run(debug=True)
