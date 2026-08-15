import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import jwt from 'jsonwebtoken';

type State = { users: any[]; sessions: any[]; maps: Record<string, any>; liveSessions: any[]; activities: any[]; participants: any[]; responses: any[]; questions: any[] };
const empty = (): State => ({ users: [], sessions: [], maps: {}, liveSessions: [], activities: [], participants: [], responses: [], questions: [] });
const json = (body: unknown, status = 200) => Response.json(body, { status });
const store = () => getStore('cloud-platform');
const load = async () => { const state = (await store().get('state', { type: 'json', consistency: 'strong' }) as State | null) || empty(); state.users ||= []; return state; };
const save = async (state: State) => store().setJSON('state', state);
const bodyOf = async (request: Request) => { try { return await request.json() as any; } catch { return {}; } };
const userOf = (request: Request) => {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
    const p = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    return { id: p.id || p.userId, name: p.name || 'EzMindSphere Educator', role: p.role };
  } catch { return null; }
};
const id = (prefix: string) => `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 5)}`;
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');
const publicUser = ({ passwordHash: _passwordHash, ...user }: any) => user;

export default async (request: Request) => {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const state = await load();
  const user = userOf(request);

  if (path === '/api/config/share-url' && method === 'GET') {
    const code = String(url.searchParams.get('code') || '').trim().toUpperCase().replace(/^(MIND|LIVE)-/, '');
    return json({ baseUrl: `${url.origin}/app`, joinUrl: code ? `${url.origin}/app?joinCode=${encodeURIComponent(code)}` : `${url.origin}/app` });
  }

  if (path === '/api/admin/users' && method === 'GET') {
    if (!user || user.role !== 'admin') return json({ error: 'Administrator access required' }, 403);
    const defaults = [{ id: 'u_admin_ejoe', name: 'Ejoe Tso', email: process.env.ADMIN_EMAIL || 'ejoe@ejoe.com', role: 'admin', disabled: false }, { id: 'u_educator_ezmindsphere', name: 'EzMindSphere Educator', email: process.env.EDUCATOR_USERNAME || 'ezmindsphere', role: 'educator', disabled: false }];
    return json([...defaults, ...state.users].filter((item, index, all) => all.findIndex(x => x.id === item.id) === index).map(publicUser));
  }
  if (path === '/api/admin/users' && method === 'POST') {
    if (!user || user.role !== 'admin') return json({ error: 'Administrator access required' }, 403);
    const b = await bodyOf(request), email = String(b.email || '').trim().toLowerCase();
    if (!b.name || !email || !b.password) return json({ error: 'Name, email, and password are required.' }, 400);
    if (!['educator','admin'].includes(b.role || 'educator')) return json({ error: 'Managed accounts must be educators or administrators.' }, 400);
    if (String(b.password).length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
    if (state.users.some(x => x.email === email) || ['ejoe@ejoe.com','ezmindsphere'].includes(email)) return json({ error: 'An account with this email already exists.' }, 409);
    const created = { id: id(`u_${b.role || 'educator'}`), name: String(b.name).trim(), email, role: b.role || 'educator', disabled: false, passwordHash: await hash(String(b.password)) };
    state.users.push(created); await save(state); return json(publicUser(created), 201);
  }
  const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (adminUserMatch && method === 'PATCH') {
    if (!user || user.role !== 'admin') return json({ error: 'Administrator access required' }, 403);
    const index = state.users.findIndex(x => x.id === adminUserMatch[1]); if (index < 0) return json({ error: 'Account not found.' }, 404);
    const b = await bodyOf(request); if (b.password && String(b.password).length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
    if (b.role && !['educator','admin'].includes(b.role)) return json({ error: 'Managed accounts must be educators or administrators.' }, 400);
    const updates: any = { ...b }; if (b.password) { updates.passwordHash = await hash(String(b.password)); delete updates.password; }
    state.users[index] = { ...state.users[index], ...updates }; await save(state); return json(publicUser(state.users[index]));
  }
  if (adminUserMatch && method === 'DELETE') {
    if (!user || user.role !== 'admin') return json({ error: 'Administrator access required' }, 403);
    const before = state.users.length; state.users = state.users.filter(x => x.id !== adminUserMatch[1]);
    if (state.users.length === before) return json({ error: 'Account not found.' }, 404);
    await save(state); return json({ success: true });
  }

  if (path === '/api/educator/metrics' && method === 'GET') {
    if (!user) return json({ error: 'Access token required' }, 401);
    const owned = state.sessions.filter(s => s.educatorId === user.id);
    const live = state.liveSessions.filter(s => s.ownerId === user.id);
    return json({ activeStudents: state.participants.filter(p => live.some(s => s.id === p.sessionId)).length, assessments: state.activities.filter(a => live.some(s => s.id === a.sessionId) && a.type === 'multiple_choice').length, activeSessions: owned.filter(s => s.status === 'active').length + live.filter(s => !['completed','archived'].includes(s.status)).length, totalSessions: owned.length + live.length });
  }
  if ((path === '/api/sessions' || path === '/api/sessions/history') && method === 'GET') {
    if (!user) return json({ error: 'Access token required' }, 401);
    return json(state.sessions.filter(s => user.role === 'admin' || s.educatorId === user.id));
  }
  if (path === '/api/sessions' && method === 'POST') {
    if (!user) return json({ error: 'Access token required' }, 401);
    const b = await bodyOf(request), sessionId = id('session'), code = `MIND-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const session = { id: sessionId, code, title: b.title, subject: b.subject, description: b.description || '', status: 'active', educatorId: user.id, educatorName: user.name, settings: { studentCanEdit: b.studentCanEdit !== false, approvalRequired: !!b.approvalRequired, allowDownload: b.allowDownload !== false, maxParticipants: b.maxParticipants || 50 }, createdAt: new Date().toISOString(), activeLayout: 'radial', activeEngagementMode: 'brainstorm', activities: [] };
    state.sessions.unshift(session); state.maps[sessionId] = { session, nodes: [], edges: [], memos: [], activities: [] }; await save(state); return json(session, 201);
  }
  if (path === '/api/sessions/join' && method === 'POST') {
    const b = await bodyOf(request), submitted = String(b.code || '').trim().toUpperCase().replace(/^MIND-/, ''), session = state.sessions.find(s => String(s.code).toUpperCase().replace(/^MIND-/, '') === submitted);
    return session ? json({ session }) : json({ error: 'Active classroom session not found with this join code.' }, 404);
  }
  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch && method === 'GET') { const s = state.sessions.find(x => x.id === sessionMatch[1]); return s ? json(s) : json({ error: 'Session not found' }, 404); }
  if (sessionMatch && method === 'DELETE') { state.sessions = state.sessions.filter(x => x.id !== sessionMatch[1]); delete state.maps[sessionMatch[1]]; await save(state); return json({ success: true }); }
  const mapMatch = path.match(/^\/api\/maps\/([^/]+)$/);
  if (mapMatch && method === 'GET') { const map = state.maps[mapMatch[1]]; return map ? json(map) : json({ error: 'Session not found' }, 404); }
  const realtimeMatch = path.match(/^\/api\/cloud\/realtime\/([^/]+)$/);
  if (realtimeMatch && method === 'GET') { const map = state.maps[realtimeMatch[1]]; return map ? json({ ...map, participants: state.participants.filter(p => p.sessionId === realtimeMatch[1] && p.kind === 'mindmap') }) : json({ error: 'Session not found' }, 404); }
  if (realtimeMatch && method === 'POST') {
    const b = await bodyOf(request), map = state.maps[realtimeMatch[1]];
    if (!map) return json({ error: 'Session not found' }, 404);
    const d = b.data || {};
    if (b.event === 'session:join') {
      const existing = state.participants.findIndex(p => p.sessionId === realtimeMatch[1] && p.userId === d.userId && p.kind === 'mindmap');
      const participant = { id: `participant_${d.userId}`, sessionId: realtimeMatch[1], userId: d.userId, name: d.name, role: d.role, kind: 'mindmap', joinedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
      if (existing >= 0) state.participants[existing] = { ...state.participants[existing], ...participant, joinedAt: state.participants[existing].joinedAt };
      else state.participants.push(participant);
    }
    if (b.event === 'node:create') map.nodes.push(d.node);
    if (b.event === 'node:update') map.nodes = map.nodes.map((n:any) => n.id === d.node.id ? {...n,...d.node} : n);
    if (b.event === 'node:drag') map.nodes = map.nodes.map((n:any) => n.id === d.nodeId ? {...n,x:d.x,y:d.y,z:d.z ?? n.z} : n);
    if (b.event === 'node:delete') { map.nodes = map.nodes.filter((n:any) => n.id !== d.nodeId); map.edges = map.edges.filter((e:any) => e.source !== d.nodeId && e.target !== d.nodeId); }
    if (b.event === 'edge:create') map.edges.push(d.edge);
    if (b.event === 'edge:delete') map.edges = map.edges.filter((e:any) => e.id !== d.edgeId);
    if (b.event === 'activity:create') { map.activities.push(d.activity); map.nodes.push(...(d.seedNodes || [])); map.edges.push(...(d.seedEdges || [])); map.session.activeActivityId = d.activity.id; }
    if (b.event === 'activity:select') map.session.activeActivityId = d.activityId;
    if (b.event === 'activity:update') map.activities = map.activities.map((a:any) => a.id === d.activity.id ? {...a,...d.activity} : a);
    if (b.event === 'activity:delete') { map.activities = map.activities.filter((a:any) => a.id !== d.activityId); map.nodes = map.nodes.filter((n:any) => n.activityId !== d.activityId); map.edges = map.edges.filter((e:any) => e.activityId !== d.activityId); }
    if (b.event === 'teacher:layout') map.session.activeLayout = d.layout;
    if (b.event === 'teacher:mode') map.session.activeEngagementMode = d.mode;
    await save(state); return json({ success: true });
  }

  if (path === '/api/live/sessions' && method === 'GET') { if (!user) return json({error:'Access token required'},401); return json(state.liveSessions.filter(s => user.role === 'admin' || s.ownerId === user.id)); }
  if (path === '/api/live/sessions' && method === 'POST') {
    if (!user) return json({error:'Access token required'},401); const b=await bodyOf(request), sid=id('live'), now=new Date().toISOString();
    const session={id:sid,ownerId:user.id,ownerName:user.name,title:b.title||'Live Interaction Session',description:b.description||'',joinCode:String(Math.floor(1000+Math.random()*9000)),participationMode:'anonymous',pacingMode:b.settings?.pacingMode||'presenter',status:'draft',activeActivityId:null,resultsVisibility:'live',moderationMode:'none',participantLimit:100,createdAt:now,updatedAt:now};
    const activities=[{id:id('act'),sessionId:sid,type:'multiple_choice',title:'Core Concept Check',description:'Select the best answer.',position:1,status:'draft',resultVisibility:'live',moderationMode:'none',options:['Option A','Option B','Option C','Not sure'].map((label,i)=>({id:id('opt'),activityId:'',label,position:i+1,isCorrect:i===0})),createdAt:now,updatedAt:now},{id:id('act'),sessionId:sid,type:'open_ended',title:'Key Insights & Ideas',description:'Share your key takeaway.',position:2,status:'draft',resultVisibility:'live',moderationMode:'none',createdAt:now,updatedAt:now},{id:id('act'),sessionId:sid,type:'qa',title:'Live Q&A Forum',description:'Ask and vote on questions.',position:3,status:'active',resultVisibility:'live',moderationMode:'none',createdAt:now,updatedAt:now}];
    state.liveSessions.unshift(session); state.activities.push(...activities); await save(state); return json({session,activities,joinUrl:`${url.origin}/app?code=${session.joinCode}`,qrCodeUrl:''},201);
  }
  const codeMatch=path.match(/^\/api\/live\/code\/([^/]+)$/); if(codeMatch&&method==='GET'){const submitted=decodeURIComponent(codeMatch[1]).toUpperCase().replace(/^LIVE-/,''),s=state.liveSessions.find(x=>String(x.joinCode).toUpperCase().replace(/^LIVE-/,'')===submitted);return s?json({session:s,joinUrl:`${url.origin}/app?code=${encodeURIComponent(s.joinCode)}`,qrCodeUrl:''}):json({error:'Live session not found'},404);}
  const liveMatch=path.match(/^\/api\/live\/sessions\/([^/]+)$/);
  if(liveMatch&&method==='GET'){const s=state.liveSessions.find(x=>x.id===liveMatch[1]);if(!s)return json({error:'Session not found'},404);const acts=state.activities.filter(a=>a.sessionId===s.id);return json({session:s,activities:acts,participants:state.participants.filter(p=>p.sessionId===s.id),responsesMap:Object.fromEntries(acts.map(a=>[a.id,state.responses.filter(r=>r.activityId===a.id)])),clustersMap:{},audienceQuestions:state.questions.filter(q=>q.sessionId===s.id),resultLinks:[],joinUrl:`${url.origin}/app?code=${s.joinCode}`,qrCodeUrl:''});}
  if(liveMatch&&method==='PATCH'){const b=await bodyOf(request);state.liveSessions=state.liveSessions.map(s=>s.id===liveMatch[1]?{...s,...b,updatedAt:new Date().toISOString()}:s);await save(state);return json(state.liveSessions.find(s=>s.id===liveMatch[1]));}
  if(liveMatch&&method==='DELETE'){state.liveSessions=state.liveSessions.filter(s=>s.id!==liveMatch[1]);state.activities=state.activities.filter(a=>a.sessionId!==liveMatch[1]);await save(state);return json({success:true});}
  const batchMatch=path.match(/^\/api\/live\/sessions\/([^/]+)\/activities\/batch$/);
  if(batchMatch&&method==='POST'){const b=await bodyOf(request),now=new Date().toISOString(),created=(b.activities||[]).map((item:any,i:number)=>{const aid=id('act');return {id:aid,sessionId:batchMatch[1],position:state.activities.filter(x=>x.sessionId===batchMatch[1]).length+i+1,status:'draft',resultVisibility:'live',moderationMode:'none',createdAt:now,updatedAt:now,...item,options:item.options?.map((o:any,j:number)=>({id:id('opt'),activityId:aid,label:typeof o==='string'?o:o.label,position:j+1,isCorrect:!!o.isCorrect}))};});state.activities.push(...created);await save(state);return json({activities:created},201);}
  const actsMatch=path.match(/^\/api\/live\/sessions\/([^/]+)\/activities(?:\/([^/]+))?$/);
  if(actsMatch&&method==='POST'){const b=await bodyOf(request),now=new Date().toISOString(),a={id:id('act'),sessionId:actsMatch[1],position:state.activities.filter(x=>x.sessionId===actsMatch[1]).length+1,status:'draft',resultVisibility:'live',moderationMode:'none',createdAt:now,updatedAt:now,...b};if(a.options)a.options=a.options.map((o:any,i:number)=>({id:id('opt'),activityId:a.id,label:typeof o==='string'?o:o.label,position:i+1,isCorrect:!!o.isCorrect}));state.activities.push(a);await save(state);return json(a,201);}
  if(actsMatch&&actsMatch[2]&&method==='PATCH'){const b=await bodyOf(request);state.activities=state.activities.map(a=>a.id===actsMatch[2]?{...a,...b,updatedAt:new Date().toISOString()}:a);await save(state);return json(state.activities.find(a=>a.id===actsMatch[2]));}
  if(actsMatch&&actsMatch[2]&&method==='DELETE'){state.activities=state.activities.filter(a=>a.id!==actsMatch[2]);await save(state);return json({success:true});}
  const responseMatch=path.match(/^\/api\/live\/sessions\/([^/]+)\/activities\/([^/]+)\/responses(?:\/([^/]+))?(?:\/vote)?$/);
  if(responseMatch&&method==='POST'&&!responseMatch[3]){const b=await bodyOf(request),p=state.participants.find(x=>x.id===b.participantId||x.anonymousToken===b.anonymousToken),r={id:id('resp'),activityId:responseMatch[2],participantId:p?.id||b.participantId||'guest',participantName:p?.displayName||b.participantName||'Participant',selectedOptionIds:b.selectedOptionIds,textResponse:b.textResponse,moderationStatus:'approved',voteCount:0,votedBy:[],submittedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.responses.push(r);await save(state);return json(r,201);}
  if(responseMatch&&responseMatch[3]&&method==='PATCH'){const b=await bodyOf(request);state.responses=state.responses.map(r=>r.id===responseMatch[3]?{...r,...b,updatedAt:new Date().toISOString()}:r);await save(state);return json(state.responses.find(r=>r.id===responseMatch[3]));}
  const questionMatch=path.match(/^\/api\/live\/sessions\/([^/]+)\/questions(?:\/([^/]+))?(?:\/vote)?$/);
  if(questionMatch&&method==='POST'&&!questionMatch[2]){const b=await bodyOf(request),q={id:id('q'),sessionId:questionMatch[1],participantId:b.participantId||'guest',participantName:b.participantName||'Participant',isAnonymous:!!b.isAnonymous,text:b.text,status:'approved',voteCount:0,votedBy:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.questions.push(q);await save(state);return json(q,201);}
  if(questionMatch&&questionMatch[2]&&method==='PATCH'){const b=await bodyOf(request);state.questions=state.questions.map(q=>q.id===questionMatch[2]?{...q,...b,updatedAt:new Date().toISOString()}:q);await save(state);return json(state.questions.find(q=>q.id===questionMatch[2]));}
  if(path==='/api/live/join'&&method==='POST'){const b=await bodyOf(request),s=state.liveSessions.find(x=>x.joinCode===String(b.code));if(!s)return json({error:'Live session not found'},404);const p={id:id('part'),sessionId:s.id,userId:b.anonymousToken||id('anon'),anonymousToken:b.anonymousToken||id('anon'),displayName:b.displayName||'Participant',joinedAt:new Date().toISOString(),lastSeenAt:new Date().toISOString()};state.participants.push(p);await save(state);return json({session:s,participant:p});}
  return json({ error: 'Cloud API route not implemented', path }, 404);
};

export const config: Config = { path: ['/api/config/*','/api/admin/*','/api/educator/*','/api/sessions','/api/sessions/*','/api/maps/*','/api/cloud/*','/api/live/*'] };
