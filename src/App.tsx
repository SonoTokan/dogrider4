import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Bot,
  Crosshair,
  Flag,
  Play,
  Plus,
  Swords,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AchievementSpec,
  BikeFrameId,
  DifficultyId,
  GameMode,
  LeaderboardEntry,
  PlayerProfile,
  RacerSyncState,
  RiderId,
  RoomInfo,
  TrackId,
  UpgradeLevels,
  WeatherType,
} from './types/game';
import {
  ACHIEVEMENTS,
  BIKE_FRAMES,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MODE_RANK_META,
  RIDERS,
  TRACKS,
  WEATHER_LABELS,
  computeMaxHp,
  createDefaultProfile,
  evaluateProfileAchievements,
  getMilitaryRankInfo,
  getModeRankInfo,
  getUpgradeCost,
  mergeProfiles,
  UPGRADE_META,
} from './game/catalog';
import { GamePlayView } from './components/GamePlayView';
import { GarageView } from './components/GarageView';
import { LeaderboardView } from './components/LeaderboardView';
import { GuideView } from './components/GuideView';
import { AchievementsView } from './components/AchievementsView';
import { HERO_IMAGE } from './assets/riderImages';

type ActiveTab = 'lobby' | 'garage' | 'achievements' | 'leaderboard' | 'guide' | 'playing';

const API_BASE =
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/+$/, '') || '';
const WS_ORIGIN =
  (import.meta.env.VITE_WS_ORIGIN as string | undefined)?.replace(/\/+$/, '') || '';
const IS_STATIC_PAGES_HOST =
  typeof window !== 'undefined' &&
  /\.github\.io$/i.test(window.location.hostname) &&
  !API_BASE &&
  !WS_ORIGIN;

const PROFILE_KEY = 'bdb4_profile_v1';
const PREFS_KEY = 'bdb4_prefs_v1';
const LEADERBOARD_KEY = 'bdb4_leaderboard_v1';
const PERSISTABLE_TABS: ReadonlyArray<Exclude<ActiveTab, 'playing'>> = [
  'lobby',
  'garage',
  'achievements',
  'leaderboard',
  'guide',
];

interface StoredPrefs {
  activeTab: Exclude<ActiveTab, 'playing'>;
  selectedMode: GameMode;
  selectedTrack: TrackId;
  selectedDifficulty: DifficultyId;
  selectedWeather: 'dynamic' | WeatherType;
}

function getOrCreatePlayerId(): string {
  const key = 'bdb4_player_id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `dog_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `dog_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }
}

function loadStoredProfile(playerId: string): PlayerProfile {
  const fallback = createDefaultProfile(playerId);
  try {
    const rawSpecific = localStorage.getItem(`bdb4_profile_${playerId}`);
    const rawGlobal = localStorage.getItem(PROFILE_KEY);
    let merged = fallback;
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal) as PlayerProfile;
      if (parsed && (!parsed.playerId || parsed.playerId === playerId)) {
        merged = mergeProfiles(merged, { ...parsed, playerId });
      }
    }
    if (rawSpecific) {
      const parsed = JSON.parse(rawSpecific) as PlayerProfile;
      if (parsed) {
        merged = mergeProfiles(merged, { ...parsed, playerId });
      }
    }
    return merged;
  } catch {
    return fallback;
  }
}

function saveStoredProfile(profile: PlayerProfile): void {
  try {
    const json = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, json);
    localStorage.setItem(`bdb4_profile_${profile.playerId}`, json);
  } catch {
    // ignore quota errors
  }
}

function loadStoredPrefs(): StoredPrefs {
  const defaults: StoredPrefs = {
    activeTab: 'lobby',
    selectedMode: 'versus',
    selectedTrack: 'pine_canyon',
    selectedDifficulty: 'beginner',
    selectedWeather: 'dynamic',
  };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      activeTab:
        parsed.activeTab && PERSISTABLE_TABS.includes(parsed.activeTab)
          ? parsed.activeTab
          : defaults.activeTab,
      selectedMode:
        parsed.selectedMode && ['single', 'versus', 'coop', 'terminator'].includes(parsed.selectedMode)
          ? parsed.selectedMode
          : defaults.selectedMode,
      selectedTrack:
        parsed.selectedTrack && parsed.selectedTrack in TRACKS
          ? parsed.selectedTrack
          : defaults.selectedTrack,
      selectedDifficulty:
        parsed.selectedDifficulty && parsed.selectedDifficulty in DIFFICULTIES
          ? parsed.selectedDifficulty
          : defaults.selectedDifficulty,
      selectedWeather:
        parsed.selectedWeather === 'dynamic' ||
        (parsed.selectedWeather && parsed.selectedWeather in WEATHER_LABELS)
          ? parsed.selectedWeather
          : defaults.selectedWeather,
    };
  } catch {
    return defaults;
  }
}

function saveStoredPrefs(prefs: StoredPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function loadStoredLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

function saveStoredLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 60)));
  } catch {
    // ignore
  }
}

