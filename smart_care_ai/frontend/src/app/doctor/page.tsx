"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const priorityConfig: Record<string, any> = {
  emergency: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", label: "EMERGENCY" },
  high: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", label: "HIGH" },
  normal: { color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", label: "NORMAL" },
};

export default function DoctorPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "notes">("queue");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<null | Record<string, unknown>>(null);
  const [showSummary, setShowSummary] = useState(false);
  
  // New States for Reports & AI Insights
  const [showReportsPanel, setShowReportsPanel] = useState(false);
  const [reportsData, setReportsData] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const [isCalling, setIsCalling] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const fetchReportsData = useCallback(async () => {
    if (!selectedToken) return;
    setLoadingReports(true);
    try {
      const res = await fetch(`${API}/doctor/patient/${selectedToken}/previous-reports`);
      if (res.ok) {
        const data = await res.json();
        setReportsData(data);
      }
    } catch (e) {
      console.error("Failed to fetch reports data", e);
    } finally {
      setLoadingReports(false);
    }
  }, [selectedToken]);

  const openReportsPanel = () => {
    setShowReportsPanel(true);
    setChatMessages([
      { role: "model", content: "Hello! I am your Clinical AI Assistant. I have analyzed the patient's uploaded lab reports. You can ask me any clinical questions or trend comparisons here." }
    ]);
    fetchReportsData();
  };

  const handleSendReportChat = async () => {
    if (!chatInput.trim() || !selectedToken) return;
    const newMsg = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
    setSendingChat(true);
    
    try {
      const res = await fetch(`${API}/doctor/patient/${selectedToken}/chat-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, newMsg],
          language: "english"
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: "model", content: data.reply }]);
      } else {
        throw new Error();
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "model", content: "⚠️ Failed to receive response from AI. Check connection." }]);
    } finally {
      setSendingChat(false);
    }
  };

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API}/queue`);
      const data = await res.json();
      setPatients(data.queue);
      
      // Auto-select first patient if none selected
      if (!selectedToken && data.queue.length > 0) {
        setSelectedToken(data.queue[0].token);
      }
    } catch (e) {
      console.error("Failed to fetch queue", e);
    }
  }, [selectedToken]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Setup Web Speech API for Dictation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'te-IN'; // Default to Telugu/English mix

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (currentTranscript && selectedToken) {
            setNotes(prev => ({
              ...prev,
              [selectedToken]: (prev[selectedToken] || "") + currentTranscript
            }));
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [selectedToken]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const playTTS = async (text: string) => {
    setIsCalling(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" }) // nova is a female voice
      });
      const data = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
      await audio.play();
      
      // Wait for audio to finish playing before unlocking button
      audio.onended = () => {
        setIsCalling(false);
      };
    } catch (e) {
      console.error("TTS failed", e);
      setIsCalling(false);
    }
  };

  const callNextPatient = async () => {
    const nextWaiting = patients.find(p => p.status === "waiting");
    if (!nextWaiting) {
      alert("No waiting patients in the queue!");
      return;
    }

    try {
      // Announce patient
      const announcement = `టోకెన్ నంబర్ ${nextWaiting.token}, ${nextWaiting.name} గారు, దయచేసి డాక్టర్ గారి గదికి వెళ్ళండి.`;
      await playTTS(announcement);
      
      // Update status
      await fetch(`${API}/queue/${nextWaiting.token}/status?status=with-doctor`, {
        method: 'PATCH'
      });
      setSelectedToken(nextWaiting.token);
      fetchQueue();
    } catch (e) {
      console.error("Failed to update status", e);
      setIsCalling(false);
    }
  };

  const markComplete = async () => {
    if (!selectedToken) return;
    try {
      await fetch(`${API}/queue/${selectedToken}/status?status=completed`, {
        method: 'PATCH'
      });
      fetchQueue();
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const queue = patients.filter(p => p.status === "waiting" || p.status === "with-doctor");
  const completed = patients.filter(p => p.status === "completed");
  const selected = patients.find(p => p.token === selectedToken) || patients[0];

  const aiSuggestion = (patient: any) => {
    if (!patient) return "";
    if (patient.priority === "emergency") return "⚠️ URGENT: Patient shows signs of severe distress. Check vitals immediately.";
    if (patient.symptoms?.toLowerCase().includes("fever")) return "💊 Suggest: CBC, Dengue NS1 Antigen test. Start antipyretics.";
    if (patient.symptoms?.toLowerCase().includes("pain")) return "🔬 Suggest: Pain management and identify root cause. Maybe an X-Ray/Scan.";
    return "📋 Standard consultation. Review vitals and symptoms. Prescribe accordingly.";
  };

  const handleSendToPatientApp = async () => {
    if (!selected) return;
    const currentNotes = notes[selected.token];
    if (!currentNotes) { alert("Please write prescription notes first!"); return; }
    setLoadingSummary(true);
    setSummary(null);
    try {
      const res = await fetch(`${API}/prescription/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: selected.token || "",
          patient_name: selected.name || "Unknown",
          doctor_notes: currentNotes || "",
          symptoms: selected.symptoms || "None",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data);
      setShowSummary(true);
    } catch {
      alert("Could not generate summary. Check backend connection.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    if (!timestamp) return "Just now";
    const minDiff = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 60000);
    if (minDiff < 1) return "Just now";
    return `${minDiff} min ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
      {/* Patient Summary Modal (same as before) */}
      {showSummary && summary && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(2,8,23,0.85)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }} onClick={() => setShowSummary(false)}>
          <div className="glass-card" style={{ maxWidth: "600px", width: "100%", padding: "32px", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "20px", fontWeight: 700 }}>
                📲 Patient App Summary — <span style={{ color: "var(--primary)" }}>{selected?.name}</span>
              </h3>
              <button onClick={() => setShowSummary(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}>✕</button>
            </div>

            {/* Summary */}
            <div style={{ background: "rgba(0,212,255,0.06)", borderLeft: "3px solid var(--primary)", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 700, marginBottom: "6px" }}>DOCTOR'S ADVICE SUMMARY</div>
              <div style={{ fontSize: "14px", lineHeight: 1.6 }}>{String(summary.summary ?? "")}</div>
            </div>

            {/* Medications */}
            {Array.isArray(summary.medications) && (summary.medications as Array<Record<string, string>>).length > 0 ? (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>💊 MEDICATIONS</div>
                {(summary.medications as Array<Record<string, string>>).map((med, i) => (
                  <div key={i} className="glass-card-light" style={{ padding: "12px", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{med.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{med.dosage} • {med.timing} • {med.duration}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Diet */}
            {Array.isArray(summary.diet_advice) ? (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>🥗 DIET ADVICE</div>
                {(summary.diet_advice as string[]).map((d, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>• {d}</div>
                ))}
              </div>
            ) : null}

            {/* Follow up */}
            {summary.follow_up ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 700, marginBottom: "4px" }}>📅 FOLLOW UP</div>
                <div style={{ fontSize: "13px" }}>{String(summary.follow_up)}</div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      
      {/* Top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 32px", borderBottom: "1px solid var(--border)",
        background: "rgba(2,8,23,0.9)", backdropFilter: "blur(20px)",
      }}>
        <button onClick={() => router.push("/")} style={{
          background: "none", border: "1px solid var(--border)", color: "var(--text-muted)",
          borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontSize: "13px",
        }}>← Home</button>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "18px", display: "flex", alignItems: "center", gap: "16px" }}>
          🩺 Doctor <span style={{ color: "#7c3aed" }}>Dashboard</span>
          <button 
            className="btn-primary" 
            onClick={callNextPatient}
            disabled={isCalling}
            style={{ padding: "6px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isCalling ? "🔊 Calling..." : "📢 Call Next Patient"}
          </button>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "100px",
        }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} className="pulse-red" />
          <span style={{ fontSize: "13px", color: "#f87171", fontWeight: 500 }}>
            {queue.filter(p => p.priority === "emergency").length} Emergency Waiting
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: "calc(100vh - 65px)" }}>
        {/* Left: Queue */}
        <div style={{ borderRight: "1px solid var(--border)", background: "rgba(15,23,42,0.5)", display: "flex", flexDirection: "column" }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", borderBottom: "1px solid var(--border)" }}>
            {[
              { label: "Waiting", value: queue.filter(p => p.status === "waiting").length, color: "#00d4ff" },
              { label: "With Doctor", value: queue.filter(p => p.status === "with-doctor").length, color: "#7c3aed" },
              { label: "Done Today", value: completed.length, color: "#10b981" },
            ].map(s => (
              <div key={s.label} style={{ padding: "16px", textAlign: "center", background: "rgba(15,23,42,0.8)" }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            {(["queue", "notes"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: "12px", background: "none",
                border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                color: activeTab === t ? "var(--primary)" : "var(--text-muted)",
                borderBottom: activeTab === t ? "2px solid var(--primary)" : "2px solid transparent",
                transition: "all 0.2s",
              }}>
                {t === "queue" ? "📋 Patient Queue" : "📝 Completed Notes"}
              </button>
            ))}
          </div>

          {/* Patient list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {(activeTab === "queue" ? queue : completed).map(p => (
              <div key={p.token} onClick={() => {
                setSelectedToken(p.token);
              }}
                style={{
                  padding: "16px 20px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: selectedToken === p.token ? "rgba(0,212,255,0.06)" : "transparent",
                  borderLeft: selectedToken === p.token ? "3px solid var(--primary)" : "3px solid transparent",
                  transition: "all 0.2s",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{p.name}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>{p.age}y</span>
                  </div>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px",
                    background: priorityConfig[p.priority]?.bg || priorityConfig["normal"].bg,
                    color: priorityConfig[p.priority]?.color || priorityConfig["normal"].color,
                    border: `1px solid ${priorityConfig[p.priority]?.border || priorityConfig["normal"].border}`,
                  }}>{priorityConfig[p.priority]?.label || "NORMAL"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--primary)" }}>{p.token}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTimeAgo(p.timestamp)}</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.symptoms}
                </div>
              </div>
            ))}
            {(activeTab === "queue" ? queue : completed).length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                No patients found.
              </div>
            )}
          </div>
        </div>

        {/* Right: Patient Detail */}
        <div style={{ padding: "32px", overflowY: "auto" }}>
          {selected ? (
            <div className="fade-in-up">
              {/* Patient header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                    <div style={{
                      width: "52px", height: "52px", borderRadius: "50%",
                      background: "linear-gradient(135deg,#00d4ff,#7c3aed)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "22px",
                    }}>👤</div>
                    <div>
                      <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "24px", fontWeight: 700 }}>{selected.name}</h2>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Age {selected.age} • Token: <span style={{ color: "var(--primary)", fontFamily: "monospace" }}>{selected.token}</span></div>
                    </div>
                  </div>
                </div>
                <span style={{
                  padding: "8px 20px", borderRadius: "100px", fontSize: "13px", fontWeight: 700,
                  background: priorityConfig[selected.priority]?.bg || priorityConfig["normal"].bg,
                  color: priorityConfig[selected.priority]?.color || priorityConfig["normal"].color,
                  border: `1px solid ${priorityConfig[selected.priority]?.border || priorityConfig["normal"].border}`,
                }}>{priorityConfig[selected.priority]?.label || "NORMAL"}</span>
              </div>

              {/* Vitals */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
                {[
                  { label: "Blood Pressure", value: selected.bp || "N/A", unit: "mmHg", icon: "🩸", ok: true },
                  { label: "Pulse Rate", value: selected.pulse || "N/A", unit: "BPM", icon: "💓", ok: !selected.pulse || parseInt(selected.pulse) < 100 },
                  { label: "Age", value: selected.age, unit: "years", icon: "🎂", ok: true },
                  { label: "Wait Time", value: formatTimeAgo(selected.timestamp), unit: "", icon: "⏱️", ok: true },
                ].map(v => (
                  <div key={v.label} className="stat-card">
                    <div style={{ fontSize: "20px", marginBottom: "8px" }}>{v.icon}</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: v.ok ? "var(--text-primary)" : "#f59e0b" }}>{v.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{v.unit}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{v.label}</div>
                  </div>
                ))}
              </div>

              {/* Symptoms */}
              <div className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 600 }}>PATIENT COMPLAINT</div>
                <p style={{ fontSize: "15px", lineHeight: 1.7 }}>{selected.symptoms}</p>
              </div>

              {/* AI Suggestion */}
              <div style={{
                background: "rgba(0,212,255,0.06)", border: "1px solid var(--border)",
                borderLeft: "4px solid var(--primary)",
                borderRadius: "12px", padding: "20px", marginBottom: "24px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "16px" }}>🧠</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary)" }}>AI Clinical Suggestion</span>
                </div>
                <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-muted)" }}>{aiSuggestion(selected)}</p>
              </div>

              {/* Doctor Notes (mic recording simulation) */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>📝 Doctor's Prescription Notes</div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button 
                      onClick={toggleRecording}
                      style={{
                        background: isRecording ? "rgba(239,68,68,0.2)" : "rgba(0,212,255,0.1)",
                        color: isRecording ? "#ef4444" : "var(--primary)",
                        border: `1px solid ${isRecording ? "rgba(239,68,68,0.4)" : "rgba(0,212,255,0.3)"}`,
                        borderRadius: "100px", padding: "6px 12px", fontSize: "13px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px"
                      }}>
                      {isRecording ? "⏹ Stop Dictation" : "🎤 Start Dictation (Telugu/Eng)"}
                    </button>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Auto-saved</div>
                  </div>
                </div>
                <textarea className="input-field" rows={4}
                  placeholder="Type or dictate prescription... (e.g. Amoxicillin 500mg TDS x 5 days, rest for 3 days, review if no improvement...)"
                  value={notes[selected.token] || ""}
                  onChange={e => { setNotes(n => ({ ...n, [selected.token]: e.target.value })); }}
                  style={{ resize: "none", marginBottom: "16px" }}
                />
                <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                  <button
                    className="btn-ghost"
                    style={{ flex: 1, borderColor: "var(--primary)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    onClick={openReportsPanel}
                  >
                    📊 View Reports & AI Insights
                  </button>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={markComplete}>✅ Mark Complete & Save</button>
                  <button
                    className="btn-ghost"
                    style={{ flex: 1, opacity: loadingSummary ? 0.7 : 1 }}
                    onClick={handleSendToPatientApp}
                    disabled={loadingSummary}
                  >
                    {loadingSummary ? "⏳ Generating..." : "📲 Send to Patient App"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
              No patient selected
            </div>
          )}
        </div>
      </div>

      {/* Reports side drawer panel */}
      {showReportsPanel && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "550px",
          background: "rgba(15, 23, 42, 0.98)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.6)",
          zIndex: 1001,
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          backdropFilter: "blur(30px)",
          animation: "slide-in-right 0.3s ease-out"
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
            <div>
              <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                📊 Reports & AI Insights
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Comparative analytics for {selected?.name}</p>
            </div>
            <button onClick={() => setShowReportsPanel(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "22px" }}>✕</button>
          </div>

          {/* Scroller Content */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "20px" }}>
            {loadingReports ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "12px" }}>
                <div style={{ border: "4px solid rgba(0,212,255,0.1)", borderTop: "4px solid var(--primary)", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>AI is analyzing medical reports...</span>
              </div>
            ) : reportsData ? (
              <>
                {/* AI Improvement Trend Section */}
                <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", color: "var(--secondary)", fontWeight: 700 }}>AI LONGITUDINAL ANALYSIS</span>
                    <span style={{ 
                      fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "100px",
                      background: reportsData.improvement_status === "improving" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: reportsData.improvement_status === "improving" ? "#10b981" : "#f59e0b"
                    }}>
                      {reportsData.improvement_status?.toUpperCase()} ({reportsData.improvement_percentage > 0 ? `+${reportsData.improvement_percentage}%` : `${reportsData.improvement_percentage}%`})
                    </span>
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: 1.6, marginBottom: "12px" }}>{reportsData.comparison_summary}</p>
                  
                  {/* Trends List */}
                  {reportsData.key_trends && reportsData.key_trends.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {reportsData.key_trends.map((t: any, idx: number) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: "6px", fontSize: "13px" }}>
                          <span style={{ fontWeight: 600 }}>{t.marker}</span>
                          <span style={{ color: t.status === "improving" ? "#10b981" : "#94a3b8" }}>{t.trend}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Suggestions Section */}
                <div style={{ background: "rgba(0,212,255,0.05)", borderLeft: "3px solid var(--primary)", borderRadius: "8px", padding: "16px" }}>
                  <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 700, marginBottom: "10px" }}>AI CLINICAL RECOMMENDATIONS</div>
                  <ul style={{ paddingLeft: "16px", margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {reportsData.ai_suggestions?.map((s: string, idx: number) => (
                      <li key={idx} style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>{s}</li>
                    ))}
                  </ul>
                </div>

                {/* Uploaded Documents List */}
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "10px" }}>📄 UPLOADED DOCUMENTS ({reportsData.reports?.length || 0})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {reportsData.reports && reportsData.reports.length > 0 ? (
                      reportsData.reports.map((r: any) => (
                        <div key={r.id} className="glass-card-light" style={{ padding: "14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontWeight: 600, fontSize: "14px" }}>{r.filename}</span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{r.uploaded_at}</span>
                          </div>
                          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>{r.analysis.summary}</p>
                          {r.analysis.key_markers && r.analysis.key_markers.length > 0 && (
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                              {r.analysis.key_markers.map((m: any, mIdx: number) => (
                                <span key={mIdx} style={{ fontSize: "11px", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                  {m.name}: <strong style={{ color: m.status === "high" || m.status === "low" ? "#f59e0b" : "#10b981" }}>{m.value}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", border: "1px dashed var(--border)", borderRadius: "8px" }}>No documents uploaded.</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>Failed to load reports.</div>
            )}

            {/* Doctor-AI Chat Box */}
            <div className="glass-card" style={{ padding: "16px", marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <span>💬</span> Clinical Reports Assistant Chat
              </div>
              
              {/* Messages Area */}
              <div style={{ height: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", background: "rgba(2,8,23,0.4)", borderRadius: "8px", padding: "10px" }}>
                {chatMessages.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    background: msg.role === "user" ? "var(--secondary)" : "rgba(255,255,255,0.05)",
                    color: "white", padding: "8px 12px", borderRadius: "10px", maxWidth: "85%", fontSize: "13px", lineHeight: 1.4
                  }}>
                    {msg.content}
                  </div>
                ))}
                {sendingChat && (
                  <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "10px", fontSize: "13px", color: "var(--text-muted)" }}>
                    AI typing...
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ask AI about glucose values, HbA1c delta..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSendReportChat(); }}
                  style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
                />
                <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "13px" }} onClick={handleSendReportChat} disabled={sendingChat}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
