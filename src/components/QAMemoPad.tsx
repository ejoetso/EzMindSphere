/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  MessageSquare, Plus, Pin, CheckCircle2, Heart, Trash2, Send, 
  Sparkles, Filter, Search, Image, Download, Share2, CornerDownRight, 
  HelpCircle, Lightbulb, MessageCircle, AlertTriangle, Trophy
} from 'lucide-react';
import { QAMemo, User, MindMapNode } from '../types.js';

interface QAMemoPadProps {
  sessionId: string;
  currentUser: User;
  memos: QAMemo[];
  onAddMemo: (memo: { question: string; category: QAMemo['category']; color: string }) => void;
  onUpdateMemo: (memoId: string, updates: Partial<QAMemo>) => void;
  onVoteMemo: (memoId: string) => void;
  onDeleteMemo: (memoId: string) => void;
  onConvertToNode: (memo: QAMemo) => void;
}

const MEMO_COLORS = [
  { name: 'Sticky Yellow', value: '#fef08a', text: 'text-amber-950', border: 'border-yellow-300' },
  { name: 'Mint Emerald', value: '#a7f3d0', text: 'text-emerald-950', border: 'border-emerald-300' },
  { name: 'Sky Blue', value: '#bae6fd', text: 'text-sky-950', border: 'border-sky-300' },
  { name: 'Soft Pink', value: '#fbcfe8', text: 'text-pink-950', border: 'border-pink-300' },
  { name: 'Lavender Violet', value: '#ddd6fe', text: 'text-purple-950', border: 'border-purple-300' },
  { name: 'Obsidian Dark', value: '#1e293b', text: 'text-slate-100', border: 'border-slate-700' },
];

