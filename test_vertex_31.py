import asyncio
import os
import google.genai as genai
from google.genai import types

# Setup client
PROJECT_ID = "invice-test-project"
LOCATION = "us-central1"
client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

async def test_model(model_name):
    print(f"Testing Vertex AI model: {model_name}...")
    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
        )
        async with client.aio.live.connect(
            model=model_name,
            config=config,
        ) as session:
            print(f"SUCCESS: Connected to Vertex AI model: {model_name}")
            return True
    except Exception as e:
        print(f"FAILED for model {model_name}: {e}")
        return False

async def main():
    await test_model("gemini-3.1-flash-live-preview")

if __name__ == "__main__":
    asyncio.run(main())
