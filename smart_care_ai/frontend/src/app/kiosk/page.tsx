"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Step = "welcome" | "vitals" | "symptoms" | "token";

interface PatientData {
  name: string;
  age: string;
  weight: string;
  bp: string;
  pulse: string;
  symptoms: string;
  priority: "emergency" | "high" | "normal";
  token: string;
  reasoning?: string;
  recommended_action?: string;
  estimated_wait?: string;
  warning_signs?: string[];
}

export default function KioskPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [isListening, setIsListening] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("నమస్కారం! Smart Care AI కి స్వాగతం. మీ పేరు చెప్పండి.");
  const [patient, setPatient] = useState<PatientData>({
    name: "", age: "", weight: "", bp: "", pulse: "",
    symptoms: "", priority: "normal", token: "",
  });

  // Simulate AI speaking on step change
  useEffect(() => {
    const messages: Record<Step, string> = {
      welcome: "నమస్కారం! Smart Care AI కి స్వాగతం. దయచేసి మీ వివరాలు enter చేయండి.",
      vitals: "మీ vital signs తీసుకుంటున్నాం. Pulse oximeter లో వేలు పెట్టండి.",
      symptoms: "మీకు ఏమి సమస్య వస్తోంది? వివరంగా చెప్పండి.",
      token: "మీ token ready అయింది. దయచేసి waiting area లో కూర్చోండి.",
    };
    setAiText(messages[step]);
    setAiSpeaking(true);
    const t = setTimeout(() => setAiSpeaking(false), 3000);
    return () => clearTimeout(t);
  }, [step]);

  const handleSubmitVitals = () => {
    if (!patient.name || !patient.age) return;
    setStep("vitals");
  };

  const handleSubmitVitals2 = () => {
    setStep("symptoms");
  };

  // Real AI Triage — calls GPT-4o backend
  const handleSubmitSymptoms = async () => {
    if (!patient.symptoms) return;
    setLoading(true);
    setAiText("మీ symptoms AI analyze చేస్తోంది... ఒక్క నిమిషం...");
    setAiSpeaking(true);
    try {
      const res = await fetch(`${API}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patient.name,
          age: parseInt(patient.age),
          symptoms: patient.symptoms,
          bp: patient.bp,
          pulse: patient.pulse,
        }),
      });
      if (!res.ok) throw new Error("Triage API failed");
      const data = await res.json();
      setPatient(p => ({
        ...p,
        priority: data.priority,
        token: data.token,
        reasoning: data.reasoning,
        recommended_action: data.recommended_action,
        estimated_wait: data.estimated_wait,
        warning_signs: data.warning_signs,
      }));
      setAiText(data.priority === "emergency"
        ? "🚨 Emergency detected! Doctor ki immediate notification పంపాం!"
        : data.priority === "high"
        ? "⚠️ మీ case high priority గా mark అయింది. త్వరగా చూస్తారు."
        : "✅ మీ token ready అయింది. Waiting area లో కూర్చోండి."
      );
      setStep("token");
    } catch {
      // Fallback to local logic if backend unavailable
      const emergency = ["chest pain", "breathing", "stroke", "heart"];
      const high = ["fever", "severe", "swelling"];
      const s = patient.symptoms.toLowerCase();
      const priority = emergency.some(w => s.includes(w)) ? "emergency" : high.some(w => s.includes(w)) ? "high" : "normal";
      const prefix = priority === "emergency" ? "EMG" : priority === "high" ? "HPR" : "NRM";
      const token = `${prefix}-${Math.floor(Math.random() * 900) + 100}`;
      setPatient(p => ({ ...p, priority, token }));
      setStep("token");
    } finally {
      setLoading(false);
      setAiSpeaking(false);
    }
  };

  const priorityConfig = {
    emergency: { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "🚨 EMERGENCY", desc: "Doctor notified immediately!" },
    high: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "⚠️ HIGH PRIORITY", desc: "You will be seen within 15 minutes." },
    normal: { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "✅ NORMAL", desc: "Estimated wait: 20-30 minutes." },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 32px", borderBottom: "1px solid var(--border)",
        background: "rgba(2,8,23,0.9)", backdropFilter: "blur(20px)",
      }}>
        <button onClick={() => router.push("/")} style={{
          background: "none", border: "1px solid var(--border)", color: "var(--text-muted)",
          borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontSize: "13px",
        }}>← Back</button>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "18px" }}>
          🎙️ Patient <span style={{ color: "var(--primary)" }}>Kiosk</span>
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Reception — AI Triage System</div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "calc(100vh - 65px)" }}>
        {/* Left: AI Avatar Panel */}
        <div style={{
          background: "rgba(15,23,42,0.95)", borderRight: "1px solid var(--border)",
          padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px",
        }}>
          {/* AI orb */}
          <div style={{ position: "relative", width: "140px", height: "140px" }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))",
              border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "56px",
            }} className={aiSpeaking ? "pulse-animation" : ""}>🤖</div>
            {aiSpeaking && (
              <div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "3px" }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "15px" }}>Smart Care AI</div>
            <div style={{
              background: "rgba(0,212,255,0.08)", border: "1px solid var(--border)",
              borderRadius: "12px", padding: "14px 16px",
              fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, textAlign: "left",
            }}>
              {aiText}
            </div>
          </div>

          {/* Voice button */}
          <button
            onClick={() => setIsListening(p => !p)}
            style={{
              width: "80px", height: "80px", borderRadius: "50%",
              background: isListening ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#00d4ff,#7c3aed)",
              border: "none", cursor: "pointer", fontSize: "32px",
              transition: "all 0.3s ease",
            }}
            className={isListening ? "pulse-red" : ""}
          >
            {isListening ? "⏹️" : "🎙️"}
          </button>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {isListening ? "Listening... speak now" : "Tap to speak"}
          </div>

          {/* Progress steps */}
          <div style={{ width: "100%", marginTop: "auto" }}>
            {["welcome","vitals","symptoms","token"].map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: ["welcome","vitals","symptoms","token"].indexOf(step) >= i
                    ? "linear-gradient(135deg,#00d4ff,#7c3aed)" : "rgba(30,41,59,0.8)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 700,
                }}>
                  {["welcome","vitals","symptoms","token"].indexOf(step) > i ? "✓" : i+1}
                </div>
                <span style={{
                  fontSize: "13px",
                  color: step === s ? "var(--primary)" : "var(--text-muted)",
                  fontWeight: step === s ? 600 : 400,
                }}>
                  {["Registration","Vitals","Symptoms","Token"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form Area */}
        <div style={{ padding: "48px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "560px" }} className="fade-in-up">

            {/* STEP 1: Welcome / Registration */}
            {step === "welcome" && (
              <div>
                <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>
                  Welcome to <span className="gradient-text">Smart Care</span>
                </h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>Please enter your basic details to get started</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", display: "block" }}>Full Name / పూర్తి పేరు *</label>
                    <input className="input-field" placeholder="e.g. Gopi Krishna" value={patient.name}
                      onChange={e => setPatient(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", display: "block" }}>Age / వయసు *</label>
                      <input className="input-field" placeholder="e.g. 28" type="number" value={patient.age}
                        onChange={e => setPatient(p => ({ ...p, age: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", display: "block" }}>Weight (kg) / బరువు</label>
                      <input className="input-field" placeholder="e.g. 68" type="number" value={patient.weight}
                        onChange={e => setPatient(p => ({ ...p, weight: e.target.value }))} />
                    </div>
                  </div>
                  <button className="btn-primary" onClick={handleSubmitVitals} style={{ marginTop: "8px", width: "100%", padding: "16px" }}>
                    Next: Measure Vitals →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Vitals */}
            {step === "vitals" && (
              <div>
                <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>
                  Vital <span className="gradient-text">Signs</span>
                </h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>Place your finger on the pulse oximeter & arm in BP cuff</p>

                {/* Animated instructions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                  <div className="glass-card" style={{ padding: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "48px", marginBottom: "12px" }}>💓</div>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>Pulse Oximeter</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Place index finger in clip</div>
                    <button className="btn-success" style={{ width: "100%", padding: "10px", fontSize: "13px" }}
                      onClick={() => setPatient(p => ({ ...p, pulse: "78" }))}>
                      {patient.pulse ? `✓ ${patient.pulse} BPM` : "Scan Now"}
                    </button>
                  </div>
                  <div className="glass-card" style={{ padding: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "48px", marginBottom: "12px" }}>🩸</div>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>Blood Pressure</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Insert left arm into cuff</div>
                    <button className="btn-success" style={{ width: "100%", padding: "10px", fontSize: "13px" }}
                      onClick={() => setPatient(p => ({ ...p, bp: "118/76" }))}>
                      {patient.bp ? `✓ ${patient.bp} mmHg` : "Measure BP"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", display: "block" }}>Pulse (BPM)</label>
                    <input className="input-field" placeholder="Auto-filled or enter" value={patient.pulse}
                      onChange={e => setPatient(p => ({ ...p, pulse: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px", display: "block" }}>BP (mmHg)</label>
                    <input className="input-field" placeholder="Auto-filled or enter" value={patient.bp}
                      onChange={e => setPatient(p => ({ ...p, bp: e.target.value }))} />
                  </div>
                </div>

                <button className="btn-primary" onClick={handleSubmitVitals2} style={{ width: "100%", padding: "16px" }}>
                  Next: Describe Symptoms →
                </button>
              </div>
            )}

            {/* STEP 3: Symptoms */}
            {step === "symptoms" && (
              <div>
                <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "32px", fontWeight: 800, marginBottom: "8px" }}>
                  Your <span className="gradient-text">Symptoms</span>
                </h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>Speak or type your symptoms. AI will determine priority.</p>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", display: "block" }}>Describe problem / సమస్య చెప్పండి *</label>
                  <textarea className="input-field" rows={5}
                    placeholder="e.g. Left side swelling for 3 days, mild pain, fever since yesterday..."
                    value={patient.symptoms}
                    onChange={e => setPatient(p => ({ ...p, symptoms: e.target.value }))}
                    style={{ resize: "none", lineHeight: 1.6 }}
                  />
                </div>

                {/* Quick symptom chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                  {["Fever / జ్వరం", "Chest Pain / ఛాతి నొప్పి", "Swelling / వాపు", "Cough / దగ్గు", "Headache / తలనొప్పి", "Stomach Pain / కడుపు నొప్పి"].map(s => (
                    <button key={s} onClick={() => setPatient(p => ({ ...p, symptoms: p.symptoms + (p.symptoms ? ", " : "") + s }))}
                      style={{
                        background: "rgba(0,212,255,0.08)", border: "1px solid var(--border)",
                        color: "var(--primary)", borderRadius: "100px", padding: "6px 14px",
                        fontSize: "12px", cursor: "pointer", fontFamily: "'Inter',sans-serif",
                      }}>
                      + {s}
                    </button>
                  ))}
                </div>

                <button className="btn-primary" onClick={handleSubmitSymptoms}
                  disabled={loading}
                  style={{ width: "100%", padding: "16px", opacity: loading ? 0.7 : 1 }}>
                  {loading ? "🧠 AI Analyzing... please wait" : "🧠 AI Analyze & Get Token →"}
                </button>
              </div>
            )}

            {/* STEP 4: Token */}
            {step === "token" && (
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: "100px", height: "100px", borderRadius: "50%",
                  background: priorityConfig[patient.priority].bg,
                  border: `2px solid ${priorityConfig[patient.priority].color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "48px", margin: "0 auto 24px",
                }} className="pulse-animation">
                  {patient.priority === "emergency" ? "🚨" : patient.priority === "high" ? "⚠️" : "✅"}
                </div>

                <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>
                  Your Token is Ready!
                </h2>

                <div style={{
                  background: priorityConfig[patient.priority].bg,
                  border: `2px solid ${priorityConfig[patient.priority].color}`,
                  borderRadius: "16px", padding: "32px", margin: "24px 0",
                }}>
                  <div style={{ fontSize: "48px", fontFamily: "'Outfit',sans-serif", fontWeight: 900, color: priorityConfig[patient.priority].color, letterSpacing: "4px" }}>
                    {patient.token}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px" }}>Your Queue Token</div>
                </div>

                <div className="glass-card" style={{ padding: "20px", marginBottom: "16px", textAlign: "left" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {[
                      { label: "Name", value: patient.name },
                      { label: "Age", value: `${patient.age} years` },
                      { label: "Pulse", value: patient.pulse ? `${patient.pulse} BPM` : "Not measured" },
                      { label: "BP", value: patient.bp || "Not measured" },
                      { label: "Est. Wait", value: patient.estimated_wait || priorityConfig[patient.priority].desc },
                      { label: "Action", value: patient.recommended_action || "See doctor" },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.label}</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Reasoning */}
                {patient.reasoning && (
                  <div style={{
                    background: "rgba(0,212,255,0.06)", border: "1px solid var(--border)",
                    borderLeft: "3px solid var(--primary)",
                    borderRadius: "10px", padding: "14px", marginBottom: "16px", textAlign: "left",
                  }}>
                    <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 700, marginBottom: "4px" }}>🧠 AI CLINICAL REASONING</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>{patient.reasoning}</div>
                  </div>
                )}

                {/* Warning signs */}
                {patient.warning_signs && patient.warning_signs.length > 0 && (
                  <div style={{
                    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
                    borderRadius: "10px", padding: "14px", marginBottom: "16px", textAlign: "left",
                  }}>
                    <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, marginBottom: "6px" }}>⚠️ WATCH FOR THESE SIGNS</div>
                    {patient.warning_signs.map((s, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "3px" }}>• {s}</div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => {
                    setStep("welcome");
                    setPatient({ name:"",age:"",weight:"",bp:"",pulse:"",symptoms:"",priority:"normal",token:"" });
                  }}>New Patient</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => router.push("/doctor")}>
                    View Doctor Queue →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
