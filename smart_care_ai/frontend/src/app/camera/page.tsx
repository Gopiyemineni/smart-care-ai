"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WS_URL = API.replace("http://", "ws://").replace("https://", "wss://") + "/ws/detect";
type Phase = "scanning" | "talking" | "token";
type AIState = "idle"|"listening"|"thinking"|"speaking";
interface Msg { role:"ai"|"user"; text:string; }
interface TokenR { token:string; priority:"emergency"|"high"|"normal"; name:string; }

const PRI = {
  emergency:{color:"#ef4444",bg:"rgba(239,68,68,0.15)",label:"🚨 EMERGENCY"},
  high:     {color:"#f59e0b",bg:"rgba(245,158,11,0.15)",label:"⚠️ HIGH PRIORITY"},
  normal:   {color:"#10b981",bg:"rgba(16,185,129,0.15)",label:"✅ NORMAL"},
};

export default function CameraPage() {
  const router = useRouter();
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wsRef      = useRef<WebSocket|null>(null);
  const liveWsRef  = useRef<WebSocket|null>(null);
  const micStreamRef = useRef<MediaStream|null>(null);
  const ivRef      = useRef<ReturnType<typeof setInterval>|null>(null);
  const recogRef   = useRef<unknown>(null);
  const activeRef  = useRef(false);
  const coolRef    = useRef(false);
  const histRef    = useRef<{role:string;content:string}[]>([]);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const cameraOnRef  = useRef(false); // mirrors cameraOn state for use inside WS closures
  const failureCountRef = useRef(0); // consecutive Gemini WS failure counter
  const tokenPhaseRef = useRef(false); // true during token generation & 10s display phase
  const noPersonFramesRef = useRef(0); // consecutive frames with no person detected

  const [phase,    setPhase]    = useState<Phase>("scanning");
  const [aiState,  setAiState]  = useState<AIState>("idle");
  const [wsOk,     setWsOk]     = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [msgs,     setMsgs]     = useState<Msg[]>([]);
  const [interim,  setInterim]  = useState("");
  const [faceImg,  setFaceImg]  = useState<string|null>(null);
  const [tokenR,   setTokenR]   = useState<TokenR|null>(null);
  const [secs,     setSecs]     = useState(0);
  const [persons,  setPersons]  = useState(0);
  const [apiError, setApiError] = useState<string|null>(null);
  const [apiBlocked, setApiBlocked] = useState(false); // true after 2+ consecutive failures
  const msgEnd = useRef<HTMLDivElement>(null);

  useEffect(()=>{ msgEnd.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const addMsg = useCallback((role:"ai"|"user", text:string)=>{
    setMsgs(p=>[...p,{role,text}]);
  },[]);

  const audioCtxRef = useRef<AudioContext|null>(null);

  /* ── Gemini Multimodal Live API ──────────────────────────────── */
  const RECEPTIONIST_SYSTEM_TELUGU = `నువ్వు Smart Care Hospital లో front-desk AI receptionist వి. నువ్వు ఒక doctor కాదు, nurse కాదు — నువ్వు hospital receptionist వి. నీ పని patient registration మాత్రమే. ఎట్టి పరిస్థితుల్లోనూ నీ పేరు జెమిని (Gemini) అని చెప్పొద్దు.

నీ conversation flow (ఈ order లో మాత్రమే):
STEP 1: Patient వచ్చిన వెంటనే "నమస్కారం! Smart Care Hospital కి స్వాగతం. మీ పేరు చెప్పండి?" అని అడుగు.
STEP 2: వారి పేరు note చేసుకో.
STEP 3: "మీకు ఏమి అయింది, చెప్పండి?" అని అడుగు. Patient చెప్పిన symptoms వినిపించు.
STEP 4: "ఇంకేమైనా సమస్యలు ఉన్నాయా?" అని అడుగు.
STEP 5: Patient "లేదు" లేదా "అంతే" అంటే — వెంటనే "సరే [పేరు] గారూ, మీ token generate చేస్తున్నాను. దయచేసి waiting hall లో కూర్చోండి, doctor మీకు చెక్-అప్ చేస్తారు." అని చెప్పి, generate_patient_token tool call చేయి.

TOKEN PRIORITY RULES (నువ్వు decide చేయాలి):
- emergency: chest pain, heart pain, breathing problem, unconscious, stroke, severe bleeding
- high: high fever, severe headache, severe pain, vomiting, accident
- normal: mild fever, cold, cough, body pain, routine checkup

STRICT RULES — నువ్వు ఏ పరిస్థితిలోనూ చేయకూడనివి:
❌ NEVER say "doctor దగ్గరికి వెళ్ళండి" — doctor దగ్గరికే వస్తున్నారు, అది నువ్వు చెప్పకూడదు.
❌ NEVER say "checkup చేయించుకోండి" — అది doctor చేస్తాడు.
❌ NEVER give medical advice (medicine లు చెప్పడం, treatment suggest చేయడం).
❌ NEVER say more than 2 sentences per turn.
❌ NEVER describe what you are doing internally.
✅ ALWAYS issue the token at the end — ఎట్టి పరిస్థితుల్లోనూ generate_patient_token tool call మర్చిపోవద్దు.
✅ generate_patient_token function ని call చేసేటప్పుడు, patient_name ని కచ్చితంగా English letters లోకి transliterate చేసి పంపాలి (ఉదాహరణకు: 'గోపి' -> 'Gopi', 'రాము' -> 'Ramu', 'సురేష్' -> 'Suresh'). ఎట్టి పరిస్థితుల్లోనూ Telugu characters లో name పంపకూడదు.
✅ నువ్వు receptionist వి — patient ని register చేసి token ఇవ్వడం మాత్రమే నీ పని.`;


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speakingTimeout = useRef<any>(null);
  const aiTalkingRef = useRef(false);

  const inCtxRef = useRef<AudioContext|null>(null);

  const connectLiveAPI = useCallback(async () => {

    setAiState("thinking");
    try {
      // 1. Output Audio Context (24kHz for Gemini TTS)
      let outCtx = audioCtxRef.current;
      if (!outCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        outCtx = new AudioContextClass({ sampleRate: 24000 });
        audioCtxRef.current = outCtx;
      }
      if (outCtx.state === "suspended") {
        outCtx.resume().catch(e => console.warn("outCtx resume failed:", e));
      }
      try {
        outCtx.audioWorklet.addModule("/audio-processor.js").catch(() => {});
      } catch (err) {
        // Module might already be added, ignore
      }
      const playbackNode = new AudioWorkletNode(outCtx, "audio-playback-worklet");
      playbackNode.connect(outCtx.destination);

      // 2. Input Audio Context (16kHz for Gemini STT)
      let inCtx = inCtxRef.current;
      if (!inCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        inCtx = new AudioContextClass({ sampleRate: 16000 });
        inCtxRef.current = inCtx;
      }
      if (inCtx.state === "suspended") {
        inCtx.resume().catch(e => console.warn("inCtx resume failed:", e));
      }
      try {
        inCtx.audioWorklet.addModule("/audio-processor.js").catch(() => {});
      } catch (err) {
        // Module might already be added, ignore
      }
      const recorderNode = new AudioWorkletNode(inCtx, "audio-recorder-worklet");

      if (micStreamRef.current) {
        const source = inCtx.createMediaStreamSource(micStreamRef.current);
        const gainNode = inCtx.createGain();
        gainNode.gain.value = 2.0; // Lower manual gain since AGC is enabled
        source.connect(gainNode);
        gainNode.connect(recorderNode);
      } else {
        console.warn("No mic stream available!");
      }

      const ws = new WebSocket(API.replace("http://", "ws://").replace("https://", "wss://") + "/ws/live-voice-proxy");
      liveWsRef.current = ws;
      let isSetupComplete = false;
      let lastAudioTime = 0; // Track latency

      // Base64 encoder for PCM16 audio
      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      // Stream mic audio to Gemini continuously
      recorderNode.port.onmessage = (e) => {
        if (!isSetupComplete || ws.readyState !== WebSocket.OPEN) return;
        if (aiTalkingRef.current) return; // Mute mic while AI speaks to prevent self-interruption

        const pcm16 = e.data; // Int16Array
        const base64 = arrayBufferToBase64(pcm16.buffer);
        ws.send(JSON.stringify({
          realtimeInput: { audio: { data: base64, mimeType: "audio/pcm;rate=16000" } }
        }));
      };

      ws.onopen = () => {
        console.log("🟢 [WS] Connected to Gemini directly. Sending setup with gemini-3.1-flash-live-preview...");
        ws.send(JSON.stringify({
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } },
            systemInstruction: { parts: [{ text: RECEPTIONIST_SYSTEM_TELUGU }] },
            tools: [{ functionDeclarations: [{ name: "generate_patient_token", description: "Call when patient says no more issues.", parameters: { type: "object", properties: { priority: { type: "string", enum: ["emergency","high","normal"] }, patient_name: { type: "string", description: "Name of the patient in English characters (transliterated from Telugu, e.g. Gopi instead of గోపి)" }, closing_message: { type: "string" } }, required: ["priority","patient_name","closing_message"] } }] }]
          }
        }));
      };

      ws.onmessage = async (e) => {
        try {
          let d;
          if (e.data instanceof Blob) d = JSON.parse(await e.data.text());
          else d = JSON.parse(e.data);

          // --- FULL LOGGING ---
          if (d.serverContent) {
             if (d.serverContent.interrupted) console.log("⚠️ [AI Interrupted by User]");
             if (d.serverContent.modelTurn) {
                const parts = d.serverContent.modelTurn.parts || [];
                const textParts = parts.filter((p:any)=>p.text).map((p:any)=>p.text).join("");
                if (textParts) console.log("🤖 [AI Says]:", textParts);
                if (parts.some((p:any)=>p.inlineData)) {
                   const now = Date.now();
                   if (lastAudioTime > 0) {
                      console.log(`⏱️ [Latency]: ${now - lastAudioTime}ms since last interaction`);
                   }
                   lastAudioTime = now;
                }
             }
          }
          if (d.error) {
            console.error("❌ [Gemini API Error]:", JSON.stringify(d.error));
            alert("Gemini API Error: " + JSON.stringify(d.error));
          }

          if (d.setupComplete) {
            isSetupComplete = true;
            console.log("✅ [Setup Complete] Triggering first turn...");
            // Trigger first turn
            ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: "నేను ఇప్పుడే వచ్చాను. రిజిస్ట్రేషన్ ప్రారంభించండి." }] }], turnComplete: true } }));
            setAiState("listening");
            lastAudioTime = Date.now();
          }

          if (d.serverContent?.modelTurn?.parts) {
            for (const part of d.serverContent.modelTurn.parts) {
              // If AI is sending audio data
              if (part.inlineData?.data) {
                if (aiState !== "speaking") console.log("🗣️ [AI Started Speaking]");
                setAiState("speaking");
                aiTalkingRef.current = true; // Lock mic
                const bin = atob(part.inlineData.data);
                const b = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
                const i16 = new Int16Array(b.buffer);
                const f32 = new Float32Array(i16.length);
                for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
                
                playbackNode.port.postMessage(f32);
                
                clearTimeout(speakingTimeout.current);
                speakingTimeout.current = setTimeout(() => { 
                  setAiState("listening"); 
                  aiTalkingRef.current = false; // Unlock mic
                  console.log("🎤 [AI Finished Speaking - Mic Open]");
                  lastAudioTime = Date.now(); // reset timer for next response
                }, 1500); // revert to listening when audio stops
              }
            }
          }

          // Barge-in / interruption
          if (d.serverContent?.interrupted) {
            playbackNode.port.postMessage("clear");
            setAiState("listening");
            aiTalkingRef.current = false;
            console.log("🎤 [AI Audio Cleared - Mic Open]");
          }

          if (d.toolCall) {
            console.log("🛠️ [Tool Call Detected]:", JSON.stringify(d.toolCall));
            const call = d.toolCall.functionCalls[0];
             if (call.name === "generate_patient_token") {
              const args = call.args;
              try {
                const priority = args.priority || "normal";
                const pName = args.patient_name || "Patient";
                const res = await fetch(`${API}/triage/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: priority, patient_name: pName }) });
                const td = await res.json();
                console.log("✅ [Token Generated from Backend]:", td.token);
                ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { result: "Success" } }] } }));
                setTokenR({ token: td.token, priority: priority as any, name: pName });
                tokenPhaseRef.current = true; // Set tokenPhaseRef immediately to prevent early close reset
              } catch (err) {
                console.error("❌ Tool call fetch failed", err);
                setTokenR({ token: "NRM-" + Math.floor(Math.random()*900+100), priority: "normal", name: "Patient" });
                tokenPhaseRef.current = true;
              } finally {
                // Wait for AI to finish speaking its goodbye message before disconnecting
                setTimeout(() => {
                  setPhase("token"); disconnectLiveAPI();
                  let c = 10; setSecs(c); // User requested 10 seconds
                  const t = setInterval(() => { c--; setSecs(c); if (c <= 0) { clearInterval(t); tokenPhaseRef.current = false; setPhase("scanning"); setFaceImg(null); setTokenR(null); setTimeout(() => { activeRef.current = false; }, 1000); } }, 1000);
                }, 8000); // 8 seconds allows the full Telugu sentence to speak completely
              }
            }
          }
        } catch (msgErr: any) {
          console.error("Error in WebSocket onmessage:", msgErr);
          alert("WebSocket Message Processing Error: " + msgErr.message);
        }
      };

      ws.onerror = (e) => {
        console.error("[WebSocket Error]:", e);
        setAiState("idle");
        disconnectLiveAPI();
        setPhase("scanning");
        setFaceImg(null);
        activeRef.current = false;
        failureCountRef.current += 1;
        if (failureCountRef.current >= 2) {
          // 2+ failures: block auto-trigger permanently until manual retry
          setApiBlocked(true);
          setApiError("AI connection failed. 'Retry' నొక్కండి.");
          // coolRef stays true — no auto-trigger
        } else {
          setApiError("AI error. 10s లో retry...");
          setTimeout(() => {
            coolRef.current = false;
            setApiError(null);
          }, 10000);
        }
      };
      
      ws.onclose = (e) => {
        console.warn(`[WebSocket Closed] Code: ${e.code}, Reason: ${e.reason}`);
        setAiState("idle");
        
        if (tokenPhaseRef.current) {
          // If we are currently in token generation or display phase, do not reset scanning states.
          // The countdown timer will handle returning to scanning phase after the 10-second delay.
          return;
        }
        
        setPhase(prev => prev === "token" ? prev : "scanning");
        setFaceImg(null);
        activeRef.current = false;
        if (e.code === 1011 || e.code === 1008) {
          failureCountRef.current += 1;
          if (failureCountRef.current >= 2) {
            // Permanent block after repeated failures
            setApiBlocked(true);
            setApiError(e.code === 1011
              ? "⚠️ API Credits అయిపోయాయి. Billing చెక్ చేయండి లేదా 'Retry' నొక్కండి."
              : "⚠️ API Connection Error. 'Retry' నొక్కండి."
            );
            // coolRef stays true — stops the loop completely
          } else {
            const wait = e.code === 1011 ? 15000 : 10000;
            setApiError(`Connection error. ${wait/1000}s లో retry...`);
            setTimeout(() => {
              coolRef.current = false;
              setApiError(null);
            }, wait);
          }
        } else {
          // Normal successful close — reset immediately
          failureCountRef.current = 0;
          coolRef.current = false;
        }
      };
    } catch (err: any) {
      console.error("Failed to start Live API", err);
      alert("Failed to start Live Voice API: " + err.message);
      setPhase("scanning");
      activeRef.current = false;
      coolRef.current = false;
    }
  }, []);

  const disconnectLiveAPI = useCallback(() => {
    liveWsRef.current?.close();
    // Do not close AudioContexts to preserve user-gesture permission for subsequent scans.
    // Instead, suspend them.
    audioCtxRef.current?.suspend().catch(() => {});
    inCtxRef.current?.suspend().catch(() => {});
    activeRef.current = false;
    setAiState("idle");
  }, []);

  /* ── Crop face from live video ───────────────────────────────── */
  const cropFace = useCallback((bbox:{x1:number;y1:number;x2:number;y2:number})=>{
    const v=videoRef.current; if(!v) return;
    const tmp=document.createElement("canvas");
    const sx=v.videoWidth/320, sy=v.videoHeight/240;
    const x=bbox.x1*sx, y=bbox.y1*sy;
    const w=(bbox.x2-bbox.x1)*sx, h=(bbox.y2-bbox.y1)*sy;
    tmp.width=w; tmp.height=h;
    const ctx=tmp.getContext("2d"); if(!ctx) return;
    ctx.drawImage(v,x,y,w,h,0,0,w,h);
    setFaceImg(tmp.toDataURL("image/jpeg",0.92));
  },[]);

  const triggerSession = useCallback((bbox:{x1:number;y1:number;x2:number;y2:number})=>{
    if(activeRef.current||coolRef.current) return;
    activeRef.current=true; coolRef.current=true;
    setTokenR(null);
    cropFace(bbox);
    setPhase("talking");
    connectLiveAPI();
  },[cropFace, connectLiveAPI]);

  /* ── Bounding box drawing ───────────────────────────────────── */
  const drawBoxes=useCallback((dets:Array<{bbox:{x1:number;y1:number;x2:number;y2:number};confidence:number}>)=>{
    const cv=overlayRef.current; if(!cv) return;
    const ctx=cv.getContext("2d"); if(!ctx) return;
    ctx.clearRect(0,0,cv.width,cv.height);
    dets.forEach(({bbox,confidence})=>{
      const sx=cv.width/320, sy=cv.height/240;
      const x=bbox.x1*sx, y=bbox.y1*sy, w=(bbox.x2-bbox.x1)*sx, h=(bbox.y2-bbox.y1)*sy;
      ctx.strokeStyle="#00d4ff"; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h);
      ctx.fillStyle="rgba(0,212,255,0.85)"; ctx.fillRect(x,y-22,130,22);
      ctx.fillStyle="#000"; ctx.font="bold 12px Inter";
      ctx.fillText(`👤 ${Math.round(confidence*100)}%`,x+4,y-6);
    });
  },[]);

  const sendFrame=useCallback(()=>{
    if (activeRef.current) return; // Stop YOLO detection during active conversation
    if(!wsRef.current||wsRef.current.readyState!==WebSocket.OPEN) return;
    const v=videoRef.current, c=canvasRef.current; if(!v||!c) return;
    const ctx=c.getContext("2d"); if(!ctx) return;
    c.width=320; c.height=240; ctx.drawImage(v,0,0,320,240);
    wsRef.current.send(JSON.stringify({frame:c.toDataURL("image/jpeg",0.6).split(",")[1]}));
  },[]);

  const connectWS=useCallback(()=>{
    // Clear any pending reconnect timer
    if(reconnectRef.current) clearTimeout(reconnectRef.current);
    const ws=new WebSocket(WS_URL); wsRef.current=ws;
    ws.onopen=()=>{
      setWsOk(true);
      if(ivRef.current) clearInterval(ivRef.current);
      ivRef.current=setInterval(sendFrame,400);
    };
    ws.onmessage=(e)=>{
      const d=JSON.parse(e.data);
      setPersons(d.count||0);
      if(d.detections) drawBoxes(d.detections);
      
      if (d.person_detected) {
        noPersonFramesRef.current = 0;
      } else {
        noPersonFramesRef.current += 1;
        if (noPersonFramesRef.current >= 5) {
          if (coolRef.current && !activeRef.current) {
            console.log("🔓 Camera cleared (no person detected). Unlocking kiosk for next patient!");
            coolRef.current = false;
          }
        }
      }
      
      if(d.person_detected&&d.is_new_person&&!activeRef.current&&!coolRef.current&&d.detections?.length>0){
        triggerSession(d.detections[0].bbox);
      }
    };
    ws.onclose=()=>{
      setWsOk(false);
      setPersons(0);
      // Auto-reconnect every 3 seconds if camera is still on
      if(cameraOnRef.current){
        console.log("YOLO WS closed. Reconnecting in 3s...");
        reconnectRef.current = setTimeout(()=>{
          if(cameraOnRef.current) connectWS();
        }, 3000);
      }
    };
    ws.onerror=()=>{
      setWsOk(false);
      ws.close(); // triggers onclose which handles reconnect
    };
  },[sendFrame,drawBoxes,triggerSession]);

  const startCamera=async()=>{
    try{
      // Ask for CAMERA permission
      const constraints = selectedDeviceId 
        ? { video: { deviceId: { exact: selectedDeviceId } } }
        : { video: true };

      const camStream=await navigator.mediaDevices.getUserMedia(constraints);
      if(videoRef.current){ videoRef.current.srcObject=camStream; await videoRef.current.play(); }
      cameraOnRef.current = true;

      // Enumerate camera devices
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === "videoinput");
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          const activeTrack = camStream.getVideoTracks()[0];
          const activeSettings = activeTrack?.getSettings();
          const activeDeviceId = activeSettings?.deviceId || videoDevices[0].deviceId;
          setSelectedDeviceId(activeDeviceId);
        }
      } catch (deviceErr) {
        console.warn("Could not enumerate devices:", deviceErr);
      }

      // Ask for MIC permission upfront so there is no popup when patient walks in
      try{
        const mic=await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        micStreamRef.current=mic; // keep alive – reused by connectLiveAPI
      }catch{
        console.warn("Mic permission denied – voice will not work");
      }

      // Initialize AudioContexts here inside the user gesture callback!
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Web Audio API is not supported in this browser!");
        }

        const outCtx = new AudioContextClass({ sampleRate: 24000 });
        audioCtxRef.current = outCtx;
        await outCtx.resume();
        await outCtx.audioWorklet.addModule("/audio-processor.js");

        const inCtx = new AudioContextClass({ sampleRate: 16000 });
        inCtxRef.current = inCtx;
        await inCtx.resume();
        await inCtx.audioWorklet.addModule("/audio-processor.js");
        
        console.log("🔊 Audio contexts initialized, resumed and modules loaded.");
      } catch (audioErr: any) {
        console.error("Failed to initialize audio contexts in startCamera", audioErr);
        alert("Audio initialization error: " + audioErr.message + "\nIf using Chrome, please verify permissions.");
      }

      setCameraOn(true); connectWS();
    }catch(err: any){ 
      console.error("Camera access failed:", err);
      alert("Camera access denied! Details: " + (err.message || err)); 
    }
  };

  const restartCameraWithDevice = async (deviceId: string) => {
    try {
      const currentStream = videoRef.current?.srcObject as MediaStream;
      if (currentStream) {
        currentStream.getVideoTracks().forEach(t => t.stop());
      }
      const constraints = {
        video: { deviceId: { exact: deviceId } }
      };
      const camStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = camStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Failed to restart camera with selected device:", err);
    }
  };

  const stopCamera=()=>{
    // Stop auto-reconnect first so we don't reconnect after stopping
    cameraOnRef.current = false;
    if(reconnectRef.current) clearTimeout(reconnectRef.current);
    (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject=null;
    micStreamRef.current?.getTracks().forEach(t=>t.stop());
    micStreamRef.current=null;
    wsRef.current?.close();
    disconnectLiveAPI();
    // Fully close the contexts when stopping the camera to clean up resources
    audioCtxRef.current?.close().catch(() => {});
    inCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    inCtxRef.current = null;
    if(ivRef.current) clearInterval(ivRef.current);
    setCameraOn(false); setWsOk(false); setPersons(0);
    setPhase("scanning"); activeRef.current=false; coolRef.current=false;
    overlayRef.current?.getContext("2d")?.clearRect(0,0,9999,9999);
  };
  useEffect(()=>()=>{ stopCamera(); },[disconnectLiveAPI]);

  /* ── AI state UI ─────────────────────────────────────────────── */
  const aiColor = aiState==="speaking"?"#00d4ff":aiState==="listening"?"#10b981":aiState==="thinking"?"#7c3aed":"#94a3b8";
  const aiLabel = aiState==="speaking"?"మాట్లాడుతున్నాను...":aiState==="listening"?"వింటున్నాను...":aiState==="thinking"?"ఆలోచిస్తున్నాను...":"వేచి చూస్తున్నాను...";
  const aiIcon  = aiState==="speaking"?"🗣️":aiState==="listening"?"👂":aiState==="thinking"?"🧠":"👁️";

  /* ══════════════════════════════════════════════════════════════
     SCREEN 1: SCANNING — full screen camera
  ══════════════════════════════════════════════════════════════ */
  if(phase==="scanning") return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",position:"relative"}}>

      {/* hidden video + canvases always mounted */}
      <video ref={videoRef} autoPlay style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} muted playsInline/>
      <canvas ref={overlayRef} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}
        width={640} height={480}/>
      <canvas ref={canvasRef} style={{display:"none"}}/>

      {/* Overlay UI */}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",flexDirection:"column"}}>
        {/* Top bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"16px 28px",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(10px)"}}>
          <button onClick={()=>{stopCamera();router.push("/");}} style={{
            background:"none",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",
            borderRadius:"8px",padding:"7px 14px",cursor:"pointer",fontSize:"13px"}}>← Home</button>
          <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:"18px",color:"white"}}>
            🏥 Smart Care <span style={{color:"#00d4ff"}}>Reception AI</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            {persons>0&&<span style={{fontSize:"13px",color:"#34d399",fontWeight:600}}>👤 {persons} detected</span>}
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:wsOk?"#10b981":"#ef4444"}}
                className={wsOk?"pulse-animation":""}/>
              <span style={{fontSize:"12px",color:wsOk?"#34d399":"#f87171"}}>{wsOk?"AI Live":"Offline"}</span>
            </div>
          </div>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div style={{
            background: apiBlocked ? "rgba(220,38,38,0.95)" : "rgba(239,68,68,0.85)",
            backdropFilter:"blur(10px)",
            padding:"14px 28px",textAlign:"center",
            fontSize:"14px",color:"white",fontWeight:600,
            display:"flex",alignItems:"center",justifyContent:"center",gap:"12px"
          }}>
            <span>⚠️ {apiError}</span>
            {apiBlocked && (
              <button
                onClick={() => {
                  // Reset all failure state for manual retry
                  failureCountRef.current = 0;
                  coolRef.current = false;
                  activeRef.current = false;
                  setApiBlocked(false);
                  setApiError(null);
                }}
                style={{
                  background:"white",color:"#dc2626",
                  border:"none",borderRadius:"8px",
                  padding:"6px 16px",fontSize:"13px",
                  fontWeight:700,cursor:"pointer"
                }}
              >
                🔄 Retry
              </button>
            )}
          </div>
        )}

        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"24px"}}>
          {!cameraOn?(
            <>
              <div style={{fontSize:"80px"}}>🏥</div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:"28px",fontWeight:800,color:"white"}}>
                Smart Care Reception AI
              </div>
              <div style={{fontSize:"15px",color:"rgba(255,255,255,0.6)",textAlign:"center",lineHeight:1.7}}>
                Camera start చేయండి<br/>Patient వచ్చినప్పుడు AI automatically మాట్లాడుతుంది
              </div>
              <button className="btn-primary" onClick={startCamera}
                style={{padding:"18px 48px",fontSize:"16px",marginTop:"8px"}}>
                ▶ Camera Start చేయండి
              </button>
            </>
          ):(
            <>
              {/* Scanning indicator */}
              <div style={{background:"rgba(0,0,0,0.6)",borderRadius:"100px",padding:"12px 32px",
                border:"1px solid rgba(0,212,255,0.3)",backdropFilter:"blur(10px)",
                display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"#00d4ff"}}
                  className="pulse-animation"/>
                <span style={{color:"#00d4ff",fontWeight:600,fontSize:"14px"}}>
                  Patient కోసం scanning చేస్తున్నాను...
                </span>
              </div>
              
              {devices.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Camera Source:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={async e => {
                      const devId = e.target.value;
                      setSelectedDeviceId(devId);
                      await restartCameraWithDevice(devId);
                    }}
                    style={{
                      background: "rgba(15,23,42,0.8)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      color: "white",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      outline: "none",
                      backdropFilter: "blur(10px)"
                    }}
                  >
                    {devices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId} style={{ background: "#0f172a" }}>
                        📹 {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button className="btn-danger" onClick={stopCamera}
                style={{padding:"12px 32px",marginTop:"12px"}}>
                ⏹ Stop Camera
              </button>
            </>
          )}
        </div>

        {/* Bottom: LIVE badge */}
        {cameraOn&&(
          <div style={{padding:"16px 28px",display:"flex",justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",
              background:"rgba(0,0,0,0.5)",borderRadius:"100px",padding:"6px 16px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#ef4444"}} className="pulse-red"/>
              <span style={{color:"#f87171",fontSize:"12px",fontWeight:700}}>LIVE DETECTION</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     SCREEN 2: TALKING — AI left, Patient right, NO camera
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-deep)",display:"flex",flexDirection:"column"}}>
      {/* hidden canvases still needed for WS frames */}
      <video ref={videoRef} autoPlay style={{display:"none"}} muted playsInline/>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <canvas ref={overlayRef} style={{display:"none"}}/>

      {/* Top bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"14px 28px",borderBottom:"1px solid var(--border)",
        background:"rgba(2,8,23,0.95)",backdropFilter:"blur(20px)"}}>
        <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:"18px"}}>
          🏥 Smart Care <span style={{color:"var(--primary)"}}>Reception AI</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px",
          background:"rgba(0,212,255,0.08)",border:"1px solid var(--border)",
          borderRadius:"100px",padding:"6px 16px"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:aiColor}}
            className="pulse-animation"/>
          <span style={{fontSize:"13px",color:aiColor,fontWeight:600}}>{aiIcon} {aiLabel}</span>
        </div>
        {phase==="token"&&tokenR&&(
          <div style={{fontSize:"13px",color:"#94a3b8"}}>⏱️ Resetting in {secs}s</div>
        )}
      </div>

      {/* Main: Left = AI, Right = Patient */}
      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"calc(100vh - 65px)"}}>

        {/* ── LEFT: AI Avatar + Conversation ── */}
        <div style={{borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",
          alignItems:"center",padding:"48px 32px",gap:"32px",
          background:"linear-gradient(180deg,rgba(0,212,255,0.03) 0%,transparent 100%)"}}>

          {/* Big AI orb */}
          <div style={{position:"relative",width:"180px",height:"180px"}}>
            <div style={{position:"absolute",inset:"-16px",borderRadius:"50%",
              border:`2px solid ${aiColor}`,opacity:0.5,transition:"all 0.4s"}}
              className="pulse-animation"/>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",
              background:`radial-gradient(circle at 40% 35%,rgba(0,212,255,0.25),rgba(124,58,237,0.15))`,
              border:`4px solid ${aiColor}`,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:"72px",transition:"border-color 0.4s",
              boxShadow:`0 0 60px ${aiColor}44`}}>🤖</div>
            {/* Wave bars */}
            <div style={{position:"absolute",bottom:"-32px",left:"50%",transform:"translateX(-50%)",
              display:"flex",gap:"4px",alignItems:"flex-end"}}>
              {[0,1,2,3,4,5,6].map(i=>(
                <div key={i} className="wave-bar" style={{
                  animationDelay:`${i*0.1}s`,background:aiColor,
                  height:aiState==="speaking"?"24px":aiState==="listening"?"16px":"6px",
                  transition:"height 0.3s"}}/>
              ))}
            </div>
          </div>

          <div style={{textAlign:"center",marginTop:"16px"}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:"22px",marginBottom:"4px"}}>
              Smart Care AI
            </div>
            <div style={{fontSize:"15px",color:aiColor,fontWeight:600}}>{aiIcon} {aiLabel}</div>
          </div>

          {/* Live interim hidden as requested */}

          {/* Chat messages (Hidden to enforce pure voice interface) */}
          <div style={{display:"none", width:"100%",maxWidth:"480px",flex:1,overflowY:"auto",flexDirection:"column",gap:"10px"}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:"10px",flexDirection:m.role==="ai"?"row":"row-reverse"}}
                className="fade-in-up">
                <div style={{width:"32px",height:"32px",borderRadius:"50%",flexShrink:0,
                  background:m.role==="ai"?"linear-gradient(135deg,#00d4ff,#7c3aed)":"linear-gradient(135deg,#10b981,#059669)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>
                  {m.role==="ai"?"🤖":"👤"}
                </div>
                <div style={{maxWidth:"75%",padding:"10px 14px",fontSize:"14px",lineHeight:1.65,
                  borderRadius:m.role==="ai"?"4px 14px 14px 14px":"14px 4px 14px 14px",
                  background:m.role==="ai"?"rgba(0,212,255,0.07)":"rgba(16,185,129,0.07)",
                  border:`1px solid ${m.role==="ai"?"var(--border)":"rgba(16,185,129,0.2)"}`}}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={msgEnd}/>
          </div>
          
          {/* Fallback Text Input if Mic Fails (Hidden) */}
          {aiState === "listening" && (
            <div style={{display:"none", width:"100%",maxWidth:"480px",marginTop:"10px",gap:"8px"}} className="fade-in-up">
              <input 
                type="text" 
                id="fallbackInput"
                placeholder="ఒకవేళ మైక్ పనిచేయకపోతే, ఇక్కడ టైప్ చేయండి..." 
                style={{flex:1,padding:"12px 16px",borderRadius:"100px",border:"1px solid var(--border)",background:"rgba(15,23,42,0.8)",color:"white",fontSize:"13px"}}
                onKeyDown={(e)=>{
                  if(e.key==="Enter" && e.currentTarget.value.trim()){
                    const txt = e.currentTarget.value.trim();
                    e.currentTarget.value = "";
                    (recogRef.current as any)?.abort(); // Stop mic
                    setInterim("");
                    addMsg("user",txt);
                  }
                }}
              />
              <button 
                className="btn-primary" 
                style={{borderRadius:"100px",padding:"0 20px"}}
                onClick={()=>{
                  const input = document.getElementById("fallbackInput") as HTMLInputElement;
                  if(input && input.value.trim()){
                    const txt = input.value.trim();
                    input.value = "";
                    (recogRef.current as any)?.abort(); // Stop mic
                    setInterim("");
                    addMsg("user",txt);
                  }
                }}>
                Send
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Patient Face + Token ── */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          padding:"48px 32px",gap:"28px",
          background:"linear-gradient(180deg,rgba(124,58,237,0.03) 0%,transparent 100%)"}}>

          {phase!=="token"?(
            <>
              {/* Patient face */}
              <div style={{fontSize:"13px",color:"var(--text-muted)",fontWeight:700,letterSpacing:"1px"}}>
                PATIENT
              </div>
              <div style={{
                width:"260px",height:"300px",borderRadius:"24px",overflow:"hidden",
                border:`3px solid ${aiColor}`,
                background:"rgba(15,23,42,0.8)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:`0 0 60px ${aiColor}33`,
                transition:"all 0.5s ease"}}>
                {faceImg?(
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faceImg} alt="Patient" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                ):(
                  <div style={{textAlign:"center",color:"var(--text-muted)"}}>
                    <div style={{fontSize:"64px",marginBottom:"12px"}}>👤</div>
                    <div style={{fontSize:"13px"}}>Face loading...</div>
                  </div>
                )}
              </div>

              <div style={{textAlign:"center",color:"var(--text-muted)",fontSize:"14px",lineHeight:1.8}}>
                🕐 {new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}<br/>
                📍 Reception — AI Triage<br/>
                🤖 Gemini 2.5 Powered
              </div>
            </>
          ):(
            /* Token screen */
            tokenR&&(
              <div className="fade-in-up" style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"20px"}}>
                {faceImg&&(
                  <div style={{width:"120px",height:"130px",borderRadius:"16px",overflow:"hidden",
                    border:`3px solid ${PRI[tokenR.priority].color}`,boxShadow:`0 0 40px ${PRI[tokenR.priority].color}44`}}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={faceImg} alt="Patient" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                )}
                <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:"20px"}}>
                  Token Issued! 🎉
                </div>
                <div style={{background:PRI[tokenR.priority].bg,border:`2px solid ${PRI[tokenR.priority].color}`,
                  borderRadius:"20px",padding:"32px 48px"}}>
                  <div style={{fontSize:"52px",fontWeight:900,letterSpacing:"4px",
                    color:PRI[tokenR.priority].color,fontFamily:"'Outfit',sans-serif"}}>
                    {tokenR.token}
                  </div>
                  <div style={{fontSize:"13px",color:"var(--text-muted)",marginTop:"6px"}}>{PRI[tokenR.priority].label}</div>
                  <div style={{fontSize:"14px",marginTop:"8px",fontWeight:600}}>{tokenR.name}</div>
                </div>
                <div style={{color:"var(--text-muted)",fontSize:"14px"}}>
                  Waiting hall లో కూర్చోండి.<br/>
                  మీ token వచ్చినప్పుడు పిలుస్తాం! 🙏
                </div>
                <div style={{background:"rgba(0,0,0,0.3)",borderRadius:"100px",padding:"8px 24px",
                  fontSize:"13px",color:"var(--text-muted)"}}>
                  ⏱️ Next patient scan: {secs}s
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
