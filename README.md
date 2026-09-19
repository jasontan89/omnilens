# 🎙️ OmniLens — Real-Time Multimodal Voice & Screen Copilot

OmniLens is an ultra-low latency, real-time multimodal copilot that **hears your voice, speaks back with natural cadence, and "sees" your active screen or webcam in real time**.

Built on Google's **Gemini Live API** (`gemini-3.1-flash-live-preview` / `gemini-3.8-live`) with bidirectional WebSocket streaming, instant interruption handling, and token-optimized screen capture.

---

## 🌟 Key Features

* **"See What I See" Real-Time Vision**: Stream active display (VS Code, browser, slides, terminal) or webcam at 1 FPS with smart canvas downscaling to conserve tokens while keeping code crisp.
* **Zero-Latency Spoken Dialogue**: 16kHz PCM audio streaming input with synchronized 24kHz raw PCM playback.
* **Instant Voice Interruption (VAD)**: Speak over Gemini at any point; audio output halts immediately and pivots to your new question.
* **Adaptive Copilot Personas**:
  * 💻 **Pair Programmer**: Inspects IDE screens, terminal output, stack traces, and code refactors.
  * 📋 **Meeting Copilot**: Transcribes live audio, extracts key decisions, and drafts action items.
  * 🎓 **Study Tutor**: Step-by-step problem solver for slides, homework, math, and diagrams.
  * 🤖 **General Assistant**: Adaptive real-time conversational partner.
* **Live Action Items & Notes**: Auto-detects key takeaways and code snippets with 1-click Markdown export.
* **Neon Audio Visualizer**: Dual-channel glowing waveform canvas reacting to both user speech and AI voice.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/jasontan89/omnilens.git
cd omnilens
npm install
```

### 2. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in Google Chrome or Microsoft Edge.

### 3. Connect
1. Click the **Settings** gear icon in the top right.
2. Enter your **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/app/apikey)).
3. Click **Connect Live** in the floating dock, grant microphone access, and optionally share your screen!

---

## 🧪 Running Tests & Building

```bash
# Run unit tests
npm test

# Build production bundle
npm run build
```

---

## ☁️ Deploying to Vercel

OmniLens is 100% compatible with Vercel and requires zero backend infrastructure:

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your `omnilens` repository.
4. Vercel automatically detects the Vite framework settings (`npm run build` -> `dist/`).
5. Click **Deploy**!

> **Why it works seamlessly on Vercel:**
> OmniLens establishes a direct browser-to-Google edge WebSocket connection (`wss://generativelanguage.googleapis.com/...`). There are no backend serverless execution timeouts or proxy latency bottlenecks!
