import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Cpu,
  Volume2,
  Sliders,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Play,
  Square,
  Globe,
  Languages,
  Zap,
  BrainCircuit,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import type {
  CopilotPersona,
  GeminiVoice,
  LiveModel,
  SessionSettings,
} from '../types/live';
import {
  VOICE_PROFILES,
  playVoicePreview,
  stopVoicePreview,
} from '../lib/audio/voice-preview';

interface SettingsModalProps {
  isOpen: boolean;
  settings: SessionSettings;
  onClose: () => void;
  onSave: (newSettings: SessionSettings) => void;
}

const SUPPORTED_MODELS: {
  id: LiveModel;
  name: string;
  badge: string;
  badgeColor: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'gemini-3.1-flash-live-preview',
    name: 'Gemini 3 Flash Live',
    badge: 'Fast / Free Tier Safe',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    desc: 'Lowest latency for real-time speech and screen vision. Best for free quota (65k TPM).',
    icon: <Zap className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'gemini-3.8-live',
    name: 'Gemini 3.8 Live',
    badge: 'Deep Reasoning',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    desc: 'Enhanced reasoning and code comprehension with balanced medium thinking depth.',
    icon: <Cpu className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'gemini-3.8-live-extended-thinking',
    name: 'Gemini 3.8 Live Extended Thinking',
    badge: 'Maximum Cognitive Depth',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    desc: 'Extended thinking mode (high thinking level) for complex system architecture, mathematical proofs, and deep debugging.',
    icon: <BrainCircuit className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'gemini-3.5-live-translate-preview',
    name: 'Gemini 3.5 Live Translate',
    badge: 'Real-Time Translation',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    desc: 'Bilingual live speech interpreter. Speaks translated audio in your chosen target language.',
    icon: <Languages className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'gemini-3.5-transcribe-live',
    name: 'Gemini 3.5 Transcribe Live',
    badge: 'Sub-Second Transcription',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    desc: 'Ultra-fast speech-to-text without audio reply. Ideal for captioning and silent transcription.',
    icon: <MessageSquare className="w-4 h-4 text-amber-400" />,
  },
];

const TARGET_LANGUAGES = [
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'zh', label: 'Mandarin Chinese (中文)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'ru', label: 'Russian (Русский)' },
];

