// ─────────────────────────────────────────────────────────
// Backend Configuration
// For Android Emulator: use "10.0.2.2"
// For Real Device (same WiFi): use your PC's LAN IP e.g. "192.168.1.100"
// ─────────────────────────────────────────────────────────
// Production Backend:
export const API_BASE = "https://smart-care-backend-690805058186.us-central1.run.app";

// Local Backend (uncomment for local testing):
// export const BACKEND_IP = "172.18.250.14"; // ← Updated for your mobile hotspot
// export const BACKEND_PORT = "8000";
// export const API_BASE = `http://${BACKEND_IP}:${BACKEND_PORT}`;

export const ENDPOINTS = {
  login: `${API_BASE}/patient/login`,
  chat: `${API_BASE}/patient/chat`,
  details: (token: string) => `${API_BASE}/patient/${token}/details`,
  uploadReport: (token: string) => `${API_BASE}/patient/${token}/upload-report`,
  bookAppointment: (token: string) => `${API_BASE}/patient/${token}/book-appointment`,
  queue: `${API_BASE}/queue`,
} as const;
