import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  userAnalyser: AnalyserNode | null;
  geminiAnalyser: AnalyserNode | null;
  isConnected: boolean;
  isMicMuted: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({
  userAnalyser,
  geminiAnalyser,
  isConnected,
  isMicMuted,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const userBuffer = new Uint8Array(128);
    const geminiBuffer = new Uint8Array(128);

    const render = () => {
      animationId = requestAnimationFrame(render);

      // Handle canvas resolution
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let hasUserAudio = false;
      let hasGeminiAudio = false;

      if (userAnalyser && !isMicMuted) {
        userAnalyser.getByteFrequencyData(userBuffer);
        const avg = userBuffer.reduce((a, b) => a + b, 0) / userBuffer.length;
        if (avg > 10) hasUserAudio = true;
      }

      if (geminiAnalyser) {
        geminiAnalyser.getByteFrequencyData(geminiBuffer);
        const avg = geminiBuffer.reduce((a, b) => a + b, 0) / geminiBuffer.length;
        if (avg > 8) hasGeminiAudio = true;
      }

      const barCount = 48;
      const barWidth = Math.max(3, (width / barCount) - 3);
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + 3);
        const normIndex = Math.floor((i / barCount) * (userBuffer.length / 2));

        let userVal = userBuffer[normIndex] || 0;
        let geminiVal = geminiBuffer[normIndex] || 0;

        // If disconnected or silent, generate a subtle ambient breathing idle wave
        const idleTime = Date.now() * 0.003;
        const idleHeight = Math.sin(idleTime + i * 0.2) * 4 + 6;

        let barHeight = idleHeight;
        let fillStyle: string | CanvasGradient = 'rgba(75, 85, 99, 0.3)';

        if (hasGeminiAudio) {
          // Gemini is speaking: vibrant violet/pink gradient
          const scaled = (geminiVal / 255) * (height * 0.85);
          barHeight = Math.max(4, scaled);
          const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
          gradient.addColorStop(0, '#ec4899'); // pink-500
          gradient.addColorStop(0.5, '#a855f7'); // purple-500
          gradient.addColorStop(1, '#6366f1'); // indigo-500
          fillStyle = gradient;
        } else if (hasUserAudio) {
          // User is speaking: vibrant emerald/cyan gradient
          const scaled = (userVal / 255) * (height * 0.85);
          barHeight = Math.max(4, scaled);
          const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2);
          gradient.addColorStop(0, '#34d399'); // emerald-400
          gradient.addColorStop(0.5, '#06b6d4'); // cyan-500
          gradient.addColorStop(1, '#3b82f6'); // blue-500
          fillStyle = gradient;
        } else if (isConnected) {
          // Connected ready state: subtle purple glow
          fillStyle = 'rgba(168, 85, 247, 0.4)';
        }

        ctx.fillStyle = fillStyle;
        const y = centerY - barHeight / 2;
        const radius = barWidth / 2;

        // Draw rounded rectangle
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [userAnalyser, geminiAnalyser, isConnected, isMicMuted]);

  return (
    <div className="relative w-full h-16 sm:h-20 bg-gray-950/60 rounded-2xl border border-gray-800/80 p-2 flex items-center justify-center overflow-hidden backdrop-blur-sm">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-cyan-500/5 pointer-events-none" />
      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        className="w-full h-full max-w-xl mx-auto"
      />
      <div className="absolute bottom-1 right-3 text-[10px] font-mono text-gray-500 tracking-wider">
        {isConnected
          ? isMicMuted
            ? 'MIC MUTED'
            : 'AUDIO STREAM ACTIVE'
          : 'DISCONNECTED'}
      </div>
    </div>
  );
};