export const QAMemoPad: React.FC<QAMemoPadProps> = ({
  sessionId,
  currentUser,
  memos,
  onAddMemo,
  onUpdateMemo,
  onVoteMemo,
  onDeleteMemo,
  onConvertToNode,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState<QAMemo['category']>('Question');
  const [selectedColor, setSelectedColor] = useState('#fef08a');

  // Filter & Search
  const [activeFilter, setActiveFilter] = useState<'all' | 'unanswered' | 'pinned' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Answering Memo state
  const [answeringMemoId, setAnsweringMemoId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  const handleCreateMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    onAddMemo({
      question: newQuestion.trim(),
      category: newCategory,
      color: selectedColor,
    });

    setNewQuestion('');
    setShowAddForm(false);
  };

  const handleSaveAnswer = (memoId: string) => {
    if (!answerText.trim()) return;
    onUpdateMemo(memoId, {
      answer: answerText.trim(),
      answeredBy: currentUser.name,
      isAnswered: true,
    });
    setAnsweringMemoId(null);
    setAnswerText('');
  };

  // Filtered Memos List
  const filteredMemos = memos
    .filter((m) => {
      if (activeFilter === 'unanswered') return !m.isAnswered;
      if (activeFilter === 'pinned') return m.isPinned;
      if (activeFilter === 'my') return m.authorId === currentUser.id;
      return true;
    })
    .filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.question.toLowerCase().includes(q) ||
        m.authorName.toLowerCase().includes(q) ||
        (m.answer && m.answer.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.votes?.length || 0) - (a.votes?.length || 0);
    });

  // Export Memo Pad Image
  const handleDownloadMemoPadImage = () => {
    const element = document.getElementById('qa-memo-board-container');
    if (!element) return;

    const canvas = document.createElement('canvas');
    const width = 800;
    const height = Math.max(600, filteredMemos.length * 160 + 200);
    canvas.width = width * 2;
    canvas.height = height * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);

    // Fill background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Live Q&A Memo Pad Board', 30, 45);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Session: ${sessionId} • Total Memos: ${memos.length}`, 30, 68);

    // Draw Memos
    let currentY = 100;
    filteredMemos.forEach((memo, idx) => {
      ctx.save();
      ctx.fillStyle = memo.color || '#fef08a';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 8;
      ctx.fillRect(30, currentY, width - 60, 130);

      // Text inside memo
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${memo.authorName} (${memo.category || 'Question'})`, 45, currentY + 25);

      ctx.font = '13px sans-serif';
      const truncatedQ = memo.question.length > 80 ? memo.question.substring(0, 80) + '...' : memo.question;
      ctx.fillText(truncatedQ, 45, currentY + 50);

      if (memo.answer) {
        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'italic 12px sans-serif';
        ctx.fillText(`Answer by ${memo.answeredBy}: ${memo.answer}`, 45, currentY + 80);
      }

      ctx.restore();
      currentY += 150;
    });

    const link = document.createElement('a');
    link.download = `Q_and_A_Memo_Pad_${sessionId}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Header bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-slate-100 flex items-center gap-2">
              Live Q&A Memo Pad
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                {memos.length} Memos
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Post sticky questions & ideas for real-time class Q&A</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMemoPadImage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
            title="Download Q&A Memo Pad Image"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Export Image</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Post Sticky Memo</span>
          </button>
        </div>
      </div>

      {/* Post Sticky Memo Collapsible Form */}
      {showAddForm && (
        <form onSubmit={handleCreateMemo} className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Your Question or Sticky Note
            </label>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Type a question, misconception, or idea for the live board..."
              rows={2}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-amber-500 transition-colors resize-none"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">Tag:</span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 text-slate-200 rounded-lg focus:outline-none"
              >
                <option value="Question">❓ Question</option>
                <option value="Idea">💡 Idea</option>
                <option value="Clarification">🔍 Clarification</option>
                <option value="Feedback">💬 Feedback</option>
                <option value="Challenge">🏆 Challenge</option>
              </select>
            </div>

            {/* Sticky Color picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono">Color:</span>
              <div className="flex items-center gap-1">
                {MEMO_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`w-5 h-5 rounded-full border transition-all ${
                      selectedColor === c.value ? 'scale-125 ring-2 ring-amber-400 border-white' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newQuestion.trim()}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition-all"
              >
                Post Note
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filters & Search Toolbar */}
      <div className="p-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              activeFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('unanswered')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              activeFilter === 'unanswered' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Unanswered
          </button>
          <button
            onClick={() => setActiveFilter('pinned')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              activeFilter === 'pinned' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pinned 📌
          </button>
          <button
            onClick={() => setActiveFilter('my')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
              activeFilter === 'my' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            My Memos
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search questions or answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Sticky Memos Grid Container */}
      <div id="qa-memo-board-container" className="flex-1 p-4 overflow-y-auto space-y-3">
        {filteredMemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-600" />
            <p className="text-xs">No Q&A sticky memos found.</p>
            <p className="text-[11px] text-slate-600">Click "Post Sticky Memo" to ask a question or drop an idea!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMemos.map((memo, idx) => {
              const memoKey = memo.id || `memo_fallback_${idx}_${memo.question.substring(0, 10)}`;
              const isDarkMemo = memo.color === '#1e293b';
              const hasVoted = memo.votes?.includes(currentUser.id);

              return (
                <div
                  key={memoKey}
                  style={{ backgroundColor: memo.color || '#fef08a' }}
                  className={`p-3.5 rounded-2xl shadow-lg border transition-all hover:scale-[1.01] relative flex flex-col justify-between ${
                    isDarkMemo ? 'text-slate-100 border-slate-700' : 'text-slate-900 border-black/10'
                  }`}
                >
                  {/* Top Bar: Author, Tag, Pin */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold truncate">{memo.authorName}</span>
                        {memo.authorRole === 'educator' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-600 text-white font-mono uppercase">
                            Educator
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/10 text-slate-800 dark:text-slate-200 font-mono">
                          {memo.category || 'Question'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {memo.isPinned && (
                          <span className="text-amber-600 dark:text-amber-400" title="Pinned Note">
                            <Pin className="w-3.5 h-3.5 fill-current" />
                          </span>
                        )}
                        {memo.isAnswered && (
                          <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 text-[10px] font-bold" title="Answered">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Content */}
                    <p className="text-xs font-medium leading-relaxed mb-3 whitespace-pre-wrap">
                      {memo.question}
                    </p>

                    {/* Answer Section if present */}
                    {memo.answer && (
                      <div className="mt-2 p-2.5 rounded-xl bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/10 text-xs">
                        <div className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide opacity-80 mb-1">
                          <CornerDownRight className="w-3 h-3" />
                          Answered by {memo.answeredBy || 'Educator'}:
                        </div>
                        <p className="text-xs font-normal leading-relaxed">{memo.answer}</p>
                      </div>
                    )}
                  </div>

                  {/* Answering Inline Box for Educator */}
                  {answeringMemoId === memo.id && (
                    <div className="mt-2 space-y-2 pt-2 border-t border-black/10">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Write educator explanation or answer..."
                        rows={2}
                        className="w-full p-2 text-xs bg-white/80 dark:bg-slate-900/80 border border-black/20 rounded-lg focus:outline-none"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setAnsweringMemoId(null)}
                          className="px-2 py-1 text-[10px] opacity-70 hover:opacity-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveAnswer(memo.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold"
                        >
                          Submit Answer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between gap-1 text-[11px]">
                    {/* Upvote Button */}
                    <button
                      onClick={() => onVoteMemo(memo.id)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all ${
                        hasVoted
                          ? 'bg-rose-500 text-white border-rose-600 font-bold'
                          : 'bg-black/5 hover:bg-black/10 border-black/10'
                      }`}
                      title="Upvote Memo"
                    >
                      <Heart className={`w-3 h-3 ${hasVoted ? 'fill-current' : ''}`} />
                      <span>{memo.votes?.length || 0}</span>
                    </button>

                    {/* Quick convert to MindMap node */}
                    <button
                      onClick={() => onConvertToNode && onConvertToNode(memo)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/5 hover:bg-black/15 border border-black/10 font-medium transition-all"
                      title="Insert this Q&A Memo as a Node onto Mind Map Board"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>To Map</span>
                    </button>

                    {/* Educator & Author Controls */}
                    {(currentUser.role === 'educator' || memo.authorId === currentUser.id) && (
                      <div className="flex items-center gap-1">
                        {currentUser.role === 'educator' && (
                          <>
                            <button
                              onClick={() => {
                                if (answeringMemoId === memo.id) {
                                  setAnsweringMemoId(null);
                                } else {
                                  setAnsweringMemoId(memo.id);
                                  setAnswerText(memo.answer || '');
                                }
                              }}
                              className="p-1 rounded hover:bg-black/10 opacity-70 hover:opacity-100"
                              title="Answer Question"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onUpdateMemo(memo.id, { isPinned: !memo.isPinned })}
                              className={`p-1 rounded hover:bg-black/10 ${memo.isPinned ? 'text-amber-600 font-bold' : 'opacity-70'}`}
                              title={memo.isPinned ? 'Unpin' : 'Pin Memo'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => onDeleteMemo(memo.id)}
                          className="p-1 rounded hover:bg-rose-500 hover:text-white opacity-70 hover:opacity-100 transition-colors"
                          title="Delete Memo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
