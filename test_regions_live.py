import asyncio
import os
import google.genai as genai
from google.genai import types

PROJECT_ID = "invice-test-project"

async def test_region_model(location, model_name):
    print(f"Testing location={location}, model={model_name}...")
    try:
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=location)
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
        )
        async with client.aio.live.connect(
            model=model_name,
            config=config,
        ) as session:
            print(f"SUCCESS: location={location}, model={model_name}")
            return True
    except Exception as e:
        print(f"FAILED for location={location}, model={model_name}: {e}")
        return False

async def main():
    regions = ["us-central1", "us-east4", "europe-west4"]
    models = ["gemini-2.0-flash-exp", "gemini-2.5-flash-live", "gemini-2.0-flash-live-001", "gemini-3.1-flash-live-preview"]
    for r in regions:
        for m in models:
            await test_region_model(r, m)
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
