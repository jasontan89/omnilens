import type { GeminiVoice } from '../../types/live';

export interface VoiceProfile {
  id: GeminiVoice;
  name: string;
  gender: 'female' | 'male';
  desc: string;
  previewSampleText: string;
  pitch: number;
  rate: number;
  harmonicFreq: number;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    desc: 'Warm, articulate, and conversational',
    previewSampleText: "Hello! I am Aoede. I'm warm, articulate, and ready to assist your workflow.",
    pitch: 1.15,
    rate: 1.0,
    harmonicFreq: 440,
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    desc: 'Calm, soothing, and balanced',
    previewSampleText: 'Hello. I am Kore. I have a gentle, soothing, and balanced tone.',
    pitch: 0.95,
    rate: 0.92,
    harmonicFreq: 392,
  },
  {
    id: 'Leda',
    name: 'Leda',
    gender: 'female',
    desc: 'Youthful, bright, and vibrant',
    previewSampleText: 'Hi there! I am Leda. Youthful, energetic, and excited to collaborate with you!',
    pitch: 1.25,
    rate: 1.05,
    harmonicFreq: 523,
  },
  {
    id: 'Callirrhoe',
    name: 'Callirrhoe',
    gender: 'female',
    desc: 'Easy-going, relaxed, and friendly',
    previewSampleText: 'Hey! I am Callirrhoe. Easy-going, relaxed, and ready when you are.',
    pitch: 1.05,
    rate: 0.98,
    harmonicFreq: 415,
  },
  {
    id: 'Autonoe',
    name: 'Autonoe',
    gender: 'female',
    desc: 'Crisp, expressive, and lively',
    previewSampleText: 'Hello! I am Autonoe. Crisp, expressive, and highly observant.',
    pitch: 1.18,
    rate: 1.02,
    harmonicFreq: 466,
  },
  {
    id: 'Despina',
    name: 'Despina',
    gender: 'female',
    desc: 'Smooth, polished, and executive',
    previewSampleText: 'Greetings. I am Despina. Polished, articulate, and analytical.',
    pitch: 1.08,
    rate: 0.96,
    harmonicFreq: 370,
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    desc: 'Energetic, witty, and upbeat',
    previewSampleText: 'Hey! I am Puck. Energetic, witty, and ready to dive into your code!',
    pitch: 1.02,
    rate: 1.08,
    harmonicFreq: 330,
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    desc: 'Deep, calm, and authoritative',
    previewSampleText: 'Greetings. I am Charon. Calm, deep, and focused on strategic decisions.',
    pitch: 0.82,
    rate: 0.92,
    harmonicFreq: 220,
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    desc: 'Direct, focused, and crisp',
    previewSampleText: 'Hello. I am Fenrir. Direct, focused, and concise in problem-solving.',
    pitch: 0.88,
    rate: 1.04,
    harmonicFreq: 261,
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'male',
    desc: 'Bright, cheerful, and pleasant',
    previewSampleText: 'Hi! I am Zephyr. Bright, friendly, and always ready to help.',
    pitch: 1.1,
    rate: 1.02,
    harmonicFreq: 349,
  },
];

let activeAudioContext: AudioContext | null = null;

export function stopVoicePreview(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (activeAudioContext) {
    try {
      activeAudioContext.close();
    } catch {
      // ignore
    }
    activeAudioContext = null;
  }
}

export async function playVoicePreview(
  voiceId: GeminiVoice,
  onEnd?: () => void
): Promise<void> {
  stopVoicePreview();

  const profile = VOICE_PROFILES.find((v) => v.id === voiceId) || VOICE_PROFILES[0];

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(profile.previewSampleText);
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const preferred = voices.find((v) => {
        const name = v.name.toLowerCase();
        if (profile.gender === 'female') {
          return (
            name.includes('female') ||
            name.includes('samantha') ||
            name.includes('victoria') ||
            name.includes('zira') ||
            name.includes('karen') ||
            name.includes('natural')
          );
        } else {
          return (
            name.includes('male') ||
            name.includes('david') ||
            name.includes('alex') ||
            name.includes('george') ||
            name.includes('mark')
          );
        }
      });
      if (preferred) {
        utterance.voice = preferred;
      }
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      playFallbackTone(profile.harmonicFreq, onEnd);
    };

    window.speechSynthesis.speak(utterance);
  } else {
    playFallbackTone(profile.harmonicFreq, onEnd);
  }
}

function playFallbackTone(freq: number, onEnd?: () => void): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    activeAudioContext = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.65);

    setTimeout(() => {
      if (onEnd) onEnd();
    }, 650);
  } catch {
    if (onEnd) onEnd();
  }
}
