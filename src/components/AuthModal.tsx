"use client";

import React, { useState } from "react";
import { X, Lock, Mail, User as UserIcon, Shield, Loader2, LogIn, UserPlus } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; email: string; fullName: string; role: string }, token: string) => void;
  backendUrl: string;
}

export default function AuthModal({ isOpen, onClose, onSuccess, backendUrl }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const endpoint = mode === "login" ? `${backendUrl}/auth/login` : `${backendUrl}/auth/register`;
      const payload = mode === "login" ? { email, password } : { email, password, fullName };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      }

      if (data.accessToken && data.user) {
        localStorage.setItem("hand_lang_token", data.accessToken);
        localStorage.setItem("hand_lang_user", JSON.stringify(data.user));
        onSuccess(data.user, data.accessToken);
        onClose();
        setEmail("");
        setPassword("");
        setFullName("");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-white relative animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">
              {mode === "login" ? "เข้าสู่ระบบ (Authentication)" : "ลงทะเบียนบัญชีใหม่"}
            </h3>
            <p className="text-xs text-purple-300">
              {mode === "login" ? "ระบุอีเมลและรหัสผ่านเพื่อเข้าใช้งาน" : "สร้างบัญชีผู้ใช้งานเพื่อบันทึกท่าทาง"}
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode("login"); setErrorMsg(null); }}
            className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              mode === "login" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setErrorMsg(null); }}
            className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
              mode === "register" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>ลงทะเบียน</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-medium">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-purple-400" />
                ชื่อ-นามสกุล *
              </label>
              <input
                type="text"
                required
                placeholder="สมชาย ใจดี"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none transition"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              อีเมล (Email) *
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              รหัสผ่าน (Password) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-purple-500 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังดำเนินการ...</span>
              </>
            ) : mode === "login" ? (
              <span>เข้าสู่ระบบ</span>
            ) : (
              <span>สร้างบัญชีใหม่</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
