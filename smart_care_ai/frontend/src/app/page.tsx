"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: "Patients Today", value: "247", icon: "👥", color: "#00d4ff" },
    { label: "Avg Wait Time", value: "8 min", icon: "⏱️", color: "#10b981" },
    { label: "Wards Monitored", value: "12", icon: "🏥", color: "#7c3aed" },
    { label: "AI Accuracy", value: "98.2%", icon: "🎯", color: "#f59e0b" },
  ];

  const portals = [
    {
      id: "doctor",
      title: "Doctor Dashboard",
      subtitle: "Patient Queue & Records",
      desc: "View patient queue, vitals, and AI-summarized consultation notes.",
      icon: "🩺",
      gradient: "linear-gradient(135deg, #7c3aed, #5b21b6)",
      glow: "0 0 40px rgba(124, 58, 237, 0.3)",
      path: "/doctor",
      badge: "SECURE",
    },
    {
      id: "admin",
      title: "Admin & Hygiene",
      subtitle: "AI Ward Monitoring",
      desc: "Real-time CCTV hygiene scoring and automatic escalation alerts.",
      icon: "🏥",
      gradient: "linear-gradient(135deg, #10b981, #059669)",
      glow: "0 0 40px rgba(16, 185, 129, 0.3)",
      path: "/admin",
      badge: "MONITORING",
    },
    {
      id: "camera",
      title: "AI Smart Reception",
      subtitle: "Auto Telugu Voice + YOLOv8",
      desc: "Patient వచ్చిన వెంటనే AI automatic గా Telugu లో మాట్లాడుతుంది. No button clicks!",
      icon: "📡",
      gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      glow: "0 0 40px rgba(245, 158, 11, 0.3)",
      path: "/camera",
      badge: "AUTO AI",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", position: "relative", overflow: "hidden" }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }} />

      {/* Ambient blobs */}
      <div style={{
        position: "fixed", top: "-20%", right: "-10%", width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(0, 212, 255, 0.08), transparent 70%)",
        zIndex: 0, borderRadius: "50%",
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", left: "-10%", width: "500px", height: "500px",
        background: "radial-gradient(circle, rgba(124, 58, 237, 0.08), transparent 70%)",
        zIndex: 0, borderRadius: "50%",
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Top navbar */}
        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 48px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(2, 8, 23, 0.8)",
          backdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px",
            }}>🏥</div>
            <div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "18px", letterSpacing: "-0.5px" }}>
                Smart<span style={{ color: "var(--primary)" }}>Care</span> AI
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Intelligent Hospital Management</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 16px", borderRadius: "100px",
              background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)",
            }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} className="pulse-animation" />
              <span style={{ fontSize: "13px", color: "#34d399", fontWeight: 500 }}>All Systems Operational</span>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "14px", color: "var(--text-muted)" }}>{time}</div>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ textAlign: "center", padding: "80px 48px 48px" }} className="fade-in-up">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "8px 20px", borderRadius: "100px",
            background: "rgba(0, 212, 255, 0.1)", border: "1px solid var(--border)",
            marginBottom: "28px",
          }}>
            <span style={{ fontSize: "12px" }}>✨</span>
            <span style={{ fontSize: "13px", color: "var(--primary)", fontWeight: 500 }}>Google Hackathon 2026 — Agentic AI Project</span>
          </div>

          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "clamp(48px, 6vw, 80px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-2px",
            marginBottom: "20px",
          }}>
            <span>AI That </span>
            <span className="gradient-text">Thinks. Decides.</span>
            <br />
            <span>Acts for </span>
            <span className="gradient-text-green">Better Healthcare.</span>
          </h1>

          <p style={{
            fontSize: "18px", color: "var(--text-muted)", maxWidth: "580px",
            margin: "0 auto 48px", lineHeight: 1.7,
          }}>
            3 autonomous AI agents managing hospital operations — from patient triage to ward hygiene monitoring — with zero manual intervention.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap", marginBottom: "64px" }}>
            {stats.map((s) => (
              <div key={s.label} className="glass-card" style={{ padding: "20px 28px", textAlign: "center" }}>
                <div style={{ fontSize: "28px", marginBottom: "4px" }}>{s.icon}</div>
                <div style={{ fontSize: "26px", fontWeight: 700, color: s.color, fontFamily: "'Outfit', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Portal Cards */}
        <div style={{ padding: "0 48px 48px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
              Choose Your Portal
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>Three specialized AI-powered portals, one seamless ecosystem</p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px", maxWidth: "1100px", margin: "0 auto",
          }}>
            {portals.map((portal, i) => (
              <div
                key={portal.id}
                onClick={() => router.push(portal.path)}
                className="glass-card fade-in-up"
                style={{
                  padding: "32px", cursor: "pointer", transition: "all 0.3s ease",
                  animationDelay: `${i * 0.1}s`,
                  position: "relative", overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = portal.glow;
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                }}
              >
                {/* Gradient top bar */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "3px",
                  background: portal.gradient,
                }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div style={{
                    width: "60px", height: "60px", borderRadius: "16px",
                    background: portal.gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "28px", boxShadow: portal.glow,
                  }}>
                    {portal.icon}
                  </div>
                  <span className="badge badge-waiting" style={{ fontSize: "10px" }}>{portal.badge}</span>
                </div>

                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>
                  {portal.title}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--primary)", marginBottom: "12px", fontWeight: 500 }}>
                  {portal.subtitle}
                </p>
                <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "24px" }}>
                  {portal.desc}
                </p>

                <button className="btn-ghost" style={{ width: "100%", padding: "12px" }}>
                  Open Portal →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Flow Diagram */}
        <div style={{ padding: "0 48px 80px", maxWidth: "1100px", margin: "0 auto" }}>
          <div className="glass-card" style={{ padding: "40px" }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
              How The <span className="gradient-text">Agentic AI</span> Works
            </h2>
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", marginBottom: "40px" }}>
              3 autonomous agents working in parallel, 24/7
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: "16px" }}>
              {[
                { step: "01", title: "Patient Arrives", desc: "Face detected by CCTV. AI greets in Telugu/English.", color: "#00d4ff", icon: "👤" },
                { step: "→", title: "", desc: "", color: "", icon: "" },
                { step: "02", title: "Triage Agent", desc: "Voice collects symptoms. AI assigns priority token (Emergency/Normal).", color: "#7c3aed", icon: "🧠" },
                { step: "→", title: "", desc: "", color: "", icon: "" },
                { step: "03", title: "Doctor Alert", desc: "Emergency patients get instant doctor notification. Queue auto-managed.", color: "#f59e0b", icon: "🔔" },
              ].map((item, i) => (
                item.step === "→" ? (
                  <div key={i} style={{ textAlign: "center", fontSize: "24px", color: "var(--text-muted)" }}>→</div>
                ) : (
                  <div key={i} className="glass-card-light" style={{ padding: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>{item.icon}</div>
                    <div style={{ fontSize: "11px", color: item.color, fontWeight: 700, marginBottom: "6px", letterSpacing: "1px" }}>STEP {item.step}</div>
                    <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{item.title}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          borderTop: "1px solid var(--border)", padding: "24px 48px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "rgba(2, 8, 23, 0.8)",
        }}>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            🏥 Smart Care AI — Built for <span style={{ color: "var(--primary)" }}>Google Hackathon 2026</span>
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Powered by Agentic AI × Gemini Live API
          </div>
        </footer>
      </div>
    </div>
  );
}
