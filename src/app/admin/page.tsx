"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ShieldCheck, Lock, User, KeyRound, ArrowLeft, AlertCircle, LogOut } from "lucide-react";

const HandTracker = dynamic(() => import("../../components/HandTracker"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400 z-50">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-purple-500/30" />
      <span className="text-sm font-medium tracking-wide text-purple-300">
        กำลังโหลดระบบจัดการผู้ดูแลระบบ (Admin Studio)...
      </span>
    </div>
  ),
});

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check login persistence on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const authState = localStorage.getItem("hand_lang_admin_auth");
      if (authState === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = usernameInput.trim().toLowerCase();
    const cleanPassword = passwordInput;

    // Query NestJS Backend Auth Endpoint for Database Created Admins
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api/v1";
      const response = await fetch(`${backendUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanUsername, password: cleanPassword }),
      });

      const data = await response.json();

      if (response.ok && data.accessToken) {
        setIsAuthenticated(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("hand_lang_admin_auth", "true");
          localStorage.setItem("hand_lang_token", data.accessToken);
          localStorage.setItem("hand_lang_user", JSON.stringify(data.user));
        }
        return;
      }

      const serverMsg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      setErrorMessage(serverMsg || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } catch (err: any) {
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("hand_lang_admin_auth");
      localStorage.removeItem("hand_lang_token");
      localStorage.removeItem("hand_lang_user");
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="fixed inset-0 w-screen h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden select-none">
        {/* Ambient Glow Background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 text-white animate-in zoom-in-95">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/30">
              <ShieldCheck className="w-8 h-8 text-purple-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Admin Authentication
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                เข้าสู่ระบบผู้ดูแลระบบเพื่อเพิ่มและจัดการท่าทางภาษามือ
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span>ชื่อผู้ใช้ (Username)</span>
              </label>
              <input
                type="text"
                required
                placeholder="ระบุชื่อผู้ใช้แอดมิน"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span>รหัสผ่าน (Password)</span>
              </label>
              <input
                type="password"
                required
                placeholder="ระบุรหัสผ่าน"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-xl shadow-purple-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>เข้าสู่ระบบแอดมิน</span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-center">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-300 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับสู่หน้าหลักสำหรับผู้ใช้งานทั่วไป (User Mode)</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <HandTracker isAdmin={true} onLogout={handleLogout} />
    </main>
  );
}
