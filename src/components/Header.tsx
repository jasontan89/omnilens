import React from 'react';
import {
  Radio,
  Settings,
  ShieldAlert,
  Sparkles,
  Terminal,
  Users,
  GraduationCap,
  Bot,
  Network,
  ShieldCheck,
  Languages,
  TrendingUp,
  Globe,
  Download,
} from 'lucide-react';
import type { ConnectionState, CopilotPersona, LiveModel } from '../types/live';

interface HeaderProps {
  connectionState: ConnectionState;
  errorMessage?: string;
  currentModel: LiveModel;
  currentPersona: CopilotPersona;
  enableGoogleSearch?: boolean;
  isSearchingGoogle?: boolean;
  searchQuery?: string;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
  onOpenSettings: () => void;
  onSelectPersona: (persona: CopilotPersona) => void;
  onDisableSearchGrounding?: () => void;
}

const PERSONA_ICONS: Record<CopilotPersona, React.ReactNode> = {
  'pair-programmer': <Terminal className="w-4 h-4" />,
  'system-design': <Network className="w-4 h-4" />,
  'meeting-copilot': <Users className="w-4 h-4" />,
  'study-tutor': <GraduationCap className="w-4 h-4" />,
  'legal-auditor': <ShieldCheck className="w-4 h-4" />,
  'language-tutor': <Languages className="w-4 h-4" />,
  'financial-analyst': <TrendingUp className="w-4 h-4" />,
  'general-assistant': <Bot className="w-4 h-4" />,
};

const PERSONA_LABELS: Record<CopilotPersona, string> = {
  'pair-programmer': 'Pair Dev',
  'system-design': 'Architecture',
  'meeting-copilot': 'Meeting',
  'study-tutor': 'Tutor',
  'legal-auditor': 'Legal Audit',
  'language-tutor': 'Language',
  'financial-analyst': 'Finance',
  'general-assistant': 'Assistant',
};

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  errorMessage,
  currentModel,
  currentPersona,
  enableGoogleSearch,
  isSearchingGoogle,
  searchQuery,
  canInstallPwa,
  onInstallPwa,
  onOpenSettings,
  onSelectPersona,
  onDisableSearchGrounding,
}) => {
  return (
    <header className="border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md px-4 lg:px-6 py-3 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-purple-900/30">
          <Sparkles className="w-5 h-5 text-white" />
          {connectionState === 'connected' && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-gray-950"></span>
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              OmniLens <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">LIVE</span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 hidden sm:block">
            Real-Time Voice & Screen Multimodal Copilot
          </p>
        </div>
      </div>

      {/* Mode / Persona Switcher */}
      <div className="flex items-center gap-1.5 bg-gray-900/90 p-1 rounded-xl border border-gray-800">
        {(Object.keys(PERSONA_LABELS) as CopilotPersona[]).map((persona) => {
          const isActive = currentPersona === persona;
          return (
            <button
              key={persona}
              onClick={() => onSelectPersona(persona)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              {PERSONA_ICONS[persona]}
              <span className="hidden md:inline">{PERSONA_LABELS[persona]}</span>
            </button>
          );
        })}
      </div>

      {/* Status & Settings */}
      <div className="flex items-center gap-2.5">
        {/* Connection status indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900/90 border border-gray-800">
          <Radio
            className={`w-3.5 h-3.5 ${
              connectionState === 'connected'
                ? 'text-emerald-400 animate-pulse'
                : connectionState === 'connecting'
                ? 'text-amber-400 animate-spin'
                : connectionState === 'error'
                ? 'text-rose-400'
                : 'text-gray-500'
            }`}
          />
          <span
            className={`capitalize ${
              connectionState === 'connected'
                ? 'text-emerald-400'
                : connectionState === 'connecting'
                ? 'text-amber-400'
                : connectionState === 'error'
                ? 'text-rose-400'
                : 'text-gray-400'
            }`}
          >
            {connectionState === 'connected'
              ? 'Live'
              : connectionState === 'connecting'
              ? 'Connecting...'
              : connectionState === 'error'
              ? 'Error'
              : 'Disconnected'}
          </span>
        </div>

        {/* Model Pill */}
        <div className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-gray-900 border border-gray-800 text-gray-300">
          <span className="text-purple-400">⚡</span>
          {currentModel === 'gemini-3.1-flash-live-preview'
            ? '3 Flash Live'
            : currentModel === 'gemini-3.8-live'
            ? '3.8 Live'
            : currentModel === 'gemini-3.8-live-extended-thinking'
            ? '3.8 Thinking'
            : currentModel === 'gemini-3.5-live-translate-preview'
            ? '3.5 Translate'
            : '3.5 Transcribe'}
        </div>

        {/* Live Search Grounding Badge */}
        {enableGoogleSearch && currentModel !== 'gemini-3.5-transcribe-live' && (
          <div
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm transition-all ${
              isSearchingGoogle
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 animate-pulse ring-1 ring-cyan-500/30'
                : 'bg-cyan-950/40 border-cyan-800/50 text-cyan-300'
            }`}
            title={
              isSearchingGoogle
                ? `Searching Google via Gemini 3.1 Flash Lite${searchQuery ? `: "${searchQuery}"` : '...'}`
                : 'Grounding with Google Search enabled (Gemini 3.1 & 3.5 Flash Lite Free Tier)'
            }
          >
            <Globe className={`w-3.5 h-3.5 text-cyan-400 ${isSearchingGoogle ? 'animate-spin' : 'animate-pulse'}`} />
            <span>{isSearchingGoogle ? 'Searching Google...' : '3.1 Flash Lite Grounded'}</span>
          </div>
        )}

        {/* Install PWA Button (When browser supports install prompt) */}
        {canInstallPwa && onInstallPwa && (
          <button
            onClick={onInstallPwa}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Install OmniLens as an app on your device"
          >
            <Download className="w-3.5 h-3.5 text-purple-200" />
            <span>Install App</span>
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 transition-colors"
          title="Settings & API Key"
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enableGoogleSearch && onDisableSearchGrounding && errorMessage.toLowerCase().includes('quota') && (
              <button
                type="button"
                onClick={onDisableSearchGrounding}
                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] shadow transition-colors"
              >
                Disable Search &amp; Use Free Tier
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-200 text-[11px] font-medium transition-colors"
            >
              Open Settings
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
