/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Mail, Lock, User, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react';
import { User as UserType } from '../types.js';

interface LoginFormProps {
  initialRole: 'educator' | 'student' | 'admin';
  onAuthSuccess: (user: UserType) => void;
  onBackToLanding: () => void;
  hideBackToMain?: boolean;
  cloudTrialMode?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  initialRole,
  onAuthSuccess,
  onBackToLanding,
  hideBackToMain = false,
  cloudTrialMode = false,
}) => {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<'educator' | 'student' | 'admin'>(initialRole);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cloudTrialMode || !googleButtonRef.current) return;
    const clientId = '284628551012-gm69vbvlmmlg47ns6t8nigkfpk6arlde.apps.googleusercontent.com';
    const initialise = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleButtonRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }: { credential: string }) => {
          setError(''); setLoading(true);
          try {
            const response = await fetch('/api/auth/google-trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Google trial sign-up failed');
            localStorage.setItem('mindsphere_token', data.token);
            localStorage.setItem('mindsphere_trial', JSON.stringify(data.trial));
            onAuthSuccess(data.user);
          } catch (trialError: any) { setError(trialError.message || 'Google trial sign-up failed'); }
          finally { setLoading(false); }
        },
      });
      google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', text: 'signup_with', shape: 'pill', width: 336 });
    };
    if ((window as any).google?.accounts?.id) initialise();
    else {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = initialise; document.head.appendChild(script);
      return () => script.remove();
    }
  }, [cloudTrialMode, onAuthSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = '/api/auth/login'; // Registration disabled
    const payload = role === 'student' 
      ? { name, role } 
      : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        // Save token in storage
        localStorage.setItem('mindsphere_token', data.token);
        onAuthSuccess(data.user);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Authentication challenge failed. Please check entries.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Connection to server lost. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F5F9] dark:bg-slate-950 flex flex-col justify-between font-sans p-4 gap-4">
      
      {/* Top navbar */}
      {!hideBackToMain && <header className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 px-6 py-3">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main
        </button>
      </header>}

      {/* Main Authentication Box */}
      <main className="max-w-md w-full mx-auto p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6 my-auto">
        <div className="text-center space-y-2">
          <img src="/ezmindsphere-logo.png" alt="EzMindSphere" className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-lg" />
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
            {role === 'admin'
              ? 'Administrator Sign-In'
              : role === 'educator'
              ? (isRegistering ? 'Educator Sign-Up' : 'Educator Sign-In') 
              : 'Student Registration'}
          </h2>
          <p className="text-xs text-slate-400">
            {role === 'admin'
              ? 'Manage educator access and platform accounts.'
              : role === 'educator'
              ? 'Control and design real-time 3D learning graphs.' 
              : 'Sign in to access your teacher\'s interactive mind map.'}
          </p>
        </div>
        {cloudTrialMode && role === 'educator' && <div className="space-y-3"><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-900 dark:bg-blue-950/30"><p className="text-sm font-bold text-blue-900 dark:text-blue-200">30-day educator trial</p><p className="mt-1 text-xs text-blue-700 dark:text-blue-300">Register with Google for educator access. No activation key required.</p></div><div ref={googleButtonRef} className="flex min-h-11 justify-center" /><div className="flex items-center gap-3"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /><span className="text-[11px] uppercase tracking-wider text-slate-400">or sign in</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div></div>}

        {error && (
          <div className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-xs p-3.5 border border-red-100 dark:border-red-900/40 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Display Name Input (always shown for register or student login) */}
          {(isRegistering || role === 'student') && (
            <div>
              <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                Full Display Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Professor Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>
          )}

          {/* Email / Pass fields (educator only) */}
          {role !== 'student' && (
            <>
              <div>
                <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                  Email or Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="you@school.edu or ezmindsphere"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-1.5 font-bold">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all"
          >
            {loading ? 'Processing...' : (role === 'student' ? 'Access Board' : role === 'admin' ? 'Open Admin Console' : 'Sign In')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Educator Register/Login Toggle option */}
        {/* Registration disabled
        {role === 'educator' && (
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-xs text-blue-500 hover:underline font-medium"
            >
              {isRegistering ? 'Already registered? Sign In' : 'Need a Host Account? Sign Up'}
            </button>
          </div>
        )}
        */}

        {/* Change auth roles links */}
        <div className="text-center border-t border-slate-100 dark:border-slate-800/80 pt-4 text-[10px] text-slate-400">
          Sign in as{' '}
          {(['student', 'educator', 'admin'] as const).map((option, index) => (
            <React.Fragment key={option}>
              {index > 0 && ' · '}
              <button onClick={() => { setRole(option); setError(''); setIsRegistering(false); }} className={`${role === option ? 'text-slate-700 dark:text-slate-200' : 'text-blue-500 hover:underline'} font-semibold capitalize`}>
                {option}
              </button>
            </React.Fragment>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 flex items-center justify-center text-[10px] text-slate-400">
        Copyright © 2026 Ejoe Tso · Educational Institution License.
      </footer>

    </div>
  );
};
