import type { Config } from '@netlify/functions';
import jwt from 'jsonwebtoken';

const json = (body: unknown, status = 200) => Response.json(body, { status });

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!process.env.JWT_SECRET) return json({ error: 'Cloud authentication is not configured' }, 503);

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return json({ error: 'Access token required' }, 401);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
    const id = payload.id || payload.userId;
    if (!id || !payload.role) return json({ error: 'Invalid token' }, 403);
    return json({ user: { id, name: payload.name || (payload.role === 'educator' ? 'EzMindSphere Educator' : 'EzMindSphere User'), email: payload.email, role: payload.role, trialExpiresAt: payload.trialExpiresAt } });
  } catch {
    return json({ error: 'Invalid or expired token' }, 403);
  }
};

export const config: Config = { path: '/api/auth/me' };
