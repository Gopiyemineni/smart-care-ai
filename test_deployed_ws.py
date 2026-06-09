import asyncio
import websockets
import json

URL = "wss://smart-care-backend-690805058186.us-central1.run.app/ws/detect"

async def main():
    print(f"Connecting to deployed WS at {URL}...")
    try:
        async with websockets.connect(URL) as ws:
            print("Connected successfully!")
            # Send a dummy frame
            dummy_frame = {"frame": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}
            await ws.send(json.dumps(dummy_frame))
            print("Frame sent. Waiting for response...")
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            print(f"Received response: {response}")
    except Exception as e:
        print(f"Connection failed: {e}")

asyncio.run(main())
