import React, { useState } from 'react';
import {
  BookmarkCheck,
  CheckCircle2,
  Circle,
  Code2,
  Download,
  Lightbulb,
  Plus,
  Trash2,
  Zap,
  Sparkles,
} from 'lucide-react';
import type { ExtractedNote, TranscriptMessage } from '../types/live';

interface NotesPanelProps {
  notes: ExtractedNote[];
  messages: TranscriptMessage[];
  onAddNote: (note: Omit<ExtractedNote, 'id' | 'timestamp'>) => void;
  onDeleteNote: (id: string) => void;
  onToggleCompleteNote?: (id: string) => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  messages,
  onAddNote,
  onDeleteNote,
  onToggleCompleteNote,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<ExtractedNote['type']>('action-item');
  const [isAdding, setIsAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'action-item' | 'key-insight' | 'code-snippet' | 'completed'>('all');
  const [extractStatus, setExtractStatus] = useState<string | null>(null);

  const filteredNotes = notes.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'completed') return n.completed === true;
    return n.type === activeFilter;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddNote({
      title: newTitle.trim(),
      content: newContent.trim(),
      type: newType,
      completed: false,
    });

    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
  };

  // Smart Auto-Extractor: parses dialogue history for tasks and insights
  const handleAutoExtract = () => {
    if (messages.length === 0) {
      setExtractStatus('No conversation yet to extract notes from.');
      setTimeout(() => setExtractStatus(null), 3000);
      return;
    }

    let count = 0;
    const existingTitles = new Set(notes.map((n) => n.title.toLowerCase().trim()));

    messages.forEach((msg) => {
      const text = msg.text;

      // Extract code snippets
      const codeMatches = text.match(/```(?:[a-zA-Z]*)\n([\s\S]*?)```/g);
      if (codeMatches) {
        codeMatches.forEach((chunk) => {
          const cleanCode = chunk.replace(/```[a-zA-Z]*\n?|```/g, '').trim();
          const firstLine = cleanCode.split('\n')[0].slice(0, 45) || 'Code Snippet';
          if (!existingTitles.has(firstLine.toLowerCase())) {
            existingTitles.add(firstLine.toLowerCase());
            onAddNote({
              title: firstLine,
              content: cleanCode,
              type: 'code-snippet',
              completed: false,
            });
            count++;
          }
        });
      }

      // Sentence-level task extraction
      const sentences = text.split(/(?<=[.!?\n])\s+/);
      sentences.forEach((rawSentence) => {
        const s = rawSentence.trim();
        if (s.length < 10) return;

        const lower = s.toLowerCase();
        const isAction =
          lower.includes('todo') ||
          lower.includes('action item') ||
          lower.startsWith('- [ ]') ||
          lower.includes('need to ') ||
          lower.includes('we should ') ||
          lower.includes('make sure to ') ||
          lower.includes('remember to ') ||
          lower.includes('don\'t forget to ') ||
          lower.includes('please fix ') ||
          lower.includes('implement ');

        const isInsight =
          lower.includes('note that ') ||
          lower.includes('key takeaway') ||
          lower.includes('important:') ||
          lower.includes('pro tip') ||
          lower.includes('crucial:') ||
          lower.includes('best practice');

        if (isAction || isInsight) {
          const title = s.replace(/^(action item:?|todo:?|- \[[ x]\]|important:?|note that)\s*/i, '').slice(0, 55).trim();
          if (title && !existingTitles.has(title.toLowerCase())) {
            existingTitles.add(title.toLowerCase());
            onAddNote({
              title,
              content: s,
              type: isAction ? 'action-item' : 'key-insight',
              completed: false,
            });
            count++;
          }
        }
      });
    });

    if (count > 0) {
      setExtractStatus(`Extracted ${count} new action item${count > 1 ? 's' : ''}!`);
    } else {
      setExtractStatus('No new actionable items detected in recent messages.');
    }

    setTimeout(() => setExtractStatus(null), 3500);
  };

  const handleExportMarkdown = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let md = `# OmniLens Copilot Session Notes\nDate: ${new Date().toLocaleString()}\n\n`;

    md += `## 📋 Action Items & Insights\n\n`;
    if (notes.length === 0) {
      md += `*No notes recorded for this session.*\n\n`;
    } else {
      notes.forEach((n) => {
        const icon = n.completed ? '[x]' : n.type === 'action-item' ? '[ ]' : n.type === 'key-insight' ? '💡' : '💻';
        md += `### ${icon} ${n.title}\n`;
        if (n.content) md += `${n.content}\n\n`;
      });
    }

    md += `## 💬 Full Transcript\n\n`;
    if (messages.length === 0) {
      md += `*No messages recorded.*\n\n`;
    } else {
      messages.forEach((m) => {
        md += `**[${m.sender.toUpperCase()} - ${m.timestamp.toLocaleTimeString()}]:** ${m.text}\n\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnilens-session-${timestamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950/80 rounded-2xl border border-gray-800 overflow-hidden shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/80 flex items-center justify-between bg-gray-900/50">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
            Action Items & Notes
          </h2>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
            {notes.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAutoExtract}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
            title="Auto-extract action items and key insights from transcript"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Extract</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
            title="Add note manually"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>Add</span>
          </button>
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 transition-colors"
            title="Export session to Markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Auto-Extract Feedback Notification */}
      {extractStatus && (
        <div className="px-3 py-1.5 bg-amber-950/40 border-b border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{extractStatus}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800/60 bg-gray-950 text-[11px] overflow-x-auto">
        {(['all', 'action-item', 'key-insight', 'code-snippet', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-2.5 py-1 rounded-md capitalize whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? 'bg-gray-800 text-purple-300 font-medium'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {filter.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Add Note Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="p-3 border-b border-gray-800 bg-gray-900/60 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Note or task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
              autoFocus
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as ExtractedNote['type'])}
              className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none"
            >
              <option value="action-item">Action Item</option>
              <option value="key-insight">Key Insight</option>
              <option value="code-snippet">Code Snippet</option>
            </select>
          </div>
          <textarea
            placeholder="Details or code snippet (optional)..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* Note List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <BookmarkCheck className="w-8 h-8 mb-2 text-gray-600" />
            <p className="text-xs text-gray-400">No notes in this view</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Click <strong className="text-amber-300">Extract</strong> above or tell Gemini: "Action item: review the database schema"
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`p-3 rounded-xl border transition-all group ${
                note.completed
                  ? 'bg-gray-950/40 border-gray-900 opacity-60'
                  : 'bg-gray-900/60 border-gray-800/80 hover:border-gray-700/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Completion toggle button */}
                  {onToggleCompleteNote && (
                    <button
                      type="button"
                      onClick={() => onToggleCompleteNote(note.id)}
                      className="text-gray-500 hover:text-emerald-400 transition-colors shrink-0"
                      title={note.completed ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {note.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {!onToggleCompleteNote && note.type === 'action-item' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  {note.type === 'key-insight' && (
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  {note.type === 'code-snippet' && (
                    <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}

                  <h4
                    className={`text-xs font-semibold truncate ${
                      note.completed ? 'line-through text-gray-500' : 'text-gray-200'
                    }`}
                  >
                    {note.title}
                  </h4>
                </div>

                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition-opacity shrink-0"
                  title="Delete note"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {note.content && (
                <div
                  className={`text-xs text-gray-400 mt-1.5 leading-relaxed ${
                    note.type === 'code-snippet'
                      ? 'p-2 rounded bg-black/50 font-mono text-[11px] text-indigo-200 overflow-x-auto whitespace-pre'
                      : ''
                  }`}
                >
                  {note.content}
                </div>
              )}
              <div className="mt-2 text-[10px] text-gray-600 flex items-center justify-between">
                <span>{note.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {note.completed && <span className="text-emerald-500 font-mono text-[9px]">DONE</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
