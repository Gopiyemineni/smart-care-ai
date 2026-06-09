import asyncio
import os
import google.genai as genai
from google.genai import types

PROJECT_ID = "invice-test-project"
LOCATION = "us-central1"
client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

async def test_model(model_name):
    print(f"Testing model: {model_name}...")
    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
        )
        async with client.aio.live.connect(
            model=model_name,
            config=config,
        ) as session:
            print(f"SUCCESS: Connected to: {model_name}")
            return True
    except Exception as e:
        print(f"FAILED for {model_name}: {e}")
        return False

async def main():
    models = [
        "gemini-2.5-flash-native-audio",
        "gemini-live-2.5-flash-preview",
        "gemini-2.5-flash-live",
        "gemini-2.5-flash-native-audio-preview",
        "gemini-2.5-flash-preview",
    ]
    for m in models:
        await test_model(m)
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(main())
