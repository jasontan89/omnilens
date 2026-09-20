import React, { useRef, useEffect } from 'react';
import { Monitor, Camera, Maximize2, StopCircle, Eye, Zap, SwitchCamera, Smartphone } from 'lucide-react';
import type { CaptureSource } from '../lib/video/screen-capture';
import { isMobileDevice, type CameraFacingMode } from '../lib/video/screen-capture';

interface ScreenPreviewProps {
  stream: MediaStream | null;
  captureSource: CaptureSource;
  fps: number;
  facingMode?: CameraFacingMode;
  onStartScreen: () => void;
  onStartCamera: (facing?: CameraFacingMode) => void;
  onFlipCamera?: () => void;
  onStopCapture: () => void;
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  stream,
  captureSource,
  fps,
  facingMode = 'user',
  onStartScreen,
  onStartCamera,
  onFlipCamera,
  onStopCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMobile = isMobileDevice();

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
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/90 text-white shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                LIVE VISION
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-900/80 text-gray-200 border border-gray-700/80 backdrop-blur-md">
                {captureSource === 'screen'
                  ? 'Screen Share'
                  : facingMode === 'environment'
                  ? 'Rear Camera'
                  : 'Front Camera'}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800/60">
                <Zap className="w-3 h-3 text-purple-400" />
                {fps} FPS
              </span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
              {captureSource === 'camera' && onFlipCamera && (
                <button
                  onClick={onFlipCamera}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-200 hover:text-white border border-purple-700/80 backdrop-blur-md transition-colors text-xs font-medium shadow"
                  title={`Flip to ${facingMode === 'environment' ? 'Front (Selfie)' : 'Rear (Back)'} camera`}
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-purple-300 animate-spin-once" />
                  <span>Flip</span>
                </button>
              )}
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
        <div className="p-4 sm:p-6 text-center max-w-lg flex flex-col items-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-900/80 border border-gray-800 flex items-center justify-center mb-3 sm:mb-4 text-purple-400 shadow-inner">
            <Eye className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h3 className="text-base font-semibold text-gray-200 mb-1">
            Gemini Vision is Ready
          </h3>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed max-w-sm">
            Share your camera or screen feed. Gemini will continuously inspect visual frames to solve problems, read code, or explain diagrams in real time.
          </p>

          {isMobile ? (
            /* Mobile-specific controls: Quick Rear vs Front selection */
            <div className="w-full flex flex-col items-center gap-2.5">
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                <button
                  onClick={() => onStartCamera('environment')}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white shadow-lg text-xs font-semibold transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Rear Camera (World)</span>
                </button>
                <button
                  onClick={() => onStartCamera('user')}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 text-xs font-medium transition-all active:scale-95"
                >
                  <SwitchCamera className="w-4 h-4 text-purple-400" />
                  <span>Front Camera (Selfie)</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-800/40 px-3 py-1.5 rounded-lg max-w-xs text-left">
                <Smartphone className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Mobile OS blocks browser screen sharing. Use Rear Camera to point at monitors or documents.</span>
              </div>
            </div>
          ) : (
            /* Desktop controls: Screen share primary + Camera directions */
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={onStartScreen}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Monitor className="w-4 h-4" />
                <span>Share Screen / Window</span>
              </button>
              <button
                onClick={() => onStartCamera('user')}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 hover:text-white border border-gray-700/80 text-xs font-medium transition-all"
                title="Start Webcam"
              >
                <Camera className="w-4 h-4 text-purple-400" />
                <span>Camera</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
