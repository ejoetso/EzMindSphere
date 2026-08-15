import React, { useState } from 'react';
import { CheckCircle2, KeyRound, Mail, School } from 'lucide-react';

interface ActivationScreenProps {
  onActivated: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivated }) => {
  const [key, setKey] = useState('');
  const [institution, setInstitution] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, institution, contactEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Activation failed.');
      onActivated();
    } catch (activationError: any) {
      setError(activationError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4">
      <section className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-3">
          <span className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20"><KeyRound className="w-7 h-7" /></span>
          <div><h1 className="text-2xl font-extrabold">Activate EzMindSphere</h1><p className="text-sm text-slate-400 mt-1">Free activation for eligible educational institutions.</p></div>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">{error}</div>}

        <form onSubmit={activate} className="space-y-4">
          <label className="block text-xs font-bold text-slate-300">Educational institution
            <div className="relative mt-1.5"><School className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input aria-label="Educational institution" value={institution} onChange={event => setInstitution(event.target.value)} required className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none" placeholder="School, college, university, or training centre" /></div>
          </label>
          <label className="block text-xs font-bold text-slate-300">Contact email
            <div className="relative mt-1.5"><Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input aria-label="Contact email" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none" placeholder="administrator@institution.edu" /></div>
          </label>
          <label className="block text-xs font-bold text-slate-300">Activation key
            <input aria-label="Activation key" value={key} onChange={event => setKey(event.target.value.toUpperCase())} required className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 outline-none font-mono tracking-wide" placeholder="EZMS-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" />
          </label>
          <button disabled={loading} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />{loading ? 'Activating…' : 'Activate Platform'}</button>
        </form>

        <div className="text-center text-xs text-slate-400 space-y-2 border-t border-slate-800 pt-5">
          <p>Need an activation key? Email <a className="text-indigo-400 hover:underline" href="mailto:eozoe2025@gmail.com?subject=EzMindSphere%20Educational%20Activation%20Key%20Request">eozoe2025@gmail.com</a>.</p>
          <p>Copyright © 2026 Ejoe Tso · Free for eligible educational institutions.</p>
        </div>
      </section>
    </main>
  );
};
