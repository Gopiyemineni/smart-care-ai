import requests
import base64

res = requests.post("http://127.0.0.1:8000/voice/tts", json={"text": "నమస్కారం", "voice": "female"})
if res.status_code == 200:
    b64 = res.json().get("audio_base64")
    print("Success! MP3 base64 length:", len(b64))
else:
    print("Error:", res.status_code, res.text)
