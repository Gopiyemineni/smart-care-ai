"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "processing";

interface Message {
  role: "ai" | "user";
  text: string;
  time: string;
}

const MAX_STEPS = 4;

export default function VoicePage() {
  const router = useRouter();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [language, setLanguage] = useState<"telugu" | "english">("english");
  const [sessionActive, setSessionActive] = useState(false);
  const [browserSupport, setBrowserSupport] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  const recognitionRef = useRef<any | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isListeningRef = useRef(false);
  const histRef = useRef<{role:string;content:string}[]>([]);
  const activeRef = useRef(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // Check browser support
  useEffect(() => {
    const hasSTT = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    setBrowserSupport(hasSTT);
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((role: "ai" | "user", text: string) => {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { role, text, time }]);
  }, []);

  // TTS — speak text then callback
  const speakText = useCallback(async (text: string, onDone: () => void) => {
    setVoiceState("speaking");
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "female" })
      });
      const data = await res.json();
      if (data.audio_base64) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio("data:audio/wav;base64," + data.audio_base64);
        audioRef.current = audio;
        audio.onended = () => { setVoiceState("idle"); onDone(); };
        audio.onerror = () => { setVoiceState("idle"); onDone(); };
        audio.play().catch((e) => {
          console.error("Audio play error", e);
          setVoiceState("idle"); onDone();
        });
      } else {
        setVoiceState("idle"); onDone();
      }
    } catch (e) {
      console.error("TTS fetch error:", e);
      setVoiceState("idle"); onDone();
    }
  }, []);

  // STT — listen once and return transcript
  const listenOnce = useCallback((onResult: (text: string) => void) => {
    const SRClass = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SRClass) { onResult(""); return; }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = new SRClass();
    recognitionRef.current = recognition;
    isListeningRef.current = true;

    recognition.lang = language === "telugu" ? "te-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalResult = "";

    recognition.onstart = () => {
      setVoiceState("listening");
      setInterimText("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalResult += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setInterimText(finalResult || interim);
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setInterimText("");
      if (finalResult.trim()) {
        onResult(finalResult.trim());
      } else {
        if (activeRef.current) {
          setVoiceState("listening");
          addMessage("ai", language === "telugu" ? "క్షమించండి, మళ్ళీ చెప్పండి..." : "Sorry, I didn't catch that. Please speak again.");
          setTimeout(() => listenOnce(onResult), 800);
        }
      }
    };

    recognition.onerror = (event: any) => {
      isListeningRef.current = false;
      console.error("Speech error:", event.error);
      if (event.error === "no-speech") {
        setInterimText("");
        if (activeRef.current) {
          setVoiceState("listening");
          setTimeout(() => listenOnce(onResult), 500);
        }
      } else if (event.error === "not-allowed") {
        addMessage("ai", "Microphone access denied. Please allow microphone and refresh.");
        setVoiceState("idle");
        setSessionActive(false);
      }
    };

    setVoiceState("listening");
    recognition.start();
  }, [language, addMessage]);

  // One dynamic turn
  const doTurn = useCallback(async () => {
    if (!activeRef.current) return;
    setVoiceState("processing");
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: histRef.current, language }),
      });
      const data = await res.json();
      const reply = data.reply || "";
      histRef.current.push({ role: "assistant", content: reply });
      addMessage("ai", reply);

      speakText(reply, () => {
        if (!activeRef.current) return;
        if (data.done) {
          setVoiceState("idle");
          setSessionActive(false);
          activeRef.current = false;
          return;
        }
        setStepIndex(prev => prev + 1);
        listenOnce((userText) => {
          if (!activeRef.current) return;
          if (userText) {
            histRef.current.push({ role: "user", content: userText });
            addMessage("user", userText);
          }
          doTurn();
        });
      });
    } catch {
      const fb = language === "telugu" ? "క్షమించండి, connection సమస్య వచ్చింది." : "Sorry, a connection problem occurred.";
      addMessage("ai", fb);
      speakText(fb, () => {
        setVoiceState("idle");
        setSessionActive(false);
        activeRef.current = false;
      });
    }
  }, [language, addMessage, speakText, listenOnce]);

  const startSession = () => {
    setMessages([]);
    setInterimText("");
    setTranscript("");
    setStepIndex(0);
    setSessionActive(true);
    activeRef.current = true;
    histRef.current = [];

    const firstMsg = language === "telugu"
      ? "నమస్కారం! Smart Care AI కి స్వాగతం. మీ పేరు ఏమిటి?"
      : "Hello! Welcome to Smart Care AI. May I know your name please?";

    setVoiceState("connecting");
    setTimeout(() => {
      histRef.current.push({ role: "assistant", content: firstMsg });
      addMessage("ai", firstMsg);
      speakText(firstMsg, () => {
        if (!activeRef.current) return;
        listenOnce((userText) => {
          if (!activeRef.current) return;
          if (userText) {
            histRef.current.push({ role: "user", content: userText });
            addMessage("user", userText);
          }
          doTurn();
        });
      });
    }, 800);
  };

  const stopSession = () => {
    activeRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }
    isListeningRef.current = false;
    setSessionActive(false);
    setVoiceState("idle");
    setInterimText("");
  };

  const manualListen = () => {
    if (voiceState === "listening") return;
    listenOnce((text) => {
      if (text) {
        histRef.current.push({ role: "user", content: text });
        addMessage("user", text);
      }
      doTurn();
    });
  };

  const stateConfig: Record<VoiceState, { color: string; label: string; icon: string; animate: boolean }> = {
    idle: { color: "var(--text-muted)", label: "Ready", icon: "🎙️", animate: false },
    connecting: { color: "#f59e0b", label: "Connecting...", icon: "⏳", animate: true },
    listening: { color: "#10b981", label: language === "telugu" ? "వింటున్నాను..." : "Listening...", icon: "👂", animate: true },
    speaking: { color: "var(--primary)", label: language === "telugu" ? "AI మాట్లాడుతోంది..." : "AI Speaking...", icon: "🔊", animate: true },
    processing: { color: "#7c3aed", label: language === "telugu" ? "ఆలోచిస్తోంది..." : "Thinking...", icon: "🧠", animate: true },
  };
  const sc = stateConfig[voiceState];
  const isSessionDone = !sessionActive && messages.length > 0;
  const progressPct = Math.min((stepIndex / MAX_STEPS) * 100, 100);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 32px", borderBottom: "1px solid var(--border)",
        background: "rgba(2,8,23,0.9)", backdropFilter: "blur(20px)",
      }}>
        <button onClick={() => { stopSession(); router.push("/"); }} style={{
          background: "none", border: "1px solid var(--border)", color: "var(--text-muted)",
          borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontSize: "13px",
        }}>← Home</button>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "18px" }}>
          🎤 Voice <span style={{ color: "var(--primary)" }}>Kiosk</span>
        </div>
        {/* Language toggle */}
        <div style={{ display: "flex", gap: "8px" }}>
          {(["english", "telugu"] as const).map(lang => (
            <button key={lang} disabled={sessionActive} onClick={() => { setLanguage(lang); setMessages([]); }} style={{
              padding: "6px 16px", borderRadius: "100px", fontSize: "13px", fontWeight: 600, cursor: sessionActive ? "not-allowed" : "pointer",
              background: language === lang ? "linear-gradient(135deg,#00d4ff,#7c3aed)" : "transparent",
              border: `1px solid ${language === lang ? "transparent" : "var(--border)"}`,
              color: language === lang ? "white" : "var(--text-muted)", transition: "all 0.2s",
            }}>
              {lang === "telugu" ? "🇮🇳 తెలుగు" : "🇬🇧 English"}
            </button>
          ))}
        </div>
      </div>

      {/* Browser support warning */}
      {!browserSupport && (
        <div style={{
          background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
          padding: "12px 32px", fontSize: "13px", color: "#fbbf24", textAlign: "center",
        }}>
          ⚠️ Please use <strong>Google Chrome</strong> for voice features. Other browsers may not support Speech Recognition.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: "calc(100vh - 65px)" }}>
        {/* Left: AI Avatar */}
        <div style={{
          background: "rgba(15,23,42,0.95)", borderRight: "1px solid var(--border)",
          padding: "40px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px",
        }}>
          {/* AI Orb */}
          <div style={{ position: "relative", width: "160px", height: "160px", marginTop: "16px" }}>
            <div style={{
              position: "absolute", inset: "-14px", borderRadius: "50%",
              border: `2px solid ${sc.color}`, opacity: sc.animate ? 0.6 : 0.2,
              transition: "all 0.4s",
            }} className={sc.animate ? "pulse-animation" : ""} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "radial-gradient(circle at 40% 40%, rgba(0,212,255,0.25), rgba(124,58,237,0.15))",
              border: `3px solid ${sc.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "60px", transition: "border-color 0.4s",
            }}>🤖</div>
            {/* Wave bars */}
            {sc.animate && (
              <div style={{
                position: "absolute", bottom: "-32px", left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: "4px", alignItems: "flex-end",
              }}>
                {[0,1,2,3,4,5,6].map(i => (
                  <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.08}s`, background: sc.color }} />
                ))}
              </div>
            )}
          </div>

          {/* Status label */}
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{sc.icon}</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: sc.color }}>{sc.label}</div>
          </div>

          {/* Live interim transcript */}
          {interimText && (
            <div style={{
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "10px", padding: "12px 14px", width: "100%",
              fontSize: "13px", color: "#34d399", fontStyle: "italic", lineHeight: 1.5,
              minHeight: "48px",
            }}>
              🎙️ "{interimText}"
            </div>
          )}

          {/* Progress bar */}
          {sessionActive && (
            <div style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
                <span>Progress</span>
                <span>Step {Math.min(stepIndex + 1, MAX_STEPS)} / {MAX_STEPS}</span>
              </div>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                <div style={{
                  height: "100%", width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #00d4ff, #7c3aed)",
                  borderRadius: "2px", transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            {!sessionActive ? (
              <button className="btn-primary" onClick={startSession} disabled={!browserSupport}
                style={{ padding: "16px", fontSize: "15px", width: "100%" }}>
                🎤 {language === "telugu" ? "మాట్లాడడం మొదలుపెట్టండి" : "Start Voice Session"}
              </button>
            ) : (
              <>
                {voiceState === "listening" && (
                  <div style={{
                    padding: "14px", borderRadius: "12px", textAlign: "center",
                    background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.4)",
                    fontSize: "14px", fontWeight: 600, color: "#34d399",
                  }} className="pulse-animation">
                    🎙️ {language === "telugu" ? "మాట్లాడండి..." : "Speak now..."}
                  </div>
                )}
                {voiceState === "idle" && sessionActive && (
                  <button className="btn-success" onClick={manualListen}
                    style={{ padding: "14px", width: "100%", fontSize: "14px" }}>
                    🔁 {language === "telugu" ? "మళ్ళీ చెప్పండి" : "Speak Again"}
                  </button>
                )}
                <button className="btn-danger" onClick={stopSession}
                  style={{ padding: "12px", width: "100%", fontSize: "13px" }}>
                  ⏹ End Session
                </button>
              </>
            )}
          </div>

          {/* Tips */}
          <div style={{ width: "100%", marginTop: "auto" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>TIPS</div>
            {[
              "Use Chrome for best results",
              "Speak clearly after AI finishes",
              "Quiet environment works best",
            ].map((tip, i) => (
              <div key={i} style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "5px" }}>• {tip}</div>
            ))}
          </div>
        </div>

        {/* Right: Chat */}
        <div style={{ display: "flex", flexDirection: "column", padding: "32px", gap: "16px" }}>
          <div>
            <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
              Conversation <span className="gradient-text">Transcript</span>
            </h2>
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              {language === "telugu"
                ? "AI తెలుగులో మీతో మాట్లాడుతుంది మరియు మీ symptoms విని token ఇస్తుంది."
                : "AI will guide you through the registration process step by step."}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎙️</div>
                <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                  {language === "telugu" ? "సంభాషణ మొదలుకాలేదు" : "No conversation yet"}
                </div>
                <div style={{ fontSize: "13px" }}>
                  {language === "telugu"
                    ? "ఎడమ వైపు 'మాట్లాడడం మొదలుపెట్టండి' నొక్కండి"
                    : "Click 'Start Voice Session' to begin"}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", gap: "12px",
                flexDirection: msg.role === "ai" ? "row" : "row-reverse",
              }} className="fade-in-up">
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                  background: msg.role === "ai"
                    ? "linear-gradient(135deg,#00d4ff,#7c3aed)"
                    : "linear-gradient(135deg,#10b981,#059669)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
                }}>
                  {msg.role === "ai" ? "🤖" : "👤"}
                </div>
                <div style={{ maxWidth: "68%" }}>
                  <div style={{
                    padding: "13px 17px",
                    borderRadius: msg.role === "ai" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                    background: msg.role === "ai" ? "rgba(0,212,255,0.07)" : "rgba(16,185,129,0.07)",
                    border: `1px solid ${msg.role === "ai" ? "var(--border)" : "rgba(16,185,129,0.2)"}`,
                    fontSize: "14px", lineHeight: 1.65,
                  }}>
                    {msg.text}
                  </div>
                  <div style={{
                    fontSize: "11px", color: "var(--text-muted)", marginTop: "4px",
                    textAlign: msg.role === "ai" ? "left" : "right", paddingLeft: "4px",
                  }}>
                    {msg.role === "ai" ? "Smart Care AI" : language === "telugu" ? "పేషెంట్" : "Patient"} · {msg.time}
                  </div>
                </div>
              </div>
            ))}

            {/* Done card */}
            {isSessionDone && (
              <div style={{
                background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: "14px", padding: "24px", textAlign: "center",
              }} className="fade-in-up">
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>
                  {language === "telugu" ? "Voice Registration పూర్తయింది!" : "Voice Registration Complete!"}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
                  {language === "telugu"
                    ? "OP counter లో మీ token తీసుకోండి"
                    : "Collect your token at the OP counter"}
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button className="btn-primary" onClick={() => router.push("/kiosk")}>
                    📋 Full Registration →
                  </button>
                  <button className="btn-ghost" onClick={startSession}>
                    🔁 New Patient
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
