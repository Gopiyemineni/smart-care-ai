import base64
import os
from google.cloud import texttospeech
from dotenv import load_dotenv

load_dotenv()

def test_tts():
    try:
        tts_client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text="నమస్కారం! Smart Care Hospital కి స్వాగతం.")
        voice = texttospeech.VoiceSelectionParams(
            language_code="te-IN",
            name="te-IN-Standard-A",
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.95,
            pitch=1.0,
        )
        response = tts_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        print("Success! Audio length:", len(response.audio_content))
    except Exception as e:
        print("TTS Error:", str(e))

if __name__ == "__main__":
    test_tts()