const PERSONA_TEMPLATES: {
  persona: CopilotPersona;
  label: string;
  title: string;
  samplePrompt: string;
}[] = [
  {
    persona: 'pair-programmer',
    label: 'Pair Programmer',
    title: 'Senior Full-Stack Code Reviewer',
    samplePrompt: 'Focus on spotting memory leaks, off-by-one errors, TypeScript strict typing improvements, and modern React patterns. Speak concisely and give direct line references.',
  },
  {
    persona: 'system-design',
    label: 'System Design Interviewer',
    title: 'FAANG Principal Architect',
    samplePrompt: 'Act as a Principal Engineer interviewing me on distributed systems. Question my choice of database, caching strategy, SPOF vulnerabilities, and horizontal scaling limits.',
  },
  {
    persona: 'meeting-copilot',
    label: 'Meeting Copilot',
    title: 'Executive Assistant & Secretary',
    samplePrompt: 'Listen to the meeting conversation and track action items, decisions made, and assigned deadlines. Format notes clearly with bullet points starting with "Action Item:".',
  },
  {
    persona: 'study-tutor',
    label: 'Study Tutor',
    title: 'Socratic Math & Science Coach',
    samplePrompt: 'Guide me step-by-step through calculations and problems visible on my screen. Do not give away the final answer immediately—prompt me to notice any mistakes in my logic.',
  },
  {
    persona: 'legal-auditor',
    label: 'Legal Auditor',
    title: 'Contract & Risk Analyst',
    samplePrompt: 'Scrutinize the contract on my screen for unfavorable indemnity, non-compete clauses, auto-renewal traps, or liability disclaimers. Flag risks in plain English.',
  },
  {
    persona: 'language-tutor',
    label: 'Language Tutor',
    title: 'Conversational Fluency Coach',
    samplePrompt: 'Converse with me in my target language. Provide natural phrasing alternatives and gently correct my pronunciation or grammatical mistakes.',
  },
  {
    persona: 'financial-analyst',
    label: 'Financial Analyst',
    title: 'Wall Street Valuation Specialist',
    samplePrompt: 'Examine earnings reports, balance sheets, and charts on screen. Highlight gross margin trends, debt coverage ratios, and cash flow anomalies.',
  },
  {
    persona: 'general-assistant',
    label: 'General Assistant',
    title: 'Multimodal Companion',
    samplePrompt: 'Be a friendly, quick, and witty assistant. Help me solve whatever is currently visible on my screen or camera.',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState<LiveModel>(settings.model);
  const [persona, setPersona] = useState<CopilotPersona>(settings.persona);
  const [voice, setVoice] = useState<GeminiVoice>(settings.voice);
  const [screenFps, setScreenFps] = useState<number>(settings.screenFps || 1);
  const [customInstructions, setCustomInstructions] = useState(
    settings.customInstructions || ''
  );
  const [targetLanguageCode, setTargetLanguageCode] = useState(
    settings.targetLanguageCode || 'es'
  );
  const [enableGoogleSearch, setEnableGoogleSearch] = useState<boolean>(
    settings.enableGoogleSearch ?? false
  );
  const [braveSearchApiKey, setBraveSearchApiKey] = useState(
    settings.braveSearchApiKey || ''
  );
  const [showKey, setShowKey] = useState(false);
  const [showBraveKey, setShowBraveKey] = useState(false);
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<'all' | 'female' | 'male'>('female');
  const [playingVoiceId, setPlayingVoiceId] = useState<GeminiVoice | null>(null);

  // Stop any playing voice preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopVoicePreview();
      setPlayingVoiceId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVoicePreview = (voiceId: GeminiVoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (playingVoiceId === voiceId) {
      stopVoicePreview();
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voiceId);
    playVoicePreview(voiceId, () => {
      setPlayingVoiceId(null);
    });
  };

  const handleSelectVoice = (voiceId: GeminiVoice) => {
    setVoice(voiceId);
    handleVoicePreview(voiceId);
  };

  const handleApplyPersonaTemplate = (tmpl: typeof PERSONA_TEMPLATES[0]) => {
    setPersona(tmpl.persona);
    setCustomInstructions(tmpl.samplePrompt);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    stopVoicePreview();
    onSave({
      apiKey: apiKey.trim(),
      model,
      persona,
      voice,
      screenFps,
      customInstructions: customInstructions.trim(),
      targetLanguageCode,
      enableGoogleSearch,
      braveSearchApiKey: braveSearchApiKey.trim(),
    });
    onClose();
  };

  const filteredVoices = VOICE_PROFILES.filter((v) => {
    if (voiceGenderFilter === 'all') return true;
    return v.gender === voiceGenderFilter;
  });

  // Calculate estimated token burn for FPS
  const getFpsInfo = (fps: number) => {
    switch (fps) {
      case 1:
        return {
          rate: '~15,000 TPM',
          label: 'Free Tier Recommended (Lowest token burn)',
          color: 'text-emerald-400',
          bg: 'bg-emerald-950/40 border-emerald-500/40',
        };
      case 2:
        return {
          rate: '~30,000 TPM',
          label: 'Smooth UI & text reading',
          color: 'text-blue-400',
          bg: 'bg-blue-950/40 border-blue-500/40',
        };
      case 3:
        return {
          rate: '~45,000 TPM',
          label: 'Fluid motion & code scrolling',
          color: 'text-purple-400',
          bg: 'bg-purple-950/40 border-purple-500/40',
        };
      case 4:
        return {
          rate: '~60,000 TPM',
          label: 'Approaching free tier 65k limit',
          color: 'text-amber-400',
          bg: 'bg-amber-950/40 border-amber-500/40',
        };
      case 5:
        return {
          rate: '~75,000 TPM',
          label: 'High speed (Best with paid Tier 1 API key)',
          color: 'text-rose-400',
          bg: 'bg-rose-950/40 border-rose-500/40',
        };
      default:
        return { rate: '~15,000 TPM', label: '', color: 'text-gray-400', bg: 'bg-gray-900 border-gray-800' };
    }
  };

  const fpsInfo = getFpsInfo(screenFps);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Copilot Configuration</h2>
              <p className="text-[11px] text-gray-400">Customize models, voice tones, screen FPS, and personas</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopVoicePreview();
              onClose();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5"
              >
                <span>Get API key from Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2.5 pr-10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Stored locally in browser storage. Your key is never shared or transmitted to external servers.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              Live AI Model Architecture
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUPPORTED_MODELS.map((m) => {
                const isSelected = model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 text-purple-100 shadow-md ring-1 ring-purple-500/50'
                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                        {m.icon}
                        <span>{m.name}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-snug mt-1">{m.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Target Language dropdown if Translate model is active */}
            {model === 'gemini-3.5-live-translate-preview' && (
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/40 rounded-xl mt-2 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <div className="font-medium text-xs text-cyan-200">Target Translation Language</div>
                    <div className="text-[11px] text-cyan-300/70">Audio replies will be spoken in this language</div>
                  </div>
                </div>
                <select
                  value={targetLanguageCode}
                  onChange={(e) => setTargetLanguageCode(e.target.value)}
                  className="bg-gray-900 border border-cyan-500/50 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  {TARGET_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Voice Tone with Female Tones & Audio Previews */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                Voice Tone & Preview Sample
              </label>
              <div className="flex items-center gap-1 bg-gray-900 p-0.5 rounded-lg border border-gray-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setVoiceGenderFilter('female')}
                  className={`px-2.5 py-0.5 rounded-md transition-colors ${
                    voiceGenderFilter === 'female'
                      ? 'bg-purple-600/40 text-purple-200 font-semibold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Female (6 tones)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGenderFilter('male')}
                  className={`px-2.5 py-0.5 rounded-md transition-colors ${
                    voiceGenderFilter === 'male'
                      ? 'bg-purple-600/40 text-purple-200 font-semibold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Male (4 tones)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGenderFilter('all')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    voiceGenderFilter === 'all'
                      ? 'bg-purple-600/40 text-purple-200 font-semibold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredVoices.map((v) => {
                const isSelected = voice === v.id;
                const isPlaying = playingVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVoice(v.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 ring-1 ring-purple-500/40'
                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">{v.name}</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            v.gender === 'female'
                              ? 'bg-pink-500/20 text-pink-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {v.gender === 'female' ? 'Female' : 'Male'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">{v.desc}</div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleVoicePreview(v.id, e)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-all shrink-0 ${
                        isPlaying
                          ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
                      }`}
                      title={isPlaying ? 'Stop sample' : 'Play voice sample'}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Sample</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Screen Stream Frame Rate Slider */}
          <div className="space-y-2 p-3 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Screen Stream Frame Rate (Slider)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-purple-300">{screenFps} FPS</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${fpsInfo.bg} ${fpsInfo.color}`}>
                  {fpsInfo.rate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] font-mono text-gray-500">1 FPS</span>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={screenFps}
                onChange={(e) => setScreenFps(Number(e.target.value))}
                className="flex-1 accent-purple-500 cursor-pointer h-2 bg-gray-800 rounded-lg"
              />
              <span className="text-[11px] font-mono text-gray-500">5 FPS</span>
            </div>

            <div className="text-[11px] text-gray-400 flex items-center justify-between">
              <span>{fpsInfo.label}</span>
              <span className="text-gray-500">Max width: 1024px JPEG</span>
            </div>
          </div>

          {/* Grounding with Brave Search / Live Web Data */}
          <div className="p-3.5 bg-gray-900/60 rounded-xl border border-gray-800 space-y-2.5 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  enableGoogleSearch
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-200">Live Search Grounding</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        enableGoogleSearch
                          ? 'bg-orange-950/60 text-orange-300 border-orange-500/40'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {enableGoogleSearch ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Enables real-time web search for time-sensitive queries (news, weather, stock prices, live scores). General and historical knowledge is answered directly by the model.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={enableGoogleSearch}
                onClick={() => setEnableGoogleSearch(!enableGoogleSearch)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500/40 ${
                  enableGoogleSearch ? 'bg-orange-600' : 'bg-gray-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enableGoogleSearch ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {enableGoogleSearch && (
              <div className="space-y-3 pt-2 border-t border-gray-800/80 animate-in fade-in duration-200">
                <div className="p-2.5 rounded-lg bg-orange-950/30 border border-orange-500/30 text-[11px] text-orange-200/90 leading-relaxed space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-orange-300">
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    Brave Search API + Gemini 3.1 Flash Lite Grounding
                  </div>
                  <div>
                    Retrieves fresh web results via <strong className="text-white font-medium">Brave Search</strong> and synthesizes concise voice responses via <strong className="text-white font-medium">Gemini 3.1 Flash Lite</strong> (fallback to Gemini 3.5 Flash Lite), preventing outdated answers.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-orange-400" />
                      Brave Search API Key
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        2,000 Free Queries/Mo
                      </span>
                    </label>
                    <a
                      href="https://brave.com/search/api/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5"
                    >
                      <span>Get Free Brave Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      type={showBraveKey ? 'text' : 'password'}
                      value={braveSearchApiKey}
                      onChange={(e) => setBraveSearchApiKey(e.target.value)}
                      placeholder="BSA..."
                      className="w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBraveKey(!showBraveKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showBraveKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400">
                    {braveSearchApiKey.trim() ? (
                      <span className="text-emerald-400 font-medium">✓ Brave Search active for real-time web &amp; news results.</span>
                    ) : (
                      <span>Optional. If empty, OmniLens automatically falls back to free Open-Meteo weather and Wikipedia extracts with zero API key needed.</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="text-[10px] text-gray-500 pt-1.5 border-t border-gray-800/80 flex items-center justify-between">
              <span>Engine: <code className="font-mono text-orange-400">Brave Search &amp; Gemini 3.1 Flash Lite</code></span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">⚡ Free Tier Ready</span>
            </div>
          </div>

          {/* Persona Selection & Custom Examples */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Copilot Persona & Pre-Built Examples
              </label>
              <span className="text-[10px] text-purple-400">Click any card to auto-apply prompt</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PERSONA_TEMPLATES.map((tmpl) => {
                const isActive = persona === tmpl.persona;
                return (
                  <button
                    key={tmpl.persona}
                    type="button"
                    onClick={() => handleApplyPersonaTemplate(tmpl)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200 ring-1 ring-purple-500/40'
                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="font-semibold text-[11px] text-white truncate">{tmpl.label}</div>
                    <div className="text-[10px] text-gray-400 truncate">{tmpl.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom System Instruction Textarea */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-300 flex items-center justify-between">
              <span>Custom Persona Instructions</span>
              <span className="text-[10px] text-gray-500 font-normal">Appended to system guidelines</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Focus on distributed systems trade-offs and challenge my assumptions..."
              rows={2}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 flex items-center justify-between border-t border-gray-800">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Settings save instantly in local storage</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  stopVoicePreview();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
