/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Send, CheckCircle2, HelpCircle, MessageSquare, ThumbsUp, ArrowLeft, 
  Sparkles, RefreshCw, AlertCircle, Edit2, Lock, Eye, LogOut, Check,
  ShieldCheck, QrCode
} from 'lucide-react';
import { 
  LiveInteractionSession, LiveActivity, ActivityOption, ActivityResponse, 
  AudienceQuestion 
} from '../types.js';
import { QRScannerModal } from './QRScannerModal.js';

interface LiveInteractionParticipantViewProps {
  initialCode?: string;
  onBackToHome?: () => void;
}

export const LiveInteractionParticipantView: React.FC<LiveInteractionParticipantViewProps> = ({
  initialCode = '',
  onBackToHome
}) => {
  // Join State
  const [joinCodeInput, setJoinCodeInput] = useState(initialCode);
  const [displayName, setDisplayName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  // Security Math Question State
  const [securityNum1, setSecurityNum1] = useState(0);
  const [securityNum2, setSecurityNum2] = useState(0);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Active Session State
  const [session, setSession] = useState<LiveInteractionSession | null>(null);
  const [participantToken, setParticipantToken] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [activeActivity, setActiveActivity] = useState<LiveActivity | null>(null);
  const [responses, setResponses] = useState<ActivityResponse[]>([]);
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);

  // Participant Form Input States
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submittedChoice, setSubmittedChoice] = useState<string | null>(null);
  const [openEndedText, setOpenEndedText] = useState('');
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [isQuestionAnon, setIsQuestionAnon] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'qa'>('activity');

  const generateSecurityQuestion = React.useCallback(() => {
    const num1 = Math.floor(Math.random() * 12) + 3; // e.g. 3 to 14
    const num2 = Math.floor(Math.random() * 12) + 2; // e.g. 2 to 13
    setSecurityNum1(num1);
    setSecurityNum2(num2);
    setSecurityAnswer('');
  }, []);

  useEffect(() => {
    generateSecurityQuestion();
  }, [generateSecurityQuestion]);

  useEffect(() => {
    // Check if joinCode provided in initial props or URL query
    if (initialCode) {
      setJoinCodeInput(initialCode.toUpperCase());
    }
  }, [initialCode]);

  useEffect(() => {
    if (!session) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        event: 'session:join',
        data: {
          sessionId: session.id,
          userId: participantToken,
          name: displayName || 'Participant',
          role: 'student'
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { event: evtName, data } = message;

        if (evtName === 'live:activity:activate' || evtName === 'live:activities:updated') {
          if (data.session) {
            setSession(data.session);
          }
          const act = data.activeActivity || (data.activities ? (data.activities.find((a: any) => a.id === (data.session?.activeActivityId || session?.activeActivityId)) || data.activities.find((a: any) => a.status === 'active') || data.activities[0]) : null);
          if (act) {
            setActiveActivity(act);
            setSubmittedChoice(null);
            setSelectedOptionId(null);
            setSubmittedText(null);
            fetchActivityDetails(act.id);
          }
        } else if (evtName === 'live:session:update') {
          setSession(data.session);
        } else if (evtName === 'live:session:deleted') {
          setSession(null);
          alert('This live interaction session has been removed by the educator.');
        } else if (evtName === 'live:response:submitted' || evtName === 'live:response:updated') {
          if (data.activityId === activeActivity?.id) {
            setResponses(data.responses);
          }
        } else if (evtName === 'live:question:submitted' || evtName === 'live:question:updated' || evtName === 'live:question:voted' || evtName === 'live:questions:updated') {
          setQuestions(data.questions);
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      ws.close();
    };
  }, [session?.id, participantToken, activeActivity?.id]);

  const handleAutoJoinByCode = async (code: string) => {
    setJoining(true);
    try {
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          displayName: isAnonymous ? undefined : displayName,
          anonymousToken: participantToken || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setParticipantToken(data.participant.anonymousToken);
        setParticipantId(data.participant.id);

        // Fetch full session details
        const detailsRes = await fetch(`/api/live/sessions/${data.session.id}`);
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          const activeAct = details.activities.find((a: any) => a.id === data.session.activeActivityId) || details.activities.find((a: any) => a.status === 'active') || details.activities[0];
          setActiveActivity(activeAct || null);
          setQuestions(details.audienceQuestions || []);
          if (activeAct) {
            setResponses(details.responsesMap[activeAct.id] || []);
          }
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Invalid session code.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error joining live session.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) {
      setErrorMsg('Please enter a session code.');
      return;
    }

    // Security Check: Validate math addition answer
    const expectedSum = securityNum1 + securityNum2;
    const userAnswer = parseInt(securityAnswer.trim(), 10);
    if (isNaN(userAnswer) || userAnswer !== expectedSum) {
      setErrorMsg(`Security Check Failed: Incorrect answer for ${securityNum1} + ${securityNum2}. Please try again.`);
      generateSecurityQuestion();
      return;
    }

    setErrorMsg('');
    setJoining(true);

    try {
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCodeInput.trim(),
          displayName: isAnonymous ? undefined : displayName,
          anonymousToken: participantToken || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setParticipantToken(data.participant.anonymousToken);
        setParticipantId(data.participant.id);

        // Fetch full session details
        const detailsRes = await fetch(`/api/live/sessions/${data.session.id}`);
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          const activeAct = details.activities.find((a: any) => a.id === data.session.activeActivityId) || details.activities.find((a: any) => a.status === 'active') || details.activities[0];
          setActiveActivity(activeAct || null);
          setQuestions(details.audienceQuestions || []);
          if (activeAct) {
            setResponses(details.responsesMap[activeAct.id] || []);
          }
        }
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to join session.');
        generateSecurityQuestion();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error joining session.');
      generateSecurityQuestion();
    } finally {
      setJoining(false);
    }
  };

  const fetchActivityDetails = async (actId: string) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/live/sessions/${session.id}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data.responsesMap[actId] || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMCOptionSelect = async (optionId: string) => {
    if (!session || !activeActivity) return;
    setSelectedOptionId(optionId);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/live/sessions/${session.id}/activities/${activeActivity.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantToken,
          participantName: isAnonymous ? 'Anonymous' : (displayName || 'Participant'),
          selectedOptionIds: [optionId]
        })
      });

      if (res.ok) {
        setSubmittedChoice(optionId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEndedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !activeActivity || !openEndedText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/live/sessions/${session.id}/activities/${activeActivity.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantToken,
          participantName: isAnonymous ? 'Anonymous' : (displayName || 'Participant'),
          textResponse: openEndedText.trim()
        })
      });

      if (res.ok) {
        setSubmittedText(openEndedText.trim());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !questionText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/live/sessions/${session.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantToken,
          participantName: isQuestionAnon ? 'Anonymous' : (displayName || 'Audience Member'),
          isAnonymous: isQuestionAnon,
          text: questionText.trim()
        })
      });

      if (res.ok) {
        setQuestionText('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoteQuestion = async (qId: string) => {
    if (!session) return;
    try {
      await fetch(`/api/live/sessions/${session.id}/questions/${qId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participantToken })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleVoteResponse = async (respId: string) => {
    if (!session || !activeActivity) return;
    try {
      await fetch(`/api/live/sessions/${session.id}/activities/${activeActivity.id}/responses/${respId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participantToken })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // 1. JOIN SCREEN
  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-4 overflow-x-hidden">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-5 sm:space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl shadow-lg shadow-indigo-500/20 mb-2">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Join MindSphere Live</h1>
            <p className="text-xs text-slate-400">Participate in real-time questions, polls, and Q&A from your device.</p>
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">4-Digit Session Code or Scan QR</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. 4829"
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-2xl px-3 sm:px-4 py-3 text-lg font-mono font-bold text-indigo-300 tracking-wider text-center focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="px-3 sm:px-4 py-3 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  title="Scan QR Code to join"
                >
                  <QrCode className="w-5 h-5 text-indigo-400" />
                  <span className="hidden sm:inline">Scan QR</span>
                </button>
              </div>
            </div>

            <QRScannerModal
              isOpen={isQRScannerOpen}
              onClose={() => setIsQRScannerOpen(false)}
              onScanSuccess={(scannedCode) => {
                setJoinCodeInput(scannedCode);
              }}
              title="Scan QR Code to Access Session"
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Name</label>
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`text-xs font-semibold ${isAnonymous ? 'text-indigo-400' : 'text-slate-400'}`}
                >
                  {isAnonymous ? '✓ Join Anonymously' : 'Identify Name'}
                </button>
              </div>

              {!isAnonymous && (
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>

            {/* Security Question Section */}
            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">Security Check</h3>
                    <p className="text-[10px] text-slate-400">Solve addition to enter the live vote system</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateSecurityQuestion}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                  title="Generate new security question"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex-1 text-center font-mono font-extrabold text-lg text-indigo-300 tracking-wider">
                  {securityNum1} + {securityNum2} =
                </div>
                <input
                  type="number"
                  required
                  placeholder="Answer"
                  value={securityAnswer}
                  onChange={e => setSecurityAnswer(e.target.value)}
                  className="w-24 bg-slate-950 border border-slate-700 focus:border-indigo-500 text-center font-mono font-bold text-lg text-white rounded-xl py-1.5 px-2 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{joining ? 'Connecting...' : 'Verify & Enter Live Vote System'}</span>
            </button>
          </form>

          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to MindSphere Platform</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. PARTICIPANT ACTIVE WORKSPACE
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Participant Top Header */}
      <header className="px-3 sm:px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 z-20 backdrop-blur-md">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <h1 className="text-sm font-bold text-white truncate">{session.title}</h1>
          </div>
          <p className="text-xs text-slate-400">Code: <span className="font-mono font-bold text-indigo-400">{session.joinCode}</span></p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 min-w-0">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold min-w-0">
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                activeTab === 'activity' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Poll / Activity
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                activeTab === 'qa' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Q&A
            </button>
          </div>

          <button
            onClick={() => setSession(null)}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
            title="Leave Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* PARTICIPANT CONTENT BODY */}
      <main className="flex-1 p-3 sm:p-4 max-w-lg mx-auto w-full flex flex-col justify-between min-w-0">
        
        {activeTab === 'activity' && (
          <div className="flex-1 flex flex-col gap-4">
            {activeActivity ? (
              <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col gap-5 min-w-0">
                
                {/* Activity Header */}
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                    {activeActivity.type.replace('_', ' ')}
                  </span>
                  <h2 className="text-xl font-extrabold text-white leading-snug">{activeActivity.title}</h2>
                  {activeActivity.description && (
                    <p className="text-xs text-slate-400">{activeActivity.description}</p>
                  )}
                </div>

                {/* 1. MULTIPLE CHOICE PARTICIPANT VOTE */}
                {activeActivity.type === 'multiple_choice' && (
                  <div className="space-y-3">
                    {activeActivity.options?.map((opt) => {
                      const isSelected = selectedOptionId === opt.id || submittedChoice === opt.id;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleMCOptionSelect(opt.id)}
                          disabled={isSubmitting || activeActivity.status === 'closed'}
                          className={`w-full p-4 rounded-2xl border text-left font-bold text-sm transition flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/25'
                              : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-5 h-5 text-white flex-shrink-0" />}
                        </button>
                      );
                    })}

                    {submittedChoice && (
                      <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 mt-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Response recorded! You can change your choice before voting closes.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. OPEN ENDED PARTICIPANT RESPONSE */}
                {activeActivity.type === 'open_ended' && (
                  <div className="space-y-4">
                    <form onSubmit={handleOpenEndedSubmit} className="space-y-3">
                      <div>
                        <textarea
                          rows={4}
                          maxLength={activeActivity.openEndedSettings?.characterLimit || 280}
                          placeholder="Type your response or idea here..."
                          value={openEndedText}
                          onChange={e => setOpenEndedText(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                        <div className="flex justify-end text-[10px] text-slate-500 mt-1 font-mono">
                          {openEndedText.length} / {activeActivity.openEndedSettings?.characterLimit || 280} chars
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !openEndedText.trim() || activeActivity.status === 'closed'}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                      >
                        {submittedText ? 'Update Submission' : 'Submit Response'}
                      </button>
                    </form>

                    {/* Community Submissions List */}
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classroom Submissions</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {responses.map((r) => (
                          <div key={r.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-start justify-between gap-3">
                            <p className="text-slate-200">{r.textResponse}</p>
                            <button
                              onClick={() => handleVoteResponse(r.id)}
                              className="flex items-center gap-1 font-mono text-slate-400 hover:text-indigo-400 transition"
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{r.voteCount}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center text-slate-400 my-auto">
                <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Lobby Mode</h3>
                <p className="text-xs text-slate-400 mt-1">Waiting for educator to launch the next interactive activity.</p>
              </div>
            )}
          </div>
        )}

        {/* Q&A FORUM TAB */}
        {activeTab === 'qa' && (
          <div className="flex-1 flex flex-col gap-4">
            <form onSubmit={handleSubmitQuestion} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ask a Question</h3>
              <textarea
                rows={3}
                placeholder="What would you like to ask the educator?"
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsQuestionAnon(!isQuestionAnon)}
                  className={`text-xs font-semibold ${isQuestionAnon ? 'text-indigo-400' : 'text-slate-400'}`}
                >
                  {isQuestionAnon ? '✓ Submit Anonymously' : 'Public Name'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !questionText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  Send Question
                </button>
              </div>
            </form>

            <div className="space-y-2 flex-1 overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Audience Questions</h3>
              {questions.filter(q => q.status === 'approved').map((q) => (
                <div key={q.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{q.text}</p>
                    <p className="text-[10px] text-slate-400 mt-1">By {q.participantName}</p>
                    {q.presenterAnswer && (
                      <div className="mt-2 p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-200">
                        <span className="font-bold text-white">Answer: </span>{q.presenterAnswer}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleVoteQuestion(q.id)}
                    className="flex flex-col items-center p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition font-mono text-xs text-indigo-300"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{q.voteCount}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
