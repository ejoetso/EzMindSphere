/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MindMapNode, MindMapEdge, Comment, SessionParticipant, Session, User, QAMemo, MindMapActivity } from '../types.js';

export interface UseRealtimeSessionReturn {
  session: Session | null;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  memos: QAMemo[];
  activities: MindMapActivity[];
  activeActivityId: string | null;
  participants: SessionParticipant[];
  cursors: { [userId: string]: { name: string; x: number; y: number } };
  connected: boolean;
  spotlightNodeId: string | null;
  joinSession: (sessionId: string, user: User) => void;
  sendCursorMove: (x: number, y: number) => void;
  createNode: (title: string, parentId: string | null, details?: { description?: string; color?: string; icon?: string; category?: string; x?: number; y?: number; z?: number; shape?: any; activityId?: string }) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  dragNode: (nodeId: string, x: number, y: number, z?: number) => void;
  deleteNode: (nodeId: string) => void;
  createEdge: (sourceId: string, targetId: string, label?: string, style?: 'solid' | 'dashed' | 'curved', activityId?: string) => void;
  deleteEdge: (edgeId: string) => void;
  addComment: (nodeId: string, text: string, author: User) => void;
  addReaction: (nodeId: string, userId: string, emoji: string) => void;
  addVote: (nodeId: string, userId: string) => void;
  addMemo: (memo: { question: string; category?: QAMemo['category']; color?: string }) => void;
  updateMemo: (memoId: string, updates: Partial<QAMemo>) => void;
  voteMemo: (memoId: string) => void;
  deleteMemo: (memoId: string) => void;
  createActivity: (title: string, template?: MindMapActivity['template'], description?: string, category?: string) => void;
  selectActivity: (activityId: string) => void;
  updateActivity: (activityId: string, updates: Partial<MindMapActivity>) => void;
  deleteActivity: (activityId: string) => void;
  toggleLock: (isLocked: boolean) => void;
  changeLayout: (layout: 'radial' | 'force' | 'tree' | 'timeline') => void;
  changeMode: (mode: 'brainstorm' | 'moderated' | 'voting') => void;
  spotlightNode: (nodeId: string | null) => void;
  approveNode: (nodeId: string) => void;
  rejectNode: (nodeId: string) => void;
  endSession: () => void;
  syncMapState: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
}

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [memos, setMemos] = useState<QAMemo[]>([]);
  const [activities, setActivities] = useState<MindMapActivity[]>([]);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [cursors, setCursors] = useState<{ [userId: string]: { name: string; x: number; y: number } }>({});
  const [connected, setConnected] = useState<boolean>(false);
  const [spotlightNodeId, setSpotlightNodeId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeUserRef = useRef<User | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  // Connection handler
  const connect = useCallback((sessionId: string, user: User) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Match current host port, with websocket endpoint on /ws
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected successfully');
      setConnected(true);
      
      // Join the session immediately
      socket.send(JSON.stringify({
        event: 'session:join',
        data: {
          sessionId,
          userId: user.id,
          name: user.name,
          role: user.role
        }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { event: wsEvent, data } = msg;

        switch (wsEvent) {
          case 'map:sync': {
            setSession(data.session);
            setNodes(data.nodes);
            setEdges(data.edges);
            if (data.memos) {
              setMemos(data.memos);
            }
            if (data.session) {
              setSpotlightNodeId(null);
              if (data.session.activities) {
                setActivities(data.session.activities);
              }
              if (data.session.activeActivityId) {
                setActiveActivityId(data.session.activeActivityId);
              }
            }
            break;
          }

          case 'activity:created': {
            const { activity, seedNodes = [], seedEdges = [] } = data;
            setActivities(prev => [...prev.filter(a => a.id !== activity.id), activity]);
            setActiveActivityId(activity.id);
            if (seedNodes.length > 0) {
              setNodes(prev => [...prev, ...seedNodes]);
            }
            if (seedEdges.length > 0) {
              setEdges(prev => [...prev, ...seedEdges]);
            }
            break;
          }

          case 'activity:selected': {
            const { activityId } = data;
            setActiveActivityId(activityId);
            setSession(prev => prev ? { ...prev, activeActivityId: activityId } : null);
            break;
          }

          case 'activity:updated': {
            const { activity } = data;
            setActivities(prev => prev.map(a => a.id === activity.id ? activity : a));
            break;
          }

          case 'activity:deleted': {
            const { activityId } = data;
            setActivities(prev => {
              const next = prev.filter(a => a.id !== activityId);
              setActiveActivityId(current => current === activityId ? (next[0]?.id || null) : current);
              return next;
            });
            setNodes(prev => prev.filter(n => n.activityId !== activityId));
            setEdges(prev => prev.filter(e => e.activityId !== activityId));
            break;
          }

          case 'memo:created': {
            const { memo } = data;
            setMemos(prev => {
              if (prev.some(m => m.id === memo.id)) return prev;
              return [memo, ...prev];
            });
            break;
          }

          case 'memo:updated': {
            const { memo } = data;
            setMemos(prev => prev.map(m => m.id === memo.id ? memo : m));
            break;
          }

          case 'memo:deleted': {
            const { memoId } = data;
            setMemos(prev => prev.filter(m => m.id !== memoId));
            break;
          }

          case 'participant:list': {
            setParticipants(data.participants);
            break;
          }

          case 'cursor:update': {
            const { userId, name, cursor2D } = data;
            setCursors(prev => {
              const updated = { ...prev };
              if (cursor2D) {
                updated[userId] = { name, x: cursor2D.x, y: cursor2D.y };
              } else {
                delete updated[userId];
              }
              return updated;
            });
            break;
          }

          case 'node:created': {
            const { node } = data;
            setNodes(prev => {
              // Idempotent handler guard
              if (prev.some(n => n.id === node.id)) return prev;
              return [...prev, node];
            });
            break;
          }

          case 'node:updated': {
            const { node } = data;
            setNodes(prev => prev.map(n => n.id === node.id ? node : n));
            break;
          }

          case 'node:dragged': {
            const { nodeId, x, y, z } = data;
            // Optimistic fast positional update avoiding react full diff delays
            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x, y, z: z ?? n.z } : n));
            break;
          }

          case 'node:deleted': {
            const { nodeId } = data;
            setNodes(prev => prev.filter(n => n.id !== nodeId));
            setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
            break;
          }

          case 'edge:created': {
            const { edge } = data;
            setEdges(prev => {
              if (prev.some(e => e.id === edge.id)) return prev;
              return [...prev, edge];
            });
            break;
          }

          case 'edge:deleted': {
            const { edgeId } = data;
            setEdges(prev => prev.filter(e => e.id !== edgeId));
            break;
          }

          case 'reaction:added': {
            const { nodeId, userId, emoji } = data;
            setNodes(prev => prev.map(n => {
              if (n.id !== nodeId) return n;
              return {
                ...n,
                reactions: { ...n.reactions, [userId]: emoji }
              };
            }));
            break;
          }

          case 'vote:updated': {
            const { nodeId, votes } = data;
            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, votes } : n));
            break;
          }

          case 'teacher:locked': {
            const { isLocked } = data;
            setSession(prev => prev ? {
              ...prev,
              settings: { ...prev.settings, studentCanEdit: !isLocked }
            } : null);
            break;
          }

          case 'teacher:layed_out': {
            const { layout } = data;
            setSession(prev => prev ? { ...prev, activeLayout: layout } : null);
            break;
          }

          case 'teacher:moded': {
            const { mode } = data;
            setSession(prev => prev ? { ...prev, activeEngagementMode: mode } : null);
            break;
          }

          case 'teacher:spotlighted': {
            const { nodeId } = data;
            setSpotlightNodeId(nodeId);
            break;
          }

          case 'node:approved': {
            const { nodeId, node } = data;
            setNodes(prev => prev.map(n => n.id === nodeId ? node : n));
            break;
          }

          case 'node:rejected': {
            const { nodeId } = data;
            setNodes(prev => prev.filter(n => n.id !== nodeId));
            break;
          }

          case 'session:ended': {
            setSession(prev => prev ? { ...prev, status: 'ended' } : null);
            break;
          }

          case 'error': {
            console.error('Realtime Server Error:', data);
            break;
          }
        }
      } catch (err) {
        console.error('Error handling websocket message:', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket closed. Attempting reconnect in 3s...');
      setConnected(false);
      
      // Attempt reconnection
      reconnectTimeoutRef.current = setTimeout(() => {
        if (activeSessionIdRef.current && activeUserRef.current) {
          connect(activeSessionIdRef.current, activeUserRef.current);
        }
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
  }, []);

  const joinSession = useCallback((sessionId: string, user: User) => {
    activeUserRef.current = user;
    activeSessionIdRef.current = sessionId;
    connect(sessionId, user);
  }, [connect]);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Send operations helper
  const sendEvent = useCallback((event: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event, data }));
    }
  }, []);

  // Public Actions APIs
  const sendCursorMove = useCallback((x: number, y: number) => {
    if (!activeSessionIdRef.current || !activeUserRef.current) return;
    sendEvent('cursor:move', {
      sessionId: activeSessionIdRef.current,
      userId: activeUserRef.current.id,
      cursor2D: { x, y }
    });
  }, [sendEvent]);

  const createNode = useCallback((
    title: string,
    parentId: string | null,
    details?: { id?: string; description?: string; color?: string; icon?: string; category?: string; x?: number; y?: number; z?: number; shape?: MindMapNode['shape']; activityId?: string }
  ) => {
    if (!activeSessionIdRef.current || !activeUserRef.current) return;
    
    const targetActivityId = details?.activityId || activeActivityId || undefined;
    const nodeId = details?.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newNode: MindMapNode = {
      id: nodeId,
      sessionId: activeSessionIdRef.current,
      activityId: targetActivityId,
      parentId,
      createdById: activeUserRef.current.id,
      createdByName: activeUserRef.current.name,
      title,
      description: details?.description || '',
      color: details?.color || '#10b981',
      icon: details?.icon || '💡',
      category: details?.category || 'Subtopic',
      x: details?.x ?? (Math.random() * 100 - 50),
      y: details?.y ?? (Math.random() * 100 - 50),
      z: details?.z ?? (Math.random() * 100 - 50),
      votes: [],
      reactions: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'approved', // Will be moderation filtered by server if required
      shape: details?.shape || 'rectangle'
    };

    // Optimistic local render update
    setNodes(prev => [...prev, newNode]);

    sendEvent('node:create', {
      sessionId: activeSessionIdRef.current,
      node: newNode
    });

    if (parentId) {
      const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newEdge: MindMapEdge = {
        id: edgeId,
        sessionId: activeSessionIdRef.current,
        activityId: targetActivityId,
        source: parentId,
        target: nodeId,
        label: 'relates to',
        color: details?.color || '#94a3b8',
        thickness: 2,
        style: 'curved',
        createdAt: new Date().toISOString()
      };

      setEdges(prev => [...prev, newEdge]);

      sendEvent('edge:create', {
        sessionId: activeSessionIdRef.current,
        edge: newEdge
      });
    }
  }, [sendEvent, activeActivityId]);

  const updateNode = useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
    if (!activeSessionIdRef.current) return;
    
    // Optimistic local update
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));

    sendEvent('node:update', {
      sessionId: activeSessionIdRef.current,
      node: { id: nodeId, ...updates }
    });
  }, [sendEvent]);

  const dragNode = useCallback((nodeId: string, x: number, y: number, z?: number) => {
    if (!activeSessionIdRef.current) return;

    // Optimistic local fast render
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x, y, z: z ?? n.z } : n));

    sendEvent('node:drag', {
      sessionId: activeSessionIdRef.current,
      nodeId,
      x,
      y,
      z
    });
  }, [sendEvent]);

  const deleteNode = useCallback((nodeId: string) => {
    if (!activeSessionIdRef.current) return;

    // Optimistic local update
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));

    sendEvent('node:delete', {
      sessionId: activeSessionIdRef.current,
      nodeId
    });
  }, [sendEvent]);

  const createEdge = useCallback((sourceId: string, targetId: string, label: string = 'focuses', style: 'solid' | 'dashed' | 'curved' = 'curved') => {
    if (!activeSessionIdRef.current) return;

    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newEdge: MindMapEdge = {
      id: edgeId,
      sessionId: activeSessionIdRef.current,
      source: sourceId,
      target: targetId,
      label,
      color: '#94a3b8',
      thickness: 2,
      style,
      createdAt: new Date().toISOString()
    };

    setEdges(prev => [...prev, newEdge]);

    sendEvent('edge:create', {
      sessionId: activeSessionIdRef.current,
      edge: newEdge
    });
  }, [sendEvent]);

  const deleteEdge = useCallback((edgeId: string) => {
    if (!activeSessionIdRef.current) return;

    setEdges(prev => prev.filter(e => e.id !== edgeId));

    sendEvent('edge:delete', {
      sessionId: activeSessionIdRef.current,
      edgeId
    });
  }, [sendEvent]);

  const addComment = useCallback((nodeId: string, text: string, author: User) => {
    if (!activeSessionIdRef.current) return;

    const comment: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      nodeId,
      authorId: author.id,
      authorName: author.name,
      text,
      createdAt: new Date().toISOString()
    };

    sendEvent('comment:create', {
      sessionId: activeSessionIdRef.current,
      comment
    });
  }, [sendEvent]);

  const addReaction = useCallback((nodeId: string, userId: string, emoji: string) => {
    if (!activeSessionIdRef.current) return;

    // Optimistic local update
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        reactions: { ...n.reactions, [userId]: emoji }
      };
    }));

    sendEvent('reaction:add', {
      sessionId: activeSessionIdRef.current,
      nodeId,
      userId,
      emoji
    });
  }, [sendEvent]);

  const addVote = useCallback((nodeId: string, userId: string) => {
    if (!activeSessionIdRef.current) return;

    // Optimistic local update
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const votes = [...(n.votes || [])];
      const idx = votes.indexOf(userId);
      if (idx > -1) {
        votes.splice(idx, 1);
      } else {
        votes.push(userId);
      }
      return { ...n, votes };
    }));

    sendEvent('vote:add', {
      sessionId: activeSessionIdRef.current,
      nodeId,
      userId
    });
  }, [sendEvent]);

  const toggleLock = useCallback((isLocked: boolean) => {
    if (!activeSessionIdRef.current) return;
    sendEvent('teacher:lock', {
      sessionId: activeSessionIdRef.current,
      isLocked
    });
  }, [sendEvent]);

  const changeLayout = useCallback((layout: 'radial' | 'force' | 'tree' | 'timeline') => {
    if (!activeSessionIdRef.current) return;
    sendEvent('teacher:layout', {
      sessionId: activeSessionIdRef.current,
      layout
    });
  }, [sendEvent]);

  const changeMode = useCallback((mode: 'brainstorm' | 'moderated' | 'voting') => {
    if (!activeSessionIdRef.current) return;
    sendEvent('teacher:mode', {
      sessionId: activeSessionIdRef.current,
      mode
    });
  }, [sendEvent]);

  const spotlightNode = useCallback((nodeId: string | null) => {
    if (!activeSessionIdRef.current) return;
    sendEvent('teacher:spotlight', {
      sessionId: activeSessionIdRef.current,
      nodeId
    });
  }, [sendEvent]);

  const approveNode = useCallback((nodeId: string) => {
    if (!activeSessionIdRef.current) return;
    sendEvent('teacher:approve', {
      sessionId: activeSessionIdRef.current,
      nodeId
    });
  }, [sendEvent]);

  const rejectNode = useCallback((nodeId: string) => {
    if (!activeSessionIdRef.current) return;
    sendEvent('teacher:reject', {
      sessionId: activeSessionIdRef.current,
      nodeId
    });
  }, [sendEvent]);

  const endSession = useCallback(() => {
    if (!activeSessionIdRef.current) return;
    sendEvent('session:end', {
      sessionId: activeSessionIdRef.current
    });
  }, [sendEvent]);

  const addMemo = useCallback((memoData: { question: string; category?: QAMemo['category']; color?: string }) => {
    if (!activeSessionIdRef.current || !activeUserRef.current) return;
    const now = new Date().toISOString();
    sendEvent('memo:create', {
      sessionId: activeSessionIdRef.current,
      memo: {
        id: `memo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sessionId: activeSessionIdRef.current,
        question: memoData.question,
        category: memoData.category || 'Question',
        color: memoData.color || '#fef08a',
        authorId: activeUserRef.current.id,
        authorName: activeUserRef.current.name,
        authorRole: activeUserRef.current.role,
        votes: [],
        isAnswered: false,
        isPinned: false,
        createdAt: now,
        updatedAt: now
      }
    });
  }, [sendEvent]);

  const updateMemo = useCallback((memoId: string, updates: Partial<QAMemo>) => {
    if (!activeSessionIdRef.current) return;
    sendEvent('memo:update', {
      sessionId: activeSessionIdRef.current,
      memoId,
      updates
    });
  }, [sendEvent]);

  const voteMemo = useCallback((memoId: string) => {
    if (!activeSessionIdRef.current || !activeUserRef.current) return;
    sendEvent('memo:vote', {
      sessionId: activeSessionIdRef.current,
      memoId,
      userId: activeUserRef.current.id
    });
  }, [sendEvent]);

  const deleteMemo = useCallback((memoId: string) => {
    if (!activeSessionIdRef.current) return;
    sendEvent('memo:delete', {
      sessionId: activeSessionIdRef.current,
      memoId
    });
  }, [sendEvent]);

  // Activity functions
  const createActivity = useCallback((
    title: string,
    template: MindMapActivity['template'] = 'blank',
    description?: string,
    category?: string
  ) => {
    if (!activeSessionIdRef.current || !activeUserRef.current) return;
    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newActivity: MindMapActivity = {
      id: actId,
      sessionId: activeSessionIdRef.current,
      title,
      description: description || '',
      category: category || 'Mind Map',
      template,
      createdById: activeUserRef.current.id,
      createdByName: activeUserRef.current.name,
      createdAt: now,
      updatedAt: now
    };

    const { seedNodes, seedEdges } = generateTemplateSeeds(
      activeSessionIdRef.current,
      actId,
      title,
      template,
      activeUserRef.current.id,
      activeUserRef.current.name
    );

    // Optimistic state update
    setActivities(prev => [...prev, newActivity]);
    setActiveActivityId(actId);
    setNodes(prev => [...prev, ...seedNodes]);
    setEdges(prev => [...prev, ...seedEdges]);

    sendEvent('activity:create', {
      sessionId: activeSessionIdRef.current,
      activity: newActivity,
      seedNodes,
      seedEdges
    });
  }, [sendEvent]);

  const selectActivity = useCallback((activityId: string) => {
    if (!activeSessionIdRef.current) return;
    setActiveActivityId(activityId);
    sendEvent('activity:select', {
      sessionId: activeSessionIdRef.current,
      activityId
    });
  }, [sendEvent]);

  const updateActivity = useCallback((activityId: string, updates: Partial<MindMapActivity>) => {
    if (!activeSessionIdRef.current) return;
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
    sendEvent('activity:update', {
      sessionId: activeSessionIdRef.current,
      activity: { id: activityId, ...updates }
    });
  }, [sendEvent]);

  const deleteActivity = useCallback((activityId: string) => {
    if (!activeSessionIdRef.current) return;
    setActivities(prev => {
      const next = prev.filter(a => a.id !== activityId);
      setActiveActivityId(current => current === activityId ? (next[0]?.id || null) : current);
      return next;
    });
    setNodes(prev => prev.filter(n => n.activityId !== activityId));
    setEdges(prev => prev.filter(e => e.activityId !== activityId));

    sendEvent('activity:delete', {
      sessionId: activeSessionIdRef.current,
      activityId
    });
  }, [sendEvent]);

  // Allows manual sync for layouts/autocleans
  const syncMapState = useCallback((nodesToSync: MindMapNode[], edgesToSync: MindMapEdge[]) => {
    if (!activeSessionIdRef.current) return;
    
    // Set locally
    setNodes(nodesToSync);
    setEdges(edgesToSync);

    // Send each node/edge update to server (or map:sync if supported, we can update them in sequence)
    nodesToSync.forEach(node => {
      sendEvent('node:update', {
        sessionId: activeSessionIdRef.current,
        node
      });
    });
  }, [sendEvent]);

  return {
    session,
    nodes,
    edges,
    memos,
    activities,
    activeActivityId,
    participants,
    cursors,
    connected,
    spotlightNodeId,
    joinSession,
    sendCursorMove,
    createNode,
    updateNode,
    dragNode,
    deleteNode,
    createEdge,
    deleteEdge,
    addComment,
    addReaction,
    addVote,
    addMemo,
    updateMemo,
    voteMemo,
    deleteMemo,
    createActivity,
    selectActivity,
    updateActivity,
    deleteActivity,
    toggleLock,
    changeLayout,
    changeMode,
    spotlightNode,
    approveNode,
    rejectNode,
    endSession,
    syncMapState
  };
}

// Helper to generate seed nodes and edges based on template type
function generateTemplateSeeds(
  sessionId: string,
  activityId: string,
  title: string,
  template?: MindMapActivity['template'],
  createdById?: string,
  createdByName?: string
): { seedNodes: MindMapNode[]; seedEdges: MindMapEdge[] } {
  const seedNodes: MindMapNode[] = [];
  const seedEdges: MindMapEdge[] = [];
  const now = new Date().toISOString();
  const userId = createdById || 'system';
  const userName = createdByName || 'User';

  const centralId = `node_act_${activityId}_central`;
  
  let centralColor = '#3b82f6';
  let centralIcon = '💡';
  let centralCategory = 'Main Concept';

  if (template === 'swot') {
    centralColor = '#3b82f6';
    centralIcon = '📊';
    centralCategory = 'SWOT Analysis';
  } else if (template === 'pros_cons') {
    centralColor = '#8b5cf6';
    centralIcon = '⚖️';
    centralCategory = 'Evaluation';
  } else if (template === 'problem_solving') {
    centralColor = '#ef4444';
    centralIcon = '🎯';
    centralCategory = 'Problem Solving';
  } else if (template === 'timeline') {
    centralColor = '#06b6d4';
    centralIcon = '⏳';
    centralCategory = 'Process Timeline';
  } else if (template === 'group_brainstorm') {
    centralColor = '#10b981';
    centralIcon = '👥';
    centralCategory = 'Group Board';
  }

  seedNodes.push({
    id: centralId,
    sessionId,
    activityId,
    parentId: null,
    createdById: userId,
    createdByName: userName,
    title,
    description: `Central hub for ${title}`,
    color: centralColor,
    icon: centralIcon,
    category: centralCategory,
    x: 0,
    y: 0,
    z: 0,
    votes: [],
    reactions: {},
    createdAt: now,
    updatedAt: now,
    status: 'approved',
    shape: 'rectangle'
  });

  let branches: Array<{ title: string; category: string; color: string; x: number; y: number; icon?: string }> = [];

  if (template === 'swot') {
    branches = [
      { title: 'Strengths', category: 'Internal Positive', color: '#10b981', x: -220, y: -120, icon: '💪' },
      { title: 'Weaknesses', category: 'Internal Negative', color: '#ef4444', x: 220, y: -120, icon: '⚠️' },
      { title: 'Opportunities', category: 'External Positive', color: '#f59e0b', x: -220, y: 120, icon: '🚀' },
      { title: 'Threats', category: 'External Risks', color: '#8b5cf6', x: 220, y: 120, icon: '🛡️' }
    ];
  } else if (template === 'pros_cons') {
    branches = [
      { title: 'Pros & Benefits', category: 'Advantages', color: '#10b981', x: -220, y: 0, icon: '✅' },
      { title: 'Cons & Risks', category: 'Drawbacks', color: '#ef4444', x: 220, y: 0, icon: '❌' }
    ];
  } else if (template === 'problem_solving') {
    branches = [
      { title: 'Root Causes', category: 'Diagnosis', color: '#f59e0b', x: -220, y: -100, icon: '🔍' },
      { title: 'Proposed Solutions', category: 'Ideas', color: '#10b981', x: 220, y: -100, icon: '💡' },
      { title: 'Action Plan', category: 'Implementation', color: '#06b6d4', x: 0, y: 180, icon: '📋' }
    ];
  } else if (template === 'timeline') {
    branches = [
      { title: 'Phase 1: Initiation', category: 'Start', color: '#06b6d4', x: -250, y: 0, icon: '🚀' },
      { title: 'Phase 2: Execution', category: 'In Progress', color: '#f59e0b', x: 0, y: 0, icon: '⚡' },
      { title: 'Phase 3: Final Review', category: 'Completion', color: '#10b981', x: 250, y: 0, icon: '🏁' }
    ];
  } else if (template === 'group_brainstorm') {
    branches = [
      { title: 'Team Alpha', category: 'Group 1', color: '#3b82f6', x: -220, y: -100, icon: '🅰️' },
      { title: 'Team Beta', category: 'Group 2', color: '#ec4899', x: 220, y: -100, icon: '🅱️' },
      { title: 'Team Gamma', category: 'Group 3', color: '#10b981', x: 0, y: 180, icon: '🅶' }
    ];
  }

  branches.forEach((b, idx) => {
    const branchId = `node_act_${activityId}_b${idx}`;
    seedNodes.push({
      id: branchId,
      sessionId,
      activityId,
      parentId: centralId,
      createdById: userId,
      createdByName: userName,
      title: b.title,
      description: `Collaborate on ${b.title}`,
      color: b.color,
      icon: b.icon || '📌',
      category: b.category,
      x: b.x,
      y: b.y,
      z: 0,
      votes: [],
      reactions: {},
      createdAt: now,
      updatedAt: now,
      status: 'approved'
    });

    seedEdges.push({
      id: `edge_act_${activityId}_e${idx}`,
      sessionId,
      activityId,
      source: centralId,
      target: branchId,
      label: 'branch',
      color: b.color,
      thickness: 2,
      style: 'curved',
      createdAt: now
    });
  });

  return { seedNodes, seedEdges };
}
