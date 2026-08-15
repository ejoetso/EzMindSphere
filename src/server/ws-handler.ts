/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket, WebSocketServer } from 'ws';
import { db } from './db.js';
import { UserRole, MindMapNode, MindMapEdge, Comment } from '../types.js';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  name: string;
  role: UserRole;
  sessionId: string;
}

// Maps room IDs (sessionIds) to a Set of client connections
const rooms = new Map<string, Set<ClientConnection>>();

// Helper to broadcast to a room (optionally skipping a sender)
export function broadcastToRoom(sessionId: string, message: any, skipUserId?: string) {
  const clients = rooms.get(sessionId);
  if (!clients) return;

  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!skipUserId || client.userId !== skipUserId) {
        client.ws.send(payload);
      }
    }
  });
}

export function initWebSocketServer(wss: WebSocketServer) {
  console.log('Real-Time WebSocket Server initialized alongside HTTP server.');

  wss.on('connection', (ws: WebSocket) => {
    let clientInfo: ClientConnection | null = null;

    ws.on('message', (messageBuffer) => {
      try {
        const rawMessage = messageBuffer.toString();
        const msg = JSON.parse(rawMessage);
        const { event, data } = msg;

        if (!event || !data) return;

        switch (event) {
          case 'session:join': {
            const { sessionId, userId, name, role } = data;
            
            // Cleanup past stale connections for this user in this room
            const existingRoom = rooms.get(sessionId);
            if (existingRoom) {
              existingRoom.forEach(c => {
                if (c.userId === userId) {
                  c.ws.close();
                  existingRoom.delete(c);
                }
              });
            }

            // Create client info
            clientInfo = { ws, userId, name, role, sessionId };

            // Add to room map
            if (!rooms.has(sessionId)) {
              rooms.set(sessionId, new Set());
            }
            rooms.get(sessionId)!.add(clientInfo);

            // Update database presence
            db.updateParticipantPresence(sessionId, userId, name, role, true);
            db.addAuditLog(sessionId, userId, name, 'join', `Joined the room as ${role}`);

            // Broadcast join and presence list
            broadcastToRoom(sessionId, {
              event: 'participant:list',
              data: {
                participants: db.getParticipants(sessionId)
              }
            });

            // Send initial state sync to this client (nodes & edges & memos)
            const nodes = db.getNodes(sessionId);
            const edges = db.getEdges(sessionId);
            const session = db.getSession(sessionId);
            const memos = db.getQAMemos(sessionId);

            ws.send(JSON.stringify({
              event: 'map:sync',
              data: { sessionId, nodes, edges, session, memos }
            }));

            break;
          }

          case 'cursor:move': {
            if (!clientInfo) return;
            const { sessionId, userId, cursor2D } = data;
            
            // Broadcast client cursor positions to all other room participants
            broadcastToRoom(sessionId, {
              event: 'cursor:update',
              data: { userId, name: clientInfo.name, cursor2D }
            }, userId); // skip sender

            break;
          }

          case 'node:create': {
            if (!clientInfo) return;
            const { sessionId, node } = data;

            const session = db.getSession(sessionId);
            if (!session) return;

            // Enforce teacher lock rules
            if (clientInfo.role === 'student') {
              if (!session.settings.studentCanEdit) {
                ws.send(JSON.stringify({ event: 'error', data: 'Teacher has locked editing.' }));
                return;
              }
              // Check moderated mode
              if (session.settings.approvalRequired) {
                node.status = 'pending';
              } else {
                node.status = 'approved';
              }
            } else {
              node.status = 'approved';
            }

            // Save in DB
            db.createNode(node);
            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'node:create', `Created node: "${node.title}"`);

            // Broadcast node creation to room
            broadcastToRoom(sessionId, {
              event: 'node:created',
              data: { node }
            });

            break;
          }

          case 'node:update': {
            if (!clientInfo) return;
            const { sessionId, node } = data;

            const session = db.getSession(sessionId);
            if (!session) return;

            const existingNode = db.getNode(node.id);
            if (!existingNode) return;

            // Security permission check
            if (clientInfo.role === 'student') {
              if (!session.settings.studentCanEdit) {
                ws.send(JSON.stringify({ event: 'error', data: 'Editing is locked.' }));
                return;
              }
              // Students can only edit their own nodes
              if (existingNode.createdById !== clientInfo.userId) {
                ws.send(JSON.stringify({ event: 'error', data: 'You can only edit nodes you created.' }));
                return;
              }
            }

            // Update in DB
            const updated = db.updateNode(node.id, node);
            if (updated) {
              broadcastToRoom(sessionId, {
                event: 'node:updated',
                data: { node: updated }
              });
            }

            break;
          }

          case 'node:drag': {
            // Drag is a lightweight operation (frequent positional updates during active user drags)
            if (!clientInfo) return;
            const { sessionId, nodeId, x, y, z } = data;

            const node = db.getNode(nodeId);
            if (!node) return;

            if (clientInfo.role === 'student' && node.createdById !== clientInfo.userId) {
              ws.send(JSON.stringify({ event: 'error', data: 'You can only move nodes you created.' }));
              return;
            }

            // Update position in DB without full disk commit on every intermediate pixel coordinate
            node.x = x;
            node.y = y;
            node.z = z ?? node.z;

            // Broadcast movement live to everyone else in the session
            broadcastToRoom(sessionId, {
              event: 'node:dragged',
              data: { nodeId, x, y, z }
            }, clientInfo.userId); // skip drag initiator to prevent lag

            break;
          }

          case 'node:delete': {
            if (!clientInfo) return;
            const { sessionId, nodeId } = data;

            const session = db.getSession(sessionId);
            const node = db.getNode(nodeId);
            if (!session || !node) return;

            if (clientInfo.role === 'student' && node.createdById !== clientInfo.userId) {
              ws.send(JSON.stringify({ event: 'error', data: 'You can only delete nodes you created.' }));
              return;
            }

            db.deleteNode(nodeId);
            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'node:delete', `Deleted node: "${node.title}"`);

            broadcastToRoom(sessionId, {
              event: 'node:deleted',
              data: { nodeId }
            });

            break;
          }

          case 'edge:create': {
            if (!clientInfo) return;
            const { sessionId, edge } = data;

            const session = db.getSession(sessionId);
            if (!session) return;

            if (clientInfo.role === 'student' && !session.settings.studentCanEdit) return;

            db.createEdge(edge);
            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'edge:create', `Connected nodes: ${edge.source} -> ${edge.target}`);

            broadcastToRoom(sessionId, {
              event: 'edge:created',
              data: { edge }
            });

            break;
          }

          case 'edge:delete': {
            if (!clientInfo) return;
            const { sessionId, edgeId } = data;

            const session = db.getSession(sessionId);
            if (!session) return;

            if (clientInfo.role === 'student' && !session.settings.studentCanEdit) return;

            db.deleteEdge(edgeId);

            broadcastToRoom(sessionId, {
              event: 'edge:deleted',
              data: { edgeId }
            });

            break;
          }

          case 'comment:create': {
            if (!clientInfo) return;
            const { sessionId, comment } = data;

            db.createComment(comment);
            broadcastToRoom(sessionId, {
              event: 'comment:created',
              data: { comment }
            });

            break;
          }

          case 'reaction:add': {
            if (!clientInfo) return;
            const { sessionId, nodeId, userId, emoji } = data;

            const node = db.getNode(nodeId);
            if (node) {
              if (!node.reactions) node.reactions = {};
              node.reactions[userId] = emoji;
              db.updateNode(nodeId, { reactions: node.reactions });

              broadcastToRoom(sessionId, {
                event: 'reaction:added',
                data: { nodeId, userId, emoji }
              });
            }

            break;
          }

          case 'vote:add': {
            if (!clientInfo) return;
            const { sessionId, nodeId, userId } = data;

            const node = db.getNode(nodeId);
            if (node) {
              if (!node.votes) node.votes = [];
              const idx = node.votes.indexOf(userId);
              if (idx > -1) {
                // Toggle vote off if clicked again
                node.votes.splice(idx, 1);
              } else {
                node.votes.push(userId);
              }
              db.updateNode(nodeId, { votes: node.votes });

              broadcastToRoom(sessionId, {
                event: 'vote:updated',
                data: { nodeId, votes: node.votes }
              });
            }

            break;
          }

          case 'teacher:lock': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, isLocked } = data;

            const session = db.getSession(sessionId);
            if (session) {
              session.settings.studentCanEdit = !isLocked;
              db.updateSession(sessionId, { settings: session.settings });
              db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'teacher:lock', `Locked board editing: ${isLocked}`);

              broadcastToRoom(sessionId, {
                event: 'teacher:locked',
                data: { isLocked }
              });
            }

            break;
          }

          case 'teacher:layout': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, layout } = data;

            db.updateSession(sessionId, { activeLayout: layout });
            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'teacher:layout', `Changed active layout mode to: "${layout}"`);

            broadcastToRoom(sessionId, {
              event: 'teacher:layed_out',
              data: { layout }
            });

            break;
          }

          case 'teacher:mode': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, mode } = data;

            db.updateSession(sessionId, { activeEngagementMode: mode });
            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'teacher:mode', `Switched classroom engagement mode to: "${mode}"`);

            broadcastToRoom(sessionId, {
              event: 'teacher:moded',
              data: { mode }
            });

            break;
          }

          case 'teacher:spotlight': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, nodeId } = data;

            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'teacher:spotlight', nodeId ? `Spotlighted node ID: ${nodeId}` : 'Cleared spotlight');

            broadcastToRoom(sessionId, {
              event: 'teacher:spotlighted',
              data: { nodeId }
            });

            break;
          }

          case 'teacher:approve': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, nodeId } = data;

            const node = db.getNode(nodeId);
            if (node && node.status === 'pending') {
              db.updateNode(nodeId, { status: 'approved' });
              db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'teacher:approve', `Approved pending node: "${node.title}"`);

              broadcastToRoom(sessionId, {
                event: 'node:approved',
                data: { nodeId, node: { ...node, status: 'approved' } }
              });
            }

            break;
          }

          case 'teacher:reject': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, nodeId } = data;

            const node = db.getNode(nodeId);
            if (node && node.status === 'pending') {
              db.deleteNode(nodeId);
              db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'teacher:reject', `Rejected pending node: "${node.title}"`);

              broadcastToRoom(sessionId, {
                event: 'node:rejected',
                data: { nodeId }
              });
            }

            break;
          }

          case 'memo:create': {
            if (!clientInfo) return;
            const { sessionId, memo } = data;
            const created = db.createQAMemo(memo);
            broadcastToRoom(sessionId, {
              event: 'memo:created',
              data: { memo: created }
            });
            break;
          }

          case 'memo:update': {
            if (!clientInfo) return;
            const { sessionId, memo } = data;
            const updated = db.updateQAMemo(memo.id, memo);
            if (updated) {
              broadcastToRoom(sessionId, {
                event: 'memo:updated',
                data: { memo: updated }
              });
            }
            break;
          }

          case 'memo:vote': {
            if (!clientInfo) return;
            const { sessionId, memoId, userId } = data;
            const voted = db.voteQAMemo(memoId, userId || clientInfo.userId);
            if (voted) {
              broadcastToRoom(sessionId, {
                event: 'memo:updated',
                data: { memo: voted }
              });
            }
            break;
          }

          case 'memo:delete': {
            if (!clientInfo) return;
            const { sessionId, memoId } = data;
            const deleted = db.deleteQAMemo(memoId);
            if (deleted) {
              broadcastToRoom(sessionId, {
                event: 'memo:deleted',
                data: { memoId }
              });
            }
            break;
          }

          case 'activity:create': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, activity, seedNodes = [], seedEdges = [] } = data;
            
            const createdAct = db.createActivity(sessionId, activity);
            
            // Save seed nodes and edges
            seedNodes.forEach((n: any) => db.createNode(n));
            seedEdges.forEach((e: any) => db.createEdge(e));

            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'activity:create', `Created mind map activity: "${activity.title}"`);

            broadcastToRoom(sessionId, {
              event: 'activity:created',
              data: { activity: createdAct, seedNodes, seedEdges }
            });
            break;
          }

          case 'activity:select': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, activityId } = data;
            
            db.updateSession(sessionId, { activeActivityId: activityId });

            broadcastToRoom(sessionId, {
              event: 'activity:selected',
              data: { activityId }
            });
            break;
          }

          case 'activity:update': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, activity } = data;
            
            const updated = db.updateActivity(sessionId, activity.id, activity);
            if (updated) {
              broadcastToRoom(sessionId, {
                event: 'activity:updated',
                data: { activity: updated }
              });
            }
            break;
          }

          case 'activity:delete': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId, activityId } = data;
            
            const deleted = db.deleteActivity(sessionId, activityId);
            if (deleted) {
              broadcastToRoom(sessionId, {
                event: 'activity:deleted',
                data: { activityId }
              });
            }
            break;
          }

          case 'session:end': {
            if (!clientInfo || clientInfo.role !== 'educator') return;
            const { sessionId } = data;

            db.updateSession(sessionId, { status: 'ended', endedAt: new Date().toISOString() });
            db.addAuditLog(sessionId, clientInfo.userId, clientInfo.name, 'session:end', 'Ended the live session room');

            broadcastToRoom(sessionId, {
              event: 'session:ended',
              data: { sessionId }
            });

            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing/handling error:', err);
      }
    });

    ws.on('close', () => {
      if (clientInfo) {
        const { sessionId, userId, name, role } = clientInfo;
        const roomSet = rooms.get(sessionId);
        if (roomSet) {
          roomSet.delete(clientInfo);
          if (roomSet.size === 0) {
            rooms.delete(sessionId);
          }
        }

        // Update database presence
        db.updateParticipantPresence(sessionId, userId, name, role, false);

        // Broadcast leave event and updated participant list
        broadcastToRoom(sessionId, {
          event: 'participant:list',
          data: {
            participants: db.getParticipants(sessionId)
          }
        });
      }
    });
  });
}
