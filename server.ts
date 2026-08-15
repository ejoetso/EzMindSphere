/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Type } from '@google/genai';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { createHash } from 'crypto';
import { networkInterfaces } from 'os';
import * as fs from 'fs';

import QRCode from 'qrcode';

// Import our custom modules
import { db } from './src/server/db.js';
import { initWebSocketServer, broadcastToRoom } from './src/server/ws-handler.js';
import { 
  suggestNodes, generateSummary, generateQuiz, importMindmapFromFile, verifyMindMap, getGeminiClient,
  clusterOpenEndedResponses, generateAIDraftAnswer
} from './src/server/gemini.js';

dotenv.config();

const __filename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url)
  : '';
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

const JWT_SECRET = process.env.JWT_SECRET || 'mindsphere_secret_signature_key';
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mindsphere.local';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMeAdmin!';
const DEFAULT_EDUCATOR_USERNAME = process.env.EDUCATOR_USERNAME || 'ezmindsphere';
const DEFAULT_EDUCATOR_PASSWORD = process.env.EDUCATOR_PASSWORD || 'admin@123';
const LICENSE_CONTACT_EMAIL = 'eozoe2025@gmail.com';
const LICENSE_HASH_FILE = path.resolve(process.cwd(), 'config', 'license-key-hashes.json');
const LICENSE_ACTIVATION_FILE = path.resolve(process.cwd(), 'data', 'license-activation.json');

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

const verifyPassword = (password: string, storedHash?: string) => {
  if (!storedHash) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const storedKey = Buffer.from(keyHex, 'hex');
  const suppliedKey = scryptSync(password, salt, storedKey.length);
  return storedKey.length === suppliedKey.length && timingSafeEqual(storedKey, suppliedKey);
};

const publicUser = ({ credentialHash, ...user }: any) => user;

const getLicenseKeyHashes = (): string[] => {
  const environmentHashes = process.env.LICENSE_KEY_HASHES?.split(',').map(value => value.trim()).filter(Boolean);
  if (environmentHashes?.length) return environmentHashes;
  try {
    return JSON.parse(fs.readFileSync(LICENSE_HASH_FILE, 'utf-8')).hashes || [];
  } catch {
    return [];
  }
};

const getLicenseActivation = () => {
  try {
    return JSON.parse(fs.readFileSync(LICENSE_ACTIVATION_FILE, 'utf-8'));
  } catch {
    return null;
  }
};

const saveLicenseActivation = (activation: any) => {
  fs.mkdirSync(path.dirname(LICENSE_ACTIVATION_FILE), { recursive: true });
  fs.writeFileSync(LICENSE_ACTIVATION_FILE, JSON.stringify(activation, null, 2), 'utf-8');
};

