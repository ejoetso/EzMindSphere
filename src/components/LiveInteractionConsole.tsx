/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, Square, QrCode, Sparkles, BarChart2, MessageSquare, HelpCircle, 
  CheckCircle2, AlertCircle, RefreshCw, Send, Users, Shield, ArrowRight, 
  Maximize2, Minimize2, Download, GitBranch, Layers, Eye, EyeOff, ThumbsUp, 
  Pin, Trash2, Check, X, Filter, Edit3, Lock, Unlock, Share2, Plus,
  Clipboard, Copy, FileText, Import, CheckCheck
} from 'lucide-react';
import { 
  LiveInteractionSession, LiveActivity, ActivityOption, ActivityResponse, 
  AudienceQuestion, ResponseCluster, User 
} from '../types.js';

interface LiveInteractionConsoleProps {
  sessionId: string;
  currentUser: User;
  onCloseConsole: () => void;
  onOpenMindMapCanvas?: (mapId: string) => void;
}

export const LiveInteractionConsole: React.FC<LiveInteractionConsoleProps> = ({
  sessionId,
  currentUser,
  onCloseConsole,
  onOpenMindMapCanvas
}) => {
  const [session, setSession] = useState<LiveInteractionSession | null>(null);
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [activeActivity, setActiveActivity] = useState<LiveActivity | null>(null);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [clusters, setClusters] = useState<ResponseCluster[]>([]);
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  
  // UI Tabs & Views
  const [activeTab, setActiveTab] = useState<'presenter' | 'presentation' | 'qa' | 'clusters' | 'settings'>('presenter');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClustering, setIsClustering] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionSuccessMsg, setConversionSuccessMsg] = useState('');

  // AI Answer Draft modal
  const [selectedQuestionForAI, setSelectedQuestionForAI] = useState<AudienceQuestion | null>(null);
  const [aiDraftAnswer, setAiDraftAnswer] = useState<{ answer: string; discussionPrompts: string[]; relatedConcepts: string[] } | null>(null);
  const [isGeneratingAIDraft, setIsGeneratingAIDraft] = useState(false);

  // New/Edit Activity Modal
  const [showNewActivityModal, setShowNewActivityModal] = useState(false);
  const [modalTab, setModalTab] = useState<'manual' | 'import'>('manual');
  const [pastedImportText, setPastedImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [copiedToastId, setCopiedToastId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<LiveActivity | null>(null);
  const [newActType, setNewActType] = useState<'multiple_choice' | 'open_ended' | 'qa'>('multiple_choice');
  const [newActTitle, setNewActTitle] = useState('');
  const [newActDescription, setNewActDescription] = useState('');
  const [newActOptions, setNewActOptions] = useState<string[]>(['Option A', 'Option B', 'Option C', 'Option D']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(0);

  // Q&A Editing & Management
  const [qaFilter, setQaFilter] = useState<'all' | 'pending' | 'approved' | 'answered'>('all');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<AudienceQuestion | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [editingPresenterAnswerText, setEditingPresenterAnswerText] = useState('');

  // Presenter Answer text
  const [answerInputText, setAnswerInputText] = useState<{ [qId: string]: string }>({});

  useEffect(() => {
    fetchSessionDetails();
    
    // Connect WebSocket for real-time interaction updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        event: 'session:join',
        data: {
          sessionId,
          userId: currentUser.id,
          name: currentUser.name,
          role: 'educator'
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { event: evtName, data } = message;

        if (evtName === 'live:presence') {
          setParticipantsCount(data.participantsCount);
        } else if (evtName === 'live:session:update') {
          setSession(data.session);
        } else if (evtName === 'live:activity:activate') {
          setActiveActivity(data.activeActivity);
          setSession(data.session);
          fetchResponsesAndClusters(data.activeActivity.id);
        } else if (evtName === 'live:response:submitted' || evtName === 'live:response:updated') {
          if (data.activityId === activeActivity?.id) {
            setResponses(data.responses);
          }
        } else if (evtName === 'live:question:submitted' || evtName === 'live:question:updated' || evtName === 'live:question:voted' || evtName === 'live:questions:updated') {
          setQuestions(data.questions);
        } else if (evtName === 'live:clusters:updated') {
          if (data.activityId === activeActivity?.id) {
            setClusters(data.clusters);
            if (data.responses) setResponses(data.responses);
          }
        }
      } catch (e) {
        console.error('WS parse error in console:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId, activeActivity?.id]);

  const fetchSessionDetails = async () => {
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setActivities(data.activities);
        setParticipantsCount(data.participants.filter((p: any) => !p.isBlocked).length);
        setQuestions(data.audienceQuestions);
        setQrCodeUrl(data.qrCodeUrl);
        setJoinUrl(data.joinUrl);

        // Find active activity
        const currentActive = data.activities.find((a: any) => a.id === data.session.activeActivityId) || data.activities[0] || null;
        setActiveActivity(currentActive);
        if (currentActive) {
          setResponses(data.responsesMap[currentActive.id] || []);
          setClusters(data.clustersMap[currentActive.id] || []);
          if (!data.session.activeActivityId) {
            handleActivateActivity(currentActive);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live session:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponsesAndClusters = async (actId: string) => {
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data.responsesMap[actId] || []);
        setClusters(data.clustersMap[actId] || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleActivateActivity = async (act: LiveActivity) => {
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${act.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({ status: 'active' })
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveActivity(updated);
        fetchResponsesAndClusters(updated.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseActivity = async (actId: string) => {
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${actId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({ status: 'closed' })
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveActivity(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleResultVisibility = async () => {
    if (!activeActivity) return;
    const newVis = activeActivity.resultVisibility === 'revealed' ? 'hidden' : 'revealed';
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${activeActivity.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({ resultVisibility: newVis })
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveActivity(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerAICluster = async () => {
    if (!activeActivity || activeActivity.type !== 'open_ended') return;
    setIsClustering(true);
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${activeActivity.id}/ai-cluster`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setClusters(data.clusters);
        setResponses(data.responses);
        setActiveTab('clusters');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsClustering(false);
    }
  };

  const handleGenerateAIDraftAnswer = async (q: AudienceQuestion) => {
    setSelectedQuestionForAI(q);
    setIsGeneratingAIDraft(true);
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/questions/${q.id}/ai-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAiDraftAnswer(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAIDraft(false);
    }
  };

  const handleApplyAIDraftAnswer = async () => {
    if (!selectedQuestionForAI || !aiDraftAnswer) return;
    try {
      await handleModerateQuestion(selectedQuestionForAI.id, {
        presenterAnswer: aiDraftAnswer.answer,
        status: 'approved',
        isAnswered: true
      });
      setSelectedQuestionForAI(null);
      setAiDraftAnswer(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleModerateQuestion = async (qId: string, updates: Partial<AudienceQuestion>) => {
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/questions/${qId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions(prev => prev.map(q => q.id === qId ? updated : q));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleModerateResponse = async (respId: string, updates: Partial<ActivityResponse>) => {
    if (!activeActivity) return;
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${activeActivity.id}/responses/${respId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setResponses(prev => prev.map(r => r.id === respId ? updated : r));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteResponse = async (respId: string) => {
    if (!activeActivity) return;
    if (!confirm('Are you sure you want to delete this response?')) return;
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${activeActivity.id}/responses/${respId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        setResponses(prev => prev.filter(r => r.id !== respId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConvertToMindMap = async () => {
    setIsConverting(true);
    setConversionSuccessMsg('');
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/convert-to-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          convertType: 'all',
          activityId: activeActivity?.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        setConversionSuccessMsg(`Successfully created ${data.createdNodesCount} MindSphere nodes in session: ${data.mapSession.title}`);
        if (onOpenMindMapCanvas && data.mapSession?.id) {
          setTimeout(() => {
            onOpenMindMapCanvas(data.mapSession.id);
          }, 1500);
        }
      } else {
        alert('Failed to convert results to Mindmap canvas.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsConverting(false);
    }
  };

  const handleOpenNewActivity = (initialTab: 'manual' | 'import' = 'manual') => {
    setEditingActivity(null);
    setModalTab(initialTab);
    setNewActType('multiple_choice');
    setNewActTitle('');
    setNewActDescription('');
    setNewActOptions(['Option A', 'Option B', 'Option C', 'Option D']);
    setCorrectOptionIndex(0);
    setPastedImportText('');
    setShowNewActivityModal(true);
  };

  const handleCopyActivityQuestion = (act: LiveActivity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let formatted = `${act.title}\n`;
    if (act.description) formatted += `${act.description}\n`;
    if (act.options && act.options.length > 0) {
      act.options.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        formatted += `${letter}) ${opt.label}${opt.isCorrect ? ' *' : ''}\n`;
      });
    }
    navigator.clipboard.writeText(formatted.trim()).then(() => {
      setCopiedToastId(act.id);
      setTimeout(() => setCopiedToastId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy to clipboard', err);
    });
  };

  const handleDuplicateActivity = async (act: LiveActivity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          type: act.type,
          title: `${act.title} (Copy)`,
          description: act.description,
          options: act.options?.map(o => ({ label: o.label, isCorrect: o.isCorrect })),
          openEndedSettings: act.openEndedSettings,
          qaSettings: act.qaSettings
        })
      });

      if (res.ok) {
        const newAct = await res.json();
        setActivities(prev => [...prev, newAct]);
      }
    } catch (err) {
      console.error('Error duplicating activity:', err);
    }
  };

  const parsePastedTextToActivities = (rawText: string) => {
    if (!rawText.trim()) return [];

    const blocks = rawText
      .split(/\n\s*\n|\n---+\n|\n===+\n/)
      .map(b => b.trim())
      .filter(Boolean);

    const results: Array<{
      type: 'multiple_choice' | 'open_ended';
      title: string;
      description?: string;
      options?: Array<{ label: string; isCorrect: boolean }>;
    }> = [];

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      const title = firstLine.replace(/^(Q\d*[:.]?|\d+[:.]?)\s*/i, '').trim();

      const optionLines = lines.slice(1);
      const parsedOptions: Array<{ label: string; isCorrect: boolean }> = [];

      for (const optLine of optionLines) {
        const match = optLine.match(/^([A-Za-z0-9]+[.):]|\*|-|\[[ xX]?\])?\s*(.+)$/);
        if (match) {
          let label = match[2].trim();
          let isCorrect = false;

          if (/(\*|\(correct\)|\[x\]|✓)$/i.test(label) || /^[\*✓]|\b(correct)\b/i.test(optLine)) {
            isCorrect = true;
            label = label.replace(/\s*(\*|\(correct\)|\[x\]|✓)\s*$/gi, '').trim();
          }

          if (label) {
            parsedOptions.push({ label, isCorrect });
          }
        }
      }

      if (parsedOptions.length > 0) {
        results.push({
          type: 'multiple_choice',
          title: title || 'Untitled Poll Question',
          options: parsedOptions
        });
      } else {
        results.push({
          type: 'open_ended',
          title: title || 'Untitled Open Question'
        });
      }
    }

    return results;
  };

  const handleBatchImportActivities = async () => {
    const parsed = parsePastedTextToActivities(pastedImportText);
    if (parsed.length === 0) return;

    setIsImporting(true);
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({ activities: parsed })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.allActivities) {
          setActivities(data.allActivities);
          if (!activeActivity && data.allActivities.length > 0) {
            setActiveActivity(data.allActivities[0]);
          }
        }
        setPastedImportText('');
        setShowNewActivityModal(false);
        setModalTab('manual');
      }
    } catch (err) {
      console.error('Error importing activities:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenEditActivity = (act: LiveActivity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingActivity(act);
    setModalTab('manual');
    setNewActType(act.type);
    setNewActTitle(act.title);
    setNewActDescription(act.description || '');
    if (act.options && act.options.length > 0) {
      setNewActOptions(act.options.map(o => o.label));
      const correctIdx = act.options.findIndex(o => o.isCorrect);
      setCorrectOptionIndex(correctIdx >= 0 ? correctIdx : 0);
    } else {
      setNewActOptions(['Option A', 'Option B', 'Option C', 'Option D']);
      setCorrectOptionIndex(0);
    }
    setShowNewActivityModal(true);
  };

  const handleDeleteActivity = async (actId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this activity question?')) return;
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/activities/${actId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        setActivities(prev => {
          const remaining = prev.filter(a => a.id !== actId);
          if (activeActivity?.id === actId) {
            setActiveActivity(remaining[0] || null);
          }
          return remaining;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActTitle.trim()) return;

    try {
      const formattedOptions = newActType === 'multiple_choice' 
        ? newActOptions.filter(o => o.trim()).map((label, idx) => ({
            label,
            isCorrect: correctOptionIndex === idx
          }))
        : undefined;

      if (editingActivity) {
        // Edit existing activity
        const res = await fetch(`/api/live/sessions/${sessionId}/activities/${editingActivity.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
          },
          body: JSON.stringify({
            type: newActType,
            title: newActTitle,
            description: newActDescription,
            options: formattedOptions
          })
        });

        if (res.ok) {
          const updated = await res.json();
          setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
          if (activeActivity?.id === updated.id) {
            setActiveActivity(updated);
          }
          setShowNewActivityModal(false);
          setEditingActivity(null);
        }
      } else {
        // Create new activity
        const res = await fetch(`/api/live/sessions/${sessionId}/activities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
          },
          body: JSON.stringify({
            type: newActType,
            title: newActTitle,
            description: newActDescription,
            options: formattedOptions,
            openEndedSettings: newActType === 'open_ended' ? {
              answerMode: 'short',
              characterLimit: 280,
              allowMultipleResponses: true,
              enableVoting: true,
              profanityFilter: true,
              duplicateDetection: true
            } : undefined,
            qaSettings: newActType === 'qa' ? {
              requireApproval: false,
              allowAnonymousQuestions: true,
              enableUpvoting: true
            } : undefined
          })
        });

        if (res.ok) {
          const created = await res.json();
          setActivities(prev => [...prev, created]);
          setShowNewActivityModal(false);
          setNewActTitle('');
          setNewActDescription('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Audience Questions Handlers
  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/questions/${qId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        setQuestions(prev => prev.filter(q => q.id !== qId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditQuestion = (q: AudienceQuestion) => {
    setEditingQuestion(q);
    setEditingQuestionText(q.text);
    setEditingPresenterAnswerText(q.presenterAnswer || '');
  };

  const handleSaveEditedQuestion = async () => {
    if (!editingQuestion || !editingQuestionText.trim()) return;
    try {
      const updates: any = {
        text: editingQuestionText.trim()
      };
      if (editingPresenterAnswerText.trim()) {
        updates.presenterAnswer = editingPresenterAnswerText.trim();
        updates.isAnswered = true;
      }
      const res = await fetch(`/api/live/sessions/${sessionId}/questions/${editingQuestion.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
        setEditingQuestion(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddPresenterQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          participantId: currentUser.id,
          participantName: `${currentUser.name} (Educator)`,
          isAnonymous: false,
          text: newQuestionText.trim()
        })
      });
      if (res.ok) {
        const created = await res.json();
        setQuestions(prev => [created, ...prev]);
        setShowAddQuestionModal(false);
        setNewQuestionText('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
    window.open(`/api/live/sessions/${sessionId}/export?format=csv`, '_blank');
  };

  const handleDeleteSession = async () => {
    if (!confirm('Are you sure you want to delete this live session? All activities, questions, and participant responses will be permanently removed.')) return;
    try {
      const res = await fetch(`/api/live/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        onCloseConsole();
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  if (loading || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-slate-600 font-medium">Loading MindSphere Live Interaction Console...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-slate-900 text-slate-100 min-h-screen ${isFullScreen ? 'fixed inset-0 z-50 overflow-y-auto' : 'rounded-2xl border border-slate-800 shadow-2xl'}`}>
      
      {/* Console Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-950/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{session.title}</h1>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider ${
                session.status === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {session.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">Join Code: <span className="font-mono font-bold text-indigo-400">{session.joinCode}</span> • {participantsCount} Active Participants</p>
          </div>
        </div>

        {/* Navigation Tabs & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('presenter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                activeTab === 'presenter' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Presenter Console</span>
            </button>
            <button
              onClick={() => setActiveTab('presentation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                activeTab === 'presentation' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Presentation Screen</span>
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                activeTab === 'qa' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Q&A ({questions.filter(q => q.status === 'approved').length})</span>
            </button>
            {activeActivity?.type === 'open_ended' && (
              <button
                onClick={() => setActiveTab('clusters')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  activeTab === 'clusters' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Themes ({clusters.length})</span>
              </button>
            )}
          </div>

          <button
            onClick={handleConvertToMindMap}
            disabled={isConverting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            title="Convert live interaction choices & responses into collaborative MindSphere nodes"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>{isConverting ? 'Converting...' : 'Convert to MindSphere'}</span>
          </button>

          <button
            onClick={handleDeleteSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-xl transition"
            title="Delete this entire live session and all its data"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete Session</span>
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onCloseConsole}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-rose-600/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Conversion Banner */}
      {conversionSuccessMsg && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{conversionSuccessMsg}</span>
          </div>
          <button onClick={() => setConversionSuccessMsg('')} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
        
        {/* PRESENTATION / PRESENTER TAB */}
        {activeTab === 'presenter' && (
          <>
            {/* Left Column: Activity List & Navigator */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Activity Sequence</h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenNewActivity('import')}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-800/40 transition"
                      title="Copy & Paste text questions to import polls"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Paste & Import</span>
                    </button>
                    <button
                      onClick={() => handleOpenNewActivity('manual')}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-800/40 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {activities.map((act, index) => {
                    const isActive = activeActivity?.id === act.id;
                    const isCopied = copiedToastId === act.id;
                    return (
                      <div
                        key={act.id}
                        onClick={() => handleActivateActivity(act)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 group ${
                          isActive 
                            ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/10' 
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            act.type === 'multiple_choice' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' :
                            act.type === 'open_ended' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {act.type === 'multiple_choice' ? 'MC' : act.type === 'open_ended' ? 'OE' : 'QA'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-semibold text-white truncate">{index + 1}. {act.title}</h3>
                            <p className="text-[10px] text-slate-400 capitalize truncate">{act.type.replace('_', ' ')} • Status: {act.status}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1"></span>
                          )}
                          <button
                            onClick={(e) => handleCopyActivityQuestion(act, e)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition"
                            title="Copy Question & Options to Clipboard"
                          >
                            {isCopied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleDuplicateActivity(act, e)}
                            className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
                            title="Duplicate Activity in Session"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenEditActivity(act, e)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit Activity Question"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteActivity(act.id, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Delete Activity Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code & Join Panel */}
              <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Participant Scan to Join</p>
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Session QR Code" className="w-36 h-36 rounded-xl border border-slate-700 bg-white p-2 shadow-lg mb-2" />
                ) : (
                  <div className="w-36 h-36 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center mb-2">
                    <QrCode className="w-12 h-12 text-slate-600" />
                  </div>
                )}
                <div className="mt-1">
                  <p className="text-xs text-slate-400">Direct Join Code:</p>
                  <p className="text-xl font-extrabold text-indigo-400 tracking-wider font-mono">{session.joinCode}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Active Activity Live Stage & Chart */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {activeActivity ? (
                <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 flex flex-col min-h-[480px]">
                  
                  {/* Activity Bar Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/20 text-indigo-300 rounded-full uppercase tracking-wider border border-indigo-500/30">
                          {activeActivity.type.replace('_', ' ')}
                        </span>
                        <h2 className="text-xl font-extrabold text-white">{activeActivity.title}</h2>
                      </div>
                      {activeActivity.description && (
                        <p className="text-xs text-slate-400 mt-1">{activeActivity.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleCopyActivityQuestion(activeActivity, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition"
                        title="Copy Question & Options to Clipboard"
                      >
                        {copiedToastId === activeActivity.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5 text-indigo-400" />}
                        <span>{copiedToastId === activeActivity.id ? 'Copied!' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={(e) => handleDuplicateActivity(activeActivity, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition"
                        title="Duplicate Activity"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Duplicate</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditActivity(activeActivity)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition"
                        title="Edit Activity Question"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteActivity(activeActivity.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-rose-300 rounded-xl border border-slate-700 transition"
                        title="Delete Activity Question"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Delete</span>
                      </button>

                      <button
                        onClick={handleToggleResultVisibility}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition"
                      >
                        {activeActivity.resultVisibility === 'revealed' ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{activeActivity.resultVisibility === 'revealed' ? 'Results Public' : 'Results Hidden'}</span>
                      </button>

                      {activeActivity.type === 'open_ended' && (
                        <button
                          onClick={handleTriggerAICluster}
                          disabled={isClustering || responses.length === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-pink-600 hover:bg-pink-500 text-white rounded-xl shadow-lg shadow-pink-500/20 transition disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isClustering ? 'Analyzing...' : 'AI Theme Clusters'}</span>
                        </button>
                      )}

                      {activeActivity.status === 'active' ? (
                        <button
                          onClick={() => handleCloseActivity(activeActivity.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md transition"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Close Voting</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateActivity(activeActivity)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Open Voting</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* VISUAL RESULTS STAGE */}

                  {/* 1. MULTIPLE CHOICE RESULTS */}
                  {activeActivity.type === 'multiple_choice' && (
                    <div className="flex-1 flex flex-col justify-center gap-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Total Responses Received: <strong className="text-white font-bold">{responses.length}</strong></span>
                        <span>Correct Answer Option: <strong className="text-emerald-400 font-bold">{activeActivity.options?.find(o => o.isCorrect)?.label || 'None Set'}</strong></span>
                      </div>

                      <div className="space-y-3">
                        {activeActivity.options?.map((opt) => {
                          const count = responses.filter(r => r.selectedOptionIds?.includes(opt.id)).length;
                          const total = Math.max(responses.length, 1);
                          const percentage = Math.round((count / total) * 100);

                          return (
                            <div key={opt.id} className="relative bg-slate-900/80 p-4 rounded-xl border border-slate-800 overflow-hidden">
                              {/* Background Bar */}
                              <div
                                className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                                  opt.isCorrect ? 'bg-emerald-500/20 border-r-2 border-emerald-400' : 'bg-indigo-600/20 border-r-2 border-indigo-400'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />

                              <div className="relative z-10 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  {opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                                  <span className="text-sm font-semibold text-white">{opt.label}</span>
                                </div>

                                <div className="flex items-center gap-3 text-sm font-bold">
                                  <span className="text-slate-400">{count} votes</span>
                                  <span className="text-indigo-300 font-mono text-base">{percentage}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {activeActivity.mcSettings?.explanation && (
                        <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-white">Explanation: </span>
                            {activeActivity.mcSettings.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. OPEN ENDED RESULTS */}
                  {activeActivity.type === 'open_ended' && (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span>Submissions ({responses.length})</span>
                        <span className="text-indigo-400">Click any idea card to feature or pin</span>
                      </div>

                      {responses.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                          <MessageSquare className="w-8 h-8 mb-2 text-slate-600" />
                          <p className="text-sm font-medium">Waiting for participant responses...</p>
                          <p className="text-xs text-slate-600 mt-1">Participants can submit written ideas from their phone or computer.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-2">
                          {responses.map((resp) => (
                            <div
                              key={resp.id}
                              className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                                resp.isPinned 
                                  ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/10' 
                                  : resp.isHighlighted
                                  ? 'bg-indigo-950/40 border-indigo-500'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <p className="text-sm text-slate-100 font-medium leading-relaxed">{resp.textResponse}</p>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                                <span className="font-semibold text-slate-300">{resp.participantName}</span>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleModerateResponse(resp.id, { isPinned: !resp.isPinned })}
                                    className={`p-1 rounded hover:bg-slate-800 transition ${resp.isPinned ? 'text-amber-400' : 'text-slate-500'}`}
                                    title="Pin Response"
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteResponse(resp.id)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition"
                                    title="Delete Response"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="flex items-center gap-1 font-mono text-indigo-300">
                                    <ThumbsUp className="w-3 h-3 text-indigo-400" />
                                    {resp.voteCount}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. LIVE Q&A RESULTS */}
                  {activeActivity.type === 'qa' && (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span>Audience Questions ({questions.length})</span>
                        <span>Sort: Most Popular</span>
                      </div>

                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2">
                        {questions.filter(q => q.status === 'approved').length === 0 ? (
                          <div className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                            <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                            <p className="text-sm font-medium">No approved questions submitted yet.</p>
                          </div>
                        ) : (
                          questions
                            .filter(q => q.status === 'approved')
                            .sort((a, b) => b.voteCount - a.voteCount)
                            .map((q) => (
                              <div key={q.id} className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-white">{q.text}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Asked by {q.participantName} • Upvotes: {q.voteCount}</p>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleGenerateAIDraftAnswer(q)}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 rounded-lg border border-violet-500/30 transition"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      <span>AI Answer</span>
                                    </button>
                                  </div>
                                </div>

                                {q.presenterAnswer && (
                                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-200">
                                    <span className="font-bold text-white">Presenter Answer: </span>
                                    {q.presenterAnswer}
                                  </div>
                                )}
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-slate-950/80 p-8 rounded-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[400px] text-center">
                  <BarChart2 className="w-12 h-12 text-slate-600 mb-3" />
                  <h3 className="text-lg font-bold text-white">No Active Activity Selected</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">Select an activity from the left sequence to launch it live for participants.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* FULL SCREEN CLASSROOM PRESENTATION SCREEN */}
        {activeTab === 'presentation' && (
          <div className="lg:col-span-12 bg-slate-950 p-8 rounded-2xl border border-slate-800 flex flex-col items-center text-center justify-between min-h-[600px] shadow-2xl">
            <div className="w-full flex items-center justify-between pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-extrabold uppercase tracking-widest">EzMindSphere Live</span>
                <h2 className="text-2xl font-black text-white">{session.title}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Join at homepage with code:</p>
                  <p className="text-3xl font-extrabold text-indigo-400 font-mono tracking-widest">{session.joinCode}</p>
                </div>
              </div>
            </div>

            {/* Active Activity Large Presentation View */}
            <div className="w-full max-w-4xl py-8 flex flex-col items-center">
              {activeActivity ? (
                <div className="w-full space-y-6">
                  <div className="text-center">
                    <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block">
                      {activeActivity.type.replace('_', ' ')}
                    </span>
                    <h3 className="text-3xl font-black text-white">{activeActivity.title}</h3>
                  </div>

                  {activeActivity.type === 'multiple_choice' && (
                    <div className="space-y-4 w-full">
                      {activeActivity.options?.map((opt) => {
                        const count = responses.filter(r => r.selectedOptionIds?.includes(opt.id)).length;
                        const total = Math.max(responses.length, 1);
                        const percentage = Math.round((count / total) * 100);

                        return (
                          <div key={opt.id} className="relative bg-slate-900 p-5 rounded-2xl border border-slate-800 overflow-hidden text-left">
                            <div
                              className="absolute top-0 bottom-0 left-0 bg-indigo-600/30 border-r-4 border-indigo-400 transition-all duration-700"
                              style={{ width: `${percentage}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between">
                              <span className="text-xl font-bold text-white">{opt.label}</span>
                              <span className="text-2xl font-black text-indigo-300 font-mono">{percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeActivity.type === 'open_ended' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {responses.map((r) => (
                        <div key={r.id} className="p-5 bg-slate-900/90 rounded-2xl border border-slate-800 text-left">
                          <p className="text-base text-white font-medium">{r.textResponse}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500">
                  <p className="text-xl font-bold">Lobby Open — Waiting for educator to launch first activity.</p>
                </div>
              )}
            </div>

            {/* Bottom Join Footer */}
            <div className="w-full pt-6 border-t border-slate-800 flex items-center justify-between text-slate-400 text-sm font-medium">
              <span>{participantsCount} participants connected live</span>
              <span className="font-mono text-indigo-400">{joinUrl}</span>
            </div>
          </div>
        )}

        {/* AI RESPONSE CLUSTERS TAB */}
        {activeTab === 'clusters' && (
          <div className="lg:col-span-12 flex flex-col gap-4">
            <div className="flex items-center justify-between bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  Gemini AI Semantic Response Clusters
                </h2>
                <p className="text-xs text-slate-400">Grouped student submissions by underlying themes, misconceptions, and follow-up discussion points.</p>
              </div>

              <button
                onClick={handleTriggerAICluster}
                disabled={isClustering}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white rounded-xl shadow-lg shadow-pink-500/20 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isClustering ? 'animate-spin' : ''}`} />
                <span>Re-cluster Themes</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="bg-slate-950/80 p-5 rounded-2xl border border-pink-500/30 flex flex-col justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-1 bg-pink-500/20 text-pink-300 rounded-lg text-xs font-bold border border-pink-500/30 uppercase tracking-wider mb-2 inline-block">
                      Theme Cluster
                    </span>
                    <h3 className="text-lg font-bold text-white">{cluster.label}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{cluster.summary}</p>

                    {cluster.keyIdeas && cluster.keyIdeas.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Ideas:</p>
                        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 mt-1">
                          {cluster.keyIdeas.map((idea, idx) => (
                            <li key={idx}>{idea}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {cluster.followUpQuestions && cluster.followUpQuestions.length > 0 && (
                      <div className="mt-3 p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl">
                        <p className="text-xs font-bold text-indigo-300">Suggested Discussion Prompts:</p>
                        <ul className="text-xs text-indigo-200 mt-1 space-y-1">
                          {cluster.followUpQuestions.map((fq, idx) => (
                            <li key={idx}>• "{fq}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUDIENCE Q&A MODERATION TAB */}
        {activeTab === 'qa' && (
          <div className="lg:col-span-12 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Live Audience Q&A Moderation</h2>
                  <p className="text-xs text-slate-400">Review, approve, answer, or delete audience questions live.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  {(['all', 'pending', 'approved', 'answered'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setQaFilter(filter)}
                      className={`px-3 py-1 rounded-lg capitalize font-medium transition ${
                        qaFilter === filter ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {filter} ({filter === 'all' ? questions.length : questions.filter(q => filter === 'pending' ? q.status === 'pending' : filter === 'approved' ? q.status === 'approved' : q.isAnswered).length})
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAddQuestionModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Discussion Prompt</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {questions
                .filter(q => {
                  if (qaFilter === 'pending') return q.status === 'pending';
                  if (qaFilter === 'approved') return q.status === 'approved';
                  if (qaFilter === 'answered') return q.isAnswered;
                  return true;
                })
                .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.voteCount - a.voteCount)
                .map(q => (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border transition flex flex-col gap-3 ${
                      q.isPinned
                        ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-500/10'
                        : q.status === 'pending'
                        ? 'bg-slate-950/90 border-slate-800 opacity-80'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                            q.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {q.status}
                          </span>
                          {q.isPinned && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30 flex items-center gap-1">
                              <Pin className="w-2.5 h-2.5" /> Pinned
                            </span>
                          )}
                          {q.isAnswered && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30">
                              Answered
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-medium">• Asked by {q.participantName}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white leading-relaxed">{q.text}</h3>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleModerateQuestion(q.id, { status: q.status === 'approved' ? 'pending' : 'approved' })}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                            q.status === 'approved' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                          }`}
                        >
                          {q.status === 'approved' ? 'Reject' : 'Approve'}
                        </button>

                        <button
                          onClick={() => handleModerateQuestion(q.id, { isPinned: !q.isPinned })}
                          className={`p-1.5 rounded-lg border transition ${
                            q.isPinned ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                          title={q.isPinned ? 'Unpin Question' : 'Pin Question'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleGenerateAIDraftAnswer(q)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 rounded-lg border border-violet-500/30 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI Answer</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                          title="Edit Question & Answer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-lg transition"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Published Presenter Answer */}
                    {q.presenterAnswer && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-200">
                        <span className="font-bold text-white">Educator Answer: </span>
                        {q.presenterAnswer}
                      </div>
                    )}

                    {/* Quick Answer Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Type answer to publish live..."
                        value={answerInputText[q.id] || ''}
                        onChange={e => setAnswerInputText({ ...answerInputText, [q.id]: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && answerInputText[q.id]?.trim()) {
                            handleModerateQuestion(q.id, {
                              presenterAnswer: answerInputText[q.id].trim(),
                              status: 'approved',
                              isAnswered: true
                            });
                            setAnswerInputText({ ...answerInputText, [q.id]: '' });
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => {
                          if (answerInputText[q.id]?.trim()) {
                            handleModerateQuestion(q.id, {
                              presenterAnswer: answerInputText[q.id].trim(),
                              status: 'approved',
                              isAnswered: true
                            });
                            setAnswerInputText({ ...answerInputText, [q.id]: '' });
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
                      >
                        Publish
                      </button>
                    </div>
                  </div>
                ))}
              {questions.length === 0 && (
                <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-medium">No audience questions submitted yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* AI DRAFT ANSWER MODAL */}
      {selectedQuestionForAI && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-bold text-white">Gemini AI Draft Answer</h3>
              </div>
              <button onClick={() => setSelectedQuestionForAI(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Student Question:</p>
              <p className="text-sm font-bold text-white mt-1">"{selectedQuestionForAI.text}"</p>
            </div>

            {isGeneratingAIDraft ? (
              <div className="py-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
                <p className="text-xs">Generating educator explanation & discussion prompts...</p>
              </div>
            ) : aiDraftAnswer ? (
              <div className="space-y-3">
                <div className="p-3 bg-violet-950/40 border border-violet-800/40 rounded-xl">
                  <p className="text-xs font-bold text-violet-300">Draft Explanation:</p>
                  <p className="text-xs text-violet-100 mt-1 leading-relaxed">{aiDraftAnswer.answer}</p>
                </div>

                {aiDraftAnswer.discussionPrompts?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400">Discussion Follow-ups:</p>
                    <ul className="list-disc list-inside text-xs text-slate-300 mt-1 space-y-1">
                      {aiDraftAnswer.discussionPrompts.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedQuestionForAI(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAIDraftAnswer}
                disabled={!aiDraftAnswer}
                className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-md transition disabled:opacity-50"
              >
                Publish Answer to Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW / EDIT ACTIVITY CREATION MODAL */}
      {showNewActivityModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                {editingActivity ? 'Edit Activity Question' : 'Add Activity / Poll to Session'}
              </h3>
              <button type="button" onClick={() => { setShowNewActivityModal(false); setEditingActivity(null); setModalTab('manual'); }} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Navigation Tabs (only when creating new) */}
            {!editingActivity && (
              <div className="flex border-b border-slate-800 -mt-1 pb-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalTab('manual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    modalTab === 'manual' 
                      ? 'bg-indigo-600 text-white shadow' 
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Manual Builder
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('import')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    modalTab === 'import' 
                      ? 'bg-emerald-600 text-white shadow' 
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  Paste & Import Poll(s)
                </button>
              </div>
            )}

            {modalTab === 'manual' ? (
              <form onSubmit={handleSaveActivity} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Activity Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewActType('multiple_choice')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                          newActType === 'multiple_choice' ? 'bg-violet-600 text-white border-violet-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        <BarChart2 className="w-4 h-4" />
                        Multiple Choice
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewActType('open_ended')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                          newActType === 'open_ended' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        Open Ended
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewActType('qa')}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                          newActType === 'qa' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        <HelpCircle className="w-4 h-4" />
                        Live Q&A
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Activity Title / Question</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Which factor most influences equilibrium?"
                      value={newActTitle}
                      onChange={e => setNewActTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description / Subtitle (Optional)</label>
                    <input
                      type="text"
                      placeholder="Additional context or guidance for students..."
                      value={newActDescription}
                      onChange={e => setNewActDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {newActType === 'multiple_choice' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Options</label>
                        <button
                          type="button"
                          onClick={() => setNewActOptions(prev => [...prev, `Option ${prev.length + 1}`])}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Option
                        </button>
                      </div>
                      {newActOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={correctOptionIndex === idx}
                            onChange={() => setCorrectOptionIndex(idx)}
                            className="accent-indigo-500"
                            title="Mark as Correct Option"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const val = e.target.value;
                              setNewActOptions(prev => prev.map((o, i) => i === idx ? val : o));
                            }}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                          />
                          {newActOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewActOptions(prev => prev.filter((_, i) => i !== idx));
                                if (correctOptionIndex === idx) setCorrectOptionIndex(0);
                              }}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Remove Option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setShowNewActivityModal(false); setEditingActivity(null); setModalTab('manual'); }}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
                  >
                    Save Activity with Session
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-indigo-400 font-bold mb-1">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Auto-Format Instructions:
                    </span>
                    <button
                      type="button"
                      onClick={() => setPastedImportText(
                        `Which planet is known as the Red Planet?\nA) Venus\nB) Mars *\nC) Jupiter\nD) Saturn\n\n---\n\nWhat is your main goal for today's interactive session?`
                      )}
                      className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
                    >
                      Load Sample Question
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Paste text with options (e.g. <code className="bg-slate-900 px-1 py-0.5 rounded text-slate-200">A) Option</code>, <code className="bg-slate-900 px-1 py-0.5 rounded text-slate-200">1. Option</code>). Mark correct answers with <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400">*</code> or <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400">(correct)</code>. Separate multiple questions with blank lines or <code className="bg-slate-900 px-1 py-0.5 rounded text-slate-200">---</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Paste Question & Options Text</label>
                  <textarea
                    rows={6}
                    value={pastedImportText}
                    onChange={e => setPastedImportText(e.target.value)}
                    placeholder={`e.g.\nWhat is the capital of France?\nA) London\nB) Paris *\nC) Berlin\nD) Madrid`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                {/* Parsed Live Preview */}
                {pastedImportText.trim() && (
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Detected Activities ({parsePastedTextToActivities(pastedImportText).length})
                      </span>
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ready to Save to Session
                      </span>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                      {parsePastedTextToActivities(pastedImportText).map((parsedItem, idx) => (
                        <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span className="text-slate-500">{idx + 1}.</span>
                            <span>{parsedItem.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal uppercase">
                              {parsedItem.type}
                            </span>
                          </p>
                          {parsedItem.options && parsedItem.options.length > 0 && (
                            <div className="grid grid-cols-2 gap-1 mt-1.5 pl-4">
                              {parsedItem.options.map((opt, oIdx) => (
                                <div key={oIdx} className={`text-[11px] truncate ${opt.isCorrect ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                  {String.fromCharCode(65 + oIdx)}) {opt.label} {opt.isCorrect && '✓'}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setShowNewActivityModal(false); setEditingActivity(null); setModalTab('manual'); }}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isImporting || parsePastedTextToActivities(pastedImportText).length === 0}
                    onClick={handleBatchImportActivities}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <Import className="w-3.5 h-3.5" />
                    <span>{isImporting ? 'Importing...' : `Import & Save ${parsePastedTextToActivities(pastedImportText).length} Activity(ies)`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT AUDIENCE QUESTION MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Edit Audience Question & Answer</h3>
              <button type="button" onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Question Text</label>
                <textarea
                  rows={3}
                  value={editingQuestionText}
                  onChange={e => setEditingQuestionText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Presenter Official Answer</label>
                <textarea
                  rows={3}
                  placeholder="Type an official answer to publish to all participants..."
                  value={editingPresenterAnswerText}
                  onChange={e => setEditingPresenterAnswerText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedQuestion}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRESENTER QUESTION PROMPT MODAL */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddPresenterQuestion} className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Add Educator Question / Discussion Prompt</h3>
              <button type="button" onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Prompt / Question Text</label>
              <textarea
                rows={3}
                required
                placeholder="e.g., How does increasing pressure affect liquid-gas equilibrium?"
                value={newQuestionText}
                onChange={e => setNewQuestionText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddQuestionModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md transition"
              >
                Post Prompt
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