export default function App() {
  const [initialPrefs] = useState<StoredPrefs>(() => loadStoredPrefs());
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialPrefs.activeTab);
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadStoredProfile(getOrCreatePlayerId())
  );
  const profileRef = useRef<PlayerProfile>(profile);
  const [nicknameDraft, setNicknameDraft] = useState(profile.nickname);

  // Race Configuration State
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialPrefs.selectedMode);
  const [selectedTrack, setSelectedTrack] = useState<TrackId>(initialPrefs.selectedTrack);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>(
    initialPrefs.selectedDifficulty
  );
  const [selectedWeather, setSelectedWeather] = useState<'dynamic' | WeatherType>(
    initialPrefs.selectedWeather
  );
  const [singleSeed, setSingleSeed] = useState<number>(() => Math.floor(Math.random() * 900000) + 10000);

  // Multiplayer & Real-Time State
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [openRooms, setOpenRooms] = useState<RoomInfo[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [remoteRacers, setRemoteRacers] = useState<RacerSyncState[]>([]);
  const [serverWeather, setServerWeather] = useState<WeatherType | null>(null);

  // Global Real-Time Leaderboard & Achievements Notification
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadStoredLeaderboard());
  const [achievementQueue, setAchievementQueue] = useState<AchievementSpec[]>([]);

  const syncProfileToServer = useCallback((next: PlayerProfile, activeMode?: GameMode) => {
    const { updated, newlyUnlocked } = evaluateProfileAchievements(next, activeMode);
    const stamped: PlayerProfile = {
      ...updated,
      updatedAt: Math.max(Date.now(), (profileRef.current.updatedAt ?? 0) + 1),
    };
    profileRef.current = stamped;
    saveStoredProfile(stamped);
    setProfile(stamped);
    if (newlyUnlocked.length > 0) {
      setAchievementQueue((prev) => [...prev, ...newlyUnlocked]);
    }
    if (!IS_STATIC_PAGES_HOST) {
      fetch(`${API_BASE}/api/profile/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stamped),
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  const updateProfile = useCallback(
    (updater: (prev: PlayerProfile) => PlayerProfile | null) => {
      const next = updater(profileRef.current);
      if (!next) return;
      syncProfileToServer(next);
    },
    [syncProfileToServer]
  );

  // Save preferences on change (never persist transient 'playing' tab)
  useEffect(() => {
    const persistTab: Exclude<ActiveTab, 'playing'> =
      activeTab === 'playing' ? 'lobby' : activeTab;
    saveStoredPrefs({
      activeTab: persistTab,
      selectedMode,
      selectedTrack,
      selectedDifficulty,
      selectedWeather,
    });
  }, [activeTab, selectedMode, selectedTrack, selectedDifficulty, selectedWeather]);

  // Flush profile before browser refresh / tab close
  useEffect(() => {
    const flushProfile = () => {
      saveStoredProfile(profileRef.current);
      if (!IS_STATIC_PAGES_HOST && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify(profileRef.current)], {
            type: 'application/json',
          });
          navigator.sendBeacon(`${API_BASE}/api/profile/sync`, blob);
        } catch {
          // ignore
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushProfile();
      }
    };

    window.addEventListener('beforeunload', flushProfile);
    window.addEventListener('pagehide', flushProfile);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushProfile);
      window.removeEventListener('pagehide', flushProfile);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Load & Losslessly Merge Profile & Leaderboard on Mount
  useEffect(() => {
    const pid = profileRef.current.playerId;
    saveStoredProfile(profileRef.current);
    if (IS_STATIC_PAGES_HOST) return;

    fetch(`${API_BASE}/api/profile/${encodeURIComponent(pid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PlayerProfile | null) => {
        if (data?.playerId) {
          const mergedRaw = mergeProfiles(profileRef.current, data);
          const { updated: merged, newlyUnlocked } = evaluateProfileAchievements(mergedRaw);
          profileRef.current = merged;
          saveStoredProfile(merged);
          setProfile(merged);
          setNicknameDraft(merged.nickname);
          if (newlyUnlocked.length > 0) {
            setAchievementQueue((prev) => [...prev, ...newlyUnlocked]);
          }

          if (JSON.stringify(merged) !== JSON.stringify(data)) {
            fetch(`${API_BASE}/api/profile/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(merged),
              keepalive: true,
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((items: LeaderboardEntry[] | null) => {
        if (Array.isArray(items) && items.length > 0) {
          setLeaderboard(items);
          saveStoredLeaderboard(items);
        }
      })
      .catch(() => {});
  }, []);

  // WebSocket Connection with Auto-Reconnect (disabled on static Pages unless VITE_WS_ORIGIN is set)
  useEffect(() => {
    if (IS_STATIC_PAGES_HOST) {
      setWsConnected(false);
      return;
    }
    let closedByUnmount = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failedAttempts = 0;

    const connect = () => {
      const wsUrl = WS_ORIGIN
        ? `${WS_ORIGIN}/ws`
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        failedAttempts = 0;
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'hello', payload: { playerId: profile.playerId } }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { type: string; payload: unknown };
          if (msg.type === 'room:list') {
            setOpenRooms(msg.payload as RoomInfo[]);
          } else if (msg.type === 'room:joined' || msg.type === 'room:updated') {
            const room = msg.payload as RoomInfo;
            setCurrentRoom(room);
            setRoomError(null);
            if (room.status === 'countdown' || room.status === 'racing') {
              setServerWeather(room.currentWeather);
              setActiveTab('playing');
            }
          } else if (msg.type === 'room:error') {
            const err = msg.payload as { message: string };
            setRoomError(err.message);
          } else if (msg.type === 'race:racers') {
            const list = msg.payload as RacerSyncState[];
            setRemoteRacers(list.filter((r) => r.playerId !== profile.playerId));
          } else if (msg.type === 'race:weather') {
            const w = msg.payload as { weather: WeatherType };
            setServerWeather(w.weather);
          } else if (msg.type === 'leaderboard:update') {
            const entries = msg.payload as LeaderboardEntry[];
            setLeaderboard(entries);
            saveStoredLeaderboard(entries);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        failedAttempts += 1;
        if (!closedByUnmount && (WS_ORIGIN || failedAttempts < 3)) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [profile.playerId]);

  const refreshLeaderboard = () => {
    if (IS_STATIC_PAGES_HOST) {
      setLeaderboard(loadStoredLeaderboard());
      return;
    }
    fetch(`${API_BASE}/api/leaderboard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((items: LeaderboardEntry[] | null) => {
        if (Array.isArray(items)) {
          setLeaderboard(items);
          saveStoredLeaderboard(items);
        }
      })
      .catch(() => {});
  };

  // Profile & Garage Handlers (using profileRef via updateProfile to prevent stale state drops)
  const handleSaveNickname = () => {
    const clean = nicknameDraft.trim().slice(0, 18) || '狂野大狗';
    setNicknameDraft(clean);
    updateProfile((prev) => ({ ...prev, nickname: clean }));
  };

  const handleSelectRider = (riderId: RiderId) => {
    updateProfile((prev) => ({ ...prev, selectedRider: riderId }));
  };

  const handleUnlockRider = (riderId: RiderId) => {
    updateProfile((prev) => {
      const cost = RIDERS[riderId].unlockCost;
      if (prev.goldBones < cost || prev.unlockedRiders.includes(riderId)) return null;
      return {
        ...prev,
        goldBones: prev.goldBones - cost,
        unlockedRiders: [...prev.unlockedRiders, riderId],
        selectedRider: riderId,
      };
    });
  };

  const handleSelectFrame = (frameId: BikeFrameId) => {
    updateProfile((prev) => ({ ...prev, selectedFrame: frameId }));
  };

  const handleUnlockFrame = (frameId: BikeFrameId) => {
    updateProfile((prev) => {
      const cost = BIKE_FRAMES[frameId].unlockCost;
      if (prev.goldBones < cost || prev.unlockedFrames.includes(frameId)) return null;
      return {
        ...prev,
        goldBones: prev.goldBones - cost,
        unlockedFrames: [...prev.unlockedFrames, frameId],
        selectedFrame: frameId,
      };
    });
  };

  const handleUpgradeStat = (key: keyof UpgradeLevels) => {
    updateProfile((prev) => {
      const meta = UPGRADE_META.find((m) => m.key === key);
      if (!meta) return null;
      const cur = prev.upgrades[key];
      if (cur >= meta.maxLevel) return null;
      const cost = getUpgradeCost(key, cur);
      if (prev.goldBones < cost) return null;
      return {
        ...prev,
        goldBones: prev.goldBones - cost,
        upgrades: { ...prev.upgrades, [key]: cur + 1 },
      };
    });
  };

  // Multiplayer Room Actions
  const buildRoomMember = () => ({
    playerId: profile.playerId,
    nickname: profile.nickname,
    riderId: profile.selectedRider,
    frameId: profile.selectedFrame,
    riderLevel: profile.upgrades.riderLevel,
    upgrades: profile.upgrades,
    ready: true,
    isHost: false,
  });

  const localCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLocalCountdown = () => {
    if (localCountdownTimerRef.current) {
      clearInterval(localCountdownTimerRef.current);
      localCountdownTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearLocalCountdown();
  }, []);

  const makeLocalBot = (roomId: string, botNum: number, hostUpgrades: UpgradeLevels, hostLevel: number) => {
    const riders: RiderId[] = ['shiba', 'husky', 'bulldog', 'got_virtue', 'got_66'];
    const frames: BikeFrameId[] = ['trail', 'enduro', 'titanium', 'cyber'];
    return {
      playerId: `bot_${roomId}_${botNum}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      nickname: `机械犬#${botNum}`,
      riderId: riders[botNum % riders.length],
      frameId: frames[botNum % frames.length],
      riderLevel: Math.max(1, hostLevel),
      upgrades: { ...hostUpgrades },
      ready: true,
      isHost: false,
      isBot: true,
    };
  };

  const handleCreateRoom = (modeOverride?: 'versus' | 'coop' | 'terminator') => {
    const roomMode =
      modeOverride ??
      (selectedMode === 'coop'
        ? 'coop'
        : selectedMode === 'terminator'
        ? 'terminator'
        : 'versus');
    setSelectedMode(roomMode);
    setRoomError(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:create',
          payload: {
            member: buildRoomMember(),
            mode: roomMode,
            trackId: selectedTrack,
            difficulty: selectedDifficulty,
            weatherMode: selectedWeather,
          },
        })
      );
      return;
    }

    // Offline / GitHub Pages Local AI Room Fallback
    clearLocalCountdown();
    const localCode = `L${Math.floor(100 + Math.random() * 900)}`;
    const hostMember = { ...buildRoomMember(), isHost: true, ready: true };
    const bot1 = makeLocalBot(localCode, 1, profile.upgrades, profile.upgrades.riderLevel);
    const bot2 = makeLocalBot(localCode, 2, profile.upgrades, profile.upgrades.riderLevel);
    const initialWeather: WeatherType =
      selectedWeather === 'dynamic' ? 'clear' : selectedWeather;
    const localRoom: RoomInfo = {
      roomId: localCode,
      name: `${profile.nickname} 的本地人机房`,
      mode: roomMode,
      trackId: selectedTrack,
      difficulty: selectedDifficulty,
      weatherMode: selectedWeather,
      seed: Math.floor(Math.random() * 900000) + 10000,
      status: 'lobby',
      countdown: 3,
      currentWeather: initialWeather,
      members: [hostMember, bot1, bot2],
      maxPlayers: 8,
    };
    setCurrentRoom(localRoom);
  };

  const handleJoinRoom = (code: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setRoomError('当前处于离线/静态模式，请直接点击「创建新房间」开启本地 AI 人机对战！');
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'room:join',
        payload: { roomId: trimmed, member: buildRoomMember() },
      })
    );
  };

  const handleAddBot = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:add_bot' }));
      return;
    }
    setCurrentRoom((prev) => {
      if (!prev || prev.members.length >= prev.maxPlayers) return prev;
      const botNum = prev.members.filter((m) => m.isBot).length + 1;
      const host = prev.members.find((m) => m.isHost) ?? prev.members[0];
      const bot = makeLocalBot(
        prev.roomId,
        botNum,
        host?.upgrades ?? profile.upgrades,
        host?.riderLevel ?? profile.upgrades.riderLevel
      );
      return { ...prev, members: [...prev.members, bot] };
    });
  };

  const handleStartRoom = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:start' }));
      return;
    }
    if (!currentRoom) return;
    clearLocalCountdown();
    const weathers: WeatherType[] = ['clear', 'rain', 'sandstorm', 'blizzard', 'thunderstorm'];
    const startWeather: WeatherType =
      currentRoom.weatherMode === 'dynamic'
        ? weathers[Math.floor(Math.random() * weathers.length)]
        : currentRoom.weatherMode;
    setServerWeather(startWeather);
    setCurrentRoom((prev) =>
      prev ? { ...prev, status: 'countdown', countdown: 3, currentWeather: startWeather } : prev
    );
    setActiveTab('playing');

    let left = 3;
    localCountdownTimerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearLocalCountdown();
        setCurrentRoom((prev) => (prev ? { ...prev, status: 'racing', countdown: 0 } : prev));
      } else {
        setCurrentRoom((prev) => (prev ? { ...prev, countdown: left } : prev));
      }
    }, 850);
  };

  const handleLeaveRoom = () => {
    clearLocalCountdown();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:leave' }));
    }
    setCurrentRoom(null);
    setRemoteRacers([]);
  };

  const handleStartSingleRace = () => {
    clearLocalCountdown();
    setCurrentRoom(null);
    setRemoteRacers([]);
    setServerWeather(null);
    setSingleSeed(Math.floor(Math.random() * 900000) + 10000);
    setSelectedMode('single');
    setActiveTab('playing');
  };

  const handleStartTerminatorSolo = () => {
    clearLocalCountdown();
    setCurrentRoom(null);
    setRemoteRacers([]);
    setServerWeather(null);
    setSingleSeed(Math.floor(Math.random() * 900000) + 10000);
    setSelectedMode('terminator');
    setActiveTab('playing');
  };

  const handleQuickPlay = () => {
    if (currentRoom && currentRoom.status === 'lobby') {
      const me = currentRoom.members.find((m) => m.playerId === profile.playerId);
      if (me?.isHost) {
        handleStartRoom();
        return;
      }
    }
    if (selectedMode === 'terminator') {
      handleStartTerminatorSolo();
      return;
    }
    handleStartSingleRace();
  };

  const handleFinishRun = (result: {
    finished: boolean;
    dead: boolean;
    finishTimeMs: number | null;
    score: number;
    coinsEarned: number;
    flips: number;
    crashesCount: number;
    distanceMeters: number;
    weather: WeatherType;
    rank: number;
    damageTaken: number;
    coopTeamFlawless: boolean;
    encounteredWeathers: WeatherType[];
    luckyNarrowEscape: boolean;
    diedAtLastTrap: boolean;
    deathTimeMs: number | null;
    terminatorKills?: number;
  }) => {
    const activeMode: GameMode = currentRoom
      ? currentRoom.mode
      : selectedMode === 'terminator'
      ? 'terminator'
      : 'single';
    const activeTrack: TrackId = currentRoom ? currentRoom.trackId : selectedTrack;
    const activeDifficulty: DifficultyId = currentRoom ? currentRoom.difficulty : selectedDifficulty;

    const isVictory =
      result.finished &&
      (activeMode === 'versus' || activeMode === 'terminator' ? result.rank === 1 : true);
    const isFlawlessVersusWin =
      activeMode === 'versus' &&
      isVictory &&
      result.damageTaken === 0 &&
      result.crashesCount === 0 &&
      !result.dead;
    const isRealisticSpeedrun1m =
      isVictory &&
      activeDifficulty === 'realistic' &&
      result.finishTimeMs !== null &&
      result.finishTimeMs <= 60000;
    const isUltimateSingle2m =
      activeMode === 'single' &&
      result.finished &&
      (activeDifficulty === 'ultimate' || activeDifficulty === 'silent') &&
      result.finishTimeMs !== null &&
      result.finishTimeMs <= 120000;
    const isVersusWin = activeMode === 'versus' && isVictory;
    const isCoopFlawless =
      activeMode === 'coop' &&
      result.finished &&
      result.coopTeamFlawless &&
      result.damageTaken === 0 &&
      !result.dead;
    const isNovice40s =
      isVictory &&
      !result.dead &&
      activeDifficulty === 'novice' &&
      result.finishTimeMs !== null &&
      result.finishTimeMs <= 40000;
    const isUltraLow31s =
      isVictory &&
      !result.dead &&
      activeDifficulty === 'ultra_low' &&
      result.finishTimeMs !== null &&
      result.finishTimeMs <= 31000;
    const isBeginnerWin = isVictory && !result.dead && activeDifficulty === 'beginner';
    const isLuckyEscape = isVictory && !result.dead && result.luckyNarrowEscape;
    const isOneStepShort = result.dead && result.diedAtLastTrap;
    const isUltimate20sDeath =
      result.dead &&
      (activeDifficulty === 'ultimate' || activeDifficulty === 'silent') &&
      result.deathTimeMs !== null &&
      result.deathTimeMs <= 20000;

    const curProfile = profileRef.current;

    const prevWonWeathers = new Set<WeatherType>(curProfile.stats.wonWeathers || []);
    if (isVictory && !result.dead) {
      prevWonWeathers.add(result.weather);
      for (const w of result.encounteredWeathers || []) {
        prevWonWeathers.add(w);
      }
    }

    const baseModeXp = curProfile.modeXp ?? {
      single: 0,
      versus: 0,
      coop: 0,
      terminator: 0,
    };
    const nextModeXpMap: Record<GameMode, number> = {
      ...baseModeXp,
      [activeMode]: (baseModeXp[activeMode] ?? 0) + result.coinsEarned,
    };
    const nextXp = (curProfile.xp ?? 0) + result.coinsEarned;
    const isMultiplayer = Boolean(currentRoom) || activeMode === 'versus' || activeMode === 'coop';
    const isSuperChaos =
      activeMode === 'terminator' &&
      Boolean(currentRoom) &&
      result.finished &&
      result.rank === 1 &&
      (result.terminatorKills ?? 0) >= 1;
    const isMajorInMultiplayer =
      isMultiplayer && getMilitaryRankInfo(nextModeXpMap[activeMode]).current.level >= 5;
    const isFinishedWithin5s =
      result.finished &&
      !result.dead &&
      result.finishTimeMs !== null &&
      result.finishTimeMs <= 5000;
    const isVersus5s = activeMode === 'versus' && result.rank === 1 && isFinishedWithin5s;
    const isCoop5s = activeMode === 'coop' && isFinishedWithin5s;
    const isTerminator5s = activeMode === 'terminator' && isFinishedWithin5s;

    const nextStats: PlayerProfile['stats'] = {
      racesPlayed: curProfile.stats.racesPlayed + 1,
      wins: curProfile.stats.wins + (result.finished ? 1 : 0),
      coopWins: curProfile.stats.coopWins + (result.finished && activeMode === 'coop' ? 1 : 0),
      noDamageVersusWins:
        (curProfile.stats.noDamageVersusWins ?? 0) + (isFlawlessVersusWin ? 1 : 0),
      realisticWins:
        (curProfile.stats.realisticWins ?? 0) +
        (isVictory && activeDifficulty === 'realistic' ? 1 : 0),
      ultimateWins:
        (curProfile.stats.ultimateWins ?? 0) +
        (isVictory && activeDifficulty === 'ultimate' ? 1 : 0),
      tutorialWins:
        (curProfile.stats.tutorialWins ?? 0) +
        (isVictory && activeDifficulty === 'tutorial' ? 1 : 0),
      contacterWins:
        (curProfile.stats.contacterWins ?? 0) +
        (isVictory && activeDifficulty === 'contacter' ? 1 : 0),
      silentWins:
        (curProfile.stats.silentWins ?? 0) +
        (isVictory && activeDifficulty === 'silent' ? 1 : 0),
      realisticSpeedrunWins:
        (curProfile.stats.realisticSpeedrunWins ?? 0) + (isRealisticSpeedrun1m ? 1 : 0),
      ultimateSingle2mWins:
        (curProfile.stats.ultimateSingle2mWins ?? 0) + (isUltimateSingle2m ? 1 : 0),
      versusWins: (curProfile.stats.versusWins ?? 0) + (isVersusWin ? 1 : 0),
      flawlessCoopWins: (curProfile.stats.flawlessCoopWins ?? 0) + (isCoopFlawless ? 1 : 0),
      novice40sWins: (curProfile.stats.novice40sWins ?? 0) + (isNovice40s ? 1 : 0),
      ultraLow31sWins: (curProfile.stats.ultraLow31sWins ?? 0) + (isUltraLow31s ? 1 : 0),
      beginnerWins: (curProfile.stats.beginnerWins ?? 0) + (isBeginnerWin ? 1 : 0),
      wonWeathers: Array.from(prevWonWeathers),
      luckyEscapeWins: (curProfile.stats.luckyEscapeWins ?? 0) + (isLuckyEscape ? 1 : 0),
      oneStepShortCount: (curProfile.stats.oneStepShortCount ?? 0) + (isOneStepShort ? 1 : 0),
      ultimate20sDeathCount:
        (curProfile.stats.ultimate20sDeathCount ?? 0) + (isUltimate20sDeath ? 1 : 0),
      totalFlips: curProfile.stats.totalFlips + result.flips,
      headCrashes: curProfile.stats.headCrashes + result.crashesCount,
      deaths: curProfile.stats.deaths + (result.dead ? 1 : 0),
      bestDistance: Math.max(curProfile.stats.bestDistance, result.distanceMeters),
      terminatorKills:
        (curProfile.stats.terminatorKills ?? 0) + (result.terminatorKills ?? 0),
      terminatorWins:
        (curProfile.stats.terminatorWins ?? 0) +
        (isVictory && activeMode === 'terminator' ? 1 : 0),
      multiplayerMajorAchieved: Math.max(
        curProfile.stats.multiplayerMajorAchieved ?? 0,
        isMajorInMultiplayer ? 1 : 0
      ),
      superChaosWins: (curProfile.stats.superChaosWins ?? 0) + (isSuperChaos ? 1 : 0),
      versus5sWins: (curProfile.stats.versus5sWins ?? 0) + (isVersus5s ? 1 : 0),
      coop5sWins: (curProfile.stats.coop5sWins ?? 0) + (isCoop5s ? 1 : 0),
      terminator5sWins: (curProfile.stats.terminator5sWins ?? 0) + (isTerminator5s ? 1 : 0),
    };

    const updatedProfile: PlayerProfile = {
      ...curProfile,
      goldBones: curProfile.goldBones + result.coinsEarned,
      xp: nextXp,
      modeXp: nextModeXpMap,
      stats: nextStats,
    };
    syncProfileToServer(updatedProfile, activeMode);

    // If achievement bonus bones earned in this multiplayer match promoted player to 少校 (>= Lv.5) in this mode, unlock 少校 immediately
    if (
      isMultiplayer &&
      getModeRankInfo(profileRef.current, activeMode).current.level >= 5 &&
      !(profileRef.current.stats.multiplayerMajorAchieved)
    ) {
      syncProfileToServer(
        {
          ...profileRef.current,
          stats: {
            ...profileRef.current.stats,
            multiplayerMajorAchieved: 1,
          },
        },
        activeMode
      );
    }

    if (result.finished && result.finishTimeMs) {
      const newEntry: LeaderboardEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        playerId: curProfile.playerId,
        nickname: curProfile.nickname,
        riderId: curProfile.selectedRider,
        riderLevel: curProfile.upgrades.riderLevel,
        frameId: curProfile.selectedFrame,
        mode: activeMode,
        trackId: activeTrack,
        difficulty: activeDifficulty,
        finishTimeMs: Math.max(1000, Math.round(result.finishTimeMs)),
        score: Math.max(0, Math.round(result.score || 0)),
        crashesCount: Math.max(0, Math.round(result.crashesCount || 0)),
        weather: result.weather,
        createdAt: Date.now(),
      };
      setLeaderboard((prev) => {
        const next = [...prev, newEntry]
          .sort((a, b) => a.finishTimeMs - b.finishTimeMs || b.score - a.score)
          .slice(0, 60);
        saveStoredLeaderboard(next);
        return next;
      });

      if (!IS_STATIC_PAGES_HOST) {
        fetch(`${API_BASE}/api/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            playerId: curProfile.playerId,
            nickname: curProfile.nickname,
            riderId: curProfile.selectedRider,
            riderLevel: curProfile.upgrades.riderLevel,
            frameId: curProfile.selectedFrame,
            mode: activeMode,
            trackId: activeTrack,
            difficulty: activeDifficulty,
            finishTimeMs: result.finishTimeMs,
            score: result.score,
            crashesCount: result.crashesCount,
            weather: result.weather,
          }),
        }).catch(() => {});
      }
    }
  };

  const maxHp = computeMaxHp(profile.selectedRider, profile.selectedFrame, profile.upgrades);
  const rankInfo = getModeRankInfo(profile, selectedMode);
  const amIHost = currentRoom?.members.find((m) => m.playerId === profile.playerId)?.isHost ?? false;

  return (
    <div className="min-h-screen bg-[#111318] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones (Wordmark — Nav Links — Primary CTA) */}
      <header className="h-16 border-b border-slate-800/90 bg-[#111318]/95 backdrop-blur sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between gap-8">
        <button
          onClick={() => {
            if (activeTab === 'playing' && currentRoom) handleLeaveRoom();
            setActiveTab('lobby');
          }}
          className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          大狗骑自行车4
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          {(
            [
              ['lobby', '竞速大厅'],
              ['garage', '车库升级'],
              ['achievements', '成就殿堂'],
              ['leaderboard', '全球榜'],
              ['guide', '车手指南'],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => {
                if (activeTab === 'playing' && currentRoom) handleLeaveRoom();
                setActiveTab(tab);
              }}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
                activeTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleQuickPlay}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            快速开赛
          </button>
        </div>
      </header>

      {/* Mobile Bottom Nav Switcher when not playing */}
      {activeTab !== 'playing' && (
        <div className="md:hidden flex items-center justify-around border-b border-slate-800 bg-[#161A21] py-2 px-2 text-xs">
          {(
            [
              ['lobby', '大厅'],
              ['garage', '车库'],
              ['achievements', '成就'],
              ['leaderboard', '全球榜'],
              ['guide', '指南'],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap ${
                activeTab === tab ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'playing' && (
          <GamePlayView
            mode={
              currentRoom
                ? currentRoom.mode
                : selectedMode === 'terminator'
                ? 'terminator'
                : 'single'
            }
            trackId={currentRoom ? currentRoom.trackId : selectedTrack}
            difficulty={currentRoom ? currentRoom.difficulty : selectedDifficulty}
            weatherMode={currentRoom ? currentRoom.weatherMode : selectedWeather}
            seed={currentRoom ? currentRoom.seed : singleSeed}
            profile={profile}
            room={currentRoom}
            wsRef={wsRef}
            remoteRacers={remoteRacers}
            serverWeather={serverWeather}
            onFinishRun={handleFinishRun}
            onExit={() => {
              if (currentRoom) handleLeaveRoom();
              setActiveTab('lobby');
            }}
            onGoGarage={() => {
              if (currentRoom) handleLeaveRoom();
              setActiveTab('garage');
            }}
            onReplay={() => {
              const nextSeed = Math.floor(Math.random() * 900000) + 10000;
              setSingleSeed(nextSeed);
              if (currentRoom && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
                setCurrentRoom((prev) => (prev ? { ...prev, seed: nextSeed } : prev));
              }
            }}
            onAddBot={handleAddBot}
          />
        )}

        {activeTab === 'garage' && (
          <GarageView
            profile={profile}
            onSelectRider={handleSelectRider}
            onUnlockRider={handleUnlockRider}
            onSelectFrame={handleSelectFrame}
            onUnlockFrame={handleUnlockFrame}
            onUpgradeStat={handleUpgradeStat}
          />
        )}

        {activeTab === 'achievements' && <AchievementsView profile={profile} />}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            entries={leaderboard}
            currentPlayerId={profile.playerId}
            onRefresh={refreshLeaderboard}
          />
        )}

        {activeTab === 'guide' && <GuideView />}

        {activeTab === 'lobby' && (
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-10">
            {/* Hero 2-Column Split */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between space-y-6 bg-[#1B1F27] border border-slate-800 rounded-2xl p-6 md:p-8">
                <div className="space-y-4">
                  <div className="text-xs font-medium text-amber-400">
                    第四代物理特技竞速 · 实时多人对抗与合作
                  </div>
                  <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-tight [text-wrap:balance]">
                    驾驭猛犬狂飙险峰，决胜千钧一发
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    在复杂山地地形、暴雨雷暴与致命陷阱中高速飞跃！小心控制车身平衡——一旦
                    <strong className="text-red-400">头朝地重摔</strong>
                    就会立刻暴露血量条并受到剧烈撞击伤害，血量归零即刻阵亡。
                  </p>
                </div>

                {/* Rider Identity Bar */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      value={nicknameDraft}
                      maxLength={18}
                      onChange={(e) => setNicknameDraft(e.target.value)}
                      onBlur={handleSaveNickname}
                      placeholder="输入车手昵称"
                      className="flex-1 min-w-[160px] bg-[#111318] border border-slate-700 focus:border-amber-500 rounded-lg px-3.5 py-2 text-sm text-white outline-none"
                    />
                    <button
                      onClick={handleSaveNickname}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      保存昵称
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#111318] border border-slate-800 rounded-lg p-3">
                      <div className="text-slate-500">当前出战骑手</div>
                      <div className="font-semibold text-white mt-0.5 truncate">
                        {RIDERS[profile.selectedRider].name}
                      </div>
                      <div className="font-mono-tabular text-emerald-400 mt-0.5">
                        Lv.{profile.upgrades.riderLevel} · {maxHp} HP
                      </div>
                    </div>
                    <div className="bg-[#111318] border border-slate-800 rounded-lg p-3">
                      <div className="text-slate-500">座驾车架</div>
                      <div className="font-semibold text-white mt-0.5 truncate">
                        {BIKE_FRAMES[profile.selectedFrame].name}
                      </div>
                      <div className="font-mono-tabular text-amber-400 mt-0.5">
                        {profile.goldBones} 🦴 金骨头
                      </div>
                    </div>
                    <div className="bg-[#111318] border border-slate-800 rounded-lg p-3">
                      <div className="text-slate-500">生涯战绩</div>
                      <div className="font-mono-tabular font-semibold text-white mt-0.5">
                        {profile.stats.wins} 胜 / {profile.stats.racesPlayed} 场
                      </div>
                      <div className="font-mono-tabular text-slate-400 mt-0.5">
                        {profile.stats.totalFlips} 次空翻
                      </div>
                    </div>
                  </div>

                  {/* Independent Per-Mode Military Rank & 1:1 Bone XP Progress Bar */}
                  <div className="bg-[#111318] border border-slate-800 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">
                          {MODE_RANK_META[selectedMode].label}:
                        </span>
                        <span className="font-bold" style={{ color: rankInfo.current.color }}>
                          Lv.{rankInfo.current.level} {rankInfo.current.name}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveTab('achievements')}
                        className="text-[11px] font-medium text-amber-400 hover:underline cursor-pointer"
                      >
                        查看全 12 级军衔表
                      </button>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${rankInfo.progressPct}%`,
                          backgroundColor: rankInfo.current.color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                      <span>本模式经验 {rankInfo.xp.toLocaleString()} EXP (1 骨头=1 经验 · 各模式独立)</span>
                      <span>
                        {rankInfo.next
                          ? `距 ${rankInfo.next.name} 还差 ${rankInfo.xpRemaining.toLocaleString()}`
                          : '已达无极最高等级'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      {(['single', 'versus', 'coop', 'terminator'] as GameMode[]).map((m) => {
                        const mr = getModeRankInfo(profile, m);
                        const meta = MODE_RANK_META[m];
                        return (
                          <div
                            key={m}
                            className={`rounded px-2 py-1 border ${
                              selectedMode === m
                                ? 'bg-slate-800/80 border-slate-600'
                                : 'bg-[#161A21] border-slate-800/80'
                            }`}
                          >
                            <div className="text-[10px] truncate" style={{ color: meta.color }}>
                              {meta.shortLabel}
                            </div>
                            <div className="font-semibold text-white truncate">
                              Lv.{mr.current.level} {mr.current.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Key Art Showcase */}
              <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-800 bg-[#1B1F27] min-h-[280px]">
                <img
                  src={HERO_IMAGE}
                  alt="大狗骑自行车4 主视觉插画"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs text-amber-400 font-semibold">
                      {wsConnected
                        ? '实时联机引擎 · 已连接全球大厅'
                        : IS_STATIC_PAGES_HOST
                        ? '本地 AI 引擎 · GitHub Pages 静态模式（内置人机房与本地存档）'
                        : '本地 AI 引擎 · 支持单机 / 本地人机对战与联机大厅'}
                    </div>
                    <div className="text-base font-bold text-white mt-0.5">
                      支持多人对抗、多人合作救援、终结者混战及单人无尽刷骨头
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('garage')}
                    className="px-4 py-2 rounded-lg bg-[#111318]/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                  >
                    改装升级
                  </button>
                </div>
              </div>
            </section>

            {/* Mode & Room Setup Console */}
            <section className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-white">01. 选择比赛模式与赛道</h2>
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#1B1F27] border border-slate-800 rounded-lg self-start">
                  <button
                    onClick={() => setSelectedMode('versus')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedMode === 'versus'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" /> 多人对抗赛 (主模式)
                  </button>
                  <button
                    onClick={() => setSelectedMode('coop')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedMode === 'coop'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" /> 多人合作护送
                  </button>
                  <button
                    onClick={() => setSelectedMode('terminator')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedMode === 'terminator'
                        ? 'bg-red-500 text-white'
                        : 'text-slate-300 hover:text-red-300'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" /> 终结者模式
                  </button>
                  <button
                    onClick={() => setSelectedMode('single')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedMode === 'single'
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" /> 单人越野试炼
                  </button>
                </div>
              </div>

              {/* Track Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Object.keys(TRACKS) as TrackId[]).map((tid) => {
                  const t = TRACKS[tid];
                  const active = selectedTrack === tid;
                  return (
                    <button
                      key={tid}
                      onClick={() => setSelectedTrack(tid)}
                      className={`text-left rounded-xl p-4 border transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/10 border-amber-500'
                          : 'bg-[#1B1F27] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-amber-400">{t.difficulty}</span>
                        <span className="font-mono-tabular text-slate-400">{t.length}m</span>
                      </div>
                      <div className="text-base font-bold text-white">{t.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{t.subtitle}</div>
                    </button>
                  );
                })}
              </div>

              {/* 8-Tier Difficulty Selector */}
              <div className="bg-[#1B1F27] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">
                    难度等级选择（越高难度骨头越多 · 极限/真实高概率刷新 +1000 绿色骨头）
                  </div>
                  <div className="text-xs text-slate-400">
                    当前：<span className="font-bold text-amber-400">{DIFFICULTIES[selectedDifficulty].name}</span> —{' '}
                    {DIFFICULTIES[selectedDifficulty].shortDesc}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {DIFFICULTY_ORDER.map((diffId, idx) => {
                    const spec = DIFFICULTIES[diffId];
                    const active = selectedDifficulty === diffId;
                    return (
                      <button
                        key={diffId}
                        onClick={() => setSelectedDifficulty(diffId)}
                        className={`text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-500/15 border-amber-400'
                            : 'bg-[#111318] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-500">
                          <span>LV.{idx + 1}</span>
                          <span className="text-amber-300">🦴×{spec.rewardMult.toFixed(1)}</span>
                        </div>
                        <div
                          className="text-xs font-bold mt-0.5 truncate"
                          style={{ color: active ? '#FBBF24' : spec.color }}
                        >
                          {spec.name}
                        </div>
                        <div className="text-[10px] mt-1 truncate text-slate-400">
                          {spec.greenBoneChance > 0 ? (
                            <span className="text-emerald-400 font-semibold">绿骨{Math.round(spec.greenBoneChance * 100)}%</span>
                          ) : (
                            <span>回血 +{spec.hpRegenPerSec}/s</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Weather Preference */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1B1F27] border border-slate-800 rounded-xl p-4">
                <div className="text-sm font-semibold text-white">天气动态设置</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setSelectedWeather('dynamic')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedWeather === 'dynamic'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    动态实时轮换
                  </button>
                  {(Object.keys(WEATHER_LABELS) as WeatherType[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setSelectedWeather(w)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        selectedWeather === w
                          ? 'bg-slate-200 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {WEATHER_LABELS[w].name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single Player Launch OR Multiplayer / Terminator Room Hub */}
              {selectedMode === 'single' ? (
                <div className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      单人竞速：{TRACKS[selectedTrack].name} · {DIFFICULTIES[selectedDifficulty].name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      单人挑战复杂地形与赛道陷阱，完赛自动刷新全球实时排行榜并赢取升级金骨头。
                    </p>
                  </div>
                  <button
                    onClick={handleStartSingleRace}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> 立即单人发车
                  </button>
                </div>
              ) : (
                <div className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-6">
                  {selectedMode === 'terminator' && !currentRoom && (
                    <div className="bg-red-950/35 border border-red-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-red-300 flex items-center gap-1.5">
                          <Crosshair className="w-4 h-4" /> 单人终结者模式（内置 3 名 AI 机械犬目标）
                        </h4>
                        <p className="text-xs text-slate-300 mt-1">
                          全员配备无限弹药 98K / M47 / 任意手枪，按 F 或左键射击攻击人机与其他车友！每终结 1 名对手额外奖励金骨头。
                        </p>
                      </div>
                      <button
                        onClick={handleStartTerminatorSolo}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-colors whitespace-nowrap cursor-pointer shrink-0"
                      >
                        <Crosshair className="w-4 h-4" /> 立即单人终结者开战
                      </button>
                    </div>
                  )}

                  {!currentRoom ? (
                    <>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {selectedMode === 'versus'
                              ? '多人对抗赛房间大厅'
                              : selectedMode === 'coop'
                              ? '多人合作护送房间大厅'
                              : '终结者模式联机房间大厅'}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            {selectedMode === 'terminator'
                              ? '创建终结者房间与好友和 AI 机械犬互相射击混战，可随时添加人机目标！'
                              : '创建房间邀请好友同屏对抗/合作，或输入 4 位房间号加入现有赛局，支持召唤 AI 机械犬。'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                              maxLength={4}
                              placeholder="4位房间号"
                              className="w-28 bg-[#111318] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono-tabular text-white uppercase outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleJoinRoom(joinCodeInput)}
                              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                            >
                              加入房间
                            </button>
                          </div>

                          <button
                            onClick={() => handleCreateRoom()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> 创建新房间
                          </button>
                        </div>
                      </div>

                      {roomError && (
                        <div className="text-xs text-red-400 bg-red-950/50 border border-red-800/60 rounded-lg px-4 py-2.5">
                          {roomError}
                        </div>
                      )}

                      {/* Live Open Rooms List */}
                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-slate-400">
                          当前开放中的联机房间 ({openRooms.length})
                        </div>
                        {openRooms.length === 0 ? (
                          <div className="py-8 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-500">
                            暂无等待中的房间 — 点击右上角「创建新房间」立刻开启第一局！
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {openRooms.map((rm) => (
                              <div
                                key={rm.roomId}
                                className="flex items-center justify-between gap-4 bg-[#111318] border border-slate-800 rounded-lg p-4"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono-tabular font-bold text-amber-400 text-sm">
                                      #{rm.roomId}
                                    </span>
                                    <span className="font-semibold text-white text-sm truncate">
                                      {rm.name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    {rm.mode === 'versus'
                                      ? '多人对抗'
                                      : rm.mode === 'coop'
                                      ? '多人合作'
                                      : '终结者模式'}{' '}
                                    · {DIFFICULTIES[rm.difficulty]?.name ?? '初级'} ·{' '}
                                    {TRACKS[rm.trackId].name} · {rm.members.length}/{rm.maxPlayers} 人
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleJoinRoom(rm.roomId)}
                                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  加入
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Inside Room Lobby */
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono-tabular text-xl font-bold text-amber-400">
                              房间 #{currentRoom.roomId}
                            </span>
                            <span className="text-sm font-semibold text-white">
                              {currentRoom.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {currentRoom.mode === 'versus'
                              ? '多人对抗赛'
                              : currentRoom.mode === 'coop'
                              ? '多人合作护送'
                              : '终结者模式（可攻击车友与人机）'}{' '}
                            · {DIFFICULTIES[currentRoom.difficulty]?.name ?? '初级'} ·{' '}
                            {TRACKS[currentRoom.trackId].name} ·{' '}
                            {currentRoom.weatherMode === 'dynamic'
                              ? '动态天气轮换'
                              : WEATHER_LABELS[currentRoom.weatherMode].name}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {currentRoom.members.length < currentRoom.maxPlayers && (
                            <button
                              onClick={handleAddBot}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 whitespace-nowrap cursor-pointer"
                            >
                              <Bot className="w-3.5 h-3.5" /> 添加 AI 机械犬
                            </button>
                          )}
                          <button
                            onClick={handleLeaveRoom}
                            className="px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 whitespace-nowrap cursor-pointer"
                          >
                            离开房间
                          </button>
                          {amIHost ? (
                            <button
                              onClick={handleStartRoom}
                              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                            >
                              <Play className="w-4 h-4" /> 开始比赛
                            </button>
                          ) : (
                            <button
                              onClick={() => wsRef.current?.send(JSON.stringify({ type: 'room:ready' }))}
                              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                            >
                              <UserPlus className="w-4 h-4" /> 切换准备状态
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {currentRoom.members.map((m) => (
                          <div
                            key={m.playerId}
                            className="flex items-center justify-between bg-[#111318] border border-slate-800 rounded-lg p-3.5"
                          >
                            <div>
                              <div className="font-semibold text-sm text-white">
                                {m.nickname}{' '}
                                {m.isHost && <span className="text-xs text-amber-400">(房主)</span>}
                                {m.isBot && <span className="text-xs text-sky-400">[AI 车手]</span>}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {RIDERS[m.riderId].name} · Lv.{m.riderLevel}
                              </div>
                            </div>
                            <span
                              className={`text-xs font-semibold ${
                                m.ready ? 'text-emerald-400' : 'text-slate-500'
                              }`}
                            >
                              {m.ready ? '已就绪' : '等待中'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Mini Live Global Top 5 Preview */}
            <section className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  全球实时前 5 强车手
                </h2>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="text-xs font-medium text-amber-400 hover:underline cursor-pointer"
                >
                  查看完整排行榜
                </button>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  暂无全球完赛数据，立刻完成一场竞速争夺榜首位置！
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {leaderboard.slice(0, 5).map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="bg-[#111318] border border-slate-800 rounded-lg p-3 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono-tabular font-bold text-amber-400">
                          #{idx + 1}
                        </span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          {(entry.finishTimeMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <div className="font-semibold text-white truncate">{entry.nickname}</div>
                      <div className="text-slate-400 mt-0.5 truncate">
                        {TRACKS[entry.trackId]?.name} · Lv.{entry.riderLevel}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Achievement Unlocked Celebration Modal */}
      {achievementQueue.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1B1F27] border-2 border-amber-400 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <Award className="w-12 h-12 text-amber-400 mx-auto" />
            <div>
              <div className="text-xs font-semibold text-amber-400">解锁传奇成就</div>
              <h3 className="font-display text-2xl font-bold text-white mt-1">
                {achievementQueue[0].name}
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {achievementQueue[0].description}
            </p>
            <div className="bg-[#111318] border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">已自动发放成就奖励</div>
              <div className="font-mono-tabular text-xl font-bold text-amber-400 mt-0.5">
                +{achievementQueue[0].rewardLabel}
              </div>
            </div>
            <button
              onClick={() => setAchievementQueue((prev) => prev.slice(1))}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