const getLanIPv4 = () => {
  const virtualAdapterPattern = /virtual|vethernet|vmware|vbox|hyper-v|default switch|host-only|vpn|tap|loopback/i;
  const candidates = Object.entries(networkInterfaces())
    .flatMap(([interfaceName, addresses]) => (addresses || [])
      .filter(address => address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.'))
      .map(address => {
        const firstMacOctet = Number.parseInt(address.mac.split(':')[0] || '0', 16);
        let score = 0;
        if (/wlan|wi-?fi|wireless/i.test(interfaceName)) score += 100;
        if (/ethernet|以太网/i.test(interfaceName)) score += 50;
        if (address.address.startsWith('192.168.')) score += 30;
        else if (address.address.startsWith('10.')) score += 20;
        else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address.address)) score += 10;
        if (virtualAdapterPattern.test(interfaceName)) score -= 200;
        if ((firstMacOctet & 2) === 2) score -= 20;
        return { address: address.address, score };
      }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.address
    || '127.0.0.1';
};

const getShareBaseUrl = (req: any) => {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl && configuredUrl !== 'MY_APP_URL') {
    return configuredUrl.replace(/\/$/, '');
  }

  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (forwardedHost) {
    return `${forwardedProto || 'http'}://${forwardedHost}`;
  }

  const requestHost = String(req.headers.host || 'localhost:3000');
  const hostName = requestHost.replace(/^\[/, '').replace(/\].*$/, '').split(':')[0].toLowerCase();
  const protocol = req.protocol === 'https' ? 'https' : 'http';
  if (!['localhost', '127.0.0.1', '::1'].includes(hostName)) {
    return `${protocol}://${requestHost}`;
  }

  const port = requestHost.match(/:(\d+)$/)?.[1] || '3000';
  return `${protocol}://${getLanIPv4()}:${port}`;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure a local administrator exists. Override these defaults through .env.
  const existingAdmin = db.getUserByEmail(DEFAULT_ADMIN_EMAIL);
  if (!existingAdmin) {
    db.createUser({
      id: 'u_admin_1',
      name: 'MindSphere Administrator',
      email: DEFAULT_ADMIN_EMAIL,
      role: 'admin',
      credentialHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
    });
  } else if (existingAdmin.role === 'admin' && !existingAdmin.credentialHash) {
    db.updateUser(existingAdmin.id, { credentialHash: hashPassword(DEFAULT_ADMIN_PASSWORD) });
  }

  const existingDefaultEducator = db.getUserByEmail(DEFAULT_EDUCATOR_USERNAME);
  if (!existingDefaultEducator) {
    db.createUser({
      id: 'u_educator_ezmindsphere',
      name: 'EzMindSphere Educator',
      email: DEFAULT_EDUCATOR_USERNAME,
      role: 'educator',
      credentialHash: hashPassword(DEFAULT_EDUCATOR_PASSWORD),
      disabled: false,
    });
  } else if (!existingDefaultEducator.credentialHash) {
    db.updateUser(existingDefaultEducator.id, { credentialHash: hashPassword(DEFAULT_EDUCATOR_PASSWORD) });
  }

  app.get('/api/license/status', (_req, res) => {
    const activation = getLicenseActivation();
    res.json({
      activated: Boolean(activation?.activated),
      institution: activation?.institution || null,
      activatedAt: activation?.activatedAt || null,
      license: 'Free for eligible educational institutions',
      copyright: 'Copyright (c) 2026 Ejoe Tso',
      contactEmail: LICENSE_CONTACT_EMAIL,
    });
  });

  app.post('/api/license/activate', (req, res) => {
    const { key, institution, contactEmail } = req.body || {};
    if (!key || !institution) {
      return res.status(400).json({ error: 'Activation key and educational institution are required.' });
    }
    const normalizedKey = String(key).trim().toUpperCase();
    const submittedHash = createHash('sha256').update(normalizedKey).digest('hex');
    if (!getLicenseKeyHashes().includes(submittedHash)) {
      return res.status(403).json({ error: `Invalid activation key. Request a key from ${LICENSE_CONTACT_EMAIL}.` });
    }
    const activation = {
      activated: true,
      keyHash: submittedHash,
      institution: String(institution).trim(),
      contactEmail: String(contactEmail || '').trim(),
      activatedAt: new Date().toISOString(),
      license: 'Educational Institution License',
    };
    saveLicenseActivation(activation);
    res.json({ activated: true, institution: activation.institution, activatedAt: activation.activatedAt });
  });

  app.use('/api', (req, res, next) => {
    if (getLicenseActivation()?.activated) return next();
    return res.status(402).json({
      error: 'EzMindSphere requires activation.',
      contactEmail: LICENSE_CONTACT_EMAIL,
    });
  });

  // Helper middleware to verify JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      const databaseUser = db.getUser(user.id);
      if (!databaseUser || databaseUser.disabled) {
        return res.status(403).json({ error: 'Account is disabled or no longer exists' });
      }
      req.user = publicUser(databaseUser);
      next();
    });
  };

  // ==========================================
  // REST API: Authentication Endpoints
  // ==========================================
  
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    if (role === 'educator' || role === 'admin') {
      return res.status(403).json({ error: 'Educator and administrator accounts must be created by an administrator.' });
    }

    // Check if user already exists
    if (role === 'educator' && email) {
      const existing = (db as any).getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'Email address already registered. Please sign in.' });
      }
    }

    const userId = `u_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const user = db.createUser({ id: userId, name, role, email });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { name, role, email, password } = req.body;

    // Student dynamic login/access
    if (role === 'student' || name) {
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const userId = `u_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const user = db.createUser({ id: userId, name, role: 'student', email });
      const token = jwt.sign(
        { id: user.id, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      return res.json({ token, user });
    }

    // Educator login with email & password
    if (email) {
      // Look up in database
      let user = (db as any).getUserByEmail(email);

      // Special fallback: if they use the default teacher email but it isn't in JSON file yet
      if (!user && email.toLowerCase() === 'ejoe@ejoe.com') {
        user = db.createUser({
          id: 'u_educator_1',
          name: 'Dr. Evelyn Carter',
          role: 'educator',
          email: 'ejoe@ejoe.com'
        });
      }

      if (!user) {
        return res.status(400).json({ error: 'No educator account found with this email. Please register first.' });
      }

      if (user.disabled) {
        return res.status(403).json({ error: 'This account has been disabled. Contact an administrator.' });
      }

      const legacyPassword = email.toLowerCase() === 'ejoe@ejoe.com'
        ? '97807723!'
        : email.toLowerCase() === 'test@ejoe.com'
          ? 'P@ssw0rd1'
          : undefined;
      if (!verifyPassword(password || '', user.credentialHash) && password !== legacyPassword) {
        return res.status(401).json({ error: 'Incorrect credentials/password.' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({ token, user: publicUser(user) });
    }

    return res.status(400).json({ error: 'Invalid login request parameters.' });
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const user = db.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: publicUser(user) });
  });

  app.get('/api/educator/metrics', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'educator') {
      return res.status(403).json({ error: 'Educator access required' });
    }
    const ownedSessions = db.getSessions().filter(session => session.educatorId === req.user.id);
    const ownedLiveSessions = db.getLiveSessions().filter(session => session.ownerId === req.user.id);
    const activeStudentIds = new Set<string>();
    ownedSessions.forEach(session => {
      db.getParticipants(session.id)
        .filter(participant => participant.role === 'student' && participant.isConnected)
        .forEach(participant => activeStudentIds.add(participant.userId));
    });
    const recentCutoff = Date.now() - (30 * 60 * 1000);
    ownedLiveSessions.forEach(session => {
      db.getLiveParticipants(session.id)
        .filter(participant => !participant.isBlocked && new Date(participant.lastSeenAt).getTime() >= recentCutoff)
        .forEach(participant => activeStudentIds.add(participant.userId));
    });
    const assessmentCount = ownedLiveSessions.reduce((count, session) =>
      count + db.getLiveActivities(session.id).filter(activity => activity.type === 'multiple_choice').length, 0);

    res.json({
      activeStudents: activeStudentIds.size,
      assessments: assessmentCount,
      activeSessions: ownedSessions.filter(session => session.status === 'active').length
        + ownedLiveSessions.filter(session => ['lobby', 'live', 'paused'].includes(session.status)).length,
      totalSessions: ownedSessions.length + ownedLiveSessions.length,
    });
  });

  app.get('/api/config/share-url', (req: any, res) => {
    const baseUrl = getShareBaseUrl(req);
    const code = String(req.query.code || '').trim().toUpperCase().replace(/^(MIND|LIVE)-/, '');
    res.json({
      baseUrl,
      joinUrl: code ? `${baseUrl}/?code=${encodeURIComponent(code)}` : baseUrl,
    });
  });

  // ==========================================
  // REST API: Administrator Account Management
  // ==========================================

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  };

  app.get('/api/admin/users', authenticateToken, requireAdmin, (_req, res) => {
    res.json(db.getUsers().map(publicUser));
  });

  app.post('/api/admin/users', authenticateToken, requireAdmin, (req: any, res) => {
    const { name, email, password, role = 'educator' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (!['educator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Managed accounts must be educators or administrators.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (db.getUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const user = db.createUser({
      id: `u_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      credentialHash: hashPassword(password),
      disabled: false,
    });
    res.status(201).json(publicUser(user));
  });

  app.patch('/api/admin/users/:id', authenticateToken, requireAdmin, (req: any, res) => {
    const current = db.getUser(req.params.id);
    if (!current) return res.status(404).json({ error: 'Account not found.' });
    const { name, email, password, role, disabled } = req.body;
    if (role && !['educator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Managed accounts must be educators or administrators.' });
    }
    if (email && db.getUsers().some(u => u.id !== current.id && u.email?.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (current.id === req.user.id && (disabled === true || (role && role !== 'admin'))) {
      return res.status(400).json({ error: 'You cannot disable or demote your own administrator account.' });
    }
    const updated = db.updateUser(current.id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(disabled !== undefined ? { disabled: Boolean(disabled) } : {}),
      ...(password ? { credentialHash: hashPassword(password) } : {}),
    });
    res.json(publicUser(updated));
  });

  // ==========================================
  // REST API: Classroom Sessions Endpoints
  // ==========================================

  app.post('/api/sessions', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'educator') {
      return res.status(403).json({ error: 'Only educators can create mind-mapping sessions.' });
    }

    const { title, subject, description, studentCanEdit, approvalRequired, allowDownload, maxParticipants } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ error: 'Title and subject are required.' });
    }

    // Generate simple 4-digit session code (e.g., 4829)
    let code = Math.floor(1000 + Math.random() * 9000).toString();
    while (db.getSessionByCode(code)) {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    }

    const session = db.createSession({
      id: `session_${Date.now()}`,
      code,
      title,
      subject,
      description: description || '',
      status: 'active',
      educatorId: req.user.id,
      educatorName: req.user.name,
      settings: {
        studentCanEdit: studentCanEdit !== undefined ? studentCanEdit : true,
        approvalRequired: approvalRequired !== undefined ? approvalRequired : false,
        allowDownload: allowDownload !== undefined ? allowDownload : true,
        maxParticipants: maxParticipants || 50,
      },
      createdAt: new Date().toISOString(),
      activeLayout: 'force',
      activeEngagementMode: 'brainstorm',
    });

    db.addAuditLog(session.id, req.user.id, req.user.name, 'session:create', `Created classroom session: "${title}"`);

    res.status(201).json(session);
  });

  app.get('/api/sessions', authenticateToken, (req: any, res) => {
    // List active sessions
    const activeSessions = db.getSessions().filter(s => s.status === 'active');
    res.json(activeSessions);
  });

  app.get('/api/sessions/history', authenticateToken, (req: any, res) => {
    // Return all ended and active sessions that this user hosted or joined
    let sessions = db.getSessions();
    if (req.user.role === 'educator') {
      sessions = sessions.filter(s => s.educatorId === req.user.id);
    }
    res.json(sessions);
  });

  app.get('/api/sessions/:id', authenticateToken, (req, res) => {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  });

  app.get('/api/sessions/:id/nodes/:nodeId/comments', authenticateToken, (req, res) => {
    const comments = db.getComments(req.params.nodeId);
    res.json(comments);
  });

  app.patch('/api/sessions/:id', authenticateToken, (req: any, res) => {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.educatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the session educator can modify settings.' });
    }

    const updated = db.updateSession(req.params.id, req.body);
    res.json(updated);
  });

  app.delete('/api/sessions/:id', authenticateToken, (req: any, res) => {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role !== 'educator' && session.educatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only educators can delete map sessions.' });
    }

    const success = db.deleteSession(req.params.id);
    res.json({ success });
  });

  // Join session via code
  app.post('/api/sessions/join', (req: any, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Session join code is required.' });
    }

    const session = db.getSessionByCode(code);
    if (!session) {
      return res.status(404).json({ error: 'Active classroom session not found with this join code.' });
    }

    res.json({ session });
  });

  app.get('/api/sessions/:id/audit-logs', authenticateToken, (req, res) => {
    const logs = db.getAuditLogs(req.params.id);
    res.json(logs);
  });

  // Q&A Memo Pad API endpoints
  app.get('/api/sessions/:id/memos', (req, res) => {
    const memos = db.getQAMemos(req.params.id);
    res.json(memos);
  });

  app.post('/api/sessions/:id/memos', (req: any, res) => {
    const { question, category, color, authorId, authorName, authorRole } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question content is required for Q&A memo.' });
    }
    const memo = db.createQAMemo({
      id: `memo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessionId: req.params.id,
      authorId: authorId || 'guest',
      authorName: authorName || 'Anonymous',
      authorRole: authorRole || 'student',
      question: question.trim(),
      category: category || 'Question',
      color: color || '#fef08a',
      votes: [],
      isAnswered: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    broadcastToRoom(req.params.id, {
      event: 'memo:created',
      data: { memo }
    });

    res.json(memo);
  });

  app.patch('/api/sessions/:id/memos/:memoId', (req: any, res) => {
    const updated = db.updateQAMemo(req.params.memoId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Q&A memo not found' });
    }
    broadcastToRoom(req.params.id, {
      event: 'memo:updated',
      data: { memo: updated }
    });
    res.json(updated);
  });

  app.post('/api/sessions/:id/memos/:memoId/vote', (req: any, res) => {
    const { userId } = req.body;
    const voted = db.voteQAMemo(req.params.memoId, userId || 'guest');
    if (!voted) {
      return res.status(404).json({ error: 'Q&A memo not found' });
    }
    broadcastToRoom(req.params.id, {
      event: 'memo:updated',
      data: { memo: voted }
    });
    res.json(voted);
  });

  app.delete('/api/sessions/:id/memos/:memoId', (req: any, res) => {
    const success = db.deleteQAMemo(req.params.memoId);
    if (success) {
      broadcastToRoom(req.params.id, {
        event: 'memo:deleted',
        data: { memoId: req.params.memoId }
      });
    }
    res.json({ success });
  });

  // ==========================================
  // REST API: Mind Map Nodes & Edges
  // ==========================================

  app.get('/api/maps/:id', authenticateToken, (req, res) => {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const nodes = db.getNodes(sessionId);
    const edges = db.getEdges(sessionId);

    res.json({ session, nodes, edges });
  });

  // ==========================================
  // REST API: Optional Gemini AI Classroom features
  // ==========================================

  app.post('/api/maps/:id/suggest', authenticateToken, async (req: any, res) => {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const nodes = db.getNodes(sessionId);
    try {
      const suggestions = await suggestNodes(session.subject, session.title, nodes);
      res.json({ suggestions });
    } catch (err) {
      console.error('Gemini Suggestion error:', err);
      res.status(500).json({ error: 'Failed to generate concept suggestions.' });
    }
  });

  app.post('/api/maps/:id/summary', authenticateToken, async (req: any, res) => {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const nodes = db.getNodes(sessionId).filter(n => n.status === 'approved');
    try {
      const summaryMarkdown = await generateSummary(session.subject, session.title, nodes);
      res.json({ summaryMarkdown });
    } catch (err) {
      console.error('Gemini Summary generation error:', err);
      res.status(500).json({ error: 'Failed to compile study summary guide.' });
    }
  });

  app.post('/api/maps/:id/quiz', authenticateToken, async (req: any, res) => {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const nodes = db.getNodes(sessionId).filter(n => n.status === 'approved');
    try {
      const quiz = await generateQuiz(session.subject, session.title, nodes);
      res.json({ quiz });
    } catch (err) {
      console.error('Gemini Quiz generation error:', err);
      res.status(500).json({ error: 'Failed to generate multiple choice quiz.' });
    }
  });

  // Backward compatible and direct helper API endpoints for custom Client-side requests
  app.post('/api/ai/suggest', authenticateToken, async (req: any, res) => {
    const { topic, context } = req.body;
    try {
      const client = getGeminiClient();
      if (!client) {
        return res.json({
          suggestions: [
            `${topic} Core Concepts`,
            `${topic} Advanced Theories`,
            `${topic} Real-world Examples`,
            `${topic} Structural Analysis`,
            `${topic} Key Limits & Issues`
          ]
        });
      }

      const prompt = `You are a curriculum assistant.
Given the concept "${topic}" in the context of: "${context}", suggest exactly 5 sub-topics or adjacent concepts that students can explore.
Keep each concept extremely brief (1-3 words max).
Return the result as a raw JSON array of strings, like: ["Concept A", "Concept B", "Concept C", "Concept D", "Concept E"].`;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const text = response.text;
      if (text) {
        const suggestions = JSON.parse(text);
        return res.json({ suggestions });
      }
      throw new Error('Empty suggestions text');
    } catch (err) {
      console.error('API /api/ai/suggest error:', err);
      res.json({
        suggestions: [
          `${topic} Basics`,
          `${topic} Methods`,
          `${topic} Applications`,
          `${topic} Key Constraints`,
          `${topic} Resources`
        ]
      });
    }
  });

  app.post('/api/ai/summary', authenticateToken, async (req: any, res) => {
    const { nodes, topic } = req.body;
    try {
      const summaryMarkdown = await generateSummary('General Study', topic || 'Classroom Brainstorm', nodes || []);
      res.json({ summary: summaryMarkdown });
    } catch (err) {
      console.error('API /api/ai/summary error:', err);
      res.status(500).json({ error: 'Failed to compile study guide summary.' });
    }
  });

  app.post('/api/ai/quiz', authenticateToken, async (req: any, res) => {
    const { nodes, topic } = req.body;
    try {
      const quiz = await generateQuiz('General Study', topic || 'Classroom Brainstorm', nodes || []);
      res.json({ quiz });
    } catch (err) {
      console.error('API /api/ai/quiz error:', err);
      res.status(500).json({ error: 'Failed to generate study quiz.' });
    }
  });

  app.post('/api/maps/:id/import-file', authenticateToken, async (req: any, res) => {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { fileName, fileMimeType, base64Data } = req.body;
    if (!fileName || !fileMimeType || !base64Data) {
      return res.status(400).json({ error: 'Missing required file data.' });
    }

    try {
      const result = await importMindmapFromFile(session.subject, session.title, fileName, fileMimeType, base64Data);
      
      // Update session with AI-generated educator tips
      db.updateSession(sessionId, { educatorTips: result.educatorTips });

      // Clear existing map nodes & edges
      db.clearSessionNodesAndEdges(sessionId);

      // Map tempId -> real node details
      const tempToRealId = new Map<string, string>();
      
      const aiNodes = result.nodes;
      const rootNodeObj = aiNodes.find(n => !n.parentTempId) || aiNodes[0];

      if (!rootNodeObj) {
        return res.status(500).json({ error: 'Failed to extract a central theme concept from slides.' });
      }

      // Generate central node
      const rootRealId = `node_root_${sessionId}_${Date.now()}`;
      tempToRealId.set(rootNodeObj.tempId, rootRealId);

      db.createNode({
        id: rootRealId,
        sessionId,
        parentId: null,
        createdById: req.user.id,
        createdByName: req.user.name,
        title: rootNodeObj.title,
        description: rootNodeObj.description,
        color: rootNodeObj.color || '#3b82f6',
        icon: rootNodeObj.icon || '🏫',
        category: rootNodeObj.category || 'Central Topic',
        x: 0,
        y: 0,
        z: 0,
        votes: [],
        reactions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'approved'
      });

      // Find children of root
      const children = aiNodes.filter(n => n.parentTempId === rootNodeObj.tempId && n.tempId !== rootNodeObj.tempId);
      const N = children.length || 1;

      children.forEach((child, i) => {
        const childRealId = `node_sub_${sessionId}_${i}_${Date.now()}`;
        tempToRealId.set(child.tempId, childRealId);

        const angle = (2 * Math.PI * i) / N;
        const radius = 220;
        const x = Math.round(radius * Math.cos(angle));
        const y = Math.round(radius * Math.sin(angle));
        const z = Math.round(50 * Math.sin(i));

        db.createNode({
          id: childRealId,
          sessionId,
          parentId: rootRealId,
          createdById: req.user.id,
          createdByName: req.user.name,
          title: child.title,
          description: child.description,
          color: child.color || '#10b981',
          icon: child.icon || '💡',
          category: child.category || 'Subtopic',
          x,
          y,
          z,
          votes: [],
          reactions: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'approved'
        });

        db.createEdge({
          id: `edge_import_${sessionId}_${i}_${Date.now()}`,
          sessionId,
          source: rootRealId,
          target: childRealId,
          label: 'explores',
          color: child.color || '#10b981',
          thickness: 3,
          style: 'curved',
          createdAt: new Date().toISOString()
        });

        // Find grandchildren (leaves branching from this subtopic)
        const grandChildren = aiNodes.filter(n => n.parentTempId === child.tempId);
        const M = grandChildren.length || 1;

        grandChildren.forEach((gc, j) => {
          const gcRealId = `node_detail_${sessionId}_${i}_${j}_${Date.now()}`;
          tempToRealId.set(gc.tempId, gcRealId);

          const arcOffset = (Math.PI / 4) * (j - (M - 1) / 2);
          const gcAngle = angle + arcOffset;
          const gcRadius = 420;
          const gcX = Math.round(gcRadius * Math.cos(gcAngle));
          const gcY = Math.round(gcRadius * Math.sin(gcAngle));
          const gcZ = Math.round(z + 30 * Math.cos(j));

          db.createNode({
            id: gcRealId,
            sessionId,
            parentId: childRealId,
            createdById: req.user.id,
            createdByName: req.user.name,
            title: gc.title,
            description: gc.description,
            color: gc.color || '#f59e0b',
            icon: gc.icon || '⚙️',
            category: gc.category || 'Detail',
            x: gcX,
            y: gcY,
            z: gcZ,
            votes: [],
            reactions: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'approved'
          });

          db.createEdge({
            id: `edge_import_detail_${sessionId}_${i}_${j}_${Date.now()}`,
            sessionId,
            source: childRealId,
            target: gcRealId,
            label: 'details',
            color: gc.color || '#f59e0b',
            thickness: 2,
            style: 'solid',
            createdAt: new Date().toISOString()
          });
        });
      });

      // Catch-all for other nodes that might have custom relations
      aiNodes.forEach((n) => {
        if (!tempToRealId.has(n.tempId)) {
          const orphanRealId = `node_orphan_${sessionId}_${Date.now()}`;
          tempToRealId.set(n.tempId, orphanRealId);

          db.createNode({
            id: orphanRealId,
            sessionId,
            parentId: rootRealId,
            createdById: req.user.id,
            createdByName: req.user.name,
            title: n.title,
            description: n.description,
            color: n.color || '#cccccc',
            icon: n.icon || '📌',
            category: n.category || 'Concept',
            x: Math.round((Math.random() - 0.5) * 300),
            y: Math.round((Math.random() - 0.5) * 300 + 150),
            z: 0,
            votes: [],
            reactions: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'approved'
          });

          db.createEdge({
            id: `edge_import_orphan_${sessionId}_${Date.now()}`,
            sessionId,
            source: rootRealId,
            target: orphanRealId,
            label: 'relates to',
            color: '#cccccc',
            thickness: 2,
            style: 'dashed',
            createdAt: new Date().toISOString()
          });
        }
      });

      // Broadcast room-wide update so everyone connects to the newly synchronized nodes instantly!
      const updatedNodes = db.getNodes(sessionId);
      const updatedEdges = db.getEdges(sessionId);
      const updatedSession = db.getSession(sessionId);

      broadcastToRoom(sessionId, {
        event: 'map:sync',
        data: {
          sessionId,
          nodes: updatedNodes,
          edges: updatedEdges,
          session: updatedSession
        }
      });

      db.addAuditLog(sessionId, req.user.id, req.user.name, 'import', `Imported document "${fileName}" and generated ${updatedNodes.length} nodes`);

      res.json({
        success: true,
        nodes: updatedNodes,
        edges: updatedEdges,
        educatorTips: result.educatorTips
      });
    } catch (err) {
      console.error('File import REST error:', err);
      res.status(500).json({ error: 'Failed to process file and generate mind map nodes.' });
    }
  });

  app.post('/api/maps/:id/verify', authenticateToken, async (req: any, res) => {
    const sessionId = req.params.id;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const nodes = db.getNodes(sessionId).filter(n => n.status === 'approved');
    try {
      const auditResult = await verifyMindMap(session.subject, session.title, nodes);
      res.json(auditResult);
    } catch (err) {
      console.error('Mindmap verification API error:', err);
      res.status(500).json({ error: 'Failed to audit map completeness.' });
    }
  });

  // Create Node via REST API (Safeguard)
  app.post('/api/maps/:id/nodes', authenticateToken, (req: any, res) => {
    const sessionId = req.params.id;
    const { title, parentId, description, color, icon, category, x, y, z } = req.body;

    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const node = db.createNode({
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sessionId,
      parentId: parentId || null,
      createdById: req.user.id,
      createdByName: req.user.name,
      title: title || 'Untitled Node',
      description: description || '',
      color: color || '#10b981',
      icon: icon || '💡',
      category: category || 'Concept',
      x: x || 0,
      y: y || 0,
      z: z || 0,
      votes: [],
      reactions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: (req.user.role === 'student' && session.settings.approvalRequired) ? 'pending' : 'approved'
    });

    if (parentId) {
      db.createEdge({
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        sessionId,
        source: parentId,
        target: node.id,
        label: 'relates to',
        color: color || '#cccccc',
        thickness: 2,
        style: 'curved',
        createdAt: new Date().toISOString()
      });
    }

    res.status(201).json(node);
  });

  // ===================================================
  // MindSphere Live Interaction REST API Endpoints
  // ===================================================

  const requireLiveSessionOwner = (req: any, res: any, next: any) => {
    const session = db.getLiveSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'admin' && session.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the session owner can manage this live session.' });
    }
    req.liveSession = session;
    next();
  };

  // 1. Get List of Live Sessions
  app.get('/api/live/sessions', authenticateToken, (req: any, res) => {
    try {
      const allSessions = db.getLiveSessions();
      const sessions = req.user.role === 'admin'
        ? allSessions
        : allSessions.filter(session => session.ownerId === req.user.id);
      res.json(sessions);
    } catch (err) {
      console.error('Error fetching live sessions:', err);
      res.status(500).json({ error: 'Failed to fetch live sessions' });
    }
  });

  // 2. Create Live Interaction Session
  app.post('/api/live/sessions', authenticateToken, async (req: any, res) => {
    try {
      const { title, description, participationMode, pacingMode, moderationMode, participantLimit, linkedMindMapId, settings } = req.body;
      let joinCode = Math.floor(1000 + Math.random() * 9000).toString();
      while (db.getLiveSessionByCode(joinCode)) {
        joinCode = Math.floor(1000 + Math.random() * 9000).toString();
      }
      const sessionId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const effectivePacing = pacingMode || settings?.pacingMode || 'presenter';
      const effectiveParticipation = participationMode || (settings?.anonymousAllowed ? 'anonymous' : 'identified');
      const effectiveModeration = moderationMode || (settings?.preModeration ? 'pre_moderation' : 'none');

      const newSession = db.createLiveSession({
        id: sessionId,
        ownerId: req.user.id,
        ownerName: req.user.name,
        title: title || 'Live Interaction Session',
        description: description || 'Interactive session for live audience engagement.',
        joinCode,
        participationMode: effectiveParticipation as any,
        pacingMode: effectivePacing as any,
        status: 'draft',
        activeActivityId: null,
        resultsVisibility: settings?.resultsVisibility || 'live',
        moderationMode: effectiveModeration as any,
        participantLimit: participantLimit || 100,
        linkedMindMapId: linkedMindMapId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Generate default activities: Multiple Choice, Open Ended, Live Q&A
      const mcAct = db.createLiveActivity({
        id: `act_${Date.now()}_1`,
        sessionId,
        type: 'multiple_choice',
        title: 'Core Concept Check',
        description: 'Select the option that best describes your understanding.',
        position: 1,
        status: 'draft',
        resultVisibility: 'live',
        moderationMode: 'none',
        mcSettings: {
          isMultipleAnswer: false,
          allowAnswerChange: true,
          randomizeOrder: false,
          showCorrectAnswer: true,
          explanation: 'Option A highlights the primary mechanism.',
          deadlineSeconds: 60
        },
        options: [
          { id: `opt_1`, activityId: `act_${Date.now()}_1`, label: 'Primary Mechanism A (Recommended)', position: 1, isCorrect: true },
          { id: `opt_2`, activityId: `act_${Date.now()}_1`, label: 'Alternative Approach B', position: 2, isCorrect: false },
          { id: `opt_3`, activityId: `act_${Date.now()}_1`, label: 'Secondary Variable C', position: 3, isCorrect: false },
          { id: `opt_4`, activityId: `act_${Date.now()}_1`, label: 'Uncertain / Need Clarification', position: 4, isCorrect: false }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const openAct = db.createLiveActivity({
        id: `act_${Date.now()}_2`,
        sessionId,
        type: 'open_ended',
        title: 'Key Insights & Ideas',
        description: 'What is the most important takeaway or question from today?',
        position: 2,
        status: 'draft',
        resultVisibility: 'live',
        moderationMode: moderationMode || 'none',
        openEndedSettings: {
          answerMode: 'short',
          characterLimit: 280,
          allowMultipleResponses: true,
          enableVoting: true,
          profanityFilter: true,
          duplicateDetection: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const qaAct = db.createLiveActivity({
        id: `act_${Date.now()}_3`,
        sessionId,
        type: 'qa',
        title: 'Live Q&A Forum',
        description: 'Ask questions and vote on topics you want discussed.',
        position: 3,
        status: 'active',
        resultVisibility: 'live',
        moderationMode: moderationMode || 'none',
        qaSettings: {
          requireApproval: moderationMode === 'pre_moderation',
          allowAnonymousQuestions: true,
          enableUpvoting: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const joinUrl = `${getShareBaseUrl(req)}/?code=${encodeURIComponent(joinCode)}`;
      let qrCodeUrl = '';
      try {
        qrCodeUrl = await QRCode.toDataURL(joinUrl);
      } catch (e) {
        console.warn('QR code generation failed:', e);
      }

      res.status(201).json({
        session: newSession,
        activities: [mcAct, openAct, qaAct],
        qrCodeUrl,
        joinUrl
      });
    } catch (err) {
      console.error('Error creating live session:', err);
      res.status(500).json({ error: 'Failed to create live session' });
    }
  });

  // 3. Resolve Live Session by Code
  app.get('/api/live/code/:code', async (req: any, res) => {
    try {
      const code = req.params.code;
      const session = db.getLiveSessionByCode(code);
      if (!session) {
        return res.status(404).json({ error: 'Live session not found' });
      }

      const joinUrl = `${getShareBaseUrl(req)}/?code=${encodeURIComponent(session.joinCode)}`;
      let qrCodeUrl = '';
      try {
        qrCodeUrl = await QRCode.toDataURL(joinUrl);
      } catch (e) {}

      res.json({ session, qrCodeUrl, joinUrl });
    } catch (err) {
      console.error('Error resolving session code:', err);
      res.status(500).json({ error: 'Failed to resolve session code' });
    }
  });

  // 4. Get Full Details of Live Session
  app.get('/api/live/sessions/:id', async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const session = db.getLiveSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const activities = db.getLiveActivities(sessionId);
      const participants = db.getLiveParticipants(sessionId);
      const audienceQuestions = db.getAudienceQuestions(sessionId);
      const resultLinks = db.getResultLinks(sessionId);

      // Collect responses & clusters for all activities
      const responsesMap: { [activityId: string]: any[] } = {};
      const clustersMap: { [activityId: string]: any[] } = {};
      activities.forEach(a => {
        responsesMap[a.id] = db.getActivityResponses(a.id);
        clustersMap[a.id] = db.getResponseClusters(a.id);
      });

      const joinUrl = `${getShareBaseUrl(req)}/?code=${encodeURIComponent(session.joinCode)}`;
      let qrCodeUrl = '';
      try {
        qrCodeUrl = await QRCode.toDataURL(joinUrl);
      } catch (e) {}

      res.json({
        session,
        activities,
        participants,
        responsesMap,
        clustersMap,
        audienceQuestions,
        resultLinks,
        qrCodeUrl,
        joinUrl
      });
    } catch (err) {
      console.error('Error getting live session details:', err);
      res.status(500).json({ error: 'Failed to fetch session details' });
    }
  });

  // 5. Join Live Session as Participant
  app.post('/api/live/join', (req: any, res) => {
    try {
      const { code, displayName, anonymousToken } = req.body;
      if (!code) return res.status(400).json({ error: 'Join code or ID required' });

      const session = db.getLiveSessionByCode(code);
      if (!session) return res.status(404).json({ error: 'Live session not found' });

      if (session.status === 'completed' || session.status === 'archived') {
        return res.status(400).json({ error: 'This session has ended.' });
      }

      const token = anonymousToken || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const name = displayName?.trim() || `Participant #${token.slice(-4)}`;

      const participant = db.addOrUpdateLiveParticipant({
        id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        sessionId: session.id,
        userId: token,
        anonymousToken: token,
        displayName: name,
        joinedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });

      if (participant.isBlocked) {
        return res.status(403).json({ error: 'You have been removed from this session by the educator.' });
      }

      // Broadcast new participant join via WS
      broadcastToRoom(session.id, {
        event: 'live:presence',
        data: {
          sessionId: session.id,
          participantsCount: db.getLiveParticipants(session.id).filter(p => !p.isBlocked).length,
          newParticipantName: participant.displayName
        }
      });

      res.json({ session, participant });
    } catch (err) {
      console.error('Error joining live session:', err);
      res.status(500).json({ error: 'Failed to join live session' });
    }
  });

  // 6. Update Live Session State / Status
  app.patch('/api/live/sessions/:id', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const updates = req.body;
      const updated = db.updateLiveSession(sessionId, updates);
      if (!updated) return res.status(404).json({ error: 'Session not found' });

      // Broadcast update to room
      broadcastToRoom(sessionId, {
        event: 'live:session:update',
        data: { session: updated }
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating live session:', err);
      res.status(500).json({ error: 'Failed to update live session' });
    }
  });

  // 6b. Delete Live Session
  app.delete('/api/live/sessions/:id', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const deleted = db.deleteLiveSession(sessionId);
      if (!deleted) return res.status(404).json({ error: 'Session not found' });

      broadcastToRoom(sessionId, {
        event: 'live:session:deleted',
        data: { sessionId }
      });

      res.json({ success: true, message: 'Live session deleted successfully' });
    } catch (err) {
      console.error('Error deleting live session:', err);
      res.status(500).json({ error: 'Failed to delete live session' });
    }
  });

  // 7. Activities CRUD
  app.post('/api/live/sessions/:id/activities', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const { type, title, description, options, mcSettings, openEndedSettings, qaSettings } = req.body;
      const existingActs = db.getLiveActivities(sessionId);

      const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      const newAct = db.createLiveActivity({
        id: actId,
        sessionId,
        type,
        title: title || 'Untitled Activity',
        description: description || '',
        position: existingActs.length + 1,
        status: 'draft',
        resultVisibility: 'live',
        moderationMode: 'none',
        mcSettings,
        options: options ? options.map((o: any, idx: number) => ({
          id: `opt_${Date.now()}_${idx}`,
          activityId: actId,
          label: o.label || `Option ${idx + 1}`,
          position: idx + 1,
          isCorrect: !!o.isCorrect
        })) : undefined,
        openEndedSettings,
        qaSettings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      broadcastToRoom(sessionId, {
        event: 'live:activities:updated',
        data: { sessionId, activities: db.getLiveActivities(sessionId) }
      });

      res.status(201).json(newAct);
    } catch (err) {
      console.error('Error creating live activity:', err);
      res.status(500).json({ error: 'Failed to create activity' });
    }
  });

  app.post('/api/live/sessions/:id/activities/batch', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const { activities: newActsList } = req.body;
      if (!Array.isArray(newActsList) || newActsList.length === 0) {
        return res.status(400).json({ error: 'No activities provided in batch' });
      }

      const existingActs = db.getLiveActivities(sessionId);
      const createdItems: any[] = [];

      newActsList.forEach((actData: any, i: number) => {
        const actId = `act_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`;
        const newAct = db.createLiveActivity({
          id: actId,
          sessionId,
          type: actData.type || 'multiple_choice',
          title: actData.title || 'Untitled Activity',
          description: actData.description || '',
          position: existingActs.length + i + 1,
          status: 'draft',
          resultVisibility: 'live',
          moderationMode: 'none',
          mcSettings: actData.mcSettings,
          options: actData.options ? actData.options.map((o: any, idx: number) => ({
            id: `opt_${Date.now()}_${i}_${idx}`,
            activityId: actId,
            label: typeof o === 'string' ? o : (o.label || `Option ${idx + 1}`),
            position: idx + 1,
            isCorrect: typeof o === 'object' ? !!o.isCorrect : false
          })) : undefined,
          openEndedSettings: actData.openEndedSettings || (actData.type === 'open_ended' ? {
            answerMode: 'short',
            characterLimit: 280,
            allowMultipleResponses: true,
            enableVoting: true,
            profanityFilter: true,
            duplicateDetection: true
          } : undefined),
          qaSettings: actData.qaSettings || (actData.type === 'qa' ? {
            requireApproval: false,
            allowAnonymousQuestions: true,
            enableUpvoting: true
          } : undefined),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        createdItems.push(newAct);
      });

      broadcastToRoom(sessionId, {
        event: 'live:activities:updated',
        data: { sessionId, activities: db.getLiveActivities(sessionId) }
      });

      res.status(201).json({ activities: createdItems, allActivities: db.getLiveActivities(sessionId) });
    } catch (err) {
      console.error('Error batch creating live activities:', err);
      res.status(500).json({ error: 'Failed to create activities in batch' });
    }
  });

  app.patch('/api/live/sessions/:id/activities/:activityId', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const { id: sessionId, activityId } = req.params;
      const updates = req.body;

      if (updates.options && Array.isArray(updates.options)) {
        updates.options = updates.options.map((o: any, idx: number) => ({
          id: o.id || `opt_${Date.now()}_${idx}`,
          activityId,
          label: typeof o === 'string' ? o : (o.label || `Option ${idx + 1}`),
          position: idx + 1,
          isCorrect: typeof o === 'object' ? !!o.isCorrect : false
        }));
      }

      // If status changed to active, update session's activeActivityId
      if (updates.status === 'active') {
        db.updateLiveSession(sessionId, { activeActivityId: activityId, status: 'live' });
      }

      const updated = db.updateLiveActivity(activityId, updates);
      if (!updated) return res.status(404).json({ error: 'Activity not found' });

      broadcastToRoom(sessionId, {
        event: 'live:activities:updated',
        data: {
          sessionId,
          activeActivity: updated,
          activities: db.getLiveActivities(sessionId),
          session: db.getLiveSession(sessionId)
        }
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating activity:', err);
      res.status(500).json({ error: 'Failed to update activity' });
    }
  });

  app.delete('/api/live/sessions/:id/activities/:activityId', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const { id: sessionId, activityId } = req.params;
      db.deleteLiveActivity(activityId);
      broadcastToRoom(sessionId, {
        event: 'live:activities:updated',
        data: { sessionId, activities: db.getLiveActivities(sessionId) }
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting activity:', err);
      res.status(500).json({ error: 'Failed to delete activity' });
    }
  });

  // 8. Submit Activity Response (Participants)
  app.post('/api/live/sessions/:id/activities/:activityId/responses', (req: any, res) => {
    try {
      const { id: sessionId, activityId } = req.params;
      const { participantId, participantName, selectedOptionIds, textResponse } = req.body;

      const activity = db.getLiveActivity(activityId);
      if (!activity) return res.status(404).json({ error: 'Activity not found' });
      if (activity.status === 'closed' || activity.status === 'completed') {
        return res.status(400).json({ error: 'Activity submissions are closed.' });
      }

      const responseObj = db.submitActivityResponse({
        id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        activityId,
        participantId: participantId || 'anon',
        participantName: participantName || 'Anonymous Participant',
        selectedOptionIds,
        textResponse,
        moderationStatus: activity.moderationMode === 'pre_moderation' ? 'pending' : 'approved',
        voteCount: 0,
        votedBy: [],
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Broadcast response update
      const allResponses = db.getActivityResponses(activityId);
      broadcastToRoom(sessionId, {
        event: 'live:response:submitted',
        data: {
          sessionId,
          activityId,
          response: responseObj,
          totalResponsesCount: allResponses.length,
          responses: allResponses
        }
      });

      res.json(responseObj);
    } catch (err) {
      console.error('Error submitting response:', err);
      res.status(500).json({ error: 'Failed to submit response' });
    }
  });

  // Moderate Response
  app.patch('/api/live/sessions/:id/activities/:activityId/responses/:responseId', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const { id: sessionId, activityId, responseId } = req.params;
      const updates = req.body;
      const updated = db.updateActivityResponse(responseId, updates);
      if (!updated) return res.status(404).json({ error: 'Response not found' });

      broadcastToRoom(sessionId, {
        event: 'live:response:updated',
        data: {
          sessionId,
          activityId,
          response: updated,
          responses: db.getActivityResponses(activityId)
        }
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating response:', err);
      res.status(500).json({ error: 'Failed to update response' });
    }
  });

  // Delete Response
  app.delete('/api/live/sessions/:id/activities/:activityId/responses/:responseId', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const { id: sessionId, activityId, responseId } = req.params;
      db.deleteActivityResponse(responseId);

      const allResponses = db.getActivityResponses(activityId);
      broadcastToRoom(sessionId, {
        event: 'live:response:updated',
        data: {
          sessionId,
          activityId,
          responses: allResponses
        }
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting response:', err);
      res.status(500).json({ error: 'Failed to delete response' });
    }
  });

  // Vote on Open-Ended Response
  app.post('/api/live/sessions/:id/activities/:activityId/responses/:responseId/vote', (req: any, res) => {
    try {
      const { id: sessionId, activityId, responseId } = req.params;
      const { participantId } = req.body;
      const updated = db.voteActivityResponse(responseId, participantId || 'anon');

      broadcastToRoom(sessionId, {
        event: 'live:response:updated',
        data: {
          sessionId,
          activityId,
          response: updated,
          responses: db.getActivityResponses(activityId)
        }
      });

      res.json(updated);
    } catch (err) {
      console.error('Error voting on response:', err);
      res.status(500).json({ error: 'Failed to vote' });
    }
  });

  // 9. Submit Audience Question (Live Q&A)
  app.post('/api/live/sessions/:id/questions', (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const { participantId, participantName, isAnonymous, text } = req.body;

      const session = db.getLiveSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const newQuestion = db.submitAudienceQuestion({
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        sessionId,
        participantId: participantId || 'anon',
        participantName: isAnonymous ? 'Anonymous' : (participantName || 'Audience Member'),
        isAnonymous: !!isAnonymous,
        text: text?.trim() || '',
        status: session.moderationMode === 'pre_moderation' ? 'pending' : 'approved',
        voteCount: 0,
        votedBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      broadcastToRoom(sessionId, {
        event: 'live:question:submitted',
        data: {
          sessionId,
          question: newQuestion,
          questions: db.getAudienceQuestions(sessionId)
        }
      });

      res.status(201).json(newQuestion);
    } catch (err) {
      console.error('Error submitting question:', err);
      res.status(500).json({ error: 'Failed to submit question' });
    }
  });

  // Vote on Question
  app.post('/api/live/sessions/:id/questions/:questionId/vote', (req: any, res) => {
    try {
      const { id: sessionId, questionId } = req.params;
      const { participantId } = req.body;
      const updated = db.voteAudienceQuestion(questionId, participantId || 'anon');

      broadcastToRoom(sessionId, {
        event: 'live:question:voted',
        data: {
          sessionId,
          question: updated,
          questions: db.getAudienceQuestions(sessionId)
        }
      });

      res.json(updated);
    } catch (err) {
      console.error('Error voting on question:', err);
      res.status(500).json({ error: 'Failed to vote' });
    }
  });

  // Moderate Question (Approve, Pin, Answer, Highlight)
  app.patch('/api/live/sessions/:id/questions/:questionId', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const { id: sessionId, questionId } = req.params;
      const updates = req.body;
      if (updates.presenterAnswer) {
        updates.isAnswered = true;
        updates.answeredAt = new Date().toISOString();
      }

      const updated = db.updateAudienceQuestion(questionId, updates);
      if (!updated) return res.status(404).json({ error: 'Question not found' });

      broadcastToRoom(sessionId, {
        event: 'live:question:updated',
        data: {
          sessionId,
          question: updated,
          questions: db.getAudienceQuestions(sessionId)
        }
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating question:', err);
      res.status(500).json({ error: 'Failed to update question' });
    }
  });

  app.delete('/api/live/sessions/:id/questions/:questionId', authenticateToken, requireLiveSessionOwner, (req: any, res) => {
    try {
      const { id: sessionId, questionId } = req.params;
      db.deleteAudienceQuestion(questionId);

      broadcastToRoom(sessionId, {
        event: 'live:questions:updated',
        data: {
          sessionId,
          questions: db.getAudienceQuestions(sessionId)
        }
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting question:', err);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  });

  // 10. AI Clustering for Open-Ended Responses
  app.post('/api/live/sessions/:id/activities/:activityId/ai-cluster', authenticateToken, requireLiveSessionOwner, async (req: any, res) => {
    try {
      const { id: sessionId, activityId } = req.params;
      const activity = db.getLiveActivity(activityId);
      if (!activity) return res.status(404).json({ error: 'Activity not found' });

      const responses = db.getActivityResponses(activityId).filter(r => r.moderationStatus === 'approved');
      const textArray = responses.map(r => r.textResponse || '').filter(Boolean);

      if (textArray.length === 0) {
        return res.status(400).json({ error: 'No approved open-ended responses available to cluster.' });
      }

      const rawClusters = await clusterOpenEndedResponses(activity.title, textArray);

      const formattedClusters = rawClusters.map((c, i) => ({
        id: `cluster_${Date.now()}_${i}`,
        activityId,
        label: c.label,
        summary: c.summary,
        keyIdeas: c.keyIdeas || [],
        agreements: c.agreements || [],
        disagreements: c.disagreements || [],
        misconceptions: c.misconceptions || [],
        followUpQuestions: c.followUpQuestions || [],
        createdAt: new Date().toISOString()
      }));

      // Map cluster IDs back to responses
      rawClusters.forEach((c, idx) => {
        const clusterObj = formattedClusters[idx];
        c.matchedResponseIndices.forEach(respIdx => {
          if (responses[respIdx]) {
            db.updateActivityResponse(responses[respIdx].id, { clusterId: clusterObj.id });
          }
        });
      });

      db.createOrUpdateResponseClusters(activityId, formattedClusters);

      broadcastToRoom(sessionId, {
        event: 'live:clusters:updated',
        data: {
          sessionId,
          activityId,
          clusters: formattedClusters,
          responses: db.getActivityResponses(activityId)
        }
      });

      res.json({ clusters: formattedClusters, responses: db.getActivityResponses(activityId) });
    } catch (err) {
      console.error('Error in AI clustering endpoint:', err);
      res.status(500).json({ error: 'Failed to run AI response clustering' });
    }
  });

  // 11. AI Draft Answer for Question
  app.post('/api/live/sessions/:id/questions/:questionId/ai-answer', authenticateToken, requireLiveSessionOwner, async (req: any, res) => {
    try {
      const { id: sessionId, questionId } = req.params;
      const session = db.getLiveSession(sessionId);
      const question = db.getAudienceQuestion(questionId);
      if (!session || !question) return res.status(404).json({ error: 'Session or question not found' });

      const aiResult = await generateAIDraftAnswer(question.text, session.title);
      res.json(aiResult);
    } catch (err) {
      console.error('Error generating AI draft answer:', err);
      res.status(500).json({ error: 'Failed to generate draft answer' });
    }
  });

  // 12. Convert Live Interaction Results to MindSphere Mind Map Canvas
  app.post('/api/live/sessions/:id/convert-to-mindmap', authenticateToken, requireLiveSessionOwner, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const { targetMapId, activityId, convertType } = req.body; 
      // convertType: 'all' | 'activity' | 'clusters' | 'questions'

      const liveSession = db.getLiveSession(sessionId);
      if (!liveSession) return res.status(404).json({ error: 'Live session not found' });

      // Identify or create target MindSphere map session
      let mapSession = targetMapId ? db.getSession(targetMapId) : null;
      if (!mapSession) {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        mapSession = db.createSession({
          id: `map_${Date.now()}`,
          code,
          title: `Live Synthesis: ${liveSession.title}`,
          subject: 'Live Audience Interaction',
          description: `Synthesized MindSphere map generated from live interactive session (${liveSession.joinCode}).`,
          status: 'active',
          educatorId: req.user.id,
          educatorName: req.user.name,
          settings: {
            studentCanEdit: true,
            approvalRequired: false,
            allowDownload: true,
            maxParticipants: 100
          },
          createdAt: new Date().toISOString(),
          activeLayout: 'radial',
          activeEngagementMode: 'brainstorm',
          linkedLiveSessionId: sessionId
        });
      }

      const createdNodes: any[] = [];
      const createdEdges: any[] = [];

      // Create Central Root Node
      const rootNode = db.createNode({
        id: `node_root_${Date.now()}`,
        sessionId: mapSession.id,
        parentId: null,
        createdById: req.user.id,
        createdByName: req.user.name,
        title: liveSession.title,
        description: `Live Interaction Session (${liveSession.joinCode})`,
        color: '#3b82f6',
        icon: '🎯',
        category: 'Live Interaction',
        x: 0,
        y: 0,
        z: 0,
        votes: [],
        reactions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'approved',
        shape: 'ellipse'
      });
      createdNodes.push(rootNode);

      const activities = activityId ? [db.getLiveActivity(activityId)].filter(Boolean) as any[] : db.getLiveActivities(sessionId);

      let angleStep = (2 * Math.PI) / Math.max(activities.length, 1);

      activities.forEach((act, actIndex) => {
        const radius = 260;
        const actX = Math.round(Math.cos(actIndex * angleStep) * radius);
        const actY = Math.round(Math.sin(actIndex * angleStep) * radius);

        const actNode = db.createNode({
          id: `node_act_${act.id}`,
          sessionId: mapSession!.id,
          parentId: rootNode.id,
          createdById: req.user.id,
          createdByName: req.user.name,
          title: act.title,
          description: act.description || `Activity type: ${act.type}`,
          color: act.type === 'multiple_choice' ? '#8b5cf6' : act.type === 'open_ended' ? '#10b981' : '#f59e0b',
          icon: act.type === 'multiple_choice' ? '📊' : act.type === 'open_ended' ? '💡' : '❓',
          category: act.type === 'multiple_choice' ? 'Poll Results' : act.type === 'open_ended' ? 'Student Ideas' : 'Q&A Forum',
          x: actX,
          y: actY,
          z: 0,
          votes: [],
          reactions: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'approved',
          shape: 'rectangle'
        });
        createdNodes.push(actNode);

        const edge = db.createEdge({
          id: `edge_${rootNode.id}_${actNode.id}`,
          sessionId: mapSession!.id,
          source: rootNode.id,
          target: actNode.id,
          label: 'activity',
          color: '#cbd5e1',
          thickness: 2,
          style: 'curved',
          createdAt: new Date().toISOString()
        });
        createdEdges.push(edge);

        // Convert options/responses/clusters/questions under this activity node
        if (act.type === 'multiple_choice' && act.options) {
          const responses = db.getActivityResponses(act.id);
          const totalResp = Math.max(responses.length, 1);

          act.options.forEach((opt: any, optIdx: number) => {
            const count = responses.filter(r => r.selectedOptionIds?.includes(opt.id)).length;
            const pct = Math.round((count / totalResp) * 100);

            const childNode = db.createNode({
              id: `node_opt_${opt.id}`,
              sessionId: mapSession!.id,
              parentId: actNode.id,
              createdById: req.user.id,
              createdByName: req.user.name,
              title: `${opt.label} (${count} votes - ${pct}%)`,
              description: opt.isCorrect ? 'Correct Answer' : 'Option Choice',
              color: opt.isCorrect ? '#10b981' : '#64748b',
              icon: opt.isCorrect ? '✅' : '📌',
              category: 'Poll Option',
              x: actX + (optIdx % 2 === 0 ? -120 : 120),
              y: actY + 110 + (optIdx * 50),
              z: 0,
              votes: [],
              reactions: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'approved',
              shape: 'capsule'
            });
            createdNodes.push(childNode);

            db.createEdge({
              id: `edge_${actNode.id}_${childNode.id}`,
              sessionId: mapSession!.id,
              source: actNode.id,
              target: childNode.id,
              label: `${pct}%`,
              color: opt.isCorrect ? '#10b981' : '#e2e8f0',
              thickness: Math.max(1, Math.round(pct / 15)),
              style: 'solid',
              createdAt: new Date().toISOString()
            });
          });
        } else if (act.type === 'open_ended') {
          const clusters = db.getResponseClusters(act.id);
          const responses = db.getActivityResponses(act.id).filter(r => r.moderationStatus === 'approved');

          if (clusters.length > 0) {
            clusters.forEach((cluster, clIdx) => {
              const clusterNode = db.createNode({
                id: `node_cl_${cluster.id}`,
                sessionId: mapSession!.id,
                parentId: actNode.id,
                createdById: req.user.id,
                createdByName: req.user.name,
                title: `Theme: ${cluster.label}`,
                description: cluster.summary,
                color: '#ec4899',
                icon: '🧩',
                category: 'AI Theme Cluster',
                x: actX + (clIdx % 2 === 0 ? -180 : 180),
                y: actY + 140 + (clIdx * 70),
                z: 0,
                votes: [],
                reactions: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'approved',
                shape: 'cloud'
              });
              createdNodes.push(clusterNode);

              db.createEdge({
                id: `edge_${actNode.id}_${clusterNode.id}`,
                sessionId: mapSession!.id,
                source: actNode.id,
                target: clusterNode.id,
                label: 'cluster',
                color: '#f472b6',
                thickness: 2,
                style: 'dashed',
                createdAt: new Date().toISOString()
              });

              // Put responses of this cluster under cluster node
              const clusterResponses = responses.filter(r => r.clusterId === cluster.id);
              clusterResponses.forEach((resp, rIdx) => {
                const itemNode = db.createNode({
                  id: `node_resp_${resp.id}`,
                  sessionId: mapSession!.id,
                  parentId: clusterNode.id,
                  createdById: req.user.id,
                  createdByName: resp.participantName,
                  title: resp.textResponse || 'Student submission',
                  description: `Submitted by ${resp.participantName} (${resp.voteCount} votes)`,
                  color: '#38bdf8',
                  icon: '💬',
                  category: 'Student Submission',
                  x: clusterNode.x + (rIdx % 2 === 0 ? -80 : 80),
                  y: clusterNode.y + 80 + (rIdx * 45),
                  z: 0,
                  votes: [],
                  reactions: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  status: 'approved',
                  shape: 'rectangle'
                });
                createdNodes.push(itemNode);

                db.createEdge({
                  id: `edge_${clusterNode.id}_${itemNode.id}`,
                  sessionId: mapSession!.id,
                  source: clusterNode.id,
                  target: itemNode.id,
                  label: 'idea',
                  color: '#e2e8f0',
                  thickness: 1,
                  style: 'solid',
                  createdAt: new Date().toISOString()
                });
              });
            });
          } else {
            // Direct responses without clusters
            responses.slice(0, 10).forEach((resp, rIdx) => {
              const itemNode = db.createNode({
                id: `node_resp_${resp.id}`,
                sessionId: mapSession!.id,
                parentId: actNode.id,
                createdById: req.user.id,
                createdByName: resp.participantName,
                title: resp.textResponse || 'Student submission',
                description: `By ${resp.participantName} (${resp.voteCount} votes)`,
                color: '#38bdf8',
                icon: '💬',
                category: 'Student Submission',
                x: actX + (rIdx % 2 === 0 ? -160 : 160),
                y: actY + 120 + (rIdx * 50),
                z: 0,
                votes: [],
                reactions: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'approved',
                shape: 'rectangle'
              });
              createdNodes.push(itemNode);

              db.createEdge({
                id: `edge_${actNode.id}_${itemNode.id}`,
                sessionId: mapSession!.id,
                source: actNode.id,
                target: itemNode.id,
                label: 'submission',
                color: '#e2e8f0',
                thickness: 1,
                style: 'solid',
                createdAt: new Date().toISOString()
              });
            });
          }
        } else if (act.type === 'qa') {
          const questions = db.getAudienceQuestions(sessionId).filter(q => q.status === 'approved');
          questions.forEach((q, qIdx) => {
            const qNode = db.createNode({
              id: `node_q_${q.id}`,
              sessionId: mapSession!.id,
              parentId: actNode.id,
              createdById: req.user.id,
              createdByName: q.participantName,
              title: q.text,
              description: q.presenterAnswer ? `Answer: ${q.presenterAnswer}` : `Asked by ${q.participantName} (${q.voteCount} upvotes)`,
              color: q.isAnswered ? '#10b981' : '#f59e0b',
              icon: q.isAnswered ? '✅' : '❓',
              category: 'Audience Question',
              x: actX + (qIdx % 2 === 0 ? -180 : 180),
              y: actY + 120 + (qIdx * 65),
              z: 0,
              votes: [],
              reactions: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'approved',
              shape: 'diamond'
            });
            createdNodes.push(qNode);

            db.createEdge({
              id: `edge_${actNode.id}_${qNode.id}`,
              sessionId: mapSession!.id,
              source: actNode.id,
              target: qNode.id,
              label: q.isAnswered ? 'answered' : 'question',
              color: q.isAnswered ? '#10b981' : '#cbd5e1',
              thickness: 2,
              style: 'solid',
              createdAt: new Date().toISOString()
            });

            if (q.presenterAnswer) {
              const ansNode = db.createNode({
                id: `node_ans_${q.id}`,
                sessionId: mapSession!.id,
                parentId: qNode.id,
                createdById: req.user.id,
                createdByName: 'Educator Answer',
                title: `Answer: ${q.presenterAnswer}`,
                description: `Educator explanation`,
                color: '#059669',
                icon: '🎓',
                category: 'Educator Explanation',
                x: qNode.x,
                y: qNode.y + 60,
                z: 0,
                votes: [],
                reactions: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'approved',
                shape: 'capsule'
              });
              createdNodes.push(ansNode);

              db.createEdge({
                id: `edge_${qNode.id}_${ansNode.id}`,
                sessionId: mapSession!.id,
                source: qNode.id,
                target: ansNode.id,
                label: 'explanation',
                color: '#059669',
                thickness: 2,
                style: 'solid',
                createdAt: new Date().toISOString()
              });
            }
          });
        }
      });

      // Synchronize MindMap via WS
      broadcastToRoom(mapSession.id, {
        event: 'map:sync',
        data: {
          sessionId: mapSession.id,
          nodes: db.getNodes(mapSession.id),
          edges: db.getEdges(mapSession.id),
          session: mapSession
        }
      });

      db.addAuditLog(mapSession.id, req.user.id, req.user.name, 'convert_live', `Converted live interaction results into ${createdNodes.length} MindSphere nodes.`);

      res.json({
        success: true,
        mapSession,
        createdNodesCount: createdNodes.length,
        createdEdgesCount: createdEdges.length
      });
    } catch (err) {
      console.error('Error converting live results to mindmap:', err);
      res.status(500).json({ error: 'Failed to convert live interaction to mindmap canvas' });
    }
  });

  // 13. Export Live Interaction Session Analytics
  app.get('/api/live/sessions/:id/export', (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const format = req.query.format || 'json';
      const session = db.getLiveSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const activities = db.getLiveActivities(sessionId);
      const participants = db.getLiveParticipants(sessionId);
      const questions = db.getAudienceQuestions(sessionId);

      const exportData = {
        session,
        activities: activities.map(a => ({
          ...a,
          responses: db.getActivityResponses(a.id),
          clusters: db.getResponseClusters(a.id)
        })),
        participants,
        questions,
        exportedAt: new Date().toISOString()
      };

      if (format === 'csv') {
        let csv = `Session Title,${session.title}\nJoin Code,${session.joinCode}\nExported At,${new Date().toLocaleString()}\n\n`;
        csv += `Activity Title,Activity Type,Participant,Response / Choice,Votes,Submission Date\n`;

        activities.forEach(a => {
          const resps = db.getActivityResponses(a.id);
          resps.forEach(r => {
            const val = a.type === 'multiple_choice' 
              ? (r.selectedOptionIds || []).map(optId => a.options?.find(o => o.id === optId)?.label).join(' | ')
              : r.textResponse || '';
            csv += `"${a.title}","${a.type}","${r.participantName}","${val.replace(/"/g, '""')}",${r.voteCount},"${r.submittedAt}"\n`;
          });
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="mindsphere_live_${session.joinCode}.csv"`);
        return res.send(csv);
      }

      res.json(exportData);
    } catch (err) {
      console.error('Error exporting session:', err);
      res.status(500).json({ error: 'Failed to export session' });
    }
  });

  // ==========================================
  // WebSockets and Dev/Prod Server Bundling
  // ==========================================

  const server = http.createServer(app);
  
  // Attach native ws Server on the same HTTP server port
  const wss = new WebSocketServer({ noServer: true });
  initWebSocketServer(wss);

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Vite Integration: Serve frontend React client
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // The JSON database is runtime state, not frontend source. Watching it
        // reloads the page whenever a session is created or updated.
        watch: { ignored: ['**/data/**'] },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[EzMindSphere] running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Fatal server start error:', error);
});
