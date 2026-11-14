import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  BikeFrameId,
  DifficultyId,
  GameMode,
  LeaderboardEntry,
  PlayerProfile,
  RacerSyncState,
  RiderId,
  RoomInfo,
  RoomMember,
  TrackId,
  WeatherType,
} from './src/types/game.ts';
import { createDefaultProfile, mergeProfiles } from './src/game/catalog.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

interface StoreData {
  profiles: Record<string, PlayerProfile>;
  leaderboard: LeaderboardEntry[];
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as StoreData;
      return {
        profiles: parsed.profiles || {},
        leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
      };
    }
  } catch (err) {
    console.error('Failed to load store.json:', err);
  }
  return { profiles: {}, leaderboard: [] };
}

function saveStore(store: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error('Failed to save store.json:', err);
  }
}

const store = loadStore();

// Active Multiplayer Rooms
interface InternalRoom extends RoomInfo {
  racers: Map<string, RacerSyncState>;
  weatherTimer?: NodeJS.Timeout;
  countdownTimer?: NodeJS.Timeout;
}

const rooms = new Map<string, InternalRoom>();
const clientSockets = new Map<WebSocket, { playerId: string; roomId: string | null }>();

const WEATHER_CYCLE: WeatherType[] = ['clear', 'rain', 'sandstorm', 'blizzard', 'thunderstorm'];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoom(room: InternalRoom): RoomInfo {
  return {
    roomId: room.roomId,
    name: room.name,
    mode: room.mode,
    trackId: room.trackId,
    difficulty: room.difficulty,
    weatherMode: room.weatherMode,
    seed: room.seed,
    status: room.status,
    countdown: room.countdown,
    currentWeather: room.currentWeather,
    members: room.members,
    maxPlayers: room.maxPlayers,
  };
}

function getOpenRooms(): RoomInfo[] {
  return Array.from(rooms.values())
    .filter((r) => r.status === 'lobby' || r.status === 'countdown')
    .map(serializeRoom);
}

function sendJson(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastAll(type: string, payload: unknown) {
  const msg = JSON.stringify({ type, payload });
  for (const ws of clientSockets.keys()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function broadcastRoom(roomId: string, type: string, payload: unknown, excludeWs?: WebSocket) {
  const msg = JSON.stringify({ type, payload });
  for (const [ws, meta] of clientSockets.entries()) {
    if (meta.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function leaveCurrentRoom(ws: WebSocket) {
  const meta = clientSockets.get(ws);
  if (!meta || !meta.roomId) return;
  const room = rooms.get(meta.roomId);
  meta.roomId = null;
  if (!room) return;

  room.members = room.members.filter((m) => m.playerId !== meta.playerId);
  room.racers.delete(meta.playerId);

  const humanMembers = room.members.filter((m) => !m.isBot);
  if (humanMembers.length === 0) {
    if (room.weatherTimer) clearInterval(room.weatherTimer);
    if (room.countdownTimer) clearInterval(room.countdownTimer);
    rooms.delete(room.roomId);
  } else {
    if (!room.members.some((m) => m.isHost)) {
      humanMembers[0].isHost = true;
    }
    broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));
  }
  broadcastAll('room:list', getOpenRooms());
}

function startRoomRace(room: InternalRoom) {
  if (room.status !== 'lobby') return;
  room.status = 'countdown';
  room.countdown = 3;
  room.racers.clear();
  room.currentWeather =
    room.weatherMode === 'dynamic'
      ? WEATHER_CYCLE[Math.floor(Math.random() * WEATHER_CYCLE.length)]
      : room.weatherMode;

  broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));

  if (room.countdownTimer) clearInterval(room.countdownTimer);
  room.countdownTimer = setInterval(() => {
    room.countdown -= 1;
    if (room.countdown <= 0) {
      if (room.countdownTimer) clearInterval(room.countdownTimer);
      room.status = 'racing';
      broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));

      // Server-authoritative dynamic weather transitions
      if (room.weatherMode === 'dynamic') {
        if (room.weatherTimer) clearInterval(room.weatherTimer);
        room.weatherTimer = setInterval(() => {
          if (room.status !== 'racing') {
            if (room.weatherTimer) clearInterval(room.weatherTimer);
            return;
          }
          const next = WEATHER_CYCLE[Math.floor(Math.random() * WEATHER_CYCLE.length)];
          room.currentWeather = next;
          broadcastRoom(room.roomId, 'race:weather', { weather: next });
        }, 16000);
      }
    } else {
      broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));
    }
  }, 1000);
}

