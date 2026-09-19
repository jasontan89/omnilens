import React from 'react';
import {
  Mic,
  MicOff,
  Monitor,
  Camera,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
} from 'lucide-react';
import type { ConnectionState } from '../types/live';
import type { CaptureSource } from '../lib/video/screen-capture';

interface ControlBarProps {
  connectionState: ConnectionState;
  isMicMuted: boolean;
  isSpeakerMuted: boolean;
  captureSource: CaptureSource;
  onToggleConnect: () => void;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onToggleScreen: () => void;
  onToggleCamera: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  connectionState,
  isMicMuted,
  isSpeakerMuted,
  captureSource,
  onToggleConnect,
  onToggleMic,
  onToggleSpeaker,
  onToggleScreen,
  onToggleCamera,
}) => {
  const isConnected = connectionState === 'connected';

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gray-950/90 border border-gray-800 shadow-2xl backdrop-blur-xl">
      {/* Microphone toggle */}
      <button
        onClick={onToggleMic}
        disabled={!isConnected}
        className={`relative p-3 rounded-xl flex items-center justify-center transition-all ${
          !isConnected
            ? 'opacity-40 cursor-not-allowed bg-gray-900 text-gray-500'
            : isMicMuted
            ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40 hover:bg-rose-600/30'
            : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
        }`}
        title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* Screen Share toggle */}
      <button
        onClick={onToggleScreen}
        disabled={!isConnected}
        className={`p-3 rounded-xl flex items-center justify-center transition-all ${
          !isConnected
            ? 'opacity-40 cursor-not-allowed bg-gray-900 text-gray-500'
            : captureSource === 'screen'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 hover:bg-indigo-500'
            : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800'
        }`}
        title={captureSource === 'screen' ? 'Stop screen share' : 'Share screen / window'}
      >
        <Monitor className="w-5 h-5" />
      </button>

      {/* Camera toggle */}
      <button
        onClick={onToggleCamera}
        disabled={!isConnected}
        className={`p-3 rounded-xl flex items-center justify-center transition-all ${
          !isConnected
            ? 'opacity-40 cursor-not-allowed bg-gray-900 text-gray-500'
            : captureSource === 'camera'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 hover:bg-indigo-500'
            : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800'
        }`}
        title={captureSource === 'camera' ? 'Turn off camera' : 'Turn on camera'}
      >
        <Camera className="w-5 h-5" />
      </button>

      {/* Speaker mute toggle */}
      <button
        onClick={onToggleSpeaker}
        className={`p-3 rounded-xl flex items-center justify-center transition-all ${
          isSpeakerMuted
            ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40'
            : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800'
        }`}
        title={isSpeakerMuted ? 'Unmute AI voice' : 'Mute AI voice'}
      >
        {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      <div className="w-[1px] h-7 bg-gray-800 mx-1" />

      {/* Primary Connect / Disconnect Action Button */}
      <button
        onClick={onToggleConnect}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg active:scale-95 ${
          isConnected
            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
            : connectionState === 'connecting'
            ? 'bg-amber-600 text-white animate-pulse'
            : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/40 hover:shadow-purple-900/60'
        }`}
      >
        {isConnected ? (
          <>
            <PhoneOff className="w-4 h-4" />
            <span>End Session</span>
          </>
        ) : connectionState === 'connecting' ? (
          <span>Connecting...</span>
        ) : (
          <>
            <PhoneCall className="w-4 h-4" />
            <span>Connect Live</span>
          </>
        )}
      </button>
    </div>
  );
};
