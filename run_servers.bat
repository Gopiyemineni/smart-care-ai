@echo off
echo Starting Smart Care AI Backend...
start cmd /k "cd /d d:\google_hackthon\smart_care_ai\backend && .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Smart Care Next.js Frontend...
start cmd /k "cd /d d:\google_hackthon\smart_care_ai\frontend && npm run dev"

echo Starting Smart Care Patient Expo App...
start cmd /k "cd /d d:\google_hackthon\smart_care_patient_app && npm start"

echo All servers started!
