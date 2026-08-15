/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, Lock, Unlock, Layers, Box, Users, Settings, Plus, Send, 
  MessageCircle, Copy, Check, Sparkles, BookOpen, FileText, ArrowLeft, 
  Trash2, ShieldAlert, CheckCircle, XCircle, Heart, Star, LayoutGrid,
  Edit3, StickyNote, PanelLeft, PanelRight, Maximize2, Minimize2, X, QrCode,
  UserCheck, UserX, Filter
} from 'lucide-react';
import { Session, MindMapNode, MindMapEdge, SessionParticipant, Comment, User, QAMemo, MindMapActivity } from '../types.js';
import { InteractiveCanvas2D } from './InteractiveCanvas2D.js';
import { InteractiveCanvas3D } from './InteractiveCanvas3D.js';
import { QAMemoPad } from './QAMemoPad.js';
import { MindMapQRModal } from './MindMapQRModal.js';
import { QRScannerModal } from './QRScannerModal.js';

interface SessionRoomProps {
  session: Session;
  currentUser: User;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  memos?: QAMemo[];
  activities?: MindMapActivity[];
  activeActivityId?: string | null;
  participants: SessionParticipant[];
  connected: boolean;
  spotlightNodeId: string | null;
  sendCursorMove: (x: number, y: number) => void;
  createNode: (title: string, parentId: string | null, details?: any) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  dragNode: (nodeId: string, x: number, y: number) => void;
  deleteNode: (nodeId: string) => void;
  createEdge: (sourceId: string, targetId: string) => void;
  deleteEdge?: (edgeId: string) => void;
  addComment: (nodeId: string, text: string, author: User) => void;
  addReaction: (nodeId: string, userId: string, emoji: string) => void;
  addVote: (nodeId: string, userId: string) => void;
  addMemo?: (memo: { question: string; category?: QAMemo['category']; color?: string }) => void;
  updateMemo?: (memoId: string, updates: Partial<QAMemo>) => void;
  voteMemo?: (memoId: string) => void;
  deleteMemo?: (memoId: string) => void;
  createActivity?: (title: string, template?: MindMapActivity['template'], description?: string, category?: string) => void;
  selectActivity?: (activityId: string) => void;
  updateActivity?: (activityId: string, updates: Partial<MindMapActivity>) => void;
  deleteActivity?: (activityId: string) => void;
  toggleLock: (isLocked: boolean) => void;
  changeLayout: (layout: 'radial' | 'force' | 'tree' | 'timeline') => void;
  changeMode: (mode: 'brainstorm' | 'moderated' | 'voting') => void;
  spotlightNode: (nodeId: string | null) => void;
  approveNode: (nodeId: string) => void;
  rejectNode: (nodeId: string) => void;
  syncMapState: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
  onLeaveSession: () => void;
  onNavigateToSummary: (summary: string, quiz: any[]) => void;
}

