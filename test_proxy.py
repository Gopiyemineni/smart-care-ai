import asyncio
import websockets
import json

async def test_proxy():
    print("Connecting to local proxy...")
    async with websockets.connect("ws://127.0.0.1:8000/ws/live-voice") as ws:
        print("Connected!")
        ready = await ws.recv()
        print("Ready:", ready)
        
        # Send text
        await ws.send(json.dumps({"type": "text", "text": "Hello, say namaskaram"}))
        
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
                data = json.loads(msg)
                if data["type"] == "text":
                    print("AI Text:", data["text"])
                elif data["type"] == "audio":
                    print("AI Audio chunks received!")
                elif data["type"] == "error":
                    print("AI Error:", data)
            except asyncio.TimeoutError:
                print("Done receiving")
                break

asyncio.run(test_proxy())
