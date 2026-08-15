import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Plus, RefreshCw, ShieldCheck, UserCog, Users } from 'lucide-react';
import { User } from '../types.js';

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('mindsphere_token')}`,
});

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'educator' | 'admin'>('educator');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setError('');
    const response = await fetch('/api/admin/users', { headers: authHeaders() });
    if (!response.ok) throw new Error((await response.json()).error || 'Unable to load accounts.');
    setUsers(await response.json());
  }, []);

  useEffect(() => {
    loadUsers().catch(err => setError(err.message));
  }, [loadUsers]);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create account.');
      setUsers(current => [...current, data]);
      setName('');
      setEmail('');
      setPassword('');
      setRole('educator');
      setMessage(`${data.name}'s account was created.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateAccount = async (user: User, updates: Record<string, unknown>) => {
    setError('');
    setMessage('');
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Unable to update account.');
      return;
    }
    setUsers(current => current.map(item => item.id === data.id ? data : item));
    setMessage(`${data.name}'s account was updated.`);
  };

  const resetPassword = async (user: User) => {
    const passwordValue = window.prompt(`Enter a new password for ${user.name} (minimum 8 characters):`);
    if (!passwordValue) return;
    await updateAccount(user, { password: passwordValue });
  };

  const managedUsers = users.filter(user => user.role === 'educator' || user.role === 'admin');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 text-slate-800 dark:text-slate-100">
      <header className="max-w-7xl mx-auto flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/ezmindsphere-logo.png" alt="EzMindSphere" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <h1 className="font-bold">MindSphere Administration</h1>
            <p className="text-xs text-slate-500">Signed in as {currentUser.name}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </header>

      <main className="max-w-7xl mx-auto mt-5 grid lg:grid-cols-[360px_1fr] gap-5">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-5"><Plus className="w-5 h-5 text-violet-600" /><h2 className="font-bold">Add account</h2></div>
          <form onSubmit={createAccount} autoComplete="off" className="space-y-4">
            <label className="block text-xs font-semibold">Full name<input aria-label="Full name" autoComplete="off" value={name} onChange={e => setName(e.target.value)} required className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" /></label>
            <label className="block text-xs font-semibold">Email<input aria-label="Email" type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" /></label>
            <label className="block text-xs font-semibold">Temporary password<input aria-label="Temporary password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" /></label>
            <label className="block text-xs font-semibold">Role<select aria-label="Role" value={role} onChange={e => setRole(e.target.value as 'educator' | 'admin')} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"><option value="educator">Educator</option><option value="admin">Administrator</option></select></label>
            <button disabled={busy} className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold">{busy ? 'Creating…' : 'Create account'}</button>
          </form>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Users className="w-5 h-5 text-violet-600" /><h2 className="font-bold">Account management</h2><span className="text-xs text-slate-400">{managedUsers.length}</span></div>
            <button onClick={() => loadUsers().catch(err => setError(err.message))} aria-label="Refresh accounts" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-xs">{error}</div>}
          {message && <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 text-xs">{message}</div>}
          <div className="space-y-3">
            {managedUsers.map(user => (
              <article key={user.id} className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className={`p-2.5 rounded-xl ${user.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{user.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <UserCog className="w-5 h-5" />}</span>
                <div className="min-w-0 flex-1"><p className="font-semibold truncate">{user.name}</p><p className="text-xs text-slate-500 truncate">{user.email}</p><p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{user.role} · {user.disabled ? 'Disabled' : 'Active'}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => resetPassword(user)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">Reset password</button>
                  <button disabled={user.id === currentUser.id} onClick={() => updateAccount(user, { disabled: !user.disabled })} className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 ${user.disabled ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'}`}>{user.disabled ? 'Enable' : 'Disable'}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
