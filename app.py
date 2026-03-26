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
                                except Exception as e:
                                    continue

            except Exception as e:
                yield f"[ERROR] {str(e)}"

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return {"error": str(e)}, 500
