/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Play, Calendar, Users, ShieldAlert, CheckSquare, Settings, LogOut, ArrowLeft, Brain, Sparkles, BookOpen, Trash2, Radio, MessageSquare, QrCode, Clock3, ClipboardCheck } from 'lucide-react';
import { User, Session, LiveInteractionSession } from '../types.js';
import { LiveInteractionConsole } from './LiveInteractionConsole.js';

interface TeacherDashboardProps {
  currentUser: User;
  onLogout: () => void;
  onLaunchSession: (session: Session) => void;
  onBackToLanding: () => void;
  onLaunchLiveInteraction?: (sessionId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
  onLogout,
  onLaunchSession,
  onBackToLanding,
  onLaunchLiveInteraction,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveInteractionSession[]>([]);
  const [activeLiveSessionId, setActiveLiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showLiveCreateModal, setShowLiveCreateModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ activeStudents: 0, assessments: 0, activeSessions: 0, totalSessions: 0 });
  const [now, setNow] = useState(new Date());

  // Live session creation form
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDescription, setLiveDescription] = useState('');
  const [livePacing, setLivePacing] = useState<'educator_paced' | 'participant_paced'>('educator_paced');
  const [creatingLive, setCreatingLive] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [studentCanEdit, setStudentCanEdit] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch educator sessions history on mount
  useEffect(() => {
    fetchSessions();
    fetchLiveSessions();
    fetchMetrics();
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/educator/metrics', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}` }
      });
      if (response.ok) setMetrics(await response.json());
    } catch (err) {
      console.error('Error fetching educator metrics:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveSessions = async () => {
    try {
      const response = await fetch('/api/live/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLiveSessions(data);
      }
    } catch (err) {
      console.error('Error fetching live sessions:', err);
    }
  };

  const deleteSessionById = async (sessionId: string, isLiveSession: boolean = true) => {
    try {
      const endpoint = isLiveSession ? `/api/live/sessions/${sessionId}` : `/api/sessions/${sessionId}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        }
      });
      if (res.ok) {
        if (isLiveSession) {
          setLiveSessions(prev => prev.filter(s => s.id !== sessionId));
        } else {
          setSessions(prev => prev.filter(s => s.id !== sessionId));
        }
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to delete session.');
        return false;
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      return false;
    }
  };

  const handleDeleteLiveSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this live interaction session? All activities and participant data will be permanently removed.')) return;
    await deleteSessionById(sessionId, true);
  };

  const handleCreateLiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTitle.trim()) return;

    setCreatingLive(true);
    try {
      const res = await fetch('/api/live/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          title: liveTitle.trim(),
          description: liveDescription.trim(),
          settings: {
            pacingMode: livePacing,
            anonymousAllowed: true,
            preModeration: false,
            resultsVisibility: 'revealed'
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLiveSessions(prev => [data.session, ...prev]);
        setShowLiveCreateModal(false);
        setLiveTitle('');
        setLiveDescription('');
        setActiveLiveSessionId(data.session.id);
      }
    } catch (err) {
      console.error('Create live session error:', err);
    } finally {
      setCreatingLive(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteSessionById(sessionId, false);
    if (success) {
      setConfirmDeleteId(null);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) {
      setFormError('Session title and subject course are required.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`
        },
        body: JSON.stringify({
          title,
          subject,
          description,
          studentCanEdit,
          approvalRequired,
          allowDownload,
          maxParticipants
        })
      });

      if (response.ok) {
        const session = await response.json();
        onLaunchSession(session);
      } else {
        const errData = await response.json();
        setFormError(errData.error || 'Failed to initialize session.');
      }
    } catch (err) {
      console.error('Create session error:', err);
      setFormError('Server connection failed. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F5F9] dark:bg-slate-950 font-sans p-4 flex flex-col gap-4">
      
      {/* Dashboard Top Header */}
      <header className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="p-1 bg-blue-600 text-white rounded-lg">
                <Brain className="w-4 h-4" />
              </span>
              <span className="font-display font-bold text-slate-900 dark:text-slate-100">
                EzMindSphere
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 font-mono text-[10px] uppercase font-bold rounded">
                Educator
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{currentUser.name}</div>
              <div className="text-[10px] font-mono text-slate-400">Host Educator</div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-500 rounded-lg text-xs font-semibold transition-colors bg-white dark:bg-slate-900"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Live educator status infographic */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Current educator status">
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 shadow-lg shadow-emerald-500/15">
          <Users className="absolute -right-3 -bottom-3 w-20 h-20 opacity-15" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-50">Active Students</p>
          <p className="text-3xl font-black mt-1">{metrics.activeStudents}</p>
          <p className="text-[10px] text-emerald-100 mt-1">Connected in the last 30 minutes</p>
        </article>
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white p-4 shadow-lg shadow-violet-500/15">
          <ClipboardCheck className="absolute -right-3 -bottom-3 w-20 h-20 opacity-15" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-violet-50">Exams & Polls</p>
          <p className="text-3xl font-black mt-1">{metrics.assessments}</p>
          <p className="text-[10px] text-violet-100 mt-1">Multiple-choice assessments</p>
        </article>
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white p-4 shadow-lg shadow-blue-500/15">
          <Radio className="absolute -right-3 -bottom-3 w-20 h-20 opacity-15" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-blue-50">Active Sessions</p>
          <p className="text-3xl font-black mt-1">{metrics.activeSessions}</p>
          <p className="text-[10px] text-blue-100 mt-1">{metrics.totalSessions} total classrooms</p>
        </article>
        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white p-4 shadow-lg shadow-slate-900/20">
          <Clock3 className="absolute -right-3 -bottom-3 w-20 h-20 opacity-15" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-300">Local Time</p>
          <p className="text-2xl sm:text-3xl font-black mt-1 tabular-nums">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          <p className="text-[10px] text-slate-400 mt-1">{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        </article>
      </section>

      {/* If Educator opened a Live Interaction Console */}
      {activeLiveSessionId ? (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col p-4 overflow-y-auto">
          <LiveInteractionConsole
            sessionId={activeLiveSessionId}
            currentUser={currentUser}
            onCloseConsole={() => setActiveLiveSessionId(null)}
            onOpenMindMapCanvas={(mapId) => {
              setActiveLiveSessionId(null);
              // fetch and launch map session if requested
            }}
          />
        </div>
      ) : null}

      {/* NEW LIVE INTERACTION CREATION MODAL */}
      {showLiveCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateLiveSession} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">Create MindSphere Live Session</h3>
              </div>
              <button type="button" onClick={() => setShowLiveCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics Quantum Mechanics Live Poll & Q&A"
                  value={liveTitle}
                  onChange={e => setLiveTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description / Lecture Topic</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Live active learning polling on wave-particle duality and Heisenberg principle"
                  value={liveDescription}
                  onChange={e => setLiveDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pacing Mode</label>
                <select
                  value={livePacing}
                  onChange={e => setLivePacing(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="educator_paced">Educator Paced (Presenter controls question progression)</option>
                  <option value="participant_paced">Participant Paced (Students progress independently)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLiveCreateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingLive}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {creatingLive ? 'Creating...' : 'Launch Live Console'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Dashboard Layout */}
      <main className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        
        {/* Left Side: Setup Panel or active summary metrics */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain className="w-24 h-24" />
            </div>
            
            <h2 className="text-xl font-display font-bold">Classroom Central</h2>
            <p className="text-xs text-indigo-200 max-w-xs leading-relaxed">
              Launch modular 3D map workspaces or interactive live polls & Q&A.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-2.5 bg-white text-slate-900 font-semibold text-xs rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md shadow-white/5"
              >
                <Plus className="w-4 h-4" />
                Create Mind Map Session
              </button>

              <button
                onClick={() => setShowLiveCreateModal(true)}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Sparkles className="w-4 h-4" />
                Create Live Interaction Session
              </button>
            </div>
          </div>

          {/* Quick info / guide section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl space-y-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              Classroom Best Practices
            </h3>
            
            <div className="space-y-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <div>
                <strong className="text-slate-700 dark:text-slate-200 block mb-0.5">1. Seed Starter Nodes</strong>
                Our engine automatically adds core subtopics upon launch depending on your class topic, giving students a starting scaffold.
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-200 block mb-0.5">2. Enforce Moderation</strong>
                For larger classes (20+ students), check the <strong>Approval Required</strong> option to prevent map congestion.
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-200 block mb-0.5">3. 3D Spotlight Focus</strong>
                Use the spotlight trigger next to any node cards to automatically align student screens to that concept while lecturing.
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Primary Active Workspace or Create form */}
        <div className="lg:col-span-8 space-y-6">
          
          {showCreateForm ? (
            /* Creation Form Panel */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500 fill-blue-500/10" />
                  Configure Live Classroom Mind Map
                </h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormError('');
                  }}
                  className="text-xs font-semibold px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-5">
                {formError && (
                  <div className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-xs p-3.5 rounded-xl border border-red-100 dark:border-red-900/60 font-medium">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                      Classroom Subject / Course
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Python Programming"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                      Whiteboard Title / Main Theme
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Week 3 Data Structures"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                    Class Description / Student Guidelines
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter guiding points for students when they join. What topics are we mapping today?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* Permissions Safeguards Switches */}
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 p-4 rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 mb-2">
                    <Settings className="w-3.5 h-3.5 text-blue-500" />
                    Student Access Settings & Rules
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Can Edit Switch */}
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={studentCanEdit}
                        onChange={(e) => setStudentCanEdit(e.target.checked)}
                        className="mt-1 rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Allow Student Contributions</span>
                        <span className="text-[10px] text-slate-400 leading-normal block">Students can add, link, and comment on ideas live.</span>
                      </div>
                    </label>

                    {/* Moderation Required Switch */}
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={approvalRequired}
                        onChange={(e) => setApprovalRequired(e.target.checked)}
                        className="mt-1 rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Educator Approval Required</span>
                        <span className="text-[10px] text-slate-400 leading-normal block">Student ideas enter a moderation queue first.</span>
                      </div>
                    </label>

                    {/* Allow Downloads */}
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowDownload}
                        onChange={(e) => setAllowDownload(e.target.checked)}
                        className="mt-1 rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Allow Handout Exports</span>
                        <span className="text-[10px] text-slate-400 leading-normal block">Students can download the map as PNG images or summary PDF.</span>
                      </div>
                    </label>

                    {/* Max Seats */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Max Participant Slots</span>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                        className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-24 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormError('');
                    }}
                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/15 flex items-center gap-1.5 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Launch Live Mind Map Session
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Live Interaction Sessions Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold font-display text-slate-900 dark:text-slate-50 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    MindSphere Live Interaction Sessions
                  </h3>
                  <button
                    onClick={() => setShowLiveCreateModal(true)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Live Session</span>
                  </button>
                </div>

                {liveSessions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border-2 border-dashed border-slate-150 dark:border-slate-850/60 p-4">
                    <p className="text-xs text-slate-500">No live poll/Q&A sessions created yet.</p>
                    <button
                      onClick={() => setShowLiveCreateModal(true)}
                      className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
                    >
                      Create First Live Session
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {liveSessions.map((ls) => (
                      <div key={ls.id} className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-900 rounded-2xl flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-[9px] font-mono uppercase font-bold rounded">
                              CODE: {ls.joinCode}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono capitalize">Pacing: {ls.pacingMode || (ls as any).settings?.pacingMode || 'presenter'}</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">{ls.title}</h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveLiveSessionId(ls.id)}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Launch Presenter Console
                          </button>
                          <button
                            onClick={(e) => handleDeleteLiveSession(ls.id, e)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800/80 rounded-xl transition"
                            title="Delete Live Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions History Listing Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold font-display text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Your Classroom Workspace History
                </h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full">
                  {sessions.length} sessions
                </span>
              </div>

              {loading ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  Checking saved workspaces...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border-2 border-dashed border-slate-150 dark:border-slate-850/60 p-6">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No sessions hosted yet.</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    Once you start and complete collaborative lectures, your boards and student performance records will appear here.
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    Setup First Session
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {sessions.map((session) => {
                    const isActive = session.status === 'active';
                    return (
                      <div
                        key={session.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 bg-slate-50 hover:bg-slate-100/60 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200/60 dark:border-slate-900 rounded-2xl transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 text-[9px] font-mono uppercase font-bold rounded">
                              {session.subject}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                              CODE: {session.code}
                            </span>
                          </div>
                          
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-display">
                            {session.title}
                          </h4>
                          
                          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(session.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {session.settings.maxParticipants} max seats
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {confirmDeleteId === session.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/20 p-1.5 rounded-xl border border-red-200/50 dark:border-red-900/40">
                              <span className="text-[10px] text-red-600 dark:text-red-400 font-medium px-1">Delete map?</span>
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Yes, Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              {isActive ? (
                                <button
                                  onClick={() => onLaunchSession(session)}
                                  className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/10 transition-all"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  Resume Class
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-1 rounded">
                                    Completed
                                  </span>
                                  <button
                                    onClick={() => onLaunchSession(session)}
                                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    View Final Map
                                  </button>
                                </div>
                              )}
                              
                              <button
                                onClick={() => setConfirmDeleteId(session.id)}
                                className="p-2 border border-slate-200 dark:border-slate-800 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                                title="Delete Map Session"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </>
          )}

        </div>
      </main>

    </div>
  );
};
