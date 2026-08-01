"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Activity,
  Cpu,
  Download,
  Check,
  Eye,
  Layers,
  Volume2,
  Play,
  Hand,
  X,
  Sparkles,
  Bookmark,
  Plus,
  Trash2,
  Loader2,
  Save,
  FolderHeart,
  AlertCircle,
  Clock,
  CheckCircle2,
  Upload,
  FileJson,
  UserCheck,
  LogOut,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import AuthModal from "./AuthModal";
import AdminManagerModal from "./AdminManagerModal";
import {
  drawHandSkeleton,
  FINGER_LANDMARK_NAMES,
  Landmark,
  normalizeLandmarks,
  calculateLandmarkDistance,
} from "../utils/handSkeleton";

export interface HandDetectionData {
  hand: "Left" | "Right" | "Unknown";
  score: number;
  keypoints: Landmark[];
  keypoints3D?: Landmark[];
}

export interface SavedGesture {
  _id?: string;
  id?: string;
  name: string;
  hand?: "Right" | "Left" | "Both" | string;
  phrase?: string;
  category?: string;
  description?: string;
  sampleLandmarks: Landmark[];
  isActive?: boolean;
  createdAt?: string;
}

interface HandTrackerProps {
  isAdmin?: boolean;
  onLogout?: () => void;
  onTelemetryUpdate?: (data: {
    fps: number;
    hands: HandDetectionData[];
    detectorStatus: string;
  }) => void;
}

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export default function HandTracker({
  isAdmin = false,
  onLogout,
  onTelemetryUpdate,
}: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Core States
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [detectorStatus, setDetectorStatus] = useState<string>(
    "กำลังโหลด TensorFlow.js..."
  );
  const [fps, setFps] = useState<number>(0);
  const [detectedHands, setDetectedHands] = useState<HandDetectionData[]>([]);
  const [copiedJSON, setCopiedJSON] = useState<boolean>(false);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number>(0);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [showSavedDrawer, setShowSavedDrawer] = useState<boolean>(false);

  // Saved Gestures & Backend State
  const [savedGestures, setSavedGestures] = useState<SavedGesture[]>([]);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [gestureNameInput, setGestureNameInput] = useState<string>("");
  const [gestureHandInput, setGestureHandInput] = useState<string>("Right");
  const [gesturePhraseInput, setGesturePhraseInput] = useState<string>("");
  const [gestureCategoryInput, setGestureCategoryInput] = useState<string>("หมวดทั่วไป");
  const [gestureDescInput, setGestureDescInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Authentication & Admin Management State
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; fullName: string; role: string } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAdminManagerOpen, setIsAdminManagerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("hand_lang_token");
      const savedUserStr = localStorage.getItem("hand_lang_user");
      if (savedToken && savedUserStr) {
        try {
          setAuthToken(savedToken);
          setCurrentUser(JSON.parse(savedUserStr));
        } catch (e) {
          console.warn("Failed to parse stored auth user:", e);
        }
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("hand_lang_token");
    localStorage.removeItem("hand_lang_user");
    setAuthToken(null);
    setCurrentUser(null);
    setSaveSuccessNotice("ออกจากระบบเรียบร้อยแล้ว");
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  // 1-Second Hold Recognition & Delay State
  const [matchedGestureName, setMatchedGestureName] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100%
  const holdStateRef = useRef<{
    gestureName: string;
    startTime: number;
    hasTriggered: boolean;
  } | null>(null);

  // TTS & Translation State
  const [translatedText, setTranslatedText] = useState<string>(
    "ยกมือขึ้นหน้ากล้องเพื่อเริ่มแปลภาษามือ"
  );

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeVoiceName, setActiveVoiceName] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Refs for loop management & TTS garbage collection safety
  const detectorRef = useRef<any>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Pre-load available browser voices with Premwadee as top default priority
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const findPreferredThaiVoice = (voices: SpeechSynthesisVoice[]) => {
      // Priority 1: Microsoft เปรมวดี (Premwadee) Natural Voice requested by user
      const premwadee = voices.find(
        (v) =>
          v.name.includes("เปรมวดี") ||
          v.name.toLowerCase().includes("premwadee")
      );
      if (premwadee) return premwadee;

      // Priority 2: Any Thai Voice
      const thai = voices.find(
        (v) =>
          v.lang.toLowerCase().includes("th") ||
          v.name.toLowerCase().includes("thai") ||
          v.name.includes("Kanya") ||
          v.name.includes("Pattara") ||
          v.name.includes("Niwat")
      );
      return thai || voices[0];
    };

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        const savedVoice = typeof window !== "undefined" ? localStorage.getItem("hand_lang_preferred_voice") : null;
        const matchedSaved = savedVoice ? voices.find((v) => v.name === savedVoice) : null;
        
        if (matchedSaved) {
          setActiveVoiceName(matchedSaved.name);
        } else {
          const defaultVoice = findPreferredThaiVoice(voices);
          if (defaultVoice) {
            setActiveVoiceName(defaultVoice.name);
          }
        }
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
      }
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis && window.speechSynthesis.removeEventListener) {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      }
    };
  }, []);

  /**
   * Audio Feedback Cue using Web Audio API
   */
  const playAudioBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 tone
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // AudioContext optional fallback
    }
  };

  /**
   * Robust Text-To-Speech Output Handler
   */
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        alert("Text-to-Speech ไม่รองรับในเบราว์เซอร์นี้");
        return;
      }

      if (!text || text.trim() === "") return;

      playAudioBeep();

      const synth = window.speechSynthesis;
      synth.cancel(); // Clear pending utterances

      if (synth.paused) {
        synth.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance; // Retain reference to prevent V8 Garbage Collection bug in Chrome/Edge

      const voices =
        availableVoices.length > 0 ? availableVoices : synth.getVoices();
      
      let selectedVoice: SpeechSynthesisVoice | undefined;
      if (activeVoiceName) {
        selectedVoice = voices.find((v) => v.name === activeVoiceName);
      }

      if (!selectedVoice) {
        selectedVoice =
          voices.find(
            (v) =>
              v.name.includes("เปรมวดี") ||
              v.name.toLowerCase().includes("premwadee")
          ) ||
          voices.find(
            (v) =>
              v.lang.toLowerCase().includes("th") ||
              v.name.toLowerCase().includes("thai") ||
              v.name.includes("Kanya") ||
              v.name.includes("Pattara")
          );
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || "th-TH";
        if (activeVoiceName !== selectedVoice.name) {
          setActiveVoiceName(selectedVoice.name);
        }
      } else {
        utterance.lang = "th-TH";
        if (voices.length > 0) {
          utterance.voice = voices[0];
          if (activeVoiceName !== voices[0].name) {
            setActiveVoiceName(voices[0].name);
          }
        }
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };
      utterance.onerror = (err) => {
        console.warn("SpeechSynthesis Error:", err);
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      // Workaround for Chrome SpeechSynthesis freeze bug
      setTimeout(() => {
        synth.speak(utterance);
        if (synth.paused) {
          synth.resume();
        }
      }, 50);

      setTranslatedText(text);
    },
    [availableVoices, activeVoiceName]
  );

  /**
   * Fetch saved gestures from NestJS Backend API (C:\Users\LOQ\Documents\enjoy_project\hand_lang\back)
   */
  const loadSavedGestures = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_API_URL}/gestures`);
      if (res.ok) {
        const data = await res.json();
        setSavedGestures(data || []);
        setIsBackendConnected(true);
      } else {
        setIsBackendConnected(false);
      }
    } catch (err) {
      console.warn("Backend API unavailable at", BACKEND_API_URL, err);
      setIsBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    loadSavedGestures();
  }, [loadSavedGestures]);

  /**
   * Open Save Gesture Modal
   */
  /**
   * Open Save Gesture Modal
   */
  const handleOpenSaveModal = () => {
    if (detectedHands.length === 0) {
      alert("กรุณายกมือขึ้นหน้ากล้องก่อน เพื่อให้ระบบจับพิกัดนิ้วทั้ง 5 นิ้ว (21 จุด)");
      return;
    }
    const detectedHand = detectedHands[0]?.hand || "Right";
    setGestureHandInput(detectedHand === "Right" ? "Right" : detectedHand === "Left" ? "Left" : "Both");
    setIsSaveModalOpen(true);
  };

  /**
   * Save Gesture: Submit to NestJS Backend & Download JSON
   */
  const handleSaveGestureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const spokenPhrase = gesturePhraseInput.trim();
    if (!spokenPhrase) {
      alert("กรุณาระบุข้อความอ่านออกเสียงของท่าทาง");
      return;
    }

    if (detectedHands.length === 0) {
      alert("ไม่พบมือในกล้อง ณ ขณะนี้");
      return;
    }

    setIsSaving(true);
    const activeHandKeypoints = detectedHands[0].keypoints.map((kp) => ({
      x: Number(kp.x || 0),
      y: Number(kp.y || 0),
      z: Number(kp.z || 0),
    }));

    const handLabel = gestureHandInput === "Right" ? "มือขวา" : gestureHandInput === "Left" ? "มือซ้าย" : "ทั้งสองข้าง";

    const payload = {
      name: `${spokenPhrase} (${handLabel})`,
      hand: gestureHandInput,
      phrase: spokenPhrase,
      category: "หมวดทั่วไป",
      description: gestureDescInput.trim() || `บันทึกค่านิ้ว 5 นิ้ว (${handLabel})`,
      sampleLandmarks: activeHandKeypoints,
      isActive: true,
    };

    // 1. Download local JSON file
    try {
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `gesture_${payload.name.replace(/\s+/g, "_")}_${payload.hand}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error("Failed to download JSON file:", err);
    }

    // 2. Save to NestJS MongoDB Backend API Database
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const response = await fetch(`${BACKEND_API_URL}/gestures`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok || response.status === 201) {
        setSaveSuccessNotice(`บันทึกไฟล์ JSON และท่าทาง "${payload.name}" (${payload.hand}) อ่านเสียง "${payload.phrase}" ลง DB สำเร็จ!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn("Backend save response:", errorData);
        setSaveSuccessNotice(`บันทึก JSON ท้องถิ่นสำเร็จ (สถานะเซิร์ฟเวอร์: ${errorData.message || response.statusText})`);
      }
    } catch (err) {
      console.warn("Failed to reach backend API, saved locally:", err);
      setSaveSuccessNotice(`ดาวน์โหลด JSON สำเร็จ (ยังไม่ได้เปิดการเชื่อมต่อ Database)`);
    } finally {
      setIsSaving(false);
      setIsSaveModalOpen(false);
      setGestureNameInput("");
      setGesturePhraseInput("");
      setGestureDescInput("");
      loadSavedGestures();

      setTimeout(() => setSaveSuccessNotice(null), 4000);
    }
  };

  /**
   * Import local JSON file and save directly to MongoDB Database
   */
  const handleImportJSONFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const itemsToSave = Array.isArray(jsonData) ? jsonData : [jsonData];

      let savedCount = 0;
      for (const item of itemsToSave) {
        if (!item.name || !item.sampleLandmarks) {
          continue;
        }

        const payload = {
          name: String(item.name).trim(),
          hand: String(item.hand || "Both").trim(),
          phrase: String(item.phrase || item.name).trim(),
          category: String(item.category || "หมวดทั่วไป").trim(),
          description: String(item.description || "นำเข้าจากไฟล์ JSON").trim(),
          sampleLandmarks: item.sampleLandmarks.map((pt: any) => ({
            x: Number(pt.x || 0),
            y: Number(pt.y || 0),
            z: Number(pt.z || 0),
          })),
          isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
        };

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

        const res = await fetch(`${BACKEND_API_URL}/gestures`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (res.ok || res.status === 201) {
          savedCount++;
        }
      }

      setSaveSuccessNotice(
        `บันทึกไฟล์ JSON เข้าสู่ฐานข้อมูล (Database) เรียบร้อยแล้ว! (${savedCount} ท่าทาง)`
      );
      loadSavedGestures();
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err) {
      console.error("Failed to parse or save JSON file to database:", err);
      alert("ไฟล์ JSON ไม่ถูกต้อง หรือโครงสร้างข้อมูลไม่ตรงกับระบบ");
    } finally {
      setIsSaving(false);
      e.target.value = "";
    }
  };

  /**
   * Delete Gesture from NestJS Backend API
   */
  const handleDeleteGesture = async (id?: string, name?: string) => {
    if (!id) return;
    if (!confirm(`คุณต้องการลบท่าทาง "${name || id}" ใช่หรือไม่?`)) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch(`${BACKEND_API_URL}/gestures/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setSavedGestures((prev) => prev.filter((g) => g._id !== id && g.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete gesture:", err);
    }
  };


  /**
   * Load TensorFlow.js Backend and Hand Pose Model
   */
  const initDetector = async () => {
    try {
      setDetectorStatus("กำลังโหลด WebGL backend...");
      const tf = await import("@tensorflow/tfjs-core");
      await import("@tensorflow/tfjs-backend-webgl");
      await tf.setBackend("webgl");
      await tf.ready();

      setDetectorStatus("กำลังโหลด MediaPipe Hands...");
      const handPoseDetection = await import(
        "@tensorflow-models/hand-pose-detection"
      );

      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      const detectorConfig: any = {
        runtime: "mediapipe",
        solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/hands`,
        modelType: "full",
        maxHands: 2,
      };

      const detector = await handPoseDetection.createDetector(
        model,
        detectorConfig
      );
      detectorRef.current = detector;
      setDetectorStatus("พร้อมใช้งาน (Ready)");
    } catch (err: any) {
      console.error("Failed to load Hand Pose detector:", err);
      setDetectorStatus(`Error: ${err.message || "Failed to initialize"}`);
    }
  };

  /**
   * Start Webcam Stream
   */
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("เบราว์เซอร์ไม่รองรับการเปิดกล้อง");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraActive(true);
        };
      }
    } catch (err: any) {
      console.error("Camera access denied:", err);
      alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตสิทธิ์การใช้กล้อง");
    }
  };

  /**
   * Stop Webcam Stream
   */
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setDetectedHands([]);
    setFps(0);
  };

  /**
   * Real-time Detection Frame Loop
   */
  const detectFrame = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !detectorRef.current ||
      videoRef.current.readyState < 2
    ) {
      animationFrameId.current = requestAnimationFrame(detectFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    try {
      const hands = await detectorRef.current.estimateHands(video, {
        flipHorizontal: false,
      });

      // Calculate FPS
      const now = performance.now();
      frameCountRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        const currentFps = Math.round(
          (frameCountRef.current * 1000) / (now - lastTimeRef.current)
        );
        setFps(currentFps);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      // Clear Canvas
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Format Hands
      const formattedHands: HandDetectionData[] = hands.map((h: any) => ({
        hand: (h.handedness as "Left" | "Right") || "Right",
        score: Math.round((h.score || 0.95) * 100),
        keypoints: h.keypoints.map((kp: any) => ({
          x: kp.x,
          y: kp.y,
          z: kp.z,
          name: kp.name,
        })),
        keypoints3D: h.keypoints3D
          ? h.keypoints3D.map((kp: any) => ({
              x: kp.x,
              y: kp.y,
              z: kp.z,
              name: kp.name,
            }))
          : undefined,
      }));

      setDetectedHands(formattedHands);

      // Render Skeleton
      if (ctx) {
        formattedHands.forEach((handData) => {
          drawHandSkeleton(ctx, handData.keypoints, isMirrored, canvas.width);
        });
      }

      // 5-Finger Landmark Gesture Matching & 1-Second Hold Recognition Engine
      if (formattedHands.length > 0 && savedGestures.length > 0) {
        const currentHandSide = formattedHands[0].hand; // "Left" | "Right"
        const currentKeypoints = formattedHands[0].keypoints;
        let minDistance = Infinity;
        let matched: SavedGesture | null = null;

        // 1. Primary Pass: Prioritize matching hand side or 'Both'
        for (const gesture of savedGestures) {
          if (!gesture.sampleLandmarks || gesture.sampleLandmarks.length < 21) continue;

          const isHandMatch = !gesture.hand || gesture.hand === "Both" || gesture.hand === currentHandSide;
          if (!isHandMatch) continue;

          const dist = calculateLandmarkDistance(currentKeypoints, gesture.sampleLandmarks);
          if (dist < minDistance) {
            minDistance = dist;
            matched = gesture;
          }
        }

        // 2. Fallback Pass: If no match under primary hand filter, evaluate all saved gestures
        if (!matched || minDistance > 0.55) {
          for (const gesture of savedGestures) {
            if (!gesture.sampleLandmarks || gesture.sampleLandmarks.length < 21) continue;

            const dist = calculateLandmarkDistance(currentKeypoints, gesture.sampleLandmarks);
            if (dist < minDistance) {
              minDistance = dist;
              matched = gesture;
            }
          }
        }

        // Distance Threshold for 21-landmark normalized similarity (~0.55 for flexible matching)
        if (matched && minDistance < 0.55) {
          const phraseToSpeak = matched.phrase || matched.name;
          setMatchedGestureName(phraseToSpeak);
          const currentTime = performance.now();

          if (!holdStateRef.current || holdStateRef.current.gestureName !== matched.name) {
            // New posture detected: start 0.5-second hold timer
            holdStateRef.current = {
              gestureName: matched.name,
              startTime: currentTime,
              hasTriggered: false,
            };
            setHoldProgress(0);
          } else {
            // Continuation of posture: compute progress towards 0.5 seconds (500ms)
            const elapsedTime = currentTime - holdStateRef.current.startTime;
            const progressPct = Math.min(100, Math.round((elapsedTime / 500) * 100));
            setHoldProgress(progressPct);

            if (elapsedTime >= 500 && !holdStateRef.current.hasTriggered) {
              holdStateRef.current.hasTriggered = true;
              // Trigger TTS speech after holding for 0.5 seconds!
              speakText(phraseToSpeak);
            }
          }
        } else {
          // Posture released or below threshold
          holdStateRef.current = null;
          setHoldProgress(0);
          setMatchedGestureName(null);
        }
      } else if (formattedHands.length === 0) {
        holdStateRef.current = null;
        setHoldProgress(0);
        setMatchedGestureName(null);
      }

      if (onTelemetryUpdate) {
        onTelemetryUpdate({
          fps,
          hands: formattedHands,
          detectorStatus,
        });
      }
    } catch (err) {
      console.error("Detection error:", err);
    }

    animationFrameId.current = requestAnimationFrame(detectFrame);
  }, [isMirrored, onTelemetryUpdate, detectorStatus, fps, savedGestures, speakText]);


  // Initial load
  useEffect(() => {
    initDetector();
    return () => {
      stopCamera();
    };
  }, []);

  // Detection loop triggering
  useEffect(() => {
    if (isCameraActive) {
      animationFrameId.current = requestAnimationFrame(detectFrame);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isCameraActive, detectFrame]);

  // Copy JSON Landmarks
  const handleCopyLandmarks = () => {
    if (detectedHands.length === 0) return;
    const exportData = {
      timestamp: new Date().toISOString(),
      handsCount: detectedHands.length,
      hands: detectedHands,
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const activeHand = detectedHands[selectedHandIndex] || detectedHands[0];

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 overflow-hidden select-none">
      {/* 1. FULLSCREEN VIDEO & CANVAS LAYERS */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`fixed inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          isMirrored ? "scale-x-[-1]" : ""
        } ${isCameraActive ? "opacity-100" : "opacity-0"}`}
      />

      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* 2. CAMERA INACTIVE STATE OVERLAY */}
      {!isCameraActive && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950 p-6 backdrop-blur-md">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-2xl shadow-cyan-500/20 animate-pulse">
            <Hand className="w-10 h-10" />
          </div>
          <div className="text-center max-w-md space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Thai Sign Language Translator
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              ระบบแปลภาษามือไทย Real-time จาก Web Camera ด้วย TensorFlow.js
            </p>
          </div>
          <button
            onClick={startCamera}
            disabled={detectorStatus !== "พร้อมใช้งาน (Ready)"}
            className="mt-2 flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold shadow-xl shadow-cyan-500/25 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>เปิดกล้องเริ่มการแปลภาษามือ</span>
          </button>
        </div>
      )}

      {/* 3. FLOATING TOP HEADER & STATUS BAR (TOP-LEFT) */}
      <div className="fixed top-5 left-5 z-30 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-slate-800/80 shadow-2xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/30">
            <Hand className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">
              Thai Sign Language
            </h1>
            <span className="text-[10px] text-cyan-400/90 font-medium">
              21 3D Landmarks AI Engine
            </span>
          </div>
        </div>

        {/* Live Telemetry Status Pills */}
        <div className="flex items-center gap-2">
          {isCameraActive && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-slate-800/80 text-[11px] font-mono text-emerald-400 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{fps} FPS</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-slate-800/80 text-[11px] font-mono text-slate-300 shadow-lg">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>{detectorStatus}</span>
          </div>

          {detectedHands.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-500/40 text-[11px] font-semibold text-cyan-300 shadow-lg">
              <span>พบมือ {detectedHands.length} ข้าง</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. FLOATING TOP CONTROLS (TOP-RIGHT) */}
      <div className="fixed top-5 right-5 z-30 flex items-center gap-2 pointer-events-auto">
        {/* Admin Mode Status & Logout Pill */}
        {isAdmin && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-purple-950/80 backdrop-blur-xl border border-purple-500/50 text-purple-200 shadow-xl text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span>ADMIN MODE</span>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 hover:text-rose-200 text-slate-400 transition ml-1"
                title="ออกจากระบบแอดมิน (Logout Admin)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Admin Only Actions: Manage Admins, Save Gesture & Gestures Manager Drawer */}
        {isAdmin && (
          <>
            <button
              onClick={() => setIsAdminManagerOpen(true)}
              className="flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 font-semibold backdrop-blur-xl border border-purple-500/40 shadow-xl transition-all text-xs transform hover:scale-105 active:scale-95"
              title="จัดการผู้ดูแลระบบ (เพิ่ม/ลบแอดมิน)"
            >
              <ShieldCheck className="w-4 h-4 text-purple-300" />
              <span className="hidden md:inline">จัดการแอดมิน</span>
            </button>

            <button
              onClick={handleOpenSaveModal}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold backdrop-blur-xl border border-emerald-400/40 shadow-2xl shadow-emerald-900/30 transition-all text-xs transform hover:scale-105 active:scale-95"
              title="บันทึกค่านิ้ว 5 นิ้ว และดาวน์โหลด"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">บันทึกท่าทาง (ดาวน์โหลด)</span>
            </button>

            <button
              onClick={() => setShowSavedDrawer(!showSavedDrawer)}
              className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all relative ${
                showSavedDrawer
                  ? "bg-purple-500/30 border-purple-500/50 text-purple-300"
                  : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white"
              }`}
              title="คลังท่าทางที่บันทึกไว้"
            >
              <FolderHeart className="w-5 h-5 text-purple-400" />
              {savedGestures.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md animate-bounce">
                  {savedGestures.length}
                </span>
              )}
            </button>
          </>
        )}

        <button
          onClick={() => setIsMirrored(!isMirrored)}
          className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all ${
            isMirrored
              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
              : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white"
          }`}
          title="สลับโหมดกระจก (Mirror Camera)"
        >
          <FlipHorizontal className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowInspector(!showInspector)}
          className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all ${
            showInspector
              ? "bg-indigo-500/30 border-indigo-500/50 text-indigo-300"
              : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white"
          }`}
          title="เปิด/ปิด แผงดูพิกัดนิ้วมือ 21 จุด"
        >
          <Layers className="w-5 h-5" />
        </button>

        {isCameraActive && (
          <button
            onClick={stopCamera}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-600/90 hover:bg-rose-500 text-white font-medium backdrop-blur-xl border border-rose-500/50 shadow-2xl shadow-rose-900/30 transition-all text-xs"
          >
            <CameraOff className="w-4 h-4" />
            <span className="hidden sm:inline">ปิดกล้อง</span>
          </button>
        )}
      </div>

      {/* 5. FLOATING CENTER-BOTTOM TRANSLATION & TTS OVERLAY */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-xl flex flex-col items-center gap-3 pointer-events-auto">
        {/* Save Success Notice Banner */}
        {saveSuccessNotice && (
          <div className="w-full px-4 py-2.5 rounded-2xl bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 text-emerald-200 text-xs font-medium flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessNotice}</span>
            </div>
            <button
              onClick={() => setSaveSuccessNotice(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1-Second Hold Recognition Progress Bar */}
        {matchedGestureName && (
          <div className="w-full bg-slate-950/90 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>ตรวจพบท่าทาง: <strong className="text-white text-sm">{matchedGestureName}</strong></span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">
                ถือค้าง {holdProgress}% (0.5 วิเริ่มเสียง)
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-cyan-500/30">
              <div
                className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 h-full transition-all duration-75 shadow-lg shadow-cyan-500/50"
                style={{ width: `${holdProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Translated Text Box */}
        <div className="w-full bg-slate-950/70 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-5 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                ผลการแปลภาษามือ (Live Translation Result)
              </span>
              {availableVoices.length > 0 ? (
                <select
                  value={activeVoiceName}
                  onChange={(e) => {
                    const newVoice = e.target.value;
                    setActiveVoiceName(newVoice);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("hand_lang_preferred_voice", newVoice);
                    }
                  }}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-200 border border-purple-500/40 truncate max-w-[170px] outline-none cursor-pointer hover:border-purple-400"
                  title="เลือกเสียงอ่าน (Voice Selection)"
                >
                  {availableVoices.map((v, i) => (
                    <option key={i} value={v.name} className="bg-slate-900 text-white text-xs">
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 truncate max-w-[150px]">
                  {activeVoiceName || "Default Voice"}
                </span>
              )}
            </div>
            <p className="text-lg md:text-xl font-bold text-white truncate drop-shadow-md">
              {translatedText}
            </p>
          </div>

          <button
            onClick={() => speakText(translatedText)}
            className={`shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
              isSpeaking
                ? "bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/40 animate-pulse"
                : "bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40 text-purple-300"
            }`}
            title="ออกเสียงแปลภาษา (Text to Speech)"
          >
            <Volume2 className="w-6 h-6" />
          </button>
        </div>

        {/* Floating Quick TTS Preset Phrases */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {["สวัสดีครับ", "ขอบคุณครับ", "ยินดีที่ได้รู้จัก", "สบายดีไหม"].map(
            (phrase, idx) => (
              <button
                key={idx}
                onClick={() => speakText(phrase)}
                className="px-3.5 py-1.5 rounded-full bg-slate-950/60 hover:bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-all shadow-lg flex items-center gap-1.5"
              >
                <Play className="w-3 h-3 text-purple-400" />
                {phrase}
              </button>
            )
          )}
        </div>
      </div>

      {/* 6. FLOATING COLLAPSIBLE 21-LANDMARKS DRAWER (RIGHT SIDE) */}
      {showInspector && (
        <div className="fixed top-20 right-5 z-40 w-80 max-h-[calc(100vh-120px)] bg-slate-950/85 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-4 shadow-2xl flex flex-col gap-3 pointer-events-auto transition-all animate-in slide-in-from-right-10">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-xs text-slate-200">
                21 Finger Landmarks
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyLandmarks}
                disabled={detectedHands.length === 0}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-300 transition"
                title="Export Landmarks JSON"
              >
                {copiedJSON ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setShowInspector(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Hand Info */}
          {activeHand ? (
            <div className="flex flex-col gap-2.5 flex-1 overflow-hidden">
              <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Side</span>
                  <span className="font-semibold text-slate-200">
                    {activeHand.hand} Hand
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Confidence</span>
                  <span className="font-semibold text-emerald-400">
                    {activeHand.score}%
                  </span>
                </div>
              </div>

              {/* Scrollable Keypoint Coordinates */}
              <div className="flex-1 overflow-y-auto max-h-[340px] pr-1 space-y-1 text-[11px] font-mono">
                {activeHand.keypoints.map((kp, idx) => {
                  const isTip = [4, 8, 12, 16, 20].includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`p-1.5 rounded-lg border flex items-center justify-between transition ${
                        isTip
                          ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-200"
                          : "bg-slate-950/60 border-slate-800/60 text-slate-300"
                      }`}
                    >
                      <span className="font-sans font-medium text-slate-400 text-[10px]">
                        {FINGER_LANDMARK_NAMES[idx] || `Pt ${idx}`}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-emerald-400">
                          X:{Math.round(kp.x)}
                        </span>
                        <span className="text-cyan-400">
                          Y:{Math.round(kp.y)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
              <Eye className="w-6 h-6 text-slate-700" />
              <p className="text-xs">ไม่พบมือในเฟรมกล้อง</p>
            </div>
          )}
        </div>
      )}

      {/* 7. SAVED GESTURES DRAWER (LEFT SIDE) */}
      {showSavedDrawer && (
        <div className="fixed top-20 left-5 z-40 w-80 max-h-[calc(100vh-120px)] bg-slate-950/90 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-4 shadow-2xl flex flex-col gap-3 pointer-events-auto transition-all animate-in slide-in-from-left-10">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <FolderHeart className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-xs text-slate-200">
                คลังท่าทางที่บันทึกไว้ ({savedGestures.length})
              </h3>
            </div>
            <button
              onClick={() => setShowSavedDrawer(false)}
              className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
            <span>เชื่อมต่อ Backend:</span>
            <span className={isBackendConnected ? "text-emerald-400 font-medium" : "text-amber-400"}>
              {isBackendConnected ? "Online (NestJS API)" : "Offline (Local Only)"}
            </span>
          </div>

          {/* Import JSON File to Database */}
          <label className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-purple-900/40 hover:bg-purple-900/70 border border-purple-500/40 text-purple-200 text-xs font-semibold cursor-pointer transition shadow-sm">
            <Upload className="w-4 h-4 text-purple-400" />
            <span>นำเข้าไฟล์ JSON ลง Database</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJSONFile}
              className="hidden"
            />
          </label>

          {/* List of Saved Gestures */}
          <div className="flex-1 overflow-y-auto max-h-[400px] pr-1 space-y-2">
            {savedGestures.length > 0 ? (
              savedGestures.map((gesture) => (
                <div
                  key={gesture._id || gesture.id || gesture.name}
                  className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      <span>{gesture.phrase || gesture.name}</span>
                      {gesture.phrase && gesture.phrase !== gesture.name && (
                        <span className="text-[10px] text-slate-400 font-normal">({gesture.name})</span>
                      )}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-medium">
                        {gesture.hand === "Right" ? "✋ มือขวา" : gesture.hand === "Left" ? "🤚 มือซ้าย" : "🙌 ทั้งสองข้าง"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30">
                        {gesture.category || "หมวดทั่วไป"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => speakText(gesture.phrase || gesture.name)}
                      className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 transition"
                      title="ทดสอบออกเสียง"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    {(gesture._id || gesture.id) && (
                      <button
                        onClick={() => handleDeleteGesture(gesture._id || gesture.id, gesture.name)}
                        className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition"
                        title="ลบท่าทางนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
                <Bookmark className="w-6 h-6 text-slate-700" />
                <p className="text-xs">ยังไม่มีท่าทางที่บันทึกไว้</p>
                <button
                  onClick={handleOpenSaveModal}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-xs font-medium transition"
                >
                  กดเพื่อบันทึกท่าทางแรก
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. SAVE GESTURE MODAL DIALOG */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-white relative animate-in zoom-in-95">
            <button
              onClick={() => setIsSaveModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  บันทึกท่าทาง (5 นิ้ว 21 จุด)
                </h3>
                <p className="text-xs text-emerald-400">
                  จับพิกัดเซนเซอร์ทั้ง 5 นิ้ว ณ ปัจจุบันเรียบร้อยแล้ว
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveGestureSubmit} className="flex flex-col gap-3.5 mt-2">
              {/* Hand Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  มือข้างที่ทำท่าทาง (Hand Side) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "Right", label: "✋ มือขวา" },
                    { id: "Left", label: "🤚 มือซ้าย" },
                    { id: "Both", label: "🙌 ทั้งสองข้าง" },
                  ].map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setGestureHandInput(h.id)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                        gestureHandInput === h.id
                          ? "bg-emerald-600 border-emerald-400 text-white shadow"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Phrase to Speak */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ข้อความอ่านออกเสียง (Text Phrase to Speak) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สู้ๆนะ, สวัสดี, ขอบคุณ"
                  value={gesturePhraseInput}
                  onChange={(e) => setGesturePhraseInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none transition font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  คำอธิบายเพิ่มเติม (Optional)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ท่ากาง 5 นิ้วกระดิกปลาย"
                  value={gestureDescInput}
                  onChange={(e) => setGestureDescInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  เมื่อกดดาวน์โหลด ค่านิ้วทั้ง 5 นิ้ว (21 จุด 3D) จะถูกบันทึกเป็นไฟล์ <strong>JSON</strong> และส่งเข้าเซิร์ฟเวอร์ NestJS Backend เพื่อใช้เปรียบเทียบเสียงอ่านเมื่อทำท่านี้ค้าง 0.5 วินาที
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200 cursor-pointer font-medium transition">
                  <FileJson className="w-4 h-4 text-purple-400" />
                  <span>นำเข้าไฟล์ .json ที่มีอยู่แล้วลง Database</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportJSONFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/30 transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลด & บันทึกท่าทางลง DB</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. AUTHENTICATION & AUTHORIZATION MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          setSaveSuccessNotice(`ยินดีต้อนรับคุณ ${user.fullName || user.email}! (สิทธิ์: ${user.role})`);
          setTimeout(() => setSaveSuccessNotice(null), 4000);
        }}
        backendUrl={BACKEND_API_URL}
      />

      {/* 10. ADMIN MANAGER MODAL */}
      <AdminManagerModal
        isOpen={isAdminManagerOpen}
        onClose={() => setIsAdminManagerOpen(false)}
        backendUrl={BACKEND_API_URL}
        authToken={authToken}
      />
    </div>
  );
}

