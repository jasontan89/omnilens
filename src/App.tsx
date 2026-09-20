import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Visualizer } from './components/Visualizer';
import { ScreenPreview } from './components/ScreenPreview';
import { TranscriptView } from './components/TranscriptView';
import { NotesPanel } from './components/NotesPanel';
import { ControlBar } from './components/ControlBar';
import { SettingsModal } from './components/SettingsModal';
import type {
  ConnectionState,
  CopilotPersona,
  ExtractedNote,
  SessionSettings,
  TranscriptMessage,
} from './types/live';
import { PcmRecorder } from './lib/audio/pcm-recorder';
import { PcmPlayer } from './lib/audio/pcm-player';
import {
  ScreenCapture,
  isMobileDevice,
  isScreenShareSupported,
  type CaptureSource,
  type CameraFacingMode,
} from './lib/video/screen-capture';
import { GeminiLiveClient } from './lib/gemini/live-client';

const STORAGE_KEY = 'omnilens_session_settings';

const DEFAULT_SETTINGS: SessionSettings = {
  apiKey: '',
  model: 'gemini-3.1-flash-live-preview',
  persona: 'pair-programmer',
  voice: 'Aoede',
  screenFps: 1,
  customInstructions: '',
  targetLanguageCode: 'es',
  enableGoogleSearch: false, // Default to FALSE to ensure 100% Free Tier compatibility without quota rejection
};

