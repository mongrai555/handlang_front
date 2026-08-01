"use client";

import dynamic from "next/dynamic";

const HandTracker = dynamic(() => import("../components/HandTracker"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400 z-50">
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-cyan-500/30" />
      <span className="text-sm font-medium tracking-wide text-cyan-300">
        กำลังโหลดระบบตรวจจับพิกัดนิ้วมือ (MediaPipe & TensorFlow.js)...
      </span>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <HandTracker isAdmin={false} />
    </main>
  );
}
