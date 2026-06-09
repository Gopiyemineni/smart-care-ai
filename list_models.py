import os
import google.genai as genai

PROJECT_ID = "invice-test-project"

def list_models_for_location(location):
    print(f"\n================ Models in {location} ================")
    try:
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=location)
        models = client.models.list()
        for m in models:
            print(f"- {m.name} (supports: {m.supported_actions})")
    except Exception as e:
        print(f"Failed to list models in {location}: {e}")

list_models_for_location("us-central1")
list_models_for_location("us-east4")
list_models_for_location("europe-west4")
list_models_for_location("europe-west9")