export const App: React.FC = () => {
  // Session Settings
  const [settings, setSettings] = useState<SessionSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        // fallback
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // Audio & Stream state
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [captureSource, setCaptureSource] = useState<CaptureSource>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<CameraFacingMode>(() =>
    isMobileDevice() ? 'environment' : 'user'
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Listen for PWA installation prompt event
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } catch (err) {
      console.error('Failed to trigger install prompt:', err);
    }
  };

  // Analyser nodes for visualizer
  const [userAnalyser, setUserAnalyser] = useState<AnalyserNode | null>(null);
  const [geminiAnalyser, setGeminiAnalyser] = useState<AnalyserNode | null>(null);

  // Transcript & Notes state
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [notes, setNotes] = useState<ExtractedNote[]>([]);
  const [isSearchingGoogle, setIsSearchingGoogle] = useState<boolean>(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>('');

  // Subsystem Refs
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const pcmRecorderRef = useRef<PcmRecorder | null>(null);
  const pcmPlayerRef = useRef<PcmPlayer | null>(null);
  const screenCaptureRef = useRef<ScreenCapture | null>(null);

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (liveClientRef.current) {
      liveClientRef.current.updateSettings(settings);
    }
    if (screenCaptureRef.current) {
      screenCaptureRef.current.setFps(settings.screenFps);
    }
  }, [settings]);

  // Check if API key is set on first load
  useEffect(() => {
    if (!settings.apiKey) {
      setIsSettingsOpen(true);
    }
  }, [settings.apiKey]);

  // Add a new message or update partial
  const addTranscriptMessage = useCallback(
    (
      sender: 'user' | 'gemini' | 'system',
      text: string,
      searchSources?: { title: string; uri: string }[],
      searchQuery?: string
    ) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          !searchSources &&
          sender !== 'system' &&
          last &&
          last.sender === sender &&
          Date.now() - last.timestamp.getTime() < 3500
        ) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: `${last.text} ${text}`.trim(),
          };
          return updated;
        }

        return [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            sender,
            text,
            timestamp: new Date(),
            searchSources,
            searchQuery,
          },
        ];
      });
    },
    []
  );

  // Manual Note actions
  const handleAddNote = useCallback((newNote: Omit<ExtractedNote, 'id' | 'timestamp'>) => {
    setNotes((prev) => [
      ...prev,
      {
        ...newNote,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleToggleCompleteNote = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, completed: !n.completed } : n))
    );
  }, []);

  const handleAddNoteFromMessage = useCallback((msg: TranscriptMessage) => {
    const hasCode = msg.text.includes('```');
    const isAction = /todo|action item|must|should|need to/i.test(msg.text);
    const clean = msg.text.replace(/```[a-zA-Z]*\n?|```/g, '').trim();
    const firstLine = clean.split('\n')[0].slice(0, 45) || (hasCode ? 'Code Snippet' : 'Note');
    handleAddNote({
      title: firstLine,
      content: msg.text,
      type: hasCode ? 'code-snippet' : isAction ? 'action-item' : 'key-insight',
      completed: false,
    });
  }, [handleAddNote]);

  // Initialize Audio Player & Video Screen Capture instances
  useEffect(() => {
    pcmPlayerRef.current = new PcmPlayer();
    setGeminiAnalyser(pcmPlayerRef.current.getAnalyser());

    screenCaptureRef.current = new ScreenCapture(
      (base64Jpeg) => {
        if (liveClientRef.current?.getIsConnected()) {
          liveClientRef.current.sendVideoFrame(base64Jpeg);
        }
      },
      () => {
        setCaptureSource(null);
        setActiveStream(null);
      }
    );

    return () => {
      pcmPlayerRef.current?.destroy();
      screenCaptureRef.current?.stop();
      pcmRecorderRef.current?.stop();
      liveClientRef.current?.disconnect();
    };
  }, []);

  // Initialize or update Gemini Live Client
  const initClient = useCallback(() => {
    if (!settings.apiKey) {
      setErrorMessage('Please provide a Google Gemini API Key in Settings.');
      setIsSettingsOpen(true);
      return null;
    }

    setErrorMessage(undefined);

    const client = new GeminiLiveClient(settings, {
      onConnectionChange: (state, err) => {
        setConnectionState(state);
        if (err) {
          setErrorMessage(err);
        } else if (state === 'connected') {
          setErrorMessage(undefined);
          addTranscriptMessage('system', 'Connected to Gemini Live session. You can speak now!');
        } else if (state === 'disconnected') {
          stopAudioCapture();
          setUserAnalyser(null);
          setIsSearchingGoogle(false);
        }
      },
      onAudioChunk: (base64Pcm) => {
        pcmPlayerRef.current?.playChunk(base64Pcm);
        if (pcmPlayerRef.current) {
          setGeminiAnalyser(pcmPlayerRef.current.getAnalyser());
        }
      },
      onInputTranscription: (text) => {
        addTranscriptMessage('user', text);

        // Heuristic: User speech asking to capture a note or todo
        const lower = text.toLowerCase();
        if (
          lower.includes('take note') ||
          lower.includes('action item') ||
          lower.includes('todo') ||
          lower.includes('remember this') ||
          lower.startsWith('note:')
        ) {
          const cleanTitle = text
            .replace(/^(take a? note(:|that)?|action item:?|todo:?|remember this(:|that)?|note:?)\s*/i, '')
            .slice(0, 50)
            .trim();

          if (cleanTitle) {
            handleAddNote({
              title: cleanTitle,
              content: text,
              type: 'action-item',
              completed: false,
            });
          }
        }
      },
      onOutputTranscription: (text) => {
        addTranscriptMessage('gemini', text);

        // Heuristic: Check if Gemini recommended an action item or code snippet
        const lower = text.toLowerCase();
        if (lower.includes('action item:') || lower.includes('todo:') || text.includes('```')) {
          const hasCode = text.includes('```');
          const cleanTitle = text
            .replace(/```[a-zA-Z]*\n?|```/g, '')
            .split('\n')[0]
            .replace(/^(action item:?|todo:?)\s*/i, '')
            .slice(0, 45)
            .trim();

          handleAddNote({
            title: cleanTitle || (hasCode ? 'Code Snippet' : 'Action Item'),
            content: text,
            type: hasCode ? 'code-snippet' : 'action-item',
            completed: false,
          });
        }
      },
      onInterrupted: () => {
        pcmPlayerRef.current?.interrupt();
      },
      onTurnComplete: () => {
        // Turn completed
      },
      onSearchStatus: (status, data) => {
        if (status === 'searching') {
          setIsSearchingGoogle(true);
          setCurrentSearchQuery(data?.query || '');
        } else if (status === 'grounded') {
          setIsSearchingGoogle(false);
          if (data?.query) {
            addTranscriptMessage(
              'system',
              `🔍 Grounded with Google Search (Gemini 3.1 Flash Lite): "${data.query}"`,
              data.sources,
              data.query
            );
          }
        } else if (status === 'error') {
          setIsSearchingGoogle(false);
        }
      },
    });

    liveClientRef.current = client;
    return client;
  }, [settings, addTranscriptMessage, handleAddNote]);

  // Start microphone capture
  const startAudioCapture = async () => {
    try {
      if (pcmRecorderRef.current) {
        pcmRecorderRef.current.stop();
      }

      await pcmPlayerRef.current?.resume();

      const recorder = new PcmRecorder((base64Pcm) => {
        if (!isMicMuted && liveClientRef.current?.getIsConnected()) {
          liveClientRef.current.sendAudioChunk(base64Pcm);
        }
      });

      await recorder.start();
      pcmRecorderRef.current = recorder;
      setUserAnalyser(recorder.getAnalyser());
      setIsMicMuted(false);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMessage('Microphone access was denied or unavailable.');
    }
  };

  const stopAudioCapture = () => {
    if (pcmRecorderRef.current) {
      pcmRecorderRef.current.stop();
      pcmRecorderRef.current = null;
    }
    setUserAnalyser(null);
  };

  // Connect / Disconnect toggle
  const handleToggleConnect = async () => {
    if (connectionState === 'connected' || connectionState === 'connecting') {
      liveClientRef.current?.disconnect();
      stopAudioCapture();
      screenCaptureRef.current?.stop();
      setCaptureSource(null);
      setActiveStream(null);
    } else {
      const client = initClient();
      if (!client) return;

      client.connect();
      await startAudioCapture();
    }
  };

  // Mic Mute Toggle
  const handleToggleMic = () => {
    setIsMicMuted((prev) => !prev);
  };

  // Speaker Mute Toggle
  const handleToggleSpeaker = () => {
    const next = !isSpeakerMuted;
    setIsSpeakerMuted(next);
    pcmPlayerRef.current?.setMuted(next);
  };

  // Screen Share Toggle with Mobile Detection & Graceful Fallback
  const handleToggleScreen = async () => {
    if (captureSource === 'screen') {
      screenCaptureRef.current?.stop();
      setCaptureSource(null);
      setActiveStream(null);
    } else {
      if (!isScreenShareSupported()) {
        setErrorMessage(
          'Mobile browsers (iOS Safari / Android Chrome) do not permit OS screen capture. Switched to Rear Camera so you can point at monitors, slides, or documents.'
        );
        handleToggleCamera('environment');
        return;
      }
      try {
        const stream = await screenCaptureRef.current?.startScreen(settings.screenFps);
        if (stream) {
          setActiveStream(stream);
          setCaptureSource('screen');
        }
      } catch (err: unknown) {
        console.error('Failed to start screen share:', err);
        const errorObj = err as { message?: string };
        setErrorMessage(errorObj?.message || 'Failed to start screen share.');
      }
    }
  };

  // Camera Toggle with Facing Direction
  const handleToggleCamera = async (facing?: CameraFacingMode) => {
    if (captureSource === 'camera' && !facing) {
      screenCaptureRef.current?.stop();
      setCaptureSource(null);
      setActiveStream(null);
    } else {
      try {
        const targetFacing = facing || cameraFacingMode;
        const stream = await screenCaptureRef.current?.startCamera(settings.screenFps, targetFacing);
        if (stream) {
          setActiveStream(stream);
          setCaptureSource('camera');
          setCameraFacingMode(targetFacing);
        }
      } catch (err: unknown) {
        console.error('Failed to start camera:', err);
        const errorObj = err as { message?: string };
        setErrorMessage(errorObj?.message || 'Failed to start camera feed.');
      }
    }
  };

  // Camera Flip Handler
  const handleFlipCamera = async () => {
    if (captureSource !== 'camera') return;
    try {
      const result = await screenCaptureRef.current?.flipCamera(settings.screenFps);
      if (result) {
        setActiveStream(result.stream);
        setCameraFacingMode(result.facingMode);
      }
    } catch (err: unknown) {
      console.error('Failed to flip camera:', err);
      const errorObj = err as { message?: string };
      setErrorMessage(errorObj?.message || 'Failed to flip camera.');
    }
  };

  // Persona switch handler
  const handleSelectPersona = (persona: CopilotPersona) => {
    setSettings((prev) => ({ ...prev, persona }));
  };

  // Quick 1-click fix when Free Tier hits quota due to Google Search Grounding
  const handleDisableSearchGrounding = useCallback(() => {
    setSettings((prev) => ({ ...prev, enableGoogleSearch: false }));
    setErrorMessage(undefined);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-gray-100 selection:bg-purple-600 selection:text-white pb-24">
      {/* Top Header */}
      <Header
        connectionState={connectionState}
        errorMessage={errorMessage}
        currentModel={settings.model}
        currentPersona={settings.persona}
        enableGoogleSearch={settings.enableGoogleSearch}
        isSearchingGoogle={isSearchingGoogle}
        searchQuery={currentSearchQuery}
        canInstallPwa={!!installPrompt}
        onInstallPwa={handleInstallPwa}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectPersona={handleSelectPersona}
        onDisableSearchGrounding={handleDisableSearchGrounding}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-4">
        {/* Audio Visualizer Bar */}
        <Visualizer
          userAnalyser={userAnalyser}
          geminiAnalyser={geminiAnalyser}
          isConnected={connectionState === 'connected'}
          isMicMuted={isMicMuted}
        />

        {/* Dynamic Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left Column: Screen / Camera Live Vision Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <ScreenPreview
              stream={activeStream}
              captureSource={captureSource}
              fps={settings.screenFps}
              facingMode={cameraFacingMode}
              onStartScreen={handleToggleScreen}
              onStartCamera={handleToggleCamera}
              onFlipCamera={handleFlipCamera}
              onStopCapture={() => {
                screenCaptureRef.current?.stop();
                setCaptureSource(null);
                setActiveStream(null);
              }}
            />

            {/* Quick Tips Card */}
            <div className="bg-gray-950/60 rounded-2xl border border-gray-800/80 p-4 text-xs space-y-2">
              <h4 className="font-semibold text-gray-300 flex items-center gap-1.5">
                <span className="text-purple-400">💡</span>
                Multimodal Copilot Tips:
              </h4>
              <ul className="text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed text-[11px]">
                <li>
                  Click <strong className="text-purple-300">Connect Live</strong> and talk to Gemini naturally with your microphone.
                </li>
                <li>
                  Say <em className="text-gray-300">"Take a note: optimize database query"</em> to auto-save to Action Items.
                </li>
                <li>
                  Click <strong className="text-amber-300">Extract</strong> in the Notes tab to automatically parse the transcript for tasks.
                </li>
                <li>
                  Use the <strong className="text-purple-300">FPS slider</strong> in Settings to balance visual smoothness vs token consumption.
                </li>
              </ul>
            </div>
          </div>

          {/* Middle Column: Live Transcripts (4 cols) */}
          <div className="lg:col-span-4 h-[560px] lg:h-auto">
            <TranscriptView
              messages={messages}
              onSendMessage={(text) => {
                liveClientRef.current?.sendText(text);
                addTranscriptMessage('user', text);
              }}
              onClearTranscript={() => setMessages([])}
              onAddNoteFromMessage={handleAddNoteFromMessage}
              isConnected={connectionState === 'connected'}
            />
          </div>

          {/* Right Column: Action Items & Notes (3 cols) */}
          <div className="lg:col-span-3 h-[560px] lg:h-auto">
            <NotesPanel
              notes={notes}
              messages={messages}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onToggleCompleteNote={handleToggleCompleteNote}
            />
          </div>
        </div>
      </main>

      {/* Floating Control Bar */}
      <ControlBar
        connectionState={connectionState}
        isMicMuted={isMicMuted}
        isSpeakerMuted={isSpeakerMuted}
        captureSource={captureSource}
        facingMode={cameraFacingMode}
        onToggleConnect={handleToggleConnect}
        onToggleMic={handleToggleMic}
        onToggleSpeaker={handleToggleSpeaker}
        onToggleScreen={handleToggleScreen}
        onToggleCamera={handleToggleCamera}
        onFlipCamera={handleFlipCamera}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(newSettings) => setSettings(newSettings)}
      />
    </div>
  );
};

export default App;
