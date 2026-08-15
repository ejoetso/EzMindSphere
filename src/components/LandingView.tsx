/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Brain, ArrowRight, Layers, Users, Sparkles, Monitor, Clipboard, Eye, Download, CheckCircle, Smartphone, MessageSquare, QrCode } from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';

interface LandingViewProps {
  onJoinCodeEnter: (code: string) => void;
  onNavigateToLogin: (role: 'educator' | 'student' | 'admin') => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onJoinCodeEnter,
  onNavigateToLogin,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a session code.');
      return;
    }
    
    // Simple format validation: MIND-XXXX-XX or similar
    const cleanCode = code.trim().toUpperCase();
    onJoinCodeEnter(cleanCode);
  };

  return (
    <div id="landing-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-4 flex flex-col gap-4 overflow-x-hidden">
      
      {/* 1. Navbar */}
      <header className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-150 dark:border-slate-850 px-3 sm:px-6 py-3 sm:py-3.5 sticky top-2 sm:top-4 z-50">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="p-1.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl">
              <Brain className="w-5 h-5" />
            </span>
            <span className="font-display font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
              EzMindSphere
            </span>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button
              onClick={() => onNavigateToLogin('admin')}
              className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-xl transition-all text-violet-600 dark:text-violet-400"
            >
              Admin
            </button>
            <button
              onClick={() => onNavigateToLogin('student')}
              className="text-[10px] sm:text-xs font-semibold px-2 sm:px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-600 dark:text-slate-300"
            >
              <span className="sm:hidden">Student</span><span className="hidden sm:inline">Student Portal</span>
            </button>
            <button
              onClick={() => onNavigateToLogin('educator')}
              className="text-[10px] sm:text-xs font-semibold px-2.5 sm:px-4.5 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white rounded-xl shadow-sm transition-all"
            >
              <span className="sm:hidden">Educator</span><span className="hidden sm:inline">Educator Launchpad</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Segment */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
        
        {/* Left Intro Hero Copy */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Real-time Interactive Whiteboards</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-[48px] leading-[1.12] font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-50 break-words">
            Collaborative knowledge mapping for active classrooms.
          </h1>

          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
            Erase the limits of physical blackboards. Engage student devices simultaneously in infinite, high-fidelity 2D and 3D concept maps that stay synced, moderate easily, and compile into tailored study guides.
          </p>

          {/* Student Join Code Terminal Widget */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm max-w-md">
            <form onSubmit={handleJoin} className="space-y-3.5">
              <label className="block text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                Enter 4-Digit Session Code or Scan QR
              </label>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. 4829"
                  maxLength={10}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  className="flex-grow px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono text-sm uppercase tracking-widest rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="px-3.5 py-2.5 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                  title="Scan QR Code to access Mindmap / Session"
                >
                  <QrCode className="w-4 h-4 text-indigo-400" />
                  <span>Scan QR</span>
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  Join Session
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            </form>

            <QRScannerModal
              isOpen={isQRScannerOpen}
              onClose={() => setIsQRScannerOpen(false)}
              onScanSuccess={(scannedCode) => {
                setCode(scannedCode);
                onJoinCodeEnter(scannedCode);
              }}
              title="Scan QR Code to Access Mindmap"
            />
          </div>
        </div>

        {/* Right Graphic: Dynamic Visual comparison */}
        <div className="lg:col-span-5 relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-slate-200/50 to-blue-500/5 rounded-3xl blur-2xl pointer-events-none" />
          
          <div className="relative border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm overflow-hidden space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold font-display text-slate-900 dark:text-slate-100 uppercase tracking-wider">Active Workspace</span>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold uppercase bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live 3D Node Map
              </span>
            </div>

            {/* Static mini mockup vector of concept tree */}
            <div className="h-44 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center p-4 relative">
              <div className="absolute top-4 left-4 text-[9px] font-mono text-slate-400">Class Workspace Layout</div>
              
              <div className="flex flex-col items-center gap-4">
                <div className="px-4 py-1.5 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-950 rounded-xl text-xs font-bold font-display shadow-sm">
                  Programming Concepts
                </div>
                
                <div className="flex gap-4">
                  <div className="px-3 py-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-semibold">
                    Branch: Variables
                  </div>
                  <div className="px-3 py-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-semibold">
                    Branch: Methods
                  </div>
                </div>
              </div>
            </div>

            {/* Micro stats indicators */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">100%</div>
                <div className="text-[9px] font-mono uppercase text-slate-400 mt-1">Legibility</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">Infinite</div>
                <div className="text-[9px] font-mono uppercase text-slate-400 mt-1">Board Space</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">1-Click</div>
                <div className="text-[9px] font-mono uppercase text-slate-400 mt-1">Study Guide</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Physical Whiteboard Limitations vs. Ejoe MindSphere Digital Comparison Section */}
      <section className="bg-white dark:bg-slate-900/40 border-y border-slate-200/60 dark:border-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
              Solving the classic classroom blackboard problems
            </h2>
            <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500">
              How EzMindSphere transforms messy chalkboards into clear, structured, collaborative learning flows.
            </p>
          </div>

          {/* Minimalist Feature Matrix */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 text-[10px] font-mono uppercase text-slate-400 font-bold">
                  <th className="px-6 py-4">Capability</th>
                  <th className="px-6 py-4">Traditional Blackboard</th>
                  <th className="px-6 py-4 text-blue-600 dark:text-blue-400">EzMindSphere Platform</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-850">
                <tr>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">Typography & Clarity</td>
                  <td className="px-6 py-4 text-slate-400 dark:text-slate-500">Messy hand-drawn diagrams, seat distance glare</td>
                  <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">Pristine vector scaling, clean text cards</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">Whiteboard Canvas</td>
                  <td className="px-6 py-4 text-slate-400 dark:text-slate-500">Strictly limited physical space, frequent erasing</td>
                  <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">Infinite zoomable space, multiple map styles</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">Class Participation</td>
                  <td className="px-6 py-4 text-slate-400 dark:text-slate-500">One-way passive listening</td>
                  <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">Interactive student node proposals, upvotes & comments</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">Knowledge Retention</td>
                  <td className="px-6 py-4 text-slate-400 dark:text-slate-500">Wiped out at the end of class, lost forever</td>
                  <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">Syllabus audits, auto-saved handouts & study quizzes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. Feature Highlights Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20 space-y-12">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-50">
            Engineered for interactive lectures
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            Premium workspace features made for professional classroom instruction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento Card 1: 3D Visualization */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-7 space-y-3.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <span className="p-2 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 rounded-xl inline-block border border-slate-200/60 dark:border-slate-850">
              <Layers className="w-5 h-5" />
            </span>
            <h3 className="text-base font-semibold font-display">2D / 3D Spatial Sync</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Toggle layout modes instantly. Utilize the flat 2D workspace for collaborative brainstorming, and transition to orbit-guided 3D models for immersive class walkthroughs.
            </p>
          </div>

          {/* Bento Card 2: Student Moderation */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-7 space-y-3.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <span className="p-2 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 rounded-xl inline-block border border-slate-200/60 dark:border-slate-850">
              <Users className="w-5 h-5" />
            </span>
            <h3 className="text-base font-semibold font-display">Smarter Educator Controls</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Review student nodes in the moderation approval queue. Enforce whiteboard lock states, manage individual access levels, and track audit logs transparently.
            </p>
          </div>

          {/* Bento Card 3: Real-Time Node Discussions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-7 space-y-3.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <span className="p-2 bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-100 rounded-xl inline-block border border-slate-200/60 dark:border-slate-850">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h3 className="text-base font-semibold font-display">Active Threaded Discussions</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Post threaded comments directly on whiteboard nodes, select color emojis for interactive voting, and collaborate seamlessly in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 p-6 text-center text-xs text-slate-400 dark:text-slate-500 shadow-sm mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold font-display">
            <Brain className="w-4.5 h-4.5" />
            <span>EzMindSphere</span>
          </div>
          <p>Copyright © 2026 Ejoe Tso · EzMindSphere is free for eligible educational institutions.</p>
        </div>
      </footer>

    </div>
  );
};
