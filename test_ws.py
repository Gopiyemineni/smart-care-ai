import asyncio
import websockets
import json
import base64
import os

API_KEY = "AIzaSyDoCANRv2mX-nuChfU0Xt1dx248OJSbIqk"
URL = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}"

async def test_live():
    print("Connecting...")
    async with websockets.connect(URL) as ws:
        print("Connected!")
        
        setup = {
            "setup": {
                "model": "models/gemini-2.0-flash-exp",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": "Kore"
                            }
                        }
                    }
                },
                "systemInstruction": { "parts": [{ "text": "Say hello world" }] },
                "tools": [{
                  "functionDeclarations": [{
                    "name": "generate_patient_token",
                    "description": "Call ONLY when patient confirms they have no more issues. Generates a queue token.",
                    "parameters": {
                      "type": "object",
                      "properties": {
                        "priority": { "type": "string", "enum": ["emergency", "high", "normal"], "description": "Medical priority based on symptoms." },
                        "patient_name": { "type": "string", "description": "Name of the patient." },
                        "closing_message": { "type": "string", "description": "Polite final message to patient." }
                      },
                      "required": ["priority", "patient_name", "closing_message"]
                    }
                  }]
                }]
            }
        }
        await ws.send(json.dumps(setup))
        
        msg1 = await ws.recv()
        print("Reply 1:", msg1)
        
        # Send initial text
        client_content = {
            "clientContent": {
                "turns": [{ "role": "user", "parts": [{ "text": "Hello! Please reply with audio." }] }],
                "turnComplete": True
            }
        }
        await ws.send(json.dumps(client_content))
        
        # Send empty audio chunk
        audio_msg = {
            "realtimeInput": {
                "mediaChunks": [{ "mimeType": "audio/pcm;rate=16000", "data": "A" * 100 }]
            }
        }
        await ws.send(json.dumps(audio_msg))
        
        while True:
            try:
                reply = await asyncio.wait_for(ws.recv(), timeout=5.0)
                if isinstance(reply, bytes):
                    data = json.loads(reply.decode('utf-8'))
                    print("Parsed JSON from bytes! Keys:", data.keys())
                    if "serverContent" in data:
                        parts = data["serverContent"].get("modelTurn", {}).get("parts", [])
                        for p in parts:
                            if "text" in p:
                                print("AI TEXT:", p["text"])
                            if "inlineData" in p:
                                print("AI AUDIO chunk received!")
                else:
                    data = json.loads(reply)
                    if "serverContent" in data:
                        parts = data["serverContent"].get("modelTurn", {}).get("parts", [])
                        for p in parts:
                            if "text" in p:
                                print("AI TEXT:", p["text"])
                            if "inlineData" in p:
                                print("AI AUDIO chunk received!")
            except asyncio.TimeoutError:
                print("Timeout waiting for more.")
                break

asyncio.run(test_live())
