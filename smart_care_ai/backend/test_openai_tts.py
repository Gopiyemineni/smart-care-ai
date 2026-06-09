import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

try:
    response = client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input="నమస్కారం! Smart Care Hospital కి స్వాగతం. దయచేసి మీ పేరు చెప్పండి?"
    )
    
    audio_content = response.content
    print("Success! Audio length:", len(audio_content))
except Exception as e:
    print("Error:", e)
