/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, ArrowLeft, User, Key, Users, Sparkles, ShieldCheck, RefreshCw, QrCode } from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';

interface SessionJoinProps {
  initialCode?: string;
  onJoinSuccess: (session: any, studentUser: any) => void;
  onBackToLanding: () => void;
}

export const SessionJoin: React.FC<SessionJoinProps> = ({
  initialCode = '',
  onJoinSuccess,
  onBackToLanding,
}) => {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSession, setVerifiedSession] = useState<any | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  // Security Question state
  const [secNum1, setSecNum1] = useState(0);
  const [secNum2, setSecNum2] = useState(0);
  const [secAnswer, setSecAnswer] = useState('');

  const generateSecQuestion = useCallback(() => {
    const n1 = Math.floor(Math.random() * 12) + 3;
    const n2 = Math.floor(Math.random() * 12) + 2;
    setSecNum1(n1);
    setSecNum2(n2);
    setSecAnswer('');
  }, []);

  useEffect(() => {
    generateSecQuestion();
  }, [generateSecQuestion]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Join code is required.');
      return;
    }

    setError('');
    setIsVerifying(true);

    try {
      const response = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });

      if (response.ok) {
        const data = await response.json();
        setVerifiedSession(data.session);
      } else {
        // Fallback: Check if it is a Live Interaction session code
        const liveRes = await fetch(`/api/live/code/${code.trim()}`);
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          window.location.href = `/?code=${encodeURIComponent(liveData.session.joinCode)}`;
          return;
        }
        const errData = await response.json();
        setError(errData.error || 'Active session not found with this 4-digit code.');
      }
    } catch (err) {
      console.error('Session join code verification failed:', err);
      setError('Connection to server failed. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Display name is required.');
      return;
    }

    // Security Math Check
    const expected = secNum1 + secNum2;
    const userVal = parseInt(secAnswer.trim(), 10);
    if (isNaN(userVal) || userVal !== expected) {
      setError(`Security Check Failed: What is ${secNum1} + ${secNum2}? Please solve the addition question.`);
      generateSecQuestion();
      return;
    }

    setError('');
    setIsVerifying(true);

    try {
      // Create student session user
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role: 'student' })
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        localStorage.setItem('mindsphere_token', loginData.token);
        onJoinSuccess(verifiedSession, loginData.user);
      } else {
        const errData = await loginRes.json();
        setError(errData.error || 'Failed to authorize student name.');
      }
    } catch (err) {
      console.error('Login student error:', err);
      setError('Connection failed. Please retry.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F5F9] dark:bg-slate-950 flex flex-col justify-between font-sans p-4 gap-4">
      
      {/* Mini top header */}
      <header className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 px-6 py-3">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main
        </button>
      </header>

      {/* Main Join Flow Box */}
      <main className="max-w-md w-full mx-auto p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-lg space-y-6 my-auto">
        <div className="text-center space-y-2">
          <span className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl inline-block">
            <img src="/ezmindsphere-logo.png" alt="EzMindSphere" className="h-10 w-10 rounded-xl object-cover" />
          </span>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
            Join Collaborative Board
          </h2>
          <p className="text-xs text-slate-400">
            Enter details below to claim your active desk inside the live mind map.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-xs p-3.5 border border-red-100 dark:border-red-900/40 rounded-xl font-medium">
            {error}
          </div>
        )}

        {!verifiedSession ? (
          /* Step 1: Verification of Room Code */
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                4-Digit Classroom Join Code
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. 4829"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError('');
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono text-sm uppercase tracking-widest rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="px-3.5 py-2.5 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  title="Scan QR Code with Camera"
                >
                  <QrCode className="w-4 h-4 text-indigo-400" />
                  <span>Scan QR</span>
                </button>
              </div>
            </div>

            <QRScannerModal
              isOpen={isQRScannerOpen}
              onClose={() => setIsQRScannerOpen(false)}
              onScanSuccess={(scannedCode) => {
                setCode(scannedCode);
                setError('');
              }}
            />

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all"
            >
              Verify Session Room
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Step 2: Student Display Name Entrance */
          <form onSubmit={handleJoinClass} className="space-y-4">
            {/* Active Class Summary Tag */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/60 p-4 rounded-2xl space-y-1">
              <div className="text-[9px] font-mono text-blue-500 uppercase font-bold tracking-wider">Verified Class Session</div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-display">{verifiedSession.title}</h4>
              <p className="text-[10px] text-slate-400">{verifiedSession.subject} • Hosted by {verifiedSession.educatorName}</p>
            </div>

            <div>
              <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                Your Full Name (Display Label)
              </label>
              
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Alex Johnson"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Security Check Section */}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Security Check: Addition Verification</span>
                </div>
                <button
                  type="button"
                  onClick={generateSecQuestion}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  title="New question"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                <div className="flex-1 text-center font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                  {secNum1} + {secNum2} =
                </div>
                <input
                  type="number"
                  required
                  placeholder="Answer"
                  value={secAnswer}
                  onChange={e => setSecAnswer(e.target.value)}
                  className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-blue-500 text-center font-mono font-bold text-sm text-slate-800 dark:text-slate-100 rounded-lg py-1 px-2 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setVerifiedSession(null)}
                className="px-4.5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-semibold transition-colors"
              >
                Change Code
              </button>
              <button
                type="submit"
                disabled={isVerifying}
                className="flex-grow py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                Enter Workshop
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Informative list inside modal */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-slate-400 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Join with 50+ Peers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Real-time Sync</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 flex items-center justify-center text-[10px] text-slate-400">
        Copyright © 2026 Ejoe Tso · EzMindSphere classroom portal.
      </footer>

    </div>
  );
};
