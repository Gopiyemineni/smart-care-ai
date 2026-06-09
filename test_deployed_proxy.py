import asyncio
import websockets
import json

URL = "wss://smart-care-backend-690805058186.us-central1.run.app/ws/live-voice-proxy"

async def main():
    print(f"Connecting to deployed Live Voice Proxy at {URL}...")
    try:
        async with websockets.connect(URL) as ws:
            print("Connected successfully!")
            setup = {
                "setup": {
                    "model": "models/gemini-2.0-flash-exp",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"]
                    }
                }
            }
            await ws.send(json.dumps(setup))
            print("Setup message sent. Waiting for response...")
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"Received response: {response}")
            except Exception as e:
                print(f"Failed to receive response within timeout: {e}")
    except Exception as e:
        print(f"Connection failed: {e}")

asyncio.run(main())
