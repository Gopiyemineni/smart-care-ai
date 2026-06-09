"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Ward {
  id: number;
  name: string;
  coordinator: string;
  rating: number;
  status: "good" | "warning" | "critical";
  lastCheck: string;
  lastMsg: string;
  issues: string[];
  escalated: boolean;
  phone?: string;
}

const initialWards: Ward[] = [
  { id: 1, name: "Ward A — General", coordinator: "Suresh Kumar", rating: 94, status: "good", lastCheck: "5 min ago", lastMsg: "✅ Good, keep it up!", issues: [], escalated: false, phone: "918790309981" },
  { id: 2, name: "Ward B — Surgery", coordinator: "Anitha Rao", rating: 48, status: "critical", lastCheck: "12 min ago", lastMsg: "🚨 Critical: Bio-waste not disposed. Escalated to HOD.", issues: ["Bio-waste unattended", "Floor wet, slip hazard", "Gloves disposal pending"], escalated: true, phone: "918790309981" },
  { id: 3, name: "Ward C — Pediatrics", coordinator: "Rajesh Goud", rating: 72, status: "warning", lastCheck: "25 min ago", lastMsg: "⚠️ Msg sent: Clean the washroom area.", issues: ["Washroom needs cleaning"], escalated: false, phone: "918790309981" },
  { id: 4, name: "Ward D — ICU", coordinator: "Meena Devi", rating: 97, status: "good", lastCheck: "2 min ago", lastMsg: "✅ Excellent hygiene maintained.", issues: [], escalated: false, phone: "918790309981" },
  { id: 5, name: "Ward E — Maternity", coordinator: "Padma Reddy", rating: 81, status: "good", lastCheck: "18 min ago", lastMsg: "✅ Good hygiene. Minor linen delay noted.", issues: ["Linen change slightly delayed"], escalated: false, phone: "918790309981" },
  { id: 6, name: "Ward F — Orthopedics", coordinator: "Vijay Babu", rating: 55, status: "warning", lastCheck: "35 min ago", lastMsg: "⚠️ Follow-up check pending...", issues: ["Dustbins overflowing", "Corridor cluttered"], escalated: false, phone: "918790309981" },
];

const statusConfig = {
  good: { color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", icon: "✅", label: "GOOD" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", icon: "⚠️", label: "WARNING" },
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", icon: "🚨", label: "CRITICAL" },
};

