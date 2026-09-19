import React, { useState } from 'react';
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
} from 'lucide-react';
import type {
  CopilotPersona,
  GeminiVoice,
  LiveModel,
  SessionSettings,
} from '../types/live';

interface SettingsModalProps {
  isOpen: boolean;
  settings: SessionSettings;
  onClose: () => void;
  onSave: (newSettings: SessionSettings) => void;
}

const VOICES: { id: GeminiVoice; label: string; desc: string }[] = [
  { id: 'Aoede', label: 'Aoede', desc: 'Warm, clear, and articulate' },
  { id: 'Puck', label: 'Puck', desc: 'Energetic, witty, and friendly' },
  { id: 'Charon', label: 'Charon', desc: 'Calm, deep, and authoritative' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Direct, focused, and crisp' },
  { id: 'Kore', label: 'Kore', desc: 'Gentle, soothing, and balanced' },
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
  const [screenFps, setScreenFps] = useState<number>(settings.screenFps);
  const [customInstructions, setCustomInstructions] = useState(
    settings.customInstructions || ''
  );
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      apiKey: apiKey.trim(),
      model,
      persona,
      voice,
      screenFps,
      customInstructions: customInstructions.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Copilot Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
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
                <span>Get key from AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 pr-10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
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
              Stored exclusively in your local browser storage. Never sent to any 3rd-party server.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              Live Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModel('gemini-3.1-flash-live-preview')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  model === 'gemini-3.1-flash-live-preview'
                    ? 'bg-purple-950/40 border-purple-500 text-purple-200'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="font-semibold text-xs text-white flex items-center gap-1">
                  <span>Gemini 3 Flash Live</span>
                  <Sparkles className="w-3 h-3 text-purple-400" />
                </div>
                <div className="text-[10px] text-gray-400 mt-1 leading-snug">
                  Fastest response, 65K TPM free quota, ideal for real-time speech.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModel('gemini-3.8-live')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  model === 'gemini-3.8-live'
                    ? 'bg-purple-950/40 border-purple-500 text-purple-200'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">Gemini 3.8 Live</div>
                <div className="text-[10px] text-gray-400 mt-1 leading-snug">
                  Enhanced reasoning & deep comprehension across complex code.
                </div>
              </button>
            </div>
          </div>

          {/* Persona Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-300">
              Copilot Persona
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'pair-programmer', label: 'Pair Programmer' },
                { id: 'meeting-copilot', label: 'Meeting Copilot' },
                { id: 'study-tutor', label: 'Study Tutor' },
                { id: 'general-assistant', label: 'General Assistant' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPersona(p.id as CopilotPersona)}
                  className={`py-2 px-3 rounded-lg border text-left text-xs font-medium transition-all ${
                    persona === p.id
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
              Voice Tone
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICES.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    voice === v.id
                      ? 'bg-purple-950/40 border-purple-500 text-purple-200'
                      : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs text-white">{v.label}</div>
                    <div className="text-[10px] text-gray-400">{v.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Screen FPS (Token Saver) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-300">
                Screen Stream Frame Rate
              </label>
              <span className="text-[11px] font-mono text-purple-400">
                {screenFps} FPS ({screenFps === 1 ? 'Free Tier Recommended' : 'Higher Smoothness'})
              </span>
            </div>
            <div className="flex gap-2">
              {[1, 2].map((fpsVal) => (
                <button
                  type="button"
                  key={fpsVal}
                  onClick={() => setScreenFps(fpsVal)}
                  className={`flex-1 py-2 rounded-lg border text-center font-medium transition-all ${
                    screenFps === fpsVal
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  {fpsVal} FPS
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500">
              1 FPS conserves tokens so you stay comfortably within the 65,000 TPM limit.
            </p>
          </div>

          {/* Custom System Instruction */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-300">
              Custom Persona Instructions (Optional)
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. You are helping me prepare for a Google software engineer system design interview..."
              rows={2}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
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
        </form>
      </div>
    </div>
  );
};
