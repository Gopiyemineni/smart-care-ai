import asyncio
import websockets
import json

URL = "wss://smart-care-backend-690805058186.us-central1.run.app/ws/live-voice"

async def main():
    print(f"Connecting to deployed live-voice endpoint at {URL}...")
    try:
        async with websockets.connect(URL) as ws:
            print("Connected successfully!")
            # The backend live-voice sends a "ready" message first:
            # await websocket.send_json({"type": "ready"})
            try:
                ready_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"Ready message: {ready_msg}")
                
                # Let's send a text message
                # If msg_type == "text":
                #    await session.send_client_content(...)
                text_msg = {"type": "text", "text": "నమస్కారం"}
                await ws.send(json.dumps(text_msg))
                print("Sent text. Waiting for response...")
                
                for _ in range(5):
                    reply = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    data = json.loads(reply)
                    print(f"Received from Gemini Live: {data.get('type')} - {data.get('text') or 'audio bytes'}")
            except asyncio.TimeoutError:
                print("TIMEOUT: No response received")
            except Exception as e:
                print(f"READ FAILED: {e}")
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")

asyncio.run(main())
