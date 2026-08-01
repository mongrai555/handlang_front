# 🤟 ระบบแปลภาษามือไทย Real-Time (Thai Sign Language Translator & Text-to-Speech)

ระบบเว็บแอปพลิเคชันสำหรับแปลภาษามือไทย (Thai Sign Language) ในรูปแบบ Real-Time โดยประมวลผลผ่านกล้อง Web Camera จับการเคลื่อนไหวพิกัดนิ้วมือ 21 จุด 3D แบบเรียลไทม์ และแปลงผลลัพธ์เป็นข้อความพร้อมทั้งออกเสียงพูด (Text-to-Speech) อัตโนมัติ เพื่อช่วยเชื่อมต่อการสื่อสารระหว่างผู้พิการทางการได้ยิน (คนหูหนวก) และบุคคลทั่วไป

---

## 🎯 วัตถุประสงค์โครงการ (Project Objectives)
1. **ทลายกำแพงการสื่อสาร (Bridge Communication Gap):** ช่วยให้คนทั่วไปที่ไม่เข้าใจภาษามือสามารถสื่อสารกับผู้พิการทางการได้ยินได้อย่างสะดวกและมีประสิทธิภาพ
2. **ประมวลผลบนเครื่องผู้ใช้ (Client-Side Edge Processing):** ประมวลผลภาพและท่าทางมือบนเว็บเบราว์เซอร์ของผู้ใช้โดยตรง ปลอดภัย ไร้กังวลเรื่องความเป็นส่วนตัว (Privacy-First)
3. **สื่อสารด้วยเสียงเป็นธรรมชาติ (Natural Speech Output):** แปลผลลัพธ์จากภาษามือเป็นข้อความและเล่นเสียงพูดภาษาไทยความคมชัดสูงทันที

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack & Architecture)

### **Frontend & Framework**
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS (Modern Glassmorphism Design System)
- **UI Components & Icons:** Lucide React (`Camera`, `Volume2`, `Hand`, `Layers`, `Sparkles` ฯลฯ)

### **Computer Vision & AI Engine**
- **Core Library:** `@tensorflow/tfjs-core` & `@tensorflow/tfjs-backend-webgl` (การเร่งความเร็วการประมวลผลด้วย GPU)
- **Hand Detection Model:** `@tensorflow-models/hand-pose-detection`
- **Pose Estimator Runtime:** `@mediapipe/hands` (ตรวจจับพิกัดนิ้วมือ 21 จุด 3D แบบ High-Precision)

### **Audio & Voice Processing**
- **Speech Engine:** Web Speech API (`window.speechSynthesis`)
- **Default Voice:** `Microsoft เปรมวดี Online (Natural) - Thai (Thailand)` (เสียงพากย์ธรรมชาติความคมชัดสูง)
- **Voice Persistence:** `localStorage` บันทึกการเลือกเสียงอ่านของผู้ใช้
- **Audio Cue & Feedback:** Web Audio API (`AudioContext` สำหรับส่งสัญญาณเสียง Beep ตอบสนองผู้ใช้)

---

## ✨ คุณสมบัติเด่นของระบบ (Key Features)

1. 📷 **Real-Time Hand Landmark Detection (21 Points)**
   - ตรวจจับข้อต่อและปลายนิ้วมือ 21 จุดในมิติ 3D (X, Y, Z coordinates)
   - แสดงผล Skeleton โครงกระดูกมือแยกสีตามกลุ่มนิ้วมือ (นิ้วโป้ง-เขียว, นิ้วชี้-ฟ้า, นิ้วกลาง-น้ำเงิน, นิ้วนาง-ม่วง, นิ้วก้อย-ชมพู) บน HTML5 Canvas แบบ Real-Time

2. 🔊 **Robust Text-to-Speech (TTS) System**
   - แปลงข้อความภาษามือเป็นเสียงพูดภาษาไทยโดยอัตโนมัติ
   - ป้องกันปัญหาสายหลุด/เสียงดับด้วย V8 Garbage Collection Guard Reference
   - มี Dropdown ให้เลือกสลับเสียงอ่านจากเอนจินของระบบปฏิบัติการและเบราว์เซอร์ได้อิสระ

3. 📊 **21 Finger Landmarks Inspector & Data Export**
   - แผงดูพิกัดตัวเลขพิกัดนิ้วมือ 21 จุดในมิติ Real-Time
   - รองรับการ Export ข้อมูลพิกัดมือเป็นไฟล์ JSON สำหรับนำไปใช้เทรนโมเดล Machine Learning เพิ่มเติม

4. 🎛️ **Interactive Controls & Presets**
   - โหมดกระจกเงา (Mirror Camera Toggle) สำหรับปรับมุมมองกล้องตามความถนัด
   - ปุ่มลัดออกเสียงประโยคทักทายด่วน (Preset Phrases: สวัสดีครับ, ขอบคุณครับ, ยินดีที่ได้รู้จัก, สบายดีไหม)
   - Telemetry Bar แสดงอัตราเฟรมเรต (FPS) และสถานะการทำงานของ TensorFlow WebGL Engine

---

## 🚀 การติดตั้งและเริ่มใช้งาน (Getting Started)

### **1. การติดตั้ง Dependencies**
```bash
npm install
```

### **2. เริ่มต้นรันเซิร์ฟเวอร์โหมด Development**
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

### **3. การสร้าง Production Build**
```bash
npm run build
npm run start
```

---

## 📂 โครงสร้างโฟลเดอร์หลัก (Project Directory Structure)

```
hand_lang/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main Next.js Page (Dynamic SSR-disabled Import)
│   │   ├── layout.tsx             # Global Layout Configuration
│   │   └── globals.css            # Tailwind & Canvas Styling Rules
│   ├── components/
│   │   └── HandTracker.tsx        # Main Real-Time Vision & TTS Controller
│   └── utils/
│       └── handSkeleton.ts        # Hand Joint Mapping & Canvas Rendering Engine
├── public/                        # Static Assets
├── hand.md                        # Documentation & Project Overview
├── next.config.js                 # Next.js Custom Configuration
├── tailwind.config.js             # Tailwind CSS Design System Setup
└── package.json                   # Project Dependencies & Scripts
```

---

## 🔒 ความปลอดภัยและความเป็นส่วนตัว (Privacy & Performance)
- **Local Browser Processing:** วิดีโอสตรีมจากกล้องเว็บแคมประมวลผลบนหน่วยความจำของเครื่องผู้ใช้เท่านั้น ไม่มีการบันทึกหรือส่งวิดีโอออกไปยัง External Server ใดๆ
- **Zero Latency:** ทำงานด้วยความเร็วสูง 30-60 FPS ขึ้นอยู่กับความสามารถของ GPU
