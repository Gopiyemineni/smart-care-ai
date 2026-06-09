# 🩺 Smart Care AI — Autonomous Multimodal Health Agent Ecosystem

Smart Care AI is an autonomous, end-to-end multi-agent medical assistant ecosystem built for the **Google for Startups AI Agents Challenge**. It automates patient triage, clinical analytics, hygiene compliance, and post-consultation patient care by securely linking hardware kiosks, web dashboards, and mobile companion apps using state-of-the-art Google Gemini LLMs and computer vision.

---

## 📸 Project Architecture

![Project Architecture](Architecture%20Diagram.png)

---

## 🌟 Key Features

### 1. 🤖 Autonomous Voice Triage Kiosk
- **Human Detection**: Uses a local **YOLOv8** model to lock onto patient presence at the kiosk.
- **Bilingual Voice Triage**: Gemini 1.5 Pro initiates a warm, voice-based conversational check-in (supporting **English and Telugu** mix).
- **Auto-Priority Token**: Automatically assesses symptoms, categorizes priority (`EMERGENCY` | `HIGH` | `NORMAL`), generates a ticket code, and announces wait times using **Gemini Prebuilt TTS**.

### 2. 🩺 Doctor Insights Dashboard
- **Bilingual Dictation**: Speech-to-text dictation supporting English/Telugu mix to transcribe doctor prescriptions.
- **AI Summary Extraction**: Auto-summarizes notes into structured medications, diet advice, and follow-up days.
- **Longitudinal Report Analysis**: Scans multiple uploaded patient lab reports over time using Gemini Flash to calculate overall health improvement percentage, trend deltas, and reference suggestions.
- **Clinical Assistant Chat**: Interactive sidebar chat enabling doctors to query the AI assistant about report values or trends.

### 3. 📲 Patient Companion App (React Native/Expo)
- **Advice & Prescriptions**: View current medicines, dosages, and diet guidelines from the doctor.
- **Follow-up Notifications**: AI-driven alerts reminding the patient of their next checkup (in 2 days) with a simulated cron reminder list.
- **One-Click Auto-Booking**: Patients can click "Confirm & Book" to auto-schedule appointments with their doctor.
- **Real Camera/Gallery Report Upload**: Pick files or take photos of lab results using their phone camera. The image is instantly base64-encoded and sent to Gemini Vision for parameter extraction.

### 4. 🧹 Hygiene Vision Inspector
- **Multimodal Assessment**: Scans ward images via Gemini 1.5 Pro to evaluate hospital hygiene scores (0-100), identify positive cleanliness observations, and list warnings.
- **Auto-Escalation**: Triggers an automated email warning to the HOD General Physician if the score drops below 60.

---

## 🛠️ Technologies Used
- **AI Models & SDKs**: Google Vertex AI (Gemini 1.5/2.5 Pro & Flash), Google GenAI SDK
- **Backend API**: FastAPI (Python), Uvicorn, Python-Dotenv
- **Web App**: Next.js, React, Tailwind CSS, postCSS
- **Mobile App**: React Native, Expo SDK 54, EAS Build, Expo Image Picker
- **Computer Vision**: Ultralytics YOLOv8
- **Deployments**: Google Cloud Run (Backend), Firebase Hosting (Next.js Dashboard)

---

## 📂 Project Structure
```text
google_hackthon/
├── smart_care_ai/
│   ├── backend/         # FastAPI Python server (Google Cloud Run)
│   └── frontend/        # Next.js web portal (Firebase Hosting)
└── smart_care_patient_app/ # React Native Expo mobile companion app
```

---

## 🚀 Live Testing & Access Links
- **💻 Doctor & Kiosk Web App**: [https://invice-test-project.web.app](https://invice-test-project.web.app)
- **⚙️ Backend API Base**: [https://smart-care-backend-690805058186.us-central1.run.app/](https://smart-care-backend-690805058186.us-central1.run.app/)
- **📱 Patient App APK (Android)**: [EAS Build Dashboard](https://expo.dev/accounts/gopi_yemineni/projects/smart-care-patient/builds/0f4f3adc-4315-4bf0-b163-7e292977bef9)

### E2E Testing Instructions
1. Open the Web App, go to the **Kiosk (Camera)** tab to register a patient, and get a token (e.g., `NRM-283`).
2. Open the **Doctor Dashboard**, select the patient, type prescription notes, and click **"Send to Patient App"**.
3. Install and log in to the **Patient Mobile App APK** using the name and token.
4. Go to **Appointments** tab on mobile, click **"Confirm & Book"** to schedule a follow-up visit.
5. Go to **Reports** tab on mobile, capture or upload any blood sugar or lab report image, and upload it.
6. Refresh the **Doctor Dashboard** and open **"View Reports & AI Insights"** to review the AI comparison analysis and chat with the clinical assistant.

---

## 💻 Local Setup & Development

### 1. Backend Server
```bash
cd smart_care_ai/backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Web Portal
```bash
cd smart_care_ai/frontend
npm install
npm run dev
```

### 3. Patient Mobile App
```bash
cd smart_care_patient_app
npm install
npx expo start
```
*Scan the Metro QR code using the **Expo Go** application on your phone.*

---

## 🔒 State Persistence on Cloud Run
To prevent state loss due to serverless container recycling (scale-to-zero) and multi-instance routing, the backend utilizes auto-saved local JSON serialization to `/tmp/patient_queue.json` combined with a `--max-instances=1` scaling constraint. This guarantees absolute data consistency for all client endpoints during evaluations.
