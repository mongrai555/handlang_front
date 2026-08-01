"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, ShieldCheck, UserPlus, Trash2, Mail, User, Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface AdminUser {
  _id?: string;
  id?: string;
  username: string;
  email?: string;
  fullName?: string;
  role: string;
  createdAt?: string;
}

interface AdminManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendUrl: string;
  authToken?: string | null;
}

export default function AdminManagerModal({
  isOpen,
  onClose,
  backendUrl,
  authToken,
}: AdminManagerModalProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State (No Email Required)
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [fullNameInput, setFullNameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");

  const fetchAdmins = useCallback(async () => {
    try {
      setIsLoading(true);
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch(`${backendUrl}/users?role=admin`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data || []);
      }
    } catch (err) {
      console.warn("Failed to fetch admin list:", err);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, authToken]);

  useEffect(() => {
    if (isOpen) {
      fetchAdmins();
    }
  }, [isOpen, fetchAdmins]);

  if (!isOpen) return null;

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setErrorMessage("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch(`${backendUrl}/users/admin`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          username: usernameInput.trim().toLowerCase(),
          fullName: fullNameInput.trim() || usernameInput.trim(),
          password: passwordInput,
          role: "admin",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "ไม่สามารถสร้างบัญชีแอดมินได้");
      }

      setNoticeMessage(`เพิ่มแอดมิน "${usernameInput}" สำเร็จแล้ว!`);
      setUsernameInput("");
      setFullNameInput("");
      setPasswordInput("");
      fetchAdmins();

      setTimeout(() => setNoticeMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (adminId?: string, adminName?: string) => {
    if (!adminId) return;
    if (!confirm(`คุณต้องการลบสิทธิ์แอดมินของ "${adminName || adminId}" ใช่หรือไม่?`)) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch(`${backendUrl}/users/${adminId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a._id !== adminId && a.id !== adminId));
        setNoticeMessage(`ลบสิทธิ์แอดมินเรียบร้อยแล้ว`);
        setTimeout(() => setNoticeMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to delete admin:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white relative animate-in zoom-in-95 max-h-[90vh] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">
              ระบบจัดการผู้ดูแลระบบ (Admin Management)
            </h3>
            <p className="text-xs text-purple-300">
              เพิ่มและลบบัญชีผู้ดูแลระบบ (Admin Users) ของระบบแปลภาษามือ
            </p>
          </div>
        </div>

        {/* Notices & Alerts */}
        {noticeMessage && (
          <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto pr-1">
          {/* Left Column: Create Admin Form */}
          <div className="flex flex-col gap-3.5 bg-slate-950/60 p-4.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs border-b border-slate-800 pb-2">
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มผู้ดูแลระบบคนใหม่ (Add Admin)</span>
            </div>

            <form onSubmit={handleCreateAdminSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <User className="w-3 h-3 text-purple-400" />
                  ชื่อผู้ใช้ (Username) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น admin2, superadmin"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <User className="w-3 h-3 text-purple-400" />
                  ชื่อ-นามสกุล (Full Name) (Optional)
                </label>
                <input
                  type="text"
                  placeholder="เช่น สมชาย ใจดี"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-purple-400" />
                  รหัสผ่าน (Password) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-purple-500 focus:outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังสร้าง...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>สร้างผู้ดูแลระบบ</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Existing Admins List */}
          <div className="flex flex-col gap-3 bg-slate-950/60 p-4.5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
              <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                รายชื่อแอดมินในระบบ ({admins.length})
              </span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 pr-1">
              {admins.length > 0 ? (
                admins.map((admin) => (
                  <div
                    key={admin._id || admin.id || admin.username}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate">
                        {admin.fullName || admin.username}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        @{admin.username} {admin.email ? `(${admin.email})` : ""}
                      </p>
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30 text-[9px] font-mono font-semibold">
                        ROLE: {admin.role.toUpperCase()}
                      </span>
                    </div>

                    {(admin._id || admin.id) && (
                      <button
                        onClick={() => handleDeleteAdmin(admin._id || admin.id, admin.fullName || admin.username)}
                        className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition"
                        title="ลบแอดมินคนนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  ยังไม่มีผู้ดูแลระบบในฐานข้อมูล
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
