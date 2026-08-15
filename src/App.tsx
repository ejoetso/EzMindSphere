/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LandingView } from './components/LandingView.js';
import { LoginForm } from './components/LoginForm.js';
import { TeacherDashboard } from './components/TeacherDashboard.js';
import { SessionJoin } from './components/SessionJoin.js';
import { SessionRoom } from './components/SessionRoom.js';
import { StudySummaryView } from './components/StudySummaryView.js';
import { LiveInteractionParticipantView } from './components/LiveInteractionParticipantView.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { ActivationScreen } from './components/ActivationScreen.js';
import { TechStartupLanding } from './components/TechStartupLanding.js';
import { useRealtimeSession } from './hooks/useRealtimeSession.js';
import { User, Session } from './types.js';

export default function App() {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const isLandingHost = ['ezmindsphere.netlify.app', 'ezmindsphere.ejoetso.com'].includes(window.location.hostname);
  const isCloudApp = isLandingHost && currentPath === '/app';
  const isTechStartupPage = currentPath === '/techstartup' || (isLandingHost && currentPath !== '/app');
  // App views: 'landing' | 'login' | 'dashboard' | 'join' | 'room' | 'summary' | 'live-participant'
  const [view, setView] = useState<'landing' | 'login' | 'dashboard' | 'admin' | 'join' | 'room' | 'summary' | 'live-participant'>(isCloudApp ? 'login' : 'landing');
  const [authRole, setAuthRole] = useState<'educator' | 'student' | 'admin'>(isCloudApp ? 'educator' : 'student');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [prefilledJoinCode, setPrefilledJoinCode] = useState('');
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [licenseActivated, setLicenseActivated] = useState(false);

  // AI Summary & quiz details
  const [summaryMarkdown, setSummaryMarkdown] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);

  // Hook instance (holds full state of the active live whiteboard)
  const {
    session,
    nodes,
    edges,
    memos,
    activities,
    activeActivityId,
    participants,
    connected,
    spotlightNodeId,
    joinSession,
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
  } = useRealtimeSession();

  // 1. Initial validation of active JWT tokens & URL join code on mount
  useEffect(() => {
    // Auto-detect join code in URL (e.g., ?code=LIVE-1234 or ?joinCode=LIVE-1234)
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code') || urlParams.get('joinCode');
    if (codeParam) {
      handleJoinCodeEnter(codeParam);
    }

    const token = localStorage.getItem('mindsphere_token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  useEffect(() => {
    if (isCloudApp) {
      setLicenseActivated(true);
      setLicenseChecked(true);
      return;
    }
    fetch('/api/license/status')
      .then(response => response.json())
      .then(data => setLicenseActivated(Boolean(data.activated)))
      .catch(() => setLicenseActivated(false))
      .finally(() => setLicenseChecked(true));
  }, [isCloudApp]);

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        
        // Take them to relevant dashboard or lander
        if (data.user.role === 'admin') {
          setView('admin');
        } else if (data.user.role === 'educator') {
          setView('dashboard');
        } else {
          setView('landing');
        }
      } else {
        localStorage.removeItem('mindsphere_token');
      }
    } catch (err) {
      console.error('Session verify failed:', err);
    }
  };

  // 2. Auth handlers
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setView('admin');
    } else if (user.role === 'educator') {
      setView('dashboard');
    } else {
      setView('join');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mindsphere_token');
    setCurrentUser(null);
    setActiveSession(null);
    setView('landing');
  };

  // 3. Landing & Dashboard Navigation
  const handleJoinCodeEnter = async (code: string) => {
    setPrefilledJoinCode(code);
    // If code starts with LIVE or matches live session format, route to live interaction participant view
    if (code.toUpperCase().startsWith('LIVE-')) {
      setView('live-participant');
      return;
    }

    try {
      // Check if it's a live interaction session code
      const res = await fetch(`/api/live/code/${code}`);
      if (res.ok) {
        setView('live-participant');
        return;
      }
    } catch (e) {
      // ignore
    }

    setView('join');
  };

  const handleNavigateToLogin = (role: 'educator' | 'student' | 'admin') => {
    setAuthRole(role);
    setView('login');
  };

  const handleLaunchSession = (sessionObj: Session) => {
    setActiveSession(sessionObj);
    if (currentUser) {
      // Initialize real-time workspace hook connection
      joinSession(sessionObj.id, currentUser);
      setView('room');
    }
  };

  const handleStudentJoinSuccess = (sessionObj: Session, studentUser: User) => {
    setCurrentUser(studentUser);
    setActiveSession(sessionObj);
    joinSession(sessionObj.id, studentUser);
    setView('room');
  };

  const handleBackToLanding = () => {
    setView('landing');
  };

  const handleLeaveSession = () => {
    setActiveSession(null);
    if (currentUser?.role === 'educator') {
      setView('dashboard');
    } else {
      setView('landing');
    }
  };

  const handleNavigateToSummary = (summaryText: string, quizArr: any[]) => {
    setSummaryMarkdown(summaryText);
    setQuizQuestions(quizArr);
    setView('summary');
  };

  const handleBackToMap = () => {
    setView('room');
  };

  if (isTechStartupPage) {
    return <TechStartupLanding />;
  }

  if (!licenseChecked) {
    return <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center text-slate-400 text-sm">Checking EzMindSphere activation…</div>;
  }

  if (!licenseActivated) {
    return <ActivationScreen onActivated={() => setLicenseActivated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F3F5F9] dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {view === 'landing' && (
        <LandingView
          onJoinCodeEnter={handleJoinCodeEnter}
          onNavigateToLogin={handleNavigateToLogin}
        />
      )}

      {view === 'login' && (
        <LoginForm
          initialRole={authRole}
          onAuthSuccess={handleAuthSuccess}
          onBackToLanding={handleBackToLanding}
        />
      )}

      {view === 'dashboard' && currentUser && (
        <TeacherDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onLaunchSession={handleLaunchSession}
          onBackToLanding={handleBackToLanding}
        />
      )}

      {view === 'admin' && currentUser?.role === 'admin' && (
        <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />
      )}

      {view === 'join' && (
        <SessionJoin
          initialCode={prefilledJoinCode}
          onJoinSuccess={handleStudentJoinSuccess}
          onBackToLanding={handleBackToLanding}
        />
      )}

      {view === 'room' && activeSession && currentUser && (
        <SessionRoom
          session={session || activeSession}
          currentUser={currentUser}
          nodes={nodes}
          edges={edges}
          memos={memos}
          activities={activities}
          activeActivityId={activeActivityId}
          participants={participants}
          connected={connected}
          spotlightNodeId={spotlightNodeId}
          sendCursorMove={sendCursorMove}
          createNode={createNode}
          updateNode={updateNode}
          dragNode={dragNode}
          deleteNode={deleteNode}
          createEdge={createEdge}
          deleteEdge={deleteEdge}
          addComment={addComment}
          addReaction={addReaction}
          addVote={addVote}
          addMemo={addMemo}
          updateMemo={updateMemo}
          voteMemo={voteMemo}
          deleteMemo={deleteMemo}
          createActivity={createActivity}
          selectActivity={selectActivity}
          updateActivity={updateActivity}
          deleteActivity={deleteActivity}
          toggleLock={toggleLock}
          changeLayout={changeLayout}
          changeMode={changeMode}
          spotlightNode={spotlightNode}
          approveNode={approveNode}
          rejectNode={rejectNode}
          syncMapState={syncMapState}
          onLeaveSession={handleLeaveSession}
          onNavigateToSummary={handleNavigateToSummary}
        />
      )}

      {view === 'summary' && activeSession && (
        <StudySummaryView
          session={activeSession}
          nodes={nodes}
          edges={edges}
          summaryMarkdown={summaryMarkdown}
          quizQuestions={quizQuestions}
          onBackToMap={handleBackToMap}
        />
      )}

      {view === 'live-participant' && (
        <LiveInteractionParticipantView
          initialCode={prefilledJoinCode}
          onBackToHome={handleBackToLanding}
        />
      )}

    </div>
  );
}
