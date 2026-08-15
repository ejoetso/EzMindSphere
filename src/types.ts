/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'educator' | 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  credentialHash?: string;
  disabled?: boolean;
}

export interface SessionSettings {
  studentCanEdit: boolean;
  approvalRequired: boolean;
  allowDownload: boolean;
  maxParticipants: number;
}

export interface MindMapActivity {
  id: string;
  sessionId: string;
  title: string;
  description?: string;
  category?: string;
  template?: 'blank' | 'swot' | 'timeline' | 'pros_cons' | 'problem_solving' | 'group_brainstorm';
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  code: string; // e.g. MIND-4R8K-21
  title: string;
  subject: string;
  description: string;
  status: 'active' | 'ended';
  educatorId: string;
  educatorName: string;
  settings: SessionSettings;
  createdAt: string;
  endedAt?: string;
  activeLayout: 'radial' | 'force' | 'tree' | 'timeline';
  activeEngagementMode: 'brainstorm' | 'moderated' | 'voting';
  educatorTips?: Array<{ title: string; tipType: 'question' | 'activity' | 'misconception' | 'resource'; text: string }>;
  linkedLiveSessionId?: string;
  activeActivityId?: string;
  activities?: MindMapActivity[];
}

// ===================================================
// MindSphere Live Interaction Types & Data Entities
// ===================================================

export type ParticipationMode = 'anonymous' | 'identified' | 'pseudonymous';
export type PacingMode = 'presenter' | 'participant';
export type LiveSessionStatus = 'draft' | 'lobby' | 'live' | 'paused' | 'completed' | 'archived';
export type ActivityType = 'multiple_choice' | 'open_ended' | 'qa';
export type ActivityStatus = 'draft' | 'active' | 'closed' | 'completed';
export type ResultVisibility = 'hidden' | 'revealed' | 'live';
export type ModerationMode = 'none' | 'pre_moderation';

export interface ActivityOption {
  id: string;
  activityId: string;
  label: string;
  imageUrl?: string;
  position: number;
  isCorrect?: boolean;
}

