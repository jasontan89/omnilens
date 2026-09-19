import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, Sparkles, Send, Copy, Check, Trash2 } from 'lucide-react';
import type { TranscriptMessage } from '../types/live';

interface TranscriptViewProps {
  messages: TranscriptMessage[];
  onSendMessage: (text: string) => void;
  onClearTranscript: () => void;
  isConnected: boolean;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  messages,
  onSendMessage,
  onClearTranscript,
  isConnected,
}) => {
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom as messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleCopyTranscript = () => {
    const text = messages
      .map((m) => `[${m.sender.toUpperCase()} - ${m.timestamp.toLocaleTimeString()}]: ${m.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950/80 rounded-2xl border border-gray-800 overflow-hidden shadow-xl backdrop-blur-md">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-gray-800/80 flex items-center justify-between bg-gray-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
            Live Dialogue & Transcript
          </h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
            {messages.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleCopyTranscript}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                title="Copy entire transcript"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onClearTranscript}
                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-gray-800 transition-colors"
                title="Clear transcript"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mb-3 text-gray-600">
              <Bot className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-gray-400 mb-1">
              Start speaking or sharing your screen
            </p>
            <p className="text-[11px] text-gray-500 max-w-xs">
              Live speech will be transcribed here in real time as you converse with Gemini.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.sender === 'gemini'
                    ? 'bg-gradient-to-tr from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600/90 text-white rounded-tr-none'
                    : 'bg-gray-900/90 text-gray-200 border border-gray-800 rounded-tl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-70">
                  <span className="font-semibold">
                    {msg.sender === 'user' ? 'You' : 'Gemini'}
                  </span>
                  <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <div className="whitespace-pre-wrap select-text font-sans">
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Optional Text input bar */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t border-gray-800/80 bg-gray-900/40 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isConnected
              ? 'Type a message or question (or speak freely)...'
              : 'Connect to send messages...'
          }
          disabled={!isConnected}
          className="flex-1 bg-gray-950/80 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !isConnected}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition-colors"
          title="Send text message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
