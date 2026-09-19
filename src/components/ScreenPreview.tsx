import React, { useRef, useEffect } from 'react';
import { Monitor, Camera, Maximize2, StopCircle, Eye, Zap } from 'lucide-react';
import type { CaptureSource } from '../lib/video/screen-capture';

interface ScreenPreviewProps {
  stream: MediaStream | null;
  captureSource: CaptureSource;
  fps: number;
  onStartScreen: () => void;
  onStartCamera: () => void;
  onStopCapture: () => void;
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  stream,
  captureSource,
  fps,
  onStartScreen,
  onStartCamera,
  onStopCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="relative w-full aspect-video bg-gray-950/90 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl flex flex-col items-center justify-center group">
      {stream && captureSource ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black"
          />

          {/* Top overlay badge bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/90 text-white shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                LIVE VISION
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-900/80 text-gray-200 border border-gray-700/80 backdrop-blur-md">
                {captureSource === 'screen' ? 'Screen Share' : 'Camera Feed'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800/60">
                <Zap className="w-3 h-3 text-purple-400" />
                {fps} FPS (Token-Optimized)
              </span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700/80 backdrop-blur-md transition-colors"
                title="Toggle Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onStopCapture}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-medium shadow-md transition-colors"
                title="Stop sharing feed"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Empty State / Standby Vision Prompt */
        <div className="p-6 text-center max-w-md flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-900/80 border border-gray-800 flex items-center justify-center mb-4 text-purple-400 shadow-inner">
            <Eye className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-gray-200 mb-1.5">
            Gemini Vision is Ready
          </h3>
          <p className="text-xs text-gray-400 mb-5 leading-relaxed">
            Share your display, IDE, presentation, or webcam. Gemini continuously inspects visual frames to debug code, explain diagrams, or review slides in real time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={onStartScreen}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Monitor className="w-4 h-4" />
              <span>Share Screen / Window</span>
            </button>
            <button
              onClick={onStartCamera}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 hover:text-white border border-gray-700/80 text-xs font-medium transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