export const SessionRoom: React.FC<SessionRoomProps> = ({
  session,
  currentUser,
  nodes,
  edges,
  memos = [],
  activities = [],
  activeActivityId = null,
  participants,
  connected,
  spotlightNodeId,
  sendCursorMove,
  createNode,
  updateNode,
  dragNode,
  deleteNode,
  createEdge,
  deleteEdge,
  addComment,
  addReaction,
  addVote,
  addMemo,
  updateMemo,
  voteMemo,
  deleteMemo,
  createActivity,
  selectActivity,
  updateActivity,
  deleteActivity,
  toggleLock,
  changeLayout,
  changeMode,
  spotlightNode,
  approveNode,
  rejectNode,
  syncMapState,
  onLeaveSession,
  onNavigateToSummary,
}) => {
  // Navigation active viewing modes
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'qa'>('2d');
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // MindMap Activity Management State & Filter
  const allActivities = activities.length > 0 ? activities : (session.activities || []);
  const currentActivityId = activeActivityId || session.activeActivityId || allActivities[0]?.id;
  const currentActivity = allActivities.find(a => a.id === currentActivityId) || allActivities[0];

  const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityTemplate, setNewActivityTemplate] = useState<MindMapActivity['template']>('blank');
  const [newActivityDesc, setNewActivityDesc] = useState('');

  // Scoped nodes & edges for current activity
  const filteredActivityNodes = React.useMemo(() => {
    if (!currentActivityId) return nodes;
    return nodes.filter(n => n.activityId === currentActivityId || (!n.activityId && allActivities.length <= 1));
  }, [nodes, currentActivityId, allActivities.length]);

  const filteredActivityEdges = React.useMemo(() => {
    if (!currentActivityId) return edges;
    return edges.filter(e => e.activityId === currentActivityId || (!e.activityId && allActivities.length <= 1));
  }, [edges, currentActivityId, allActivities.length]);

  // User contribution filter state
  const [selectedUserIdFilter, setSelectedUserIdFilter] = useState<string | null>(null);
  const [filterVisibilityMode, setFilterVisibilityMode] = useState<'dim' | 'hide'>('dim');

  // Layout sidecars expansion state (default left closed so board screen expands into left blank area)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const closeDesktopPanelsOnMobile = () => {
      if (window.innerWidth < 1024) {
        setIsLeftSidebarOpen(false);
        setIsRightSidebarOpen(false);
      }
    };
    closeDesktopPanelsOnMobile();
    window.addEventListener('resize', closeDesktopPanelsOnMobile);
    return () => window.removeEventListener('resize', closeDesktopPanelsOnMobile);
  }, []);

  // Auto-open left sidebar if educator has pending approvals
  useEffect(() => {
    const hasPending = nodes.some(n => n.status === 'pending');
    if (hasPending && currentUser.role === 'educator' && window.innerWidth >= 1024) {
      setIsLeftSidebarOpen(true);
    }
  }, [nodes, currentUser.role]);

  // Auto-open right sidebar when a node is selected
  useEffect(() => {
    if (selectedNode) {
      setIsRightSidebarOpen(true);
    }
  }, [selectedNode]);

  // Comments feed panel state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  // AI Suggestions overlay
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiError, setAiError] = useState('');

  // Educator lesson tips (loaded from session or generated via import)
  const [educatorTips, setEducatorTips] = useState<any[]>(session.educatorTips || []);

  // File import state
  const [fileImporting, setFileImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Student verification states
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    completenessScore: number;
    checklist: Array<{ domain: string; isCovered: boolean; feedback: string }>;
    missingConcepts: Array<{
      title: string;
      category: string;
      description: string;
      color: string;
      icon: string;
      reason: string;
    }>;
  } | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [glossarySearch, setGlossarySearch] = useState('');

  // Sidebar inline node editing
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editShape, setEditShape] = useState<'rectangle' | 'circle' | 'ellipse' | 'diamond' | 'cloud'>('rectangle');
  const [editColor, setEditColor] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileImporting(true);
    setImportError('');
    setImportSuccess('');

    // Convert file to Base64
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        const response = await fetch(`/api/maps/${session.id}/import-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
          },
          body: JSON.stringify({
            fileName: file.name,
            fileMimeType: file.type || 'application/octet-stream',
            base64Data: base64String
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to import lecture file');
        }

        const data = await response.json();
        setImportSuccess(`Successfully processed "${file.name}"! Generated ${data.nodes.length} concepts.`);
        setEducatorTips(data.educatorTips || []);
        
        // De-select current node so we focus on the newly imported map
        setSelectedNode(null);
      } catch (err: any) {
        setImportError(err.message || 'Error processing lecture document.');
      } finally {
        setFileImporting(false);
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read document file.');
      setFileImporting(false);
    };

    reader.readAsDataURL(file);
  };

  const handleVerifyMapCompleteness = async () => {
    setVerifying(true);
    setVerifyError('');
    setVerificationResult(null);

    try {
      const response = await fetch(`/api/maps/${session.id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to audit whiteboard concepts.');
      }

      const auditData = await response.json();
      setVerificationResult(auditData);
    } catch (err: any) {
      setVerifyError(err.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleProposeMissingConcept = (concept: {
    title: string;
    category: string;
    description: string;
    color: string;
    icon: string;
  }) => {
    // Propose node over socket
    createNode(concept.title, null, {
      description: concept.description,
      color: concept.color,
      icon: concept.icon,
      category: concept.category,
      x: Math.round((Math.random() - 0.5) * 200),
      y: Math.round((Math.random() - 0.5) * 200 + 100),
      z: 0
    });

    // Remove the proposed item from the local UI list so they know it was proposed
    if (verificationResult) {
      setVerificationResult({
        ...verificationResult,
        missingConcepts: verificationResult.missingConcepts.filter(c => c.title !== concept.title)
      });
    }
  };

  // Local helper to track node count changes & set root node automatically if selected goes stale
  useEffect(() => {
    if (nodes.length > 0 && !selectedNode && window.innerWidth >= 1024) {
      setSelectedNode(nodes.find(n => n.parentId === null) || nodes[0]);
    } else if (selectedNode) {
      // Keep selected node up to date
      const updated = nodes.find(n => n.id === selectedNode.id);
      if (updated) setSelectedNode(updated);
    }
  }, [nodes]);

  // Fetch comments whenever active selected node changes and sync sidebar states
  useEffect(() => {
    if (selectedNode) {
      fetchComments(selectedNode.id);
      setEditTitle(selectedNode.title);
      setEditCategory(selectedNode.category || 'Concept');
      setEditDescription(selectedNode.description || '');
      setEditShape(selectedNode.shape || 'rectangle');
      setEditColor(selectedNode.color || '#10b981');
      setIsEditingNode(false);
    } else {
      setIsEditingNode(false);
    }
  }, [selectedNode?.id]);

  const handleSaveSidebarNodeEdits = () => {
    if (!selectedNode || !editTitle.trim()) return;
    updateNode(selectedNode.id, {
      title: editTitle.trim(),
      category: editCategory,
      description: editDescription.trim(),
      shape: editShape,
      color: editColor
    });
    setIsEditingNode(false);
  };

  const fetchComments = async (nodeId: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/nodes/${nodeId}/comments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedNode) return;

    addComment(selectedNode.id, newCommentText.trim(), currentUser);
    setNewCommentText('');
    
    // Smooth refetch trigger
    setTimeout(() => {
      fetchComments(selectedNode.id);
    }, 200);
  };

  const copyJoinCode = () => {
    navigator.clipboard.writeText(session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // AI Assistant triggers
  const handleGetAiSuggestions = async () => {
    if (!selectedNode) return;
    setIsAiLoading(true);
    setAiError('');
    setAiSuggestions([]);

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          topic: selectedNode.title,
          context: `Parent context group: ${selectedNode.category}. Overall theme is ${session.title}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiSuggestions(data.suggestions);
      } else {
        setAiError('Failed to retrieve AI advice.');
      }
    } catch (err) {
      console.error('AI Suggestion error:', err);
      setAiError('Connection failed.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Compile final study sheet and study self quiz
  const handleCompileStudySheet = async () => {
    setIsAiLoading(true);
    setAiError('');

    try {
      // 1. Fetch study sheet summary
      const summaryPromise = fetch('/api/ai/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          nodes: nodes.map(n => ({ title: n.title, description: n.description, category: n.category })),
          topic: session.title
        })
      });

      // 2. Fetch study self test review quiz
      const quizPromise = fetch('/api/ai/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          nodes: nodes.map(n => ({ title: n.title, description: n.description, category: n.category })),
          topic: session.title
        })
      });

      const [summaryRes, quizRes] = await Promise.all([summaryPromise, quizPromise]);

      if (summaryRes.ok && quizRes.ok) {
        const summaryData = await summaryRes.json();
        const quizData = await quizRes.json();
        onNavigateToSummary(summaryData.summary, quizData.quiz);
      } else {
        setAiError('Failure generating handouts. Verify nodes exist.');
      }
    } catch (err) {
      console.error('AI summary compiling failed:', err);
      setAiError('Network timeout compile.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddSuggestedNode = (title: string) => {
    if (!selectedNode) return;
    createNode(title, selectedNode.id, {
      category: 'Extension',
      color: selectedNode.color,
      x: selectedNode.x + Math.round((Math.random() - 0.5) * 200),
      y: selectedNode.y + Math.round((Math.random() - 0.5) * 200),
      z: selectedNode.z + Math.round((Math.random() - 0.5) * 60)
    });
    // Remove from active options list
    setAiSuggestions(prev => prev.filter(s => s !== title));
  };

  // Extract pending moderation nodes
  const pendingNodes = nodes.filter(n => n.status === 'pending');
  const isLocked = !session.settings?.studentCanEdit;

  return (
    <div id="room-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 overflow-hidden h-[100dvh] transition-colors duration-200">
      
      {/* 1. Header Toolbar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-150 dark:border-slate-850 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 gap-2 sm:gap-4 min-w-0">
        
        {/* Left Side: Topic & Session Metadata */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onLeaveSession}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
            title="Leave Session Room"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350 font-mono text-[9px] uppercase font-bold rounded truncate max-w-[180px] sm:max-w-none">
                {session.subject}
              </span>
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/25 px-2.5 py-0.5 rounded-full uppercase font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live · {participants.length}
              </span>
            </div>

            <h1 className="text-sm font-bold font-display text-slate-800 dark:text-slate-100 leading-tight truncate">
              {session.title}
            </h1>
          </div>
        </div>

        {/* Middle: Join Code copy segment & QR Access */}
        <div className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl px-3 py-1.5 self-stretch sm:self-center sm:self-auto">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Code:</span>
          <span className="text-xs font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">{session.code}</span>
          
          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

          <button
            onClick={copyJoinCode}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 transition-all"
            title="Copy join link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40 transition"
            title="Show QR Code for current MindMap session"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Code</span>
          </button>
        </div>

        {/* Right Side: Participant Avatar Dots & Leave Button */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-x-auto no-scrollbar">
          
          {/* List connected avatars with filter functionality */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex -space-x-2.5 overflow-hidden">
              {participants.slice(0, 6).map((p) => {
                const isFiltered = selectedUserIdFilter === p.userId || selectedUserIdFilter === p.name;
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                const col = colors[Math.abs(p.name.charCodeAt(0)) % colors.length];
                return (
                  <button
                    key={p.userId}
                    onClick={() => setSelectedUserIdFilter(prev => (prev === p.userId || prev === p.name ? null : p.userId))}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white border-2 transition-all transform hover:scale-110 ${
                      isFiltered
                        ? 'border-indigo-500 ring-2 ring-indigo-400 scale-110 z-10 shadow-lg'
                        : 'border-white dark:border-slate-950 opacity-90 hover:opacity-100'
                    } ${col}`}
                    title={`Click to filter map & display ONLY ${p.name}'s contributions`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </button>
                );
              })}
              {participants.length > 6 && (
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 border-2 border-white dark:border-slate-950">
                  +{participants.length - 6}
                </div>
              )}
            </div>

            {/* Filter Active Pill Indicator in Header */}
            {selectedUserIdFilter && (() => {
              const filterUser = participants.find(p => p.userId === selectedUserIdFilter || p.name === selectedUserIdFilter);
              const filterUserName = filterUser?.name || selectedUserIdFilter;
              return (
                <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl text-xs font-bold animate-in fade-in">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="hidden sm:inline">User Work: {filterUserName}</span>
                  <button
                    onClick={() => setSelectedUserIdFilter(null)}
                    className="p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded text-indigo-500 hover:text-indigo-700 transition"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Toggle mode button & Sidebar Toggles */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 min-w-max">
            <button
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === '2d' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2D Board
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === '3d' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              3D Space
            </button>
            <button
              onClick={() => setViewMode('qa')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all relative ${
                viewMode === 'qa' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              Q&A Memos
              {memos.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-400/30 text-amber-950 dark:text-amber-200 rounded-full">
                  {memos.length}
                </span>
              )}
            </button>

            <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

            {/* Sidebar & Fullscreen Toggles */}
            <button
              onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
              className={`p-1 px-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                isLeftSidebarOpen
                  ? 'bg-blue-500 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title={isLeftSidebarOpen ? 'Collapse Left Sidebar' : 'Expand Board to Left Space'}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[10px]">Left Panel</span>
            </button>

            <button
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className={`p-1 px-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                isRightSidebarOpen
                  ? 'bg-blue-500 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title={isRightSidebarOpen ? 'Collapse Inspector' : 'Open Inspector Panel'}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden xl:inline text-[10px]">Inspector</span>
            </button>

            <button
              onClick={() => {
                if (!isLeftSidebarOpen && !isRightSidebarOpen) {
                  setIsLeftSidebarOpen(false);
                  setIsRightSidebarOpen(true);
                } else {
                  setIsLeftSidebarOpen(false);
                  setIsRightSidebarOpen(false);
                }
              }}
              className={`p-1 px-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                !isLeftSidebarOpen && !isRightSidebarOpen
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title={!isLeftSidebarOpen && !isRightSidebarOpen ? 'Restore Sidebars' : 'Maximize Board Screen'}
            >
              {!isLeftSidebarOpen && !isRightSidebarOpen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden xl:inline text-[10px]">Max Board</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Educator Realtime Commands Hub (Host Only) */}
      {currentUser.role === 'educator' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center gap-4 shadow-sm shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold min-w-max sm:min-w-0">
            {/* Lock Classroom */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Class Rights:</span>
              <button
                onClick={() => toggleLock(!isLocked)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all ${
                  isLocked 
                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/60' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-300'
                }`}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{isLocked ? 'Student Edits Locked' : 'Students Can Edit'}</span>
              </button>
            </div>

            {/* Layout Change Option */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Layout Style:</span>
              <select
                value={session.activeLayout || 'force'}
                onChange={(e) => changeLayout(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="radial">Radial Mind Map</option>
                <option value="force">Force-Directed Web</option>
                <option value="tree">Top-Down Tree</option>
                <option value="timeline">Sequential Timeline</option>
              </select>
            </div>

            {/* Engagement workflow mode change option */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Workflow Mode:</span>
              <select
                value={session.activeEngagementMode || 'brainstorm'}
                onChange={(e) => changeMode(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="brainstorm">Active Brainstorming</option>
                <option value="moderated">Moderated Submissions</option>
                <option value="voting">Concept Voting Phase</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. Stage & Panels layout */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">
        
        {/* Left Sidecar Panel: Active Queue & Roster */}
        {isLeftSidebarOpen && (
          <aside className="fixed inset-x-2 top-2 bottom-2 z-40 lg:static lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 overflow-y-auto flex flex-col justify-between min-h-0 shadow-xl lg:shadow-sm transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                  <PanelLeft className="w-4 h-4 text-blue-500" />
                  Roster & Tools
                </span>
                <button
                  onClick={() => setIsLeftSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                  title="Collapse Left Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Educator Student contribution Queue */}
              {currentUser.role === 'educator' && pendingNodes.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/60 p-3.5 rounded-2xl space-y-3">
                  <h3 className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Approval Queue ({pendingNodes.length})
                  </h3>

                  <div className="space-y-2">
                    {pendingNodes.map((n) => (
                      <div key={n.id} className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-950/80 p-2.5 rounded-xl space-y-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-display">{n.title}</h4>
                          <p className="text-[10px] text-slate-400">Proposed by {n.createdByName}</p>
                        </div>

                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => rejectNode(n.id)}
                            className="p-1 px-2 border border-red-100 hover:bg-red-50 text-red-500 dark:border-red-950 dark:hover:bg-red-950/30 rounded text-[10px] font-bold"
                          >
                            Discard
                          </button>
                          <button
                            onClick={() => approveNode(n.id)}
                            className="p-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-0.5"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Collaborators Roster (for both Educator and Student) */}
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-mono text-indigo-500 uppercase flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Active Collaborators ({participants.length})
                  </h3>
                  {selectedUserIdFilter && (
                    <button
                      onClick={() => setSelectedUserIdFilter(null)}
                      className="text-[10px] font-mono text-indigo-500 hover:underline"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Click any collaborator below to isolate & view only their contributions on the mind map.
                </p>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {participants.map((p) => {
                    const isSelected = selectedUserIdFilter === p.userId || selectedUserIdFilter === p.name;
                    const userWorkCount = nodes.filter(n => n.createdById === p.userId || n.createdByName === p.name).length;
                    return (
                      <div
                        key={p.userId}
                        onClick={() => setSelectedUserIdFilter(prev => prev === p.userId || prev === p.name ? null : p.userId)}
                        className={`flex items-center justify-between text-xs p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 font-bold shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                        title={`Click to filter board & show ONLY ${p.name}'s concepts (${userWorkCount} nodes)`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${p.role === 'educator' ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[110px]">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected ? (
                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/80 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <UserCheck className="w-2.5 h-2.5" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-slate-400 hover:text-indigo-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                              {userWorkCount} concept{userWorkCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Locked indicators */}
            {isLocked && (
              <div className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 p-3 rounded-xl border border-red-100 dark:border-red-900/40 text-[10px] font-medium leading-relaxed">
                <strong>Whiteboard Frozen:</strong> Your educator has paused student edits. You can still upvote ideas or post comments.
              </div>
            )}
          </aside>
        )}

        {/* Center: WebGL or SVG canvas boards or Q&A Memo Pad */}
        <main className={`${
          !isLeftSidebarOpen && !isRightSidebarOpen
            ? 'lg:col-span-12'
            : !isLeftSidebarOpen && isRightSidebarOpen
            ? 'lg:col-span-9'
            : isLeftSidebarOpen && !isRightSidebarOpen
            ? 'lg:col-span-9'
            : 'lg:col-span-6'
        } flex flex-col justify-between min-h-0 relative transition-all`}>

          {/* Quick Overlay Expand Buttons when sidebars are collapsed */}
          {!isLeftSidebarOpen && (
            <button
              onClick={() => setIsLeftSidebarOpen(true)}
              className="absolute top-14 lg:top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Expand Left Panel (Roster & Approvals)"
            >
              <PanelLeft className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Roster & Tools</span>
              {pendingNodes.length > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] bg-amber-500 text-slate-950 font-bold rounded-full">
                  {pendingNodes.length}
                </span>
              )}
            </button>
          )}

          {!isRightSidebarOpen && (
            <button
              onClick={() => setIsRightSidebarOpen(true)}
              className="absolute top-14 lg:top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Expand Inspector Panel"
            >
              <PanelRight className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Inspector</span>
            </button>
          )}
          {/* MindMap Activity Switcher Bar */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 px-3.5 py-2 flex items-center justify-between gap-3 shadow-sm rounded-2xl mb-2.5 shrink-0 z-10">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Activities ({allActivities.length}):
              </span>
              {allActivities.map((act) => {
                const isActive = act.id === currentActivityId;
                const actNodesCount = nodes.filter(n => n.activityId === act.id || (!n.activityId && allActivities.length <= 1)).length;
                return (
                  <div key={act.id} className="flex items-center group shrink-0">
                    <button
                      onClick={() => selectActivity && selectActivity(act.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{act.title}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                        isActive ? 'bg-indigo-500/80 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {actNodesCount}
                      </span>
                    </button>
                    {allActivities.length > 1 && (currentUser.role === 'educator' || act.createdById === currentUser.id) && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete mind map activity "${act.title}"?`)) {
                            deleteActivity && deleteActivity(act.id);
                          }
                        }}
                        className="p-1 ml-0.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Activity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {currentUser.role === 'educator' && (
                <button
                  onClick={() => {
                    setNewActivityTitle(`Activity #${allActivities.length + 1}`);
                    setNewActivityTemplate('blank');
                    setShowCreateActivityModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Activity</span>
                </button>
              )}
            </div>

            {currentActivity && (
              <div className="hidden lg:flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Topic: {currentActivity.title}
                </span>
              </div>
            )}
          </div>

          {viewMode === '2d' ? (
            <InteractiveCanvas2D
              nodes={filteredActivityNodes}
              edges={filteredActivityEdges}
              currentUser={currentUser}
              sessionLayout={session.activeLayout || 'radial'}
              sessionMode={session.activeEngagementMode || 'brainstorm'}
              spotlightNodeId={spotlightNodeId}
              studentCanEdit={session.settings?.studentCanEdit ?? true}
              selectedUserIdFilter={selectedUserIdFilter}
              filterMode={filterVisibilityMode}
              onSelectUserFilter={(userId) => setSelectedUserIdFilter(userId)}
              createNode={(title, parentId, details) => createNode(title, parentId, { ...details, activityId: currentActivityId })}
              updateNode={updateNode}
              dragNode={dragNode}
              deleteNode={deleteNode}
              createEdge={createEdge}
              deleteEdge={deleteEdge}
              addReaction={addReaction}
              addVote={addVote}
              spotlightNode={spotlightNode}
              onSelectNode={setSelectedNode}
              syncMapState={syncMapState}
            />
          ) : viewMode === '3d' ? (
            <InteractiveCanvas3D
              nodes={filteredActivityNodes}
              edges={filteredActivityEdges}
              spotlightNodeId={spotlightNodeId}
              onSelectNode={setSelectedNode}
            />
          ) : (
            <QAMemoPad
              sessionId={session.id}
              memos={memos}
              currentUser={currentUser}
              onAddMemo={(memo) => addMemo && addMemo(memo)}
              onUpdateMemo={(memoId, updates) => updateMemo && updateMemo(memoId, updates)}
              onVoteMemo={(memoId) => voteMemo && voteMemo(memoId)}
              onDeleteMemo={(memoId) => deleteMemo && deleteMemo(memoId)}
              onConvertToNode={(memo) => {
                createNode(memo.question, null, {
                  category: memo.category || 'Question',
                  color: memo.color || '#fef08a',
                  description: memo.answer ? `Answer: ${memo.answer}` : undefined,
                  activityId: currentActivityId
                });
              }}
            />
          )}

          {/* Quick Double click help tip */}
          <div className="mt-3 text-center text-[10px] font-mono text-slate-400">
            💡 TIP: Double click any blank space on the board to add a new concept. Double click on node cards to branch.
          </div>
        </main>

        {/* Right Sidecar Panel: Node comments & Reactions */}
        {isRightSidebarOpen && (
          <aside className="fixed inset-x-2 top-2 bottom-2 z-40 lg:static lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 overflow-y-auto flex flex-col justify-between min-h-0 shadow-xl lg:shadow-sm transition-all">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                <PanelRight className="w-4 h-4 text-indigo-500" />
                Concept Inspector
              </span>
              <button
                onClick={() => setIsRightSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                title="Collapse Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {selectedNode ? (
            <div className="space-y-4 flex flex-col h-full">
              {/* Node Basic Info Card / Edit Form */}
              {isEditingNode ? (
                <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Edit Concept</h4>
                  
                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-400 mb-0.5">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-400 mb-0.5">Category</label>
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-400 mb-0.5">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">Color Theme</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#06b6d4'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-5 h-5 rounded-full border transition-transform ${
                            editColor === color ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => setIsEditingNode(false)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSidebarNodeEdits}
                      disabled={!editTitle.trim()}
                      className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-semibold disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  style={{ borderLeftColor: selectedNode.color }} 
                  className="border-l-4 pl-3 py-1 space-y-1 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      {selectedNode.category || 'Topic'}
                    </div>
                    {(currentUser.role === 'educator' || selectedNode.createdById === currentUser.id) && (
                      <button
                        onClick={() => setIsEditingNode(true)}
                        className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 text-[10px] font-semibold flex items-center gap-0.5 transition-colors"
                        title="Edit Concept"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <h3 className="text-sm font-bold font-display text-slate-800 dark:text-slate-100">
                    {selectedNode.title}
                  </h3>
                  {selectedNode.description && (
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {selectedNode.description}
                    </p>
                  )}
                </div>
              )}

              {/* Classroom quick reaction bubble triggers */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">Add Reaction Emoji:</span>
                <div className="flex gap-2">
                  {['❤️', '💡', '🔥', '👍', '😮'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addReaction(selectedNode.id, currentUser.id, emoji)}
                      className="text-lg hover:scale-125 hover:-translate-y-0.5 active:scale-95 transition-all p-1 hover:bg-slate-200/50 dark:hover:bg-slate-850 rounded-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments Feed Area */}
              <div className="flex-grow flex flex-col justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <div className="space-y-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                    Whiteboard Comments
                  </h4>
                  
                  {commentsLoading ? (
                    <p className="text-[10px] text-slate-400">syncing feed...</p>
                  ) : comments.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No notes posted yet. Post the first challenge query!</p>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {comments.map((comm) => (
                        <div key={comm.id} className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 font-semibold">
                            <span>{comm.authorName}</span>
                            <span>{new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-normal">
                            {comm.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask or answer concept..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-grow px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow shadow-blue-500/10 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-5 h-full flex flex-col overflow-y-auto">
              
              {currentUser.role === 'educator' ? (
                /* ====================================================
                   EDUCATOR SIDEBAR: FILE IMPORT & AI LESSON GUIDES
                   ==================================================== */
                <div className="space-y-5">
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 p-4 rounded-2xl">
                    <h3 className="text-xs font-bold font-display text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      Document AI Importer
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-normal mb-3">
                      Upload a PDF, PPT slides, or course outline text to generate a full conceptual mind map.
                    </p>

                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:border-indigo-500 hover:bg-slate-100/40 dark:hover:bg-slate-850/40 transition-all text-center">
                      <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse mb-1.5" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {fileImporting ? 'Processing slide decks...' : 'Import Lecture PDF / PPT'}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        Accepts slides, notes, or code TXT
                      </span>
                      <input 
                        type="file" 
                        accept=".pdf,.ppt,.pptx,.txt" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={fileImporting}
                      />
                    </label>

                    {fileImporting && (
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-indigo-600 font-mono animate-pulse font-medium justify-center">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                        Analyzing topics & designing nodes...
                      </div>
                    )}

                    {importError && (
                      <div className="mt-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-[10px] p-2.5 rounded-xl border border-red-100 dark:border-red-900/40 font-semibold leading-relaxed">
                        ⚠️ {importError}
                      </div>
                    )}

                    {importSuccess && (
                      <div className="mt-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 font-semibold leading-relaxed">
                        🎉 {importSuccess}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-3.5">
                    <h3 className="text-xs font-bold font-display text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      Educator Lesson Guides
                    </h3>
                    
                    {educatorTips.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic bg-slate-50 dark:bg-slate-900/20 p-3 rounded-xl border border-slate-100 dark:border-slate-850 leading-relaxed text-center py-6">
                        No active lesson guides. Import a file to get custom discussion questions, classroom tasks, and misconceptions to watch for.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {educatorTips.map((tip, idx) => (
                          <div 
                            key={idx}
                            className={`p-3 rounded-xl border flex gap-2.5 leading-relaxed transition-all ${
                              tip.tipType === 'question' 
                                ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-950/10 dark:border-blue-900/30'
                                : tip.tipType === 'misconception'
                                ? 'bg-red-50/50 border-red-100 dark:bg-red-950/10 dark:border-red-900/30'
                                : tip.tipType === 'activity'
                                ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30'
                                : 'bg-slate-50 border-slate-100 dark:bg-slate-900/40 dark:border-slate-850'
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              {tip.tipType === 'question' && <BookOpen className="w-4 h-4 text-blue-500" />}
                              {tip.tipType === 'misconception' && <ShieldAlert className="w-4 h-4 text-red-500" />}
                              {tip.tipType === 'activity' && <Users className="w-4 h-4 text-emerald-500" />}
                              {tip.tipType === 'resource' && <FileText className="w-4 h-4 text-indigo-500" />}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-snug">
                                {tip.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                                {tip.text}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ====================================================
                   STUDENT SIDEBAR: CLASSROOM HUB & MAP VERIFICATION
                   ==================================================== */
                <div className="space-y-5">
                  {/* Classroom Stats & Quick Info */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 p-4 rounded-2xl">
                    <h3 className="text-xs font-bold font-display text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <LayoutGrid className="w-4 h-4 text-emerald-500" />
                      Classroom Hub
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Welcome to the live session! You can collaborate in real-time. Double-click the whiteboard background or double-click a node directly to branch out and add a shape.
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-3.5">
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2.5 rounded-xl text-center">
                        <span className="text-[9px] font-mono text-slate-400 uppercase">Concepts</span>
                        <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                          {nodes.filter(n => n.status === 'approved').length}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-2.5 rounded-xl text-center">
                        <span className="text-[9px] font-mono text-slate-400 uppercase">Connections</span>
                        <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                          {edges.length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Searchable Concept Glossary */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold font-display text-slate-800 dark:text-slate-200">
                        Concepts Index
                      </h4>
                      <span className="text-[9px] font-mono text-slate-400 uppercase font-semibold">
                        {nodes.filter(n => n.status === 'approved').length} total
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Search concepts on board..."
                      value={glossarySearch}
                      onChange={(e) => setGlossarySearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    />

                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {nodes
                        .filter(n => n.status === 'approved' && n.title.toLowerCase().includes(glossarySearch.toLowerCase()))
                        .map((n) => (
                          <button
                            key={n.id}
                            onClick={() => setSelectedNode(n)}
                            className="w-full text-left p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 hover:border-blue-500 dark:hover:border-blue-900 rounded-xl flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs shrink-0">{n.icon || '💡'}</span>
                              <div className="min-w-0">
                                <h5 className="text-[10px] font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-500">
                                  {n.title}
                                </h5>
                                <span className="text-[8px] font-mono text-slate-400 uppercase">
                                  {n.category || 'Topic'}
                                </span>
                              </div>
                            </div>
                            <span 
                              style={{ backgroundColor: `${n.color}15`, color: n.color }}
                              className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 uppercase"
                            >
                              {n.shape || 'rectangle'}
                            </span>
                          </button>
                        ))}
                      {nodes.filter(n => n.status === 'approved' && n.title.toLowerCase().includes(glossarySearch.toLowerCase())).length === 0 && (
                        <div className="text-center py-4 text-[10px] text-slate-400 italic">
                          No matching concepts.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
              
              <div className="text-center py-2 font-mono text-[9px] text-slate-400/80 border-t border-slate-100 dark:border-slate-800/80 pt-4 leading-normal">
                💡 Selected nodes show discussion feeds & react bubbles here. De-select to see classroom information.
              </div>
            </div>
          )}

        </aside>
        )}

      </div>

      {/* MindMap QR Code Modal */}
      <MindMapQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        sessionCode={session.code}
        sessionTitle={session.title}
      />

      {/* Camera QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={(scannedCode) => {
          if (scannedCode) {
            window.location.href = `/?code=${encodeURIComponent(scannedCode)}`;
          }
        }}
        title="Scan QR Code to Join Another Session"
      />

      {/* Create Mind Map Activity Modal */}
      {showCreateActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-display text-slate-800 dark:text-slate-100">
                    Create Mind Map Activity
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add another interactive mind map activity to this session
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateActivityModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-mono uppercase text-slate-500 mb-1">
                  Activity Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. SWOT Analysis, Group Brainstorming..."
                  value={newActivityTitle}
                  onChange={(e) => setNewActivityTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono uppercase text-slate-500 mb-1">
                  Choose Activity Template
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    { id: 'blank', name: 'Blank Board', icon: '🧠', desc: 'Standard central concept node' },
                    { id: 'swot', name: 'SWOT Analysis', icon: '📊', desc: 'Strengths, Weaknesses, Opps, Threats' },
                    { id: 'pros_cons', name: 'Pros & Cons', icon: '⚖️', desc: 'Evaluate advantages vs. risks' },
                    { id: 'problem_solving', name: 'Problem Solving', icon: '🎯', desc: 'Root Causes, Solutions, Action Plan' },
                    { id: 'timeline', name: 'Process Timeline', icon: '⏳', desc: 'Initiation, Execution, Review' },
                    { id: 'group_brainstorm', name: 'Group Boards', icon: '👥', desc: 'Alpha, Beta, & Gamma Team hubs' },
                  ].map((tpl) => {
                    const isSelected = newActivityTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setNewActivityTemplate(tpl.id as any)}
                        className={`text-left p-2.5 rounded-2xl border transition-all flex items-start gap-2 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-900 dark:text-indigo-100 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xl shrink-0">{tpl.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {tpl.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight mt-0.5">
                            {tpl.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono uppercase text-slate-500 mb-1">
                  Optional Description
                </label>
                <input
                  type="text"
                  placeholder="Goals or instructions for this activity..."
                  value={newActivityDesc}
                  onChange={(e) => setNewActivityDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateActivityModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newActivityTitle.trim()) return;
                  if (createActivity) {
                    createActivity(newActivityTitle.trim(), newActivityTemplate, newActivityDesc.trim());
                  }
                  setShowCreateActivityModal(false);
                  setNewActivityTitle('');
                  setNewActivityDesc('');
                }}
                disabled={!newActivityTitle.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Activity Board</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
