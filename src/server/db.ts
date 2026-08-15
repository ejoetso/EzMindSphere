/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  User, Session, MindMapNode, MindMapEdge, Comment, SessionParticipant, UserRole, QAMemo,
  LiveInteractionSession, LiveActivity, LiveParticipant, ActivityResponse, AudienceQuestion,
  ResponseCluster, MindSphereResultLink, MindMapActivity
} from '../types.js';

interface DBStructure {
  users: User[];
  sessions: Session[];
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  comments: Comment[];
  participants: SessionParticipant[];
  auditLogs: any[];
  qaMemos: QAMemo[];
  mindMapActivities?: MindMapActivity[];
  liveSessions?: LiveInteractionSession[];
  liveActivities?: LiveActivity[];
  liveParticipants?: LiveParticipant[];
  activityResponses?: ActivityResponse[];
  audienceQuestions?: AudienceQuestion[];
  responseClusters?: ResponseCluster[];
  resultLinks?: MindSphereResultLink[];
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DB_DIR, 'mindsphere_db.json');

class Database {
  private data: DBStructure = {
    users: [],
    sessions: [],
    nodes: [],
    edges: [],
    comments: [],
    participants: [],
    auditLogs: [],
    qaMemos: [],
    liveSessions: [],
    liveActivities: [],
    liveParticipants: [],
    activityResponses: [],
    audienceQuestions: [],
    responseClusters: [],
    resultLinks: []
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Migrate any existing teacher@school.edu to ejoe@ejoe.com and update educator name to Ejoe Tso
        let migrated = false;
        this.data.users = this.data.users.map(u => {
          const updated = { ...u };
          let changed = false;
          if (u.email?.toLowerCase() === 'teacher@school.edu') {
            updated.email = 'ejoe@ejoe.com';
            changed = true;
          }
          if (updated.email?.toLowerCase() === 'ejoe@ejoe.com' || updated.id === 'u_educator_1') {
            if (updated.name !== 'Ejoe Tso') {
              updated.name = 'Ejoe Tso';
              changed = true;
            }
          }
          if (changed) {
            migrated = true;
          }
          return updated;
        });

        // Update educatorName in existing sessions
        this.data.sessions = this.data.sessions.map(s => {
          if (s.educatorId === 'u_educator_1' && s.educatorName !== 'Ejoe Tso') {
            migrated = true;
            return { ...s, educatorName: 'Ejoe Tso' };
          }
          return s;
        });

        if (migrated) {
          this.save();
        }
      } else {
        this.seed();
        this.save();
      }
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  private seed() {
    // Seed some initial default educators, templates, or setup
    this.data.users = [
      { id: 'u_educator_1', name: 'Ejoe Tso', role: 'educator', email: 'ejoe@ejoe.com' },
      { id: 'u_educator_2', name: 'Test Educator', role: 'educator', email: 'test@ejoe.com' },
      { id: 'u_student_1', name: 'Alex Johnson', role: 'student' }
    ];
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  // Users API
  public getUser(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: User): User {
    const existing = this.getUser(user.id);
    if (existing) return existing;
    this.data.users.push(user);
    this.save();
    return user;
  }

  public getUsers(): User[] {
    return this.data.users;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.getUser(id);
    if (!user) return undefined;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  // Sessions API
  public getSessions(): Session[] {
    return this.data.sessions;
  }

  public getSession(id: string): Session | undefined {
    const session = this.data.sessions.find(s => s.id === id);
    if (!session) return undefined;

    // Ensure session has activities array and activeActivityId
    if (!session.activities || session.activities.length === 0) {
      const defaultActivity: MindMapActivity = {
        id: `act_${session.id}_main`,
        sessionId: session.id,
        title: 'Main Mind Map',
        description: 'Primary session mind map',
        category: 'Main Board',
        template: 'blank',
        createdById: session.educatorId || 'system',
        createdByName: session.educatorName || 'Educator',
        createdAt: session.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      session.activities = [defaultActivity];
      session.activeActivityId = defaultActivity.id;

      // Assign activityId to existing nodes without activityId
      this.data.nodes.forEach(n => {
        if (n.sessionId === session.id && !n.activityId) {
          n.activityId = defaultActivity.id;
        }
      });
      this.data.edges.forEach(e => {
        if (e.sessionId === session.id && !e.activityId) {
          e.activityId = defaultActivity.id;
        }
      });
    }

    return session;
  }

  public getSessionByCode(code: string): Session | undefined {
    if (!code) return undefined;
    const cleanCode = code.trim().toUpperCase().replace(/^(MIND|LIVE)-/, '');
    const session = this.data.sessions.find(s => {
      const sessionCodeClean = s.code.trim().toUpperCase().replace(/^(MIND|LIVE)-/, '');
      return (sessionCodeClean === cleanCode || s.code.trim().toUpperCase() === code.trim().toUpperCase()) && s.status === 'active';
    });
    if (session) {
      return this.getSession(session.id);
    }
    return undefined;
  }

  public createSession(session: Session): Session {
    const defaultActivity: MindMapActivity = {
      id: `act_${session.id}_main`,
      sessionId: session.id,
      title: 'Main Mind Map',
      description: 'Primary starting mind map activity',
      category: 'Main Board',
      template: 'blank',
      createdById: session.educatorId,
      createdByName: session.educatorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    session.activities = [defaultActivity];
    session.activeActivityId = defaultActivity.id;

    this.data.sessions.push(session);
    
    // Seed central main topic node
    const centralNode: MindMapNode = {
      id: `node_central_${session.id}`,
      sessionId: session.id,
      activityId: defaultActivity.id,
      parentId: null,
      createdById: session.educatorId,
      createdByName: session.educatorName,
      title: session.title,
      description: session.description || 'Central starting concept for the session.',
      color: '#3b82f6', // blue
      icon: '🏫',
      category: 'Main Topic',
      x: 0,
      y: 0,
      z: 0,
      votes: [],
      reactions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'approved'
    };
    this.data.nodes.push(centralNode);

    // Create a couple of helpful guide nodes depending on the subject to serve as starter ideas
    this.seedStarterNodes(session, centralNode.id, defaultActivity.id);

    this.save();
    return session;
  }

  private seedStarterNodes(session: Session, parentId: string, activityId: string) {
    let subtopics: { title: string; category: string; color: string; x: number; y: number; z: number }[] = [];
    if (session.subject.toLowerCase().includes('python')) {
      subtopics = [
        { title: 'Lists & Tuples', category: 'Sequences', color: '#10b981', x: -180, y: -100, z: -50 },
        { title: 'Dictionaries & Sets', category: 'Key-Value', color: '#f59e0b', x: 180, y: -100, z: 50 },
        { title: 'Control Flow', category: 'Logic', color: '#ec4899', x: 0, y: 180, z: 0 }
      ];
    } else {
      subtopics = [
        { title: 'Core Concepts', category: 'Fundamentals', color: '#10b981', x: -180, y: -100, z: -50 },
        { title: 'Practical Examples', category: 'Application', color: '#f59e0b', x: 180, y: -100, z: 50 },
        { title: 'Resources & Reference', category: 'Metadata', color: '#ec4899', x: 0, y: 180, z: 0 }
      ];
    }

    subtopics.forEach((t, i) => {
      const id = `node_seed_${session.id}_${i}`;
      this.data.nodes.push({
        id,
        sessionId: session.id,
        activityId,
        parentId,
        createdById: session.educatorId,
        createdByName: session.educatorName,
        title: t.title,
        description: `Explore and collaborate on ${t.title}.`,
        color: t.color,
        icon: '💡',
        category: t.category,
        x: t.x,
        y: t.y,
        z: t.z,
        votes: [],
        reactions: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'approved'
      });

      this.data.edges.push({
        id: `edge_seed_${session.id}_${i}`,
        sessionId: session.id,
        activityId,
        source: parentId,
        target: id,
        label: 'focus',
        color: t.color,
        thickness: 2,
        style: 'curved',
        createdAt: new Date().toISOString()
      });
    });
  }

  public updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.getSession(id);
    if (!session) return undefined;
    Object.assign(session, updates);
    this.save();
    return session;
  }

  // Activities API
  public getActivities(sessionId: string): MindMapActivity[] {
    const session = this.getSession(sessionId);
    return session?.activities || [];
  }

  public createActivity(sessionId: string, activity: MindMapActivity): MindMapActivity {
    const session = this.getSession(sessionId);
    if (session) {
      if (!session.activities) {
        session.activities = [];
      }
      session.activities.push(activity);
      session.activeActivityId = activity.id;
      this.save();
    }
    return activity;
  }

  public updateActivity(sessionId: string, activityId: string, updates: Partial<MindMapActivity>): MindMapActivity | undefined {
    const session = this.getSession(sessionId);
    if (!session || !session.activities) return undefined;
    const act = session.activities.find(a => a.id === activityId);
    if (!act) return undefined;
    Object.assign(act, updates);
    act.updatedAt = new Date().toISOString();
    this.save();
    return act;
  }

  public deleteActivity(sessionId: string, activityId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session || !session.activities) return false;
    
    // Do not delete if only one activity left
    if (session.activities.length <= 1) return false;

    session.activities = session.activities.filter(a => a.id !== activityId);
    
    // Clean up nodes and edges belonging to this activity
    this.data.nodes = this.data.nodes.filter(n => !(n.sessionId === sessionId && n.activityId === activityId));
    this.data.edges = this.data.edges.filter(e => !(e.sessionId === sessionId && e.activityId === activityId));

    if (session.activeActivityId === activityId) {
      session.activeActivityId = session.activities[0]?.id || null;
    }

    this.save();
    return true;
  }

  // Nodes API
  public getNodes(sessionId: string): MindMapNode[] {
    return this.data.nodes.filter(n => n.sessionId === sessionId);
  }

  public getNode(id: string): MindMapNode | undefined {
    return this.data.nodes.find(n => n.id === id);
  }

  public createNode(node: MindMapNode): MindMapNode {
    // If double create safeguard
    const existing = this.data.nodes.find(n => n.id === node.id);
    if (existing) return existing;
    
    this.data.nodes.push(node);
    this.save();
    return node;
  }

  public updateNode(id: string, updates: Partial<MindMapNode>): MindMapNode | undefined {
    const node = this.getNode(id);
    if (!node) return undefined;
    Object.assign(node, updates);
    node.updatedAt = new Date().toISOString();
    this.save();
    return node;
  }

  public deleteNode(id: string): boolean {
    const initialLen = this.data.nodes.length;
    this.data.nodes = this.data.nodes.filter(n => n.id !== id);
    
    // Also remove connected edges
    this.data.edges = this.data.edges.filter(e => e.source !== id && e.target !== id);
    
    // Also remove comments
    this.data.comments = this.data.comments.filter(c => c.nodeId !== id);
    
    const changed = this.data.nodes.length !== initialLen;
    if (changed) {
      this.save();
    }
    return changed;
  }

  // Edges API
  public getEdges(sessionId: string): MindMapEdge[] {
    return this.data.edges.filter(e => e.sessionId === sessionId);
  }

  public createEdge(edge: MindMapEdge): MindMapEdge {
    const existing = this.data.edges.find(e => e.id === edge.id);
    if (existing) return existing;

    // Check if edge between same source & target already exists
    const duplicate = this.data.edges.find(e => e.sessionId === edge.sessionId && e.source === edge.source && e.target === edge.target);
    if (duplicate) return duplicate;

    this.data.edges.push(edge);
    this.save();
    return edge;
  }

  public deleteEdge(id: string): boolean {
    const initialLen = this.data.edges.length;
    this.data.edges = this.data.edges.filter(e => e.id !== id);
    const changed = this.data.edges.length !== initialLen;
    if (changed) {
      this.save();
    }
    return changed;
  }

  // Comments API
  public getComments(nodeId: string): Comment[] {
    return this.data.comments.filter(c => c.nodeId === nodeId);
  }

  public createComment(comment: Comment): Comment {
    this.data.comments.push(comment);
    this.save();
    return comment;
  }

  // Participants API
  public getParticipants(sessionId: string): SessionParticipant[] {
    return this.data.participants.filter(p => p.sessionId === sessionId);
  }

  public updateParticipantPresence(sessionId: string, userId: string, name: string, role: UserRole, isConnected: boolean): SessionParticipant {
    let participant = this.data.participants.find(p => p.sessionId === sessionId && p.userId === userId);
    if (participant) {
      participant.isConnected = isConnected;
      participant.name = name;
    } else {
      participant = {
        id: `p_${sessionId}_${userId}_${Date.now()}`,
        sessionId,
        userId,
        name,
        role,
        isConnected,
        joinedAt: new Date().toISOString()
      };
      this.data.participants.push(participant);
    }
    this.save();
    return participant;
  }

  // Audit Logs
  public addAuditLog(sessionId: string, userId: string, userName: string, action: string, details: string) {
    this.data.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sessionId,
      userId,
      userName,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  public getAuditLogs(sessionId: string): any[] {
    return this.data.auditLogs.filter(log => log.sessionId === sessionId);
  }

  public clearSessionNodesAndEdges(sessionId: string) {
    this.data.nodes = this.data.nodes.filter(n => n.sessionId !== sessionId);
    this.data.edges = this.data.edges.filter(e => e.sessionId !== sessionId);
    this.data.comments = []; // clean up previous node comments to avoid dangling pointers
    this.save();
  }

  public deleteSession(sessionId: string): boolean {
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(s => s.id !== sessionId);
    this.data.nodes = this.data.nodes.filter(n => n.sessionId !== sessionId);
    this.data.edges = this.data.edges.filter(e => e.sessionId !== sessionId);
    this.data.participants = this.data.participants.filter(p => p.sessionId !== sessionId);
    this.data.auditLogs = this.data.auditLogs.filter(a => a.sessionId !== sessionId);
    this.data.qaMemos = (this.data.qaMemos || []).filter(m => m.sessionId !== sessionId);
    const changed = this.data.sessions.length !== initialLen;
    if (changed) {
      this.save();
    }
    return changed;
  }

  // Q&A Memos API
  public getQAMemos(sessionId: string): QAMemo[] {
    if (!this.data.qaMemos) this.data.qaMemos = [];
    return this.data.qaMemos.filter(m => m.sessionId === sessionId);
  }

  public createQAMemo(memo: QAMemo): QAMemo {
    if (!this.data.qaMemos) this.data.qaMemos = [];
    if (!memo.id) {
      memo.id = `memo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!memo.votes) memo.votes = [];
    if (memo.isAnswered === undefined) memo.isAnswered = false;
    if (memo.isPinned === undefined) memo.isPinned = false;
    if (!memo.createdAt) memo.createdAt = new Date().toISOString();
    if (!memo.updatedAt) memo.updatedAt = new Date().toISOString();

    const existing = this.data.qaMemos.find(m => m.id === memo.id);
    if (existing) return existing;
    this.data.qaMemos.push(memo);
    this.save();
    return memo;
  }

  public updateQAMemo(id: string, updates: Partial<QAMemo>): QAMemo | undefined {
    if (!this.data.qaMemos) this.data.qaMemos = [];
    const memo = this.data.qaMemos.find(m => m.id === id);
    if (!memo) return undefined;
    Object.assign(memo, updates);
    memo.updatedAt = new Date().toISOString();
    this.save();
    return memo;
  }

  public voteQAMemo(id: string, userId: string): QAMemo | undefined {
    if (!this.data.qaMemos) this.data.qaMemos = [];
    const memo = this.data.qaMemos.find(m => m.id === id);
    if (!memo) return undefined;
    if (!memo.votes) memo.votes = [];
    const idx = memo.votes.indexOf(userId);
    if (idx > -1) {
      memo.votes.splice(idx, 1);
    } else {
      memo.votes.push(userId);
    }
    memo.updatedAt = new Date().toISOString();
    this.save();
    return memo;
  }

  public deleteQAMemo(id: string): boolean {
    if (!this.data.qaMemos) this.data.qaMemos = [];
    const initialLen = this.data.qaMemos.length;
    this.data.qaMemos = this.data.qaMemos.filter(m => m.id !== id);
    const changed = this.data.qaMemos.length !== initialLen;
    if (changed) {
      this.save();
    }
    return changed;
  }

  // ==========================================
  // Live Interaction API Methods
  // ==========================================

  public getLiveSessions(): LiveInteractionSession[] {
    return this.data.liveSessions || [];
  }

  public getLiveSession(id: string): LiveInteractionSession | undefined {
    return (this.data.liveSessions || []).find(s => s.id === id);
  }

  public getLiveSessionByCode(code: string): LiveInteractionSession | undefined {
    if (!code) return undefined;
    const cleanCode = code.trim().toUpperCase().replace(/^(LIVE|MIND)-/, '');
    return (this.data.liveSessions || []).find(s => {
      const liveCodeClean = s.joinCode.trim().toUpperCase().replace(/^(LIVE|MIND)-/, '');
      return liveCodeClean === cleanCode || s.joinCode.trim().toUpperCase() === code.trim().toUpperCase() || s.id === code;
    });
  }

  public createLiveSession(session: LiveInteractionSession): LiveInteractionSession {
    if (!this.data.liveSessions) this.data.liveSessions = [];
    this.data.liveSessions.push(session);
    this.save();
    return session;
  }

  public updateLiveSession(id: string, updates: Partial<LiveInteractionSession>): LiveInteractionSession | undefined {
    const session = this.getLiveSession(id);
    if (!session) return undefined;
    Object.assign(session, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return session;
  }

  public deleteLiveSession(id: string): boolean {
    if (!this.data.liveSessions) return false;
    const initialLen = this.data.liveSessions.length;
    this.data.liveSessions = this.data.liveSessions.filter(s => s.id !== id);
    this.data.liveActivities = (this.data.liveActivities || []).filter(a => a.sessionId !== id);
    this.data.liveParticipants = (this.data.liveParticipants || []).filter(p => p.sessionId !== id);
    this.data.audienceQuestions = (this.data.audienceQuestions || []).filter(q => q.sessionId !== id);
    this.data.resultLinks = (this.data.resultLinks || []).filter(r => r.sessionId !== id);
    const changed = this.data.liveSessions.length !== initialLen;
    if (changed) this.save();
    return changed;
  }

  // Activities
  public getLiveActivities(sessionId: string): LiveActivity[] {
    return (this.data.liveActivities || [])
      .filter(a => a.sessionId === sessionId)
      .sort((a, b) => a.position - b.position);
  }

  public getLiveActivity(id: string): LiveActivity | undefined {
    return (this.data.liveActivities || []).find(a => a.id === id);
  }

  public createLiveActivity(activity: LiveActivity): LiveActivity {
    if (!this.data.liveActivities) this.data.liveActivities = [];
    this.data.liveActivities.push(activity);
    this.save();
    return activity;
  }

  public updateLiveActivity(id: string, updates: Partial<LiveActivity>): LiveActivity | undefined {
    const activity = this.getLiveActivity(id);
    if (!activity) return undefined;
    Object.assign(activity, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return activity;
  }

  public deleteLiveActivity(id: string): boolean {
    if (!this.data.liveActivities) return false;
    const initialLen = this.data.liveActivities.length;
    this.data.liveActivities = this.data.liveActivities.filter(a => a.id !== id);
    this.data.activityResponses = (this.data.activityResponses || []).filter(r => r.activityId !== id);
    this.data.responseClusters = (this.data.responseClusters || []).filter(c => c.activityId !== id);
    const changed = this.data.liveActivities.length !== initialLen;
    if (changed) this.save();
    return changed;
  }

  public reorderLiveActivities(sessionId: string, activityIds: string[]): LiveActivity[] {
    if (!this.data.liveActivities) return [];
    activityIds.forEach((id, index) => {
      const activity = this.getLiveActivity(id);
      if (activity) {
        activity.position = index + 1;
        activity.updatedAt = new Date().toISOString();
      }
    });
    this.save();
    return this.getLiveActivities(sessionId);
  }

  // Live Participants
  public getLiveParticipants(sessionId: string): LiveParticipant[] {
    return (this.data.liveParticipants || []).filter(p => p.sessionId === sessionId);
  }

  public addOrUpdateLiveParticipant(participant: LiveParticipant): LiveParticipant {
    if (!this.data.liveParticipants) this.data.liveParticipants = [];
    const existing = this.data.liveParticipants.find(
      p => p.sessionId === participant.sessionId && p.userId === participant.userId
    );
    if (existing) {
      existing.displayName = participant.displayName;
      existing.lastSeenAt = new Date().toISOString();
      this.save();
      return existing;
    }
    this.data.liveParticipants.push(participant);
    this.save();
    return participant;
  }

  public blockParticipant(sessionId: string, participantId: string): boolean {
    if (!this.data.liveParticipants) return false;
    const participant = this.data.liveParticipants.find(p => p.sessionId === sessionId && p.id === participantId);
    if (participant) {
      participant.isBlocked = true;
      this.save();
      return true;
    }
    return false;
  }

  // Activity Responses
  public getActivityResponses(activityId: string): ActivityResponse[] {
    return (this.data.activityResponses || []).filter(r => r.activityId === activityId);
  }

  public getParticipantResponse(activityId: string, participantId: string): ActivityResponse | undefined {
    return (this.data.activityResponses || []).find(
      r => r.activityId === activityId && r.participantId === participantId
    );
  }

  public submitActivityResponse(response: ActivityResponse): ActivityResponse {
    if (!this.data.activityResponses) this.data.activityResponses = [];
    // If existing, update it (idempotent / answer edit before close)
    const existingIdx = this.data.activityResponses.findIndex(
      r => r.activityId === response.activityId && r.participantId === response.participantId && r.id === response.id
    );
    if (existingIdx > -1) {
      this.data.activityResponses[existingIdx] = { ...this.data.activityResponses[existingIdx], ...response, updatedAt: new Date().toISOString() };
      this.save();
      return this.data.activityResponses[existingIdx];
    }
    this.data.activityResponses.push(response);
    this.save();
    return response;
  }

  public updateActivityResponse(id: string, updates: Partial<ActivityResponse>): ActivityResponse | undefined {
    if (!this.data.activityResponses) return undefined;
    const response = this.data.activityResponses.find(r => r.id === id);
    if (!response) return undefined;
    Object.assign(response, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return response;
  }

  public deleteActivityResponse(id: string): boolean {
    if (!this.data.activityResponses) return false;
    const initialLen = this.data.activityResponses.length;
    this.data.activityResponses = this.data.activityResponses.filter(r => r.id !== id);
    const changed = this.data.activityResponses.length !== initialLen;
    if (changed) this.save();
    return changed;
  }

  public voteActivityResponse(responseId: string, participantId: string): ActivityResponse | undefined {
    if (!this.data.activityResponses) return undefined;
    const response = this.data.activityResponses.find(r => r.id === responseId);
    if (!response) return undefined;
    if (!response.votedBy) response.votedBy = [];
    const idx = response.votedBy.indexOf(participantId);
    if (idx > -1) {
      response.votedBy.splice(idx, 1);
    } else {
      response.votedBy.push(participantId);
    }
    response.voteCount = response.votedBy.length;
    response.updatedAt = new Date().toISOString();
    this.save();
    return response;
  }

  // Audience Questions (Q&A)
  public getAudienceQuestions(sessionId: string): AudienceQuestion[] {
    return (this.data.audienceQuestions || []).filter(q => q.sessionId === sessionId);
  }

  public getAudienceQuestion(id: string): AudienceQuestion | undefined {
    return (this.data.audienceQuestions || []).find(q => q.id === id);
  }

  public submitAudienceQuestion(question: AudienceQuestion): AudienceQuestion {
    if (!this.data.audienceQuestions) this.data.audienceQuestions = [];
    this.data.audienceQuestions.push(question);
    this.save();
    return question;
  }

  public updateAudienceQuestion(id: string, updates: Partial<AudienceQuestion>): AudienceQuestion | undefined {
    if (!this.data.audienceQuestions) return undefined;
    const q = this.data.audienceQuestions.find(item => item.id === id);
    if (!q) return undefined;
    Object.assign(q, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return q;
  }

  public voteAudienceQuestion(questionId: string, participantId: string): AudienceQuestion | undefined {
    if (!this.data.audienceQuestions) return undefined;
    const q = this.data.audienceQuestions.find(item => item.id === questionId);
    if (!q) return undefined;
    if (!q.votedBy) q.votedBy = [];
    const idx = q.votedBy.indexOf(participantId);
    if (idx > -1) {
      q.votedBy.splice(idx, 1);
    } else {
      q.votedBy.push(participantId);
    }
    q.voteCount = q.votedBy.length;
    q.updatedAt = new Date().toISOString();
    this.save();
    return q;
  }

  public deleteAudienceQuestion(id: string): boolean {
    if (!this.data.audienceQuestions) return false;
    const initialLen = this.data.audienceQuestions.length;
    this.data.audienceQuestions = this.data.audienceQuestions.filter(q => q.id !== id);
    const changed = this.data.audienceQuestions.length !== initialLen;
    if (changed) this.save();
    return changed;
  }

  // Response Clusters
  public getResponseClusters(activityId: string): ResponseCluster[] {
    return (this.data.responseClusters || []).filter(c => c.activityId === activityId);
  }

  public createOrUpdateResponseClusters(activityId: string, clusters: ResponseCluster[]): ResponseCluster[] {
    if (!this.data.responseClusters) this.data.responseClusters = [];
    // Replace old clusters for this activity
    this.data.responseClusters = this.data.responseClusters.filter(c => c.activityId !== activityId);
    this.data.responseClusters.push(...clusters);
    this.save();
    return clusters;
  }

  // MindSphere Result Links
  public createResultLink(link: MindSphereResultLink): MindSphereResultLink {
    if (!this.data.resultLinks) this.data.resultLinks = [];
    this.data.resultLinks.push(link);
    this.save();
    return link;
  }

  public getResultLinks(sessionId: string): MindSphereResultLink[] {
    return (this.data.resultLinks || []).filter(l => l.sessionId === sessionId);
  }
}

export const db = new Database();
