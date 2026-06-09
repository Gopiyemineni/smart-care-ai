import asyncio
import websockets
import json

URL = "wss://smart-care-backend-690805058186.us-central1.run.app/ws/live-voice-proxy"

async def test_model_via_proxy(model_name):
    print(f"Testing model={model_name} via deployed proxy...")
    try:
        async with websockets.connect(URL) as ws:
            setup = {
                "setup": {
                    "model": f"models/{model_name}",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"]
                    }
                }
            }
            await ws.send(json.dumps(setup))
            # Wait for response with timeout
            try:
                reply = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"RESPONSE: {reply[:200]}")
            except asyncio.TimeoutError:
                print("TIMEOUT: No response received")
            except Exception as e:
                print(f"READ FAILED: {e}")
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")

async def main():
    models = ["gemini-2.0-flash-exp", "gemini-2.0-flash-live", "gemini-2.0-flash-live-001", "gemini-2.5-flash", "gemini-3.1-flash-live-preview"]
    for m in models:
        await test_model_via_proxy(m)
        print("-" * 40)

asyncio.run(main())
