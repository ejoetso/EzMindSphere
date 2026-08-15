import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import jwt from 'jsonwebtoken';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!process.env.JWT_SECRET) return json({ error: 'Cloud authentication is not configured' }, 503);

  try {
    const { name, role, email, password } = await request.json();

    if (role === 'student' || name) {
      if (!name?.trim()) return json({ error: 'Name is required' }, 400);
      const user = { id: `u_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`, name: name.trim(), role: 'student' as const };
      const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return json({ token, user });
    }

    const login = String(email || '').trim().toLowerCase();
    const educatorLogin = (process.env.EDUCATOR_USERNAME || 'ezmindsphere').toLowerCase();
    const educatorPassword = process.env.EDUCATOR_PASSWORD || 'admin@123';
    const adminLogin = (process.env.ADMIN_EMAIL || 'ejoe@ejoe.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '97807723!';

    let user: { id: string; name: string; email: string; role: 'educator' | 'admin' } | null = null;
    if (login === educatorLogin && password === educatorPassword) {
      user = { id: 'u_educator_ezmindsphere', name: 'EzMindSphere Educator', email: educatorLogin, role: 'educator' };
    } else if (login === adminLogin && password === adminPassword) {
      user = { id: 'u_admin_ejoe', name: 'Ejoe Tso', email: adminLogin, role: 'admin' };
    }

    if (!user && login) {
      const state = await getStore('cloud-platform').get('state', { type: 'json', consistency: 'strong' }) as any;
      const managed = state?.users?.find((item: any) => item.email === login);
      if (managed && !managed.disabled && managed.passwordHash === await hash(String(password || ''))) user = { id: managed.id, name: managed.name, email: managed.email, role: managed.role };
    }

    if (!user) return json({ error: 'Incorrect credentials/password.' }, 401);
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return json({ token, user });
  } catch {
    return json({ error: 'Invalid login request' }, 400);
  }
};

export const config: Config = { path: '/api/auth/login' };