const writeLoadingHTML = (win: Window, title: string, desc: string) => {
  win.document.open();
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            background: #020817;
            color: #f8fafc;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255,255,255,0.1);
            border-top-color: #10b981;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            text-align: center;
          }
          .desc {
            font-size: 14px;
            color: #94a3b8;
            text-align: center;
            max-width: 300px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <div class="title">${title}</div>
        <div class="desc">${desc}</div>
      </body>
    </html>
  `);
  win.document.close();
};

export default function AdminPage() {
  const router = useRouter();
  const [wards, setWards] = useState(initialWards);
  const [selected, setSelected] = useState(initialWards[1]);
  const [logs, setLogs] = useState<string[]>([
    "09:42 — AI scanned Ward B: Rating 48%. Message sent to Anitha Rao.",
    "09:45 — No response from Ward B coordinator after 1 hour threshold (simulated).",
    "09:46 — Escalation triggered: HOD Dr. Srinivas notified about Ward B.",
    "10:05 — AI scanned Ward C: Rating 72%. Warning message sent to Rajesh Goud.",
    "10:12 — Ward A re-scan: Rating 94%. Green status confirmed.",
  ]);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeBanner, setActiveBanner] = useState<{
    type: "blocker" | "warning2" | "escalation";
    url: string;
    coordinator: string;
    phone: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const simulateTimersRef = useRef<NodeJS.Timeout[]>([]);

  const clearSimulateTimers = () => {
    simulateTimersRef.current.forEach(clearTimeout);
    simulateTimersRef.current = [];
  };

  useEffect(() => {
    return () => {
      simulateTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Real AI scan: uploads image to backend Gemini 1.5 Pro Vision
  const handleRealImageScan = async (file: File, tempWin: Window | null) => {
    clearSimulateTimers();
    setScanning(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("ward_id", String(selected.id));
    formData.append("ward_name", selected.name);
    formData.append("coordinator", selected.coordinator);
    try {
      const res = await fetch(
        `${API}/hygiene/analyze-image?ward_id=${selected.id}&ward_name=${encodeURIComponent(selected.name)}&coordinator=${encodeURIComponent(selected.coordinator)}`,
        { method: "POST", body: formData }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const newStatus: "good" | "warning" | "critical" =
        data.hygiene_score >= 80 ? "good" : data.hygiene_score >= 60 ? "warning" : "critical";
      setWards(w => w.map(ward =>
        ward.id === selected.id
          ? { ...ward, rating: data.hygiene_score, status: newStatus, issues: data.issues || [], lastMsg: data.message_to_coordinator || "", lastCheck: "just now", escalated: data.escalate || false }
          : ward
      ));
      setSelected(s => ({ ...s, rating: data.hygiene_score, status: newStatus, issues: data.issues || [], lastMsg: data.message_to_coordinator || "", lastCheck: "just now", escalated: data.escalate || false }));
      const logEntry = `${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — AI scanned ${selected.name} via image: Score ${data.hygiene_score}%. ${data.escalate ? "Escalation triggered!" : data.action_required ? "Alert sent to coordinator." : "Green status."}  `;
      setLogs(l => [logEntry, ...l]);

      // Auto-trigger WhatsApp redirection
      if (data.action_required && data.message_to_coordinator) {
        const waText = encodeURIComponent(data.message_to_coordinator);
        const phoneNum = selected.phone || "918790309981";
        const waUrl = `https://wa.me/${phoneNum}?text=${waText}`;
        if (!tempWin || tempWin.closed || typeof tempWin.closed == "undefined") {
          setActiveBanner({ type: "blocker", url: waUrl, coordinator: selected.coordinator, phone: phoneNum });
        } else {
          tempWin.location.href = waUrl;
          showToast(`📲 WhatsApp alert auto-redirected to ${selected.coordinator}!`);
        }
      } else {
        if (tempWin) tempWin.close();
      }
    } catch {
      if (tempWin) tempWin.close();
      alert("Image scan failed. Check backend connection.");
    } finally {
      setScanning(false);
    }
  };

  // Simulate scan (no image, uses demo data)
  const simulateScan = (tempWin: Window | null) => {
    clearSimulateTimers();
    setScanning(true);
    
    const timer1 = setTimeout(() => {
      setScanning(false);
      const logTime1 = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const newLog = `${logTime1} — AI re-scanned all wards. Ward F updated: rating dropped to 52%.`;
      setLogs(l => [newLog, ...l]);
      
      const msg = "🚨 Alert: Ward F rating dropped to 52%. Dustbins overflowing, corridor cluttered. Please resolve immediately. You have 1 hour before escalation.";
      setWards(w => w.map(ward =>
        ward.id === 6 ? { ...ward, rating: 52, status: "critical" as const, lastMsg: msg, escalated: false } : ward
      ));
      
      if (selected.id === 6) {
        setSelected(s => ({ ...s, rating: 52, status: "critical" as const, lastMsg: msg, escalated: false }));
      }
      
      // Auto WhatsApp open for simulated F failure
      const waText = encodeURIComponent(msg);
      const phoneNum = "918790309981";
      const waUrl = `https://wa.me/${phoneNum}?text=${waText}`;
      
      if (!tempWin || tempWin.closed || typeof tempWin.closed == "undefined") {
        setActiveBanner({ type: "blocker", url: waUrl, coordinator: "Vijay Babu", phone: phoneNum });
      } else {
        tempWin.location.href = waUrl;
        showToast("📲 WhatsApp alert auto-redirected to Vijay Babu!");
      }
    }, 2000);

    // T = 12s: 1-hour recheck warning
    const timer2 = setTimeout(() => {
      const logTime2 = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const newLog = `${logTime2} — 1 hour elapsed (simulated). AI re-scanned Ward F: rating remains 52%. Warning sent to Vijay Babu.`;
      setLogs(l => [newLog, ...l]);
      
      const msg = "⚠️ Recheck Warning: Ward F hygiene issues remain unresolved after 1 hour. Solve immediately to avoid HOD escalation.";
      const phoneNum = "918790309981";
      const waText = encodeURIComponent(msg);
      const waUrl = `https://wa.me/${phoneNum}?text=${waText}`;
      
      setActiveBanner({ type: "warning2", url: waUrl, coordinator: "Vijay Babu", phone: phoneNum });
      showToast("⏳ 1 hour check: Ward F still has critical issues!");
    }, 12000);

    // T = 22s: Escalation to HOD
    const timer3 = setTimeout(() => {
      const logTime3 = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const newLog = `${logTime3} — Escalation triggered: HOD Dr. Srinivas notified about Ward F.`;
      setLogs(l => [newLog, ...l]);
      
      setWards(w => w.map(ward =>
        ward.id === 6 ? { ...ward, escalated: true } : ward
      ));
      
      if (selected.id === 6) {
        setSelected(s => ({ ...s, escalated: true }));
      }
      
      const msg = "🚨 ESCALATION: Ward F coordinator Vijay Babu failed to resolve hygiene issues. Escalated to HOD Dr. Srinivas.";
      const phoneNum = "918790309981";
      const waText = encodeURIComponent(msg);
      const waUrl = `https://wa.me/${phoneNum}?text=${waText}`;
      
      setActiveBanner({ type: "escalation", url: waUrl, coordinator: "Vijay Babu (HOD Link)", phone: phoneNum });
      showToast("🚨 Ward F has been escalated to HOD!");
    }, 22000);

    simulateTimersRef.current = [timer1, timer2, timer3];
  };

  const getRatingColor = (r: number) => r >= 80 ? "#10b981" : r >= 60 ? "#f59e0b" : "#ef4444";

  const overallHealth = Math.round(wards.reduce((s, w) => s + w.rating, 0) / wards.length);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
      {/* Hidden file input for real image upload */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) {
            const tempWin = window.open("", "_blank");
            if (tempWin) writeLoadingHTML(tempWin, "🏥 SmartCare AI Dispatcher", "Analyzing ward hygiene image and preparing alerts...");
            handleRealImageScan(f, tempWin);
          }
          e.target.value = "";
        }}
      />
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
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "18px" }}>
          🏥 Admin <span style={{ color: "#10b981" }}>Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-ghost" style={{ padding: "10px 16px", fontSize: "13px" }}
            onClick={() => fileInputRef.current?.click()} disabled={scanning}>
            📸 Upload Ward Image (AI)
          </button>
          <button className="btn-primary" onClick={() => {
            const tempWin = window.open("", "_blank");
            if (tempWin) writeLoadingHTML(tempWin, "🏥 SmartCare AI Dispatcher", "Simulating AI ward hygiene scan and preparing alerts...");
            simulateScan(tempWin);
          }} style={{ padding: "10px 20px", fontSize: "13px" }}
            disabled={scanning}>
            {scanning ? "🔄 Scanning..." : "🔍 Simulate AI Scan"}
          </button>
        </div>
      </div>

      {activeBanner && (
        <div style={{
          background: activeBanner.type === "escalation" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
          border: activeBanner.type === "escalation" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(245,158,11,0.3)",
          padding: "12px 28px",
          fontSize: "14px",
          color: activeBanner.type === "escalation" ? "#f87171" : "#f59e0b",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          margin: "16px 32px 0",
          borderRadius: "8px",
        }}>
          <span>
            {activeBanner.type === "blocker" && `📲 AI Auto-Alert: WhatsApp message ready for ${activeBanner.coordinator} (+${activeBanner.phone})!`}
            {activeBanner.type === "warning2" && `📲 AI Auto-Alert (1 Hour Re-check): Ward F remains dirty! Send warning to ${activeBanner.coordinator}.`}
            {activeBanner.type === "escalation" && `🚨 AI Escalation: No action taken. Send escalation alert to HOD (+${activeBanner.phone}).`}
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                window.open(activeBanner.url, '_blank');
                setActiveBanner(null);
              }}
              className={activeBanner.type === "escalation" ? "btn-danger" : "btn-success"}
              style={{ padding: "6px 16px", fontSize: "12px", fontWeight: 700 }}
            >
              {activeBanner.type === "blocker" && "🚀 Open WhatsApp"}
              {activeBanner.type === "warning2" && "🚀 Send Second Warning"}
              {activeBanner.type === "escalation" && "🚨 Send Escalation to HOD"}
            </button>
            <button
              onClick={() => setActiveBanner(null)}
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: "13px"
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "28px 32px", overflowY: "auto", flex: 1 }}>
        {/* Top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" }}>
          {[
            { label: "Overall Hygiene Score", value: `${overallHealth}%`, icon: "🏥", color: getRatingColor(overallHealth) },
            { label: "Wards in Good State", value: wards.filter(w => w.status === "good").length, icon: "✅", color: "#10b981" },
            { label: "Warnings Active", value: wards.filter(w => w.status === "warning").length, icon: "⚠️", color: "#f59e0b" },
            { label: "Escalations Triggered", value: wards.filter(w => w.escalated).length, icon: "🚨", color: "#ef4444" },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ fontSize: "32px" }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" }}>
          {/* Ward Grid */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              {wards.map(ward => (
                <div key={ward.id}
                  onClick={() => setSelected(ward)}
                  className="glass-card"
                  style={{
                    padding: "20px", cursor: "pointer", transition: "all 0.3s",
                    borderColor: selected.id === ward.id ? statusConfig[ward.status].color : undefined,
                    boxShadow: selected.id === ward.id ? `0 0 20px ${statusConfig[ward.status].bg}` : undefined,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "2px" }}>{ward.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>👤 {ward.coordinator}</div>
                    </div>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "100px",
                      background: statusConfig[ward.status].bg,
                      color: statusConfig[ward.status].color,
                      border: `1px solid ${statusConfig[ward.status].border}`,
                    }}>{statusConfig[ward.status].label}</span>
                  </div>

                  {/* Rating bar */}
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Hygiene Score</span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: getRatingColor(ward.rating) }}>{ward.rating}%</span>
                    </div>
                    <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${ward.rating}%`,
                        background: `linear-gradient(90deg, ${getRatingColor(ward.rating)}, ${getRatingColor(ward.rating)}99)`,
                        borderRadius: "3px", transition: "width 0.8s ease",
                      }} />
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Last checked: {ward.lastCheck}</div>
                  {ward.escalated && (
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "#f87171", fontWeight: 600 }}>
                      🚨 Escalated to HOD
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* AI Escalation Log */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>🤖 AI Escalation Log</div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Auto-generated by Facility Agent</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {logs.map((log, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: "8px",
                    background: log.includes("🚨") ? "rgba(239,68,68,0.08)" : log.includes("⚠️") ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.06)",
                    borderLeft: `3px solid ${log.includes("🚨") ? "#ef4444" : log.includes("⚠️") ? "#f59e0b" : "#10b981"}`,
                    fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5,
                  }}>{log}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Selected Ward Detail */}
          <div>
            <div className="glass-card" style={{ padding: "24px", marginBottom: "16px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>{selected.name}</div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>Coordinator: {selected.coordinator}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>📞 Phone:</span>
                  <input
                    type="text"
                    value={selected.phone || ""}
                    onChange={e => {
                      const val = e.target.value;
                      setWards(w => w.map(ward => ward.id === selected.id ? { ...ward, phone: val } : ward));
                      setSelected(s => ({ ...s, phone: val }));
                    }}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      color: "white",
                      fontSize: "12px",
                      width: "100%",
                      fontFamily: "monospace"
                    }}
                    placeholder="e.g. 919876543210"
                  />
                </div>
              </div>

              {/* Big rating circle */}
              <div style={{ textAlign: "center", padding: "24px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", margin: "16px 0" }}>
                <div style={{
                  width: "100px", height: "100px", borderRadius: "50%",
                  background: `conic-gradient(${getRatingColor(selected.rating)} ${selected.rating * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column",
                  }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: getRatingColor(selected.rating) }}>{selected.rating}%</div>
                  </div>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Hygiene Rating</div>
              </div>

              {/* Issues */}
              {selected.issues.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, marginBottom: "8px" }}>IDENTIFIED ISSUES</div>
                  {selected.issues.map(issue => (
                    <div key={issue} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 12px", borderRadius: "8px",
                      background: "rgba(239,68,68,0.08)", marginBottom: "6px", fontSize: "13px",
                    }}>
                      <span>⚠️</span><span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Last AI message */}
              <div style={{
                background: "rgba(0,212,255,0.06)", border: "1px solid var(--border)",
                borderLeft: "3px solid var(--primary)",
                borderRadius: "8px", padding: "12px", marginBottom: "16px",
              }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>LAST AI MESSAGE SENT</div>
                <div style={{ fontSize: "13px" }}>{selected.lastMsg}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  onClick={() => {
                    const waText = encodeURIComponent(selected.lastMsg);
                    const waUrl = `https://wa.me/${selected.phone || "919876543210"}?text=${waText}`;
                    window.open(waUrl, "_blank");
                  }}
                  className="btn-primary"
                  style={{ width: "100%" }}
                >
                  📲 Send WhatsApp Alert
                </button>
                {selected.status !== "good" && !selected.escalated && (
                  <button
                    onClick={() => {
                      setWards(w => w.map(ward => ward.id === selected.id ? { ...ward, escalated: true } : ward));
                      setSelected(s => ({ ...s, escalated: true }));
                      const logEntry = `${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — Escalated ${selected.name} to HOD Dr. Srinivas.`;
                      setLogs(l => [logEntry, ...l]);
                      showToast(`🚨 Escalation alert sent to HOD for ${selected.name}!`);
                    }}
                    className="btn-danger"
                    style={{ width: "100%" }}
                  >
                    🚨 Escalate to HOD
                  </button>
                )}
                <button
                  onClick={() => {
                    showToast(`📸 CCTV image requested for ${selected.name}...`);
                    setTimeout(() => {
                      fileInputRef.current?.click();
                    }, 1000);
                  }}
                  className="btn-ghost"
                  style={{ width: "100%" }}
                >
                  📸 Request CCTV Image
                </button>
              </div>
            </div>

            {/* Escalation flow visual */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>🔄 AI Escalation Workflow</div>
              {[
                { step: "Scan", desc: "AI scans ward via CCTV", done: true },
                { step: "Rate", desc: "Hygiene score generated", done: true },
                { step: "Alert", desc: "Msg sent to coordinator", done: selected.status !== "good" },
                { step: "Wait 1hr", desc: "AI waits for response", done: selected.escalated },
                { step: "Escalate", desc: "HOD notified if no action", done: selected.escalated },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0,
                    background: item.done ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(30,41,59,0.8)",
                    border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px",
                  }}>{item.done ? "✓" : i + 1}</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{item.step}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px",
          background: "rgba(16,185,129,0.95)", backdropFilter: "blur(10px)",
          color: "white", padding: "14px 24px", borderRadius: "10px",
          border: "1px solid rgba(16,185,129,0.3)", boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          fontSize: "14px", fontWeight: 600, zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