async function createServer() {
  const app = express();
  app.use(express.json({ type: ['application/json', 'text/plain'] }));

  // Health & Profile APIs
  app.get('/api/profile/:playerId', (req, res) => {
    const { playerId } = req.params;
    const defaults = createDefaultProfile(playerId);
    const existing = store.profiles[playerId];
    if (!existing) {
      store.profiles[playerId] = defaults;
      saveStore(store);
    } else {
      store.profiles[playerId] = mergeProfiles(existing, defaults);
    }
    res.json(store.profiles[playerId]);
  });

  app.post('/api/profile/sync', (req, res) => {
    const incoming = req.body as PlayerProfile;
    if (!incoming || typeof incoming.playerId !== 'string') {
      res.status(400).json({ error: 'Invalid profile payload' });
      return;
    }
    const existing =
      store.profiles[incoming.playerId] ||
      createDefaultProfile(incoming.playerId, incoming.nickname);
    const normalizedIncoming: PlayerProfile = {
      ...createDefaultProfile(incoming.playerId, incoming.nickname),
      ...incoming,
      nickname: String(incoming.nickname || '狂野大狗').slice(0, 18),
      updatedAt:
        typeof incoming.updatedAt === 'number' && incoming.updatedAt > 0
          ? incoming.updatedAt
          : Date.now(),
    };
    store.profiles[incoming.playerId] = mergeProfiles(existing, normalizedIncoming);
    saveStore(store);
    res.json(store.profiles[incoming.playerId]);
  });

  app.get('/api/leaderboard', (req, res) => {
    const trackId = req.query.trackId as TrackId | undefined;
    const mode = req.query.mode as GameMode | undefined;
    let items = [...store.leaderboard];
    if (trackId) items = items.filter((e) => e.trackId === trackId);
    if (mode) items = items.filter((e) => e.mode === mode);
    items.sort((a, b) => a.finishTimeMs - b.finishTimeMs || b.score - a.score);
    res.json(items.slice(0, 50));
  });

  app.post('/api/leaderboard', (req, res) => {
    const body = req.body as Omit<LeaderboardEntry, 'id' | 'createdAt'>;
    if (!body || !body.playerId || !body.trackId || typeof body.finishTimeMs !== 'number') {
      res.status(400).json({ error: 'Invalid leaderboard submission' });
      return;
    }
    const entry: LeaderboardEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      playerId: body.playerId,
      nickname: String(body.nickname || '狂野大狗').slice(0, 18),
      riderId: (body.riderId || 'shiba') as RiderId,
      riderLevel: Number(body.riderLevel || 1),
      frameId: (body.frameId || 'trail') as BikeFrameId,
      mode: (body.mode || 'single') as GameMode,
      trackId: body.trackId,
      difficulty: (body.difficulty || 'beginner') as DifficultyId,
      finishTimeMs: Math.max(1000, Math.round(body.finishTimeMs)),
      score: Math.max(0, Math.round(body.score || 0)),
      crashesCount: Math.max(0, Math.round(body.crashesCount || 0)),
      weather: body.weather || 'clear',
      createdAt: Date.now(),
    };
    store.leaderboard.push(entry);
    store.leaderboard.sort((a, b) => a.finishTimeMs - b.finishTimeMs || b.score - a.score);
    store.leaderboard = store.leaderboard.slice(0, 200);
    saveStore(store);

    broadcastAll('leaderboard:update', store.leaderboard.slice(0, 50));
    res.json(entry);
  });

  app.get('/api/rooms', (_req, res) => {
    res.json(getOpenRooms());
  });

  // Vite Dev Middleware or Static Production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clientSockets.set(ws, { playerId: '', roomId: null });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; payload?: Record<string, unknown> };
        const meta = clientSockets.get(ws);
        if (!meta) return;

        switch (msg.type) {
          case 'hello': {
            meta.playerId = String(msg.payload?.playerId || '');
            sendJson(ws, 'room:list', getOpenRooms());
            sendJson(ws, 'leaderboard:update', store.leaderboard.slice(0, 50));
            break;
          }

          case 'room:list': {
            sendJson(ws, 'room:list', getOpenRooms());
            break;
          }

          case 'room:create': {
            leaveCurrentRoom(ws);
            const p = msg.payload as {
              member: RoomMember;
              name?: string;
              mode: 'versus' | 'coop' | 'terminator';
              trackId: TrackId;
              difficulty?: DifficultyId;
              weatherMode: 'dynamic' | WeatherType;
            };
            if (!p?.member) break;
            meta.playerId = p.member.playerId;
            const roomId = generateRoomCode();
            const safeMode: 'versus' | 'coop' | 'terminator' =
              p.mode === 'coop' ? 'coop' : p.mode === 'terminator' ? 'terminator' : 'versus';
            const room: InternalRoom = {
              roomId,
              name: (p.name || `${p.member.nickname} 的赛道`).slice(0, 24),
              mode: safeMode,
              trackId: p.trackId || 'pine_canyon',
              difficulty: p.difficulty || 'beginner',
              weatherMode: p.weatherMode || 'dynamic',
              seed: Math.floor(Math.random() * 900000) + 10000,
              status: 'lobby',
              countdown: 3,
              currentWeather: p.weatherMode === 'dynamic' ? 'clear' : p.weatherMode,
              members: [{ ...p.member, isHost: true, ready: true }],
              maxPlayers: 8,
              racers: new Map(),
            };
            rooms.set(roomId, room);
            meta.roomId = roomId;
            sendJson(ws, 'room:joined', serializeRoom(room));
            broadcastAll('room:list', getOpenRooms());
            break;
          }

          case 'room:join': {
            leaveCurrentRoom(ws);
            const p = msg.payload as { roomId: string; member: RoomMember };
            const code = String(p?.roomId || '').toUpperCase().trim();
            const room = rooms.get(code);
            if (!room) {
              sendJson(ws, 'room:error', { message: `未找到房间 ${code}` });
              break;
            }
            if (room.status !== 'lobby') {
              sendJson(ws, 'room:error', { message: '该房间比赛已开始，请等待或创建新房间' });
              break;
            }
            if (room.members.length >= room.maxPlayers) {
              sendJson(ws, 'room:error', { message: '房间人数已满' });
              break;
            }
            meta.playerId = p.member.playerId;
            meta.roomId = code;
            room.members.push({ ...p.member, isHost: false, ready: true });
            sendJson(ws, 'room:joined', serializeRoom(room));
            broadcastRoom(code, 'room:updated', serializeRoom(room), ws);
            broadcastAll('room:list', getOpenRooms());
            break;
          }

          case 'room:leave': {
            leaveCurrentRoom(ws);
            break;
          }

          case 'room:ready': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            const m = room.members.find((x) => x.playerId === meta.playerId);
            if (m) {
              m.ready = !m.ready;
              broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));
            }
            break;
          }

          case 'room:add_bot': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room || room.status === 'finished') break;
            if (room.members.length >= room.maxPlayers) {
              sendJson(ws, 'room:error', { message: `房间人数已满（上限 ${room.maxPlayers} 人）` });
              break;
            }
            const requester = room.members.find((m) => m.playerId === meta.playerId);
            const host = room.members.find((m) => m.isHost);
            if (!requester || !host) break;
            const botNum = room.members.filter((m) => m.isBot).length + 1;
            const riders: RiderId[] = ['shiba', 'husky', 'bulldog', 'got_virtue', 'got_66'];
            const frames: BikeFrameId[] = ['trail', 'enduro', 'titanium', 'cyber'];
            const botMember: RoomMember = {
              playerId: `bot_${room.roomId}_${botNum}_${Date.now()}`,
              nickname: `机械犬#${botNum}`,
              riderId: riders[botNum % riders.length],
              frameId: frames[botNum % frames.length],
              riderLevel: Math.max(1, host.riderLevel),
              upgrades: { ...host.upgrades },
              ready: true,
              isHost: false,
              isBot: true,
            };
            room.members.push(botMember);
            broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));
            broadcastAll('room:list', getOpenRooms());
            break;
          }

          case 'room:start': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            const host = room.members.find((m) => m.playerId === meta.playerId);
            if (!host?.isHost) break;
            startRoomRace(room);
            broadcastAll('room:list', getOpenRooms());
            break;
          }

          case 'room:reset': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            const host = room.members.find((m) => m.playerId === meta.playerId);
            if (!host?.isHost) break;
            if (room.weatherTimer) clearInterval(room.weatherTimer);
            room.status = 'lobby';
            room.seed = Math.floor(Math.random() * 900000) + 10000;
            room.racers.clear();
            broadcastRoom(room.roomId, 'room:updated', serializeRoom(room));
            broadcastAll('room:list', getOpenRooms());
            break;
          }

          case 'race:state': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room || room.status !== 'racing') break;
            const state = msg.payload as unknown as RacerSyncState;
            if (!state?.playerId) break;
            room.racers.set(state.playerId, state);
            broadcastRoom(room.roomId, 'race:racers', Array.from(room.racers.values()), ws);
            break;
          }

          case 'race:bark': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            broadcastRoom(room.roomId, 'race:bark', msg.payload, ws);
            break;
          }

          case 'race:revive': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room || room.mode !== 'coop') break;
            broadcastRoom(room.roomId, 'race:revive', msg.payload, ws);
            break;
          }

          case 'race:taunt': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            broadcastRoom(room.roomId, 'race:taunt', msg.payload, ws);
            break;
          }

          case 'race:fire': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            broadcastRoom(room.roomId, 'race:fire', msg.payload, ws);
            break;
          }

          case 'race:hit': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            broadcastRoom(room.roomId, 'race:hit', msg.payload, ws);
            break;
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(ws);
      clientSockets.delete(ws);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Big Dog Bike 4 server listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
