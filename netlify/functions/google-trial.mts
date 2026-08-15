import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import jwt from 'jsonwebtoken';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const TRIAL_DAYS = 30;

type TrialRecord = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  startedAt: string;
  expiresAt: string;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GOOGLE_CLIENT_ID || !process.env.JWT_SECRET) return json({ error: 'Google trial is not configured' }, 503);

  try {
    const { credential } = await request.json();
    if (!credential) return json({ error: 'Google credential is required' }, 400);

    const verification = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verification.ok) return json({ error: 'Google identity verification failed' }, 401);
    const profile = await verification.json() as any;
    if (profile.aud !== GOOGLE_CLIENT_ID || profile.email_verified !== 'true') return json({ error: 'Google identity is not authorised' }, 401);

    const store = getStore('educator-trials');
    const key = `google-${profile.sub}`;
    let trial = await store.get(key, { type: 'json' }) as TrialRecord | null;
    if (!trial) {
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + TRIAL_DAYS * 86400000);
      trial = { sub: profile.sub, email: profile.email, name: profile.name || profile.email, picture: profile.picture, startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString() };
      await store.setJSON(key, trial);
    }

    const expired = Date.now() >= new Date(trial.expiresAt).getTime();
    if (expired) return json({ error: 'Your 30-day educator trial has expired', trialExpired: true, expiresAt: trial.expiresAt }, 403);
    const daysRemaining = Math.max(1, Math.ceil((new Date(trial.expiresAt).getTime() - Date.now()) / 86400000));
    const user = { id: `google-${trial.sub}`, name: trial.name, email: trial.email, role: 'educator', avatarUrl: trial.picture, trialStartedAt: trial.startedAt, trialExpiresAt: trial.expiresAt, trialDaysRemaining: daysRemaining };
    const token = jwt.sign({ userId: user.id, role: 'educator', trialExpiresAt: trial.expiresAt }, process.env.JWT_SECRET, { expiresIn: `${daysRemaining}d` });
    return json({ token, user, trial: { daysRemaining, startedAt: trial.startedAt, expiresAt: trial.expiresAt } });
  } catch (error) {
    console.error('Google trial sign-up failed', error);
    return json({ error: 'Unable to start Google educator trial' }, 500);
  }
};

export const config: Config = { path: '/api/auth/google-trial' };