export interface LiveActivity {
  id: string;
  sessionId: string;
  type: ActivityType;
  title: string;
  description?: string;
  position: number;
  status: ActivityStatus;
  resultVisibility: ResultVisibility;
  moderationMode: ModerationMode;
  mcSettings?: {
    isMultipleAnswer: boolean;
    allowAnswerChange: boolean;
    randomizeOrder: boolean;
    showCorrectAnswer: boolean;
    explanation?: string;
    deadlineSeconds?: number;
  };
  options?: ActivityOption[];
  openEndedSettings?: {
    answerMode: 'short' | 'long';
    characterLimit: number;
    allowMultipleResponses: boolean;
    enableVoting: boolean;
    profanityFilter: boolean;
    duplicateDetection: boolean;
  };
  qaSettings?: {
    requireApproval: boolean;
    allowAnonymousQuestions: boolean;
    enableUpvoting: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LiveInteractionSession {
  id: string;
  ownerId: string;
  ownerName: string;
  organisationId?: string;
  classId?: string;
  title: string;
  description: string;
  joinCode: string; // e.g. LIVE-7890
  participationMode: ParticipationMode;
  pacingMode: PacingMode;
  status: LiveSessionStatus;
  activeActivityId: string | null;
  resultsVisibility: ResultVisibility;
  moderationMode: ModerationMode;
  participantLimit: number;
  linkedMindMapId?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveParticipant {
  id: string;
  sessionId: string;
  userId: string;
  anonymousToken: string;
  displayName: string;
  isBlocked?: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface ActivityResponse {
  id: string;
  activityId: string;
  participantId: string;
  participantName: string;
  selectedOptionIds?: string[]; // For MC
  textResponse?: string; // For Open Ended
  moderationStatus: 'pending' | 'approved' | 'rejected';
  voteCount: number;
  votedBy: string[];
  clusterId?: string;
  isPinned?: boolean;
  isHighlighted?: boolean;
  submittedAt: string;
  updatedAt: string;
}

export interface AudienceQuestion {
  id: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  isAnonymous: boolean;
  text: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  voteCount: number;
  votedBy: string[];
  isPinned?: boolean;
  isHighlighted?: boolean;
  isAnswered?: boolean;
  presenterAnswer?: string;
  answeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseCluster {
  id: string;
  activityId: string;
  label: string;
  summary: string;
  keyIdeas?: string[];
  agreements?: string[];
  disagreements?: string[];
  misconceptions?: string[];
  followUpQuestions?: string[];
  createdAt: string;
}

export interface MindSphereResultLink {
  id: string;
  sessionId: string;
  activityId?: string;
  responseId?: string;
  questionId?: string;
  mapId: string;
  nodeId: string;
  createdAt: string;
}

export type NodeShape = 'rectangle' | 'circle' | 'ellipse' | 'diamond' | 'cloud' | 'hexagon' | 'star' | 'capsule';

export interface QAMemo {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  question: string;
  category?: 'Question' | 'Idea' | 'Clarification' | 'Feedback' | 'Challenge';
  color: string;
  votes: string[];
  isAnswered: boolean;
  isPinned: boolean;
  answer?: string;
  answeredBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MindMapNode {
  id: string;
  sessionId: string;
  activityId?: string;
  parentId: string | null;
  createdById: string;
  createdByName: string;
  title: string;
  description: string;
  color: string; // Hex or tailwind class
  icon: string; // Emoji or Lucide icon key
  category: string;
  x: number; // 2D X coordinate
  y: number; // 2D Y coordinate
  z: number; // 3D Z coordinate
  votes: string[]; // List of user IDs who upvoted
  reactions: { [userId: string]: string }; // e.g., { "u1": "👍", "u2": "🔥" }
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'approved'; // Moderation state
  isLocked?: boolean;
  shape?: NodeShape;
}

export interface MindMapEdge {
  id: string;
  sessionId: string;
  activityId?: string;
  source: string; // Source Node ID
  target: string; // Target Node ID
  label: string;
  color: string;
  thickness: number;
  style: 'solid' | 'dashed' | 'curved';
  createdAt: string;
}

export interface Comment {
  id: string;
  nodeId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  name: string;
  role: UserRole;
  isConnected: boolean;
  joinedAt: string;
  cursor2D?: { x: number; y: number } | null;
}

// WS Event Message Payloads
export interface WSMessageMap {
  'session:join': { sessionId: string; userId: string; name: string; role: UserRole };
  'session:leave': { sessionId: string; userId: string };
  'cursor:move': { sessionId: string; userId: string; cursor2D: { x: number; y: number } | null };
  'map:sync': { sessionId: string; nodes: MindMapNode[]; edges: MindMapEdge[] };
  'node:create': { sessionId: string; node: MindMapNode };
  'node:update': { sessionId: string; node: MindMapNode };
  'node:delete': { sessionId: string; nodeId: string };
  'edge:create': { sessionId: string; edge: MindMapEdge };
  'edge:delete': { sessionId: string; edgeId: string };
  'comment:create': { sessionId: string; comment: Comment };
  'reaction:add': { sessionId: string; nodeId: string; userId: string; emoji: string };
  'vote:add': { sessionId: string; nodeId: string; userId: string };
  'teacher:lock': { sessionId: string; isLocked: boolean };
  'teacher:layout': { sessionId: string; layout: 'radial' | 'force' | 'tree' | 'timeline' };
  'teacher:mode': { sessionId: string; mode: 'brainstorm' | 'moderated' | 'voting' };
  'teacher:spotlight': { sessionId: string; nodeId: string | null }; // Highlight node
  'teacher:approve': { sessionId: string; nodeId: string };
  'memo:create': { sessionId: string; memo: QAMemo };
  'memo:update': { sessionId: string; memo: QAMemo };
  'memo:vote': { sessionId: string; memoId: string; userId: string };
  'memo:delete': { sessionId: string; memoId: string };
  'activity:create': { sessionId: string; activity: MindMapActivity; seedNodes?: MindMapNode[]; seedEdges?: MindMapEdge[] };
  'activity:select': { sessionId: string; activityId: string };
  'activity:update': { sessionId: string; activity: MindMapActivity };
  'activity:delete': { sessionId: string; activityId: string };
  'session:ended': { sessionId: string };
}
