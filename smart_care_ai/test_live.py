import asyncio
import websockets
import json
import time

API_KEY = "AIzaSyDoCANRv2mX-nuChfU0Xt1dx248OJSbIqk"
URI = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={API_KEY}"
MODEL = "models/gemini-3.1-flash-live-preview"

SYSTEM = """You are Smart Care Hospital AI receptionist. You speak friendly Telugu.
Ask the patient's name, then their symptoms, then call generate_patient_token tool.
CRITICAL: Keep responses SHORT (1-2 sentences max). Do NOT narrate your thoughts."""

TOOLS = [{
    "functionDeclarations": [{
        "name": "generate_patient_token",
        "description": "Call this when patient says no more symptoms.",
        "parameters": {
            "type": "object",
            "properties": {
                "priority": {"type": "string", "enum": ["emergency","high","normal"]},
                "patient_name": {"type": "string"},
                "closing_message": {"type": "string"}
            },
            "required": ["priority","patient_name","closing_message"]
        }
    }]
}]

async def main():
    setup = {
        "setup": {
            "model": MODEL,
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Aoede"}}}
            },
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "tools": TOOLS
        }
    }
    print("Connecting...")
    async with websockets.connect(URI, open_timeout=10) as ws:
        await ws.send(json.dumps(setup))
        r = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
        if r.get("setupComplete") is None:
            print("SETUP FAILED:", json.dumps(r)[:300])
            return
        print("Setup OK! Sending first message...")

        trigger = {"clientContent": {"turns": [{"role": "user", "parts": [{"text": "Say namaskaram and ask for name"}]}], "turnComplete": True}}
        await ws.send(json.dumps(trigger))
        start = time.time()
        audio_chunks = 0

        for _ in range(40):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                d = json.loads(raw)
                parts = d.get("serverContent", {}).get("modelTurn", {}).get("parts", [])
                for p in parts:
                    if p.get("inlineData"):
                        audio_chunks += 1
                        if audio_chunks == 1:
                            print(f"First audio: {(time.time()-start)*1000:.0f}ms")
                    if p.get("text"):
                        print(f"AI text: {p['text'][:80]}")
                if d.get("serverContent", {}).get("turnComplete"):
                    print(f"Turn done: {(time.time()-start)*1000:.0f}ms | audio_chunks={audio_chunks}")
                    break
            except asyncio.TimeoutError:
                print(f"TIMEOUT: {(time.time()-start)*1000:.0f}ms | audio_chunks={audio_chunks}")
                break

asyncio.run(main())
