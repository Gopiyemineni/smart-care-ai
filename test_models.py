import asyncio
import websockets
import json

API_KEY = "AIzaSyDoCANRv2mX-nuChfU0Xt1dx248OJSbIqk"

async def test_model(model_name, api_version):
    URL = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.{api_version}.GenerativeService.BidiGenerateContent?key={API_KEY}"
    print(f"Testing model={model_name} with version={api_version}...")
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
            reply = await asyncio.wait_for(ws.recv(), timeout=3.0)
            print(f"SUCCESS! Response: {reply[:100]}")
            return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False

async def main():
    models = ["gemini-2.0-flash-exp", "gemini-2.0-flash-live", "gemini-2.0-flash-live-001", "gemini-2.5-flash", "gemini-3.1-flash-live-preview"]
    versions = ["v1alpha", "v1beta"]
    for m in models:
        for v in versions:
            try:
                await test_model(m, v)
            except Exception as loop_e:
                print(f"Loop Exception: {loop_e}")
            print("-" * 40)

asyncio.run(main())
