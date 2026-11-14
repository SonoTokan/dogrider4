import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Crosshair,
  Heart,
  RotateCcw,
  ShieldAlert,
  Smile,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  ActiveTauntBubble,
  ControlInputs,
  DifficultyId,
  GameMode,
  PlayerProfile,
  Projectile,
  RacerSyncState,
  RoomInfo,
  TauntSpec,
  TrackCollectible,
  TrackId,
  TrackTrap,
  WeaponId,
  WeatherType,
} from '../types/game';
import {
  DIFFICULTIES,
  PISTOL_VARIANTS,
  RIDERS,
  TAUNTS,
  TRACKS,
  WEAPONS,
  WEATHER_LABELS,
} from '../game/catalog';
import { soundEngine } from '../game/audio';
import {
  FloatingText,
  LocalRacerState,
  Particle,
  computeBotInputs,
  createInitialRacerState,
  stepRacerPhysics,
  toSyncState,
} from '../game/physics';
import { renderGameCanvas, WeatherParticle } from '../game/renderer';
import { TRACK_SCALE, generateTrackObjects, getFinishX, getTerrainHeight } from '../game/tracks';

interface GamePlayViewProps {
  mode: GameMode;
  trackId: TrackId;
  difficulty: DifficultyId;
  weatherMode: 'dynamic' | WeatherType;
  seed: number;
  profile: PlayerProfile;
  room: RoomInfo | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
  remoteRacers: RacerSyncState[];
  serverWeather: WeatherType | null;
  onFinishRun: (result: {
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
  }) => void;
  onExit: () => void;
  onGoGarage: () => void;
  onReplay: () => void;
  onAddBot?: () => void;
}

const WEATHER_SEQ: WeatherType[] = ['clear', 'rain', 'sandstorm', 'blizzard', 'thunderstorm'];

export const GamePlayView: React.FC<GamePlayViewProps> = ({
  mode,
  trackId,
  difficulty,
  weatherMode,
  seed,
  profile,
  room,
  wsRef,
  remoteRacers,
  serverWeather,
  onFinishRun,
  onExit,
  onGoGarage,
  onReplay,
  onAddBot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputsRef = useRef<ControlInputs>({
    throttle: false,
    brake: false,
    leanLeft: false,
    leanRight: false,
    jump: false,
    nitro: false,
    bark: false,
  });

  const [muted, setMuted] = useState(soundEngine.muted);
  const [hudState, setHudState] = useState({
    hp: 100,
    maxHp: 100,
    nitro: 100,
    speedKmh: 0,
    progressPct: 0,
    score: 0,
    flips: 0,
    crashes: 0,
    coins: 0,
    elapsedMs: 0,
    headCrashWarning: false,
    lastDamage: 0,
    dead: false,
    finished: false,
    canReviveNearby: false,
    silentBlackout: false,
  });

  const isSoloLocal = mode === 'single' || (mode === 'terminator' && !room);
  const canUseWeapons = profile.selectedRider === 'derek' || mode === 'terminator';

  const [activeWeather, setActiveWeather] = useState<WeatherType>(
    weatherMode === 'dynamic' ? TRACKS[trackId].defaultWeather : weatherMode
  );
  const [countdown, setCountdown] = useState<number>(isSoloLocal ? 3 : room?.countdown ?? 0);
  const [tutorialStep, setTutorialStep] = useState<number>(0);
  const [tutorialDismissed, setTutorialDismissed] = useState<boolean>(false);
  const [deathAlertQueue, setDeathAlertQueue] = useState<Array<{ playerId: string; nickname: string }>>([]);
  const [tauntWheelOpen, setTauntWheelOpen] = useState<boolean>(false);
  const [tauntFeed, setTauntFeed] = useState<ActiveTauntBubble[]>([]);
  const [activeWeapon, setActiveWeapon] = useState<WeaponId>('98k');
  const [pistolVariantIdx, setPistolVariantIdx] = useState<number>(0);
  const [hudKills, setHudKills] = useState<number>(0);
  const [hudBots, setHudBots] = useState<RacerSyncState[]>([]);
  const [runOutcome, setRunOutcome] = useState<{
    status: 'dead' | 'finished';
    finishTimeMs: number | null;
    score: number;
    coinsEarned: number;
    flips: number;
    crashesCount: number;
    distanceMeters: number;
    rank: number;
    terminatorKills?: number;
  } | null>(null);

  const remoteRacersRef = useRef<RacerSyncState[]>([]);
  remoteRacersRef.current = remoteRacers;

  const roomRef = useRef<RoomInfo | null>(room);
  roomRef.current = room;

  const activeWeatherRef = useRef<WeatherType>(activeWeather);
  activeWeatherRef.current = activeWeather;

  const countdownRef = useRef<number>(countdown);
  countdownRef.current = countdown;

  const roomStatusRef = useRef<RoomInfo['status'] | undefined>(room?.status);
  roomStatusRef.current = room?.status;

  const tutorialStepRef = useRef<number>(tutorialStep);
  tutorialStepRef.current = tutorialStep;

  const deathAlertActiveRef = useRef<boolean>(false);
  deathAlertActiveRef.current = deathAlertQueue.length > 0;

  const announcedDeadIdsRef = useRef<Set<string>>(new Set());
  const tauntBubblesRef = useRef<Record<string, { text: string; expiresAt: number }>>({});
  const lastTauntSentRef = useRef<number>(0);

  const activeWeaponRef = useRef<WeaponId>('98k');
  const projectilesRef = useRef<Projectile[]>([]);
  const lastShotTimeRef = useRef<number>(0);
  const killsCountRef = useRef<number>(0);
  const localRacerRef = useRef<LocalRacerState | null>(null);
  const cameraPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const selectWeapon = (w: WeaponId) => {
    activeWeaponRef.current = w;
    setActiveWeapon(w);
    if (w === 'pistol') {
      setPistolVariantIdx((prev) => (prev + 1) % PISTOL_VARIANTS.length);
    }
  };

  const cycleWeapon = () => {
    const order: WeaponId[] = ['98k', 'm47', 'pistol'];
    const nextIdx = (order.indexOf(activeWeaponRef.current) + 1) % order.length;
    selectWeapon(order[nextIdx]);
  };

  const fireWeapon = (aimWorldX?: number, aimWorldY?: number) => {
    if (!canUseWeapons) return;
    const racer = localRacerRef.current;
    if (!racer || racer.dead || racer.finished) return;
    const isCd =
      mode === 'single' || (mode === 'terminator' && !roomRef.current)
        ? countdownRef.current > 0
        : roomStatusRef.current === 'countdown';
    if (isCd || deathAlertActiveRef.current) return;

    const w = activeWeaponRef.current;
    const spec = WEAPONS[w];
    const now = performance.now();
    if (now - lastShotTimeRef.current < spec.cooldownMs) return;
    lastShotTimeRef.current = now;

    soundEngine.unlock();
    soundEngine.playGunshot(w);

    const sx = racer.x + Math.cos(racer.angle) * 26;
    const sy = racer.y - 34 + Math.sin(racer.angle) * 14;
    let aimAngle = racer.angle;
    if (aimWorldX !== undefined && aimWorldY !== undefined) {
      aimAngle = Math.atan2(aimWorldY - sy, aimWorldX - sx);
    }

    const damageMult = RIDERS[profile.selectedRider].damageBonus ?? 1.0;
    const proj: Projectile = {
      id: `proj_${profile.playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: profile.playerId,
      ownerName: profile.nickname,
      weaponId: w,
      x: sx,
      y: sy,
      vx: Math.cos(aimAngle) * spec.bulletSpeed + Math.max(0, racer.vx * 0.25),
      vy: Math.sin(aimAngle) * spec.bulletSpeed,
      damage: Math.max(1, Math.round(spec.baseDamage * damageMult)),
      hpPctDamage: spec.hpPctDamage * damageMult,
      color: spec.color,
      life: spec.rangePx / spec.bulletSpeed,
    };

    projectilesRef.current.push(proj);
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: sx,
        y: sy,
        vx: Math.cos(aimAngle + (Math.random() - 0.5) * 0.6) * (240 + Math.random() * 180),
        vy: Math.sin(aimAngle + (Math.random() - 0.5) * 0.6) * (240 + Math.random() * 180),
        life: 0.22,
        maxLife: 0.22,
        size: 3,
        color: spec.color,
      });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'race:fire',
          payload: proj,
        })
      );
    }
  };

  const sendTaunt = (taunt: TauntSpec) => {
    if (mode !== 'versus') return;
    const now = Date.now();
    if (now - lastTauntSentRef.current < 1000) return;
    lastTauntSentRef.current = now;
    soundEngine.unlock();
    soundEngine.playTaunt(taunt.id);

    const text = `${taunt.emoji} ${taunt.label}`;
    tauntBubblesRef.current[profile.playerId] = {
      text,
      expiresAt: now + 2600,
    };
    const item: ActiveTauntBubble = {
      playerId: profile.playerId,
      nickname: profile.nickname,
      tauntId: taunt.id,
      text,
      expiresAt: now + 2800,
    };
    setTauntFeed((prev) => [...prev.slice(-2), item]);
    setTauntWheelOpen(false);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'race:taunt',
          payload: {
            playerId: profile.playerId,
            nickname: profile.nickname,
            tauntId: taunt.id,
            text,
          },
        })
      );
    }
  };

  useEffect(() => {
    setRunOutcome(null);
    setTutorialStep(0);
    setTutorialDismissed(false);
    setDeathAlertQueue([]);
    setTauntWheelOpen(false);
    setTauntFeed([]);
    setHudKills(0);
    setHudBots([]);
    killsCountRef.current = 0;
    projectilesRef.current = [];
    tauntBubblesRef.current = {};
    announcedDeadIdsRef.current = new Set();
  }, [seed, trackId, mode, difficulty]);

  useEffect(() => {
    if (tauntFeed.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTauntFeed((prev) => prev.filter((item) => item.expiresAt > now));
    }, 450);
    return () => clearInterval(timer);
  }, [tauntFeed.length]);

  // Watch remote racers in Multiplayer Versus / Terminator for player death notification popup
  useEffect(() => {
    if (mode !== 'versus' && mode !== 'terminator') return;
    for (const r of remoteRacers) {
      if (r.dead && !announcedDeadIdsRef.current.has(r.playerId)) {
        announcedDeadIdsRef.current.add(r.playerId);
        setDeathAlertQueue((prev) => [...prev, { playerId: r.playerId, nickname: r.nickname }]);
      }
    }
  }, [remoteRacers, mode]);

  useEffect(() => {
    if (serverWeather) {
      setActiveWeather(serverWeather);
    }
  }, [serverWeather]);

  // Countdown for single player / solo terminator
  useEffect(() => {
    if (!isSoloLocal) {
      setCountdown(room?.status === 'countdown' ? room.countdown : 0);
      return;
    }
    setCountdown(3);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 850);
    return () => clearInterval(id);
  }, [isSoloLocal, seed, room?.status, room?.countdown]);

  // Keyboard Listeners (supports both e.code for IME/CapsLock safety and e.key)
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.unlock();
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
      }
      const k = e.key.toLowerCase();
      const c = e.code;
      if (c === 'KeyW' || c === 'ArrowUp' || k === 'w' || e.key === 'ArrowUp') {
        inputsRef.current.throttle = true;
      }
      if (c === 'KeyS' || c === 'ArrowDown' || k === 's' || e.key === 'ArrowDown') {
        inputsRef.current.brake = true;
      }
      if (c === 'KeyA' || c === 'ArrowLeft' || k === 'a' || e.key === 'ArrowLeft') {
        inputsRef.current.leanLeft = true;
      }
      if (c === 'KeyD' || c === 'ArrowRight' || k === 'd' || e.key === 'ArrowRight') {
        inputsRef.current.leanRight = true;
      }
      if (c === 'KeyQ' || k === 'q') {
        inputsRef.current.jump = true;
      }
      if (c === 'ShiftLeft' || c === 'ShiftRight' || e.key === 'Shift') {
        inputsRef.current.nitro = true;
      }
      if (c === 'KeyE' || k === 'e') {
        inputsRef.current.bark = true;
      }
      if (c === 'KeyF' || k === 'f') {
        fireWeapon();
      }
      if (c === 'KeyR' || k === 'r') {
        cycleWeapon();
      }
      if (mode === 'versus') {
        if (c === 'KeyT' || k === 't') {
          setTauntWheelOpen((v) => !v);
        }
        const digitIdx = ['1', '2', '3', '4', '5', '6'].indexOf(k);
        if (digitIdx !== -1 && TAUNTS[digitIdx]) {
          sendTaunt(TAUNTS[digitIdx]);
        }
      } else if (canUseWeapons) {
        if (k === '1') selectWeapon('98k');
        if (k === '2') selectWeapon('m47');
        if (k === '3') selectWeapon('pistol');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const c = e.code;
      if (c === 'KeyW' || c === 'ArrowUp' || k === 'w' || e.key === 'ArrowUp') {
        inputsRef.current.throttle = false;
      }
      if (c === 'KeyS' || c === 'ArrowDown' || k === 's' || e.key === 'ArrowDown') {
        inputsRef.current.brake = false;
      }
      if (c === 'KeyA' || c === 'ArrowLeft' || k === 'a' || e.key === 'ArrowLeft') {
        inputsRef.current.leanLeft = false;
      }
      if (c === 'KeyD' || c === 'ArrowRight' || k === 'd' || e.key === 'ArrowRight') {
        inputsRef.current.leanRight = false;
      }
      if (c === 'ShiftLeft' || c === 'ShiftRight' || e.key === 'Shift') {
        inputsRef.current.nitro = false;
      }
    };

    const onBlur = () => {
      inputsRef.current = {
        throttle: false,
        brake: false,
        leanLeft: false,
        leanRight: false,
        jump: false,
        nitro: false,
        bark: false,
      };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [mode, profile.playerId, profile.nickname]);

  // Main 60Hz Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const { traps, collectibles }: { traps: TrackTrap[]; collectibles: TrackCollectible[] } =
      generateTrackObjects(trackId, seed, difficulty);
    const finishX = getFinishX(trackId);

    const localRacer: LocalRacerState = createInitialRacerState({
      playerId: profile.playerId,
      nickname: profile.nickname,
      riderId: profile.selectedRider,
      frameId: profile.selectedFrame,
      upgrades: profile.upgrades,
    });
    localRacerRef.current = localRacer;

    // Host manages AI Bots in multiplayer rooms OR solo Terminator spawns 3 AI targets
    const botStates: LocalRacerState[] = [];
    const spawnedBotIds = new Set<string>();
    const syncRoomBots = () => {
      const r = roomRef.current;
      if (r) {
        const amIHost = r.members.find((m) => m.playerId === profile.playerId)?.isHost ?? false;
        if (!amIHost) return;
        const bots = r.members.filter((m) => m.isBot);
        bots.forEach((bot, idx) => {
          if (spawnedBotIds.has(bot.playerId)) return;
          spawnedBotIds.add(bot.playerId);
          botStates.push(
            createInitialRacerState({
              playerId: bot.playerId,
              nickname: bot.nickname,
              riderId: bot.riderId,
              frameId: bot.frameId,
              upgrades: bot.upgrades,
              isBot: true,
              startOffset: (idx + 1) * 16,
            })
          );
        });
      } else if (mode === 'terminator' && botStates.length === 0) {
        const soloBotRiders = ['shiba', 'husky', 'bulldog'] as const;
        soloBotRiders.forEach((rid, idx) => {
          const bid = `term_bot_${idx + 1}`;
          spawnedBotIds.add(bid);
          botStates.push(
            createInitialRacerState({
              playerId: bid,
              nickname: `机械靶犬#${idx + 1}`,
              riderId: rid,
              frameId: idx === 1 ? 'enduro' : 'trail',
              upgrades: { ...profile.upgrades },
              isBot: true,
              startOffset: (idx + 1) * 32,
            })
          );
        });
      }
    };
    syncRoomBots();

    const particles: Particle[] = [];
    const floatingTexts: FloatingText[] = [];
    particlesRef.current = particles;
    floatingTextsRef.current = floatingTexts;
    const weatherParticles: WeatherParticle[] = Array.from({ length: 85 }, () => ({
      x: Math.random() * 1400,
      y: Math.random() * 800,
      vx: -140 - Math.random() * 120,
      vy: 360 + Math.random() * 240,
      size: 2 + Math.random() * 3,
      alpha: 0.4 + Math.random() * 0.5,
    }));

    const lightningState = {
      targetX: null as number | null,
      warningTimer: 0,
      flashAlpha: 0,
      cooldown: 6,
    };

    let cameraX = localRacer.x - canvas.width * 0.28;
    let cameraY = localRacer.y - canvas.height * 0.6;
    cameraPosRef.current = { x: cameraX, y: cameraY };
    let elapsedMs = 0;
    let lastTime = performance.now();
    let lastSyncSend = 0;
    let lastWeatherSwitch = 0;
    let lastSilentCueTime = 0;
    let reportedOutcome = false;
    let anyCoopDeath = false;
    let anyCoopDamage = false;
    const encounteredWeathers = new Set<WeatherType>([activeWeatherRef.current]);
    let animId = 0;

    // Listen for Co-op heal / revive / taunt / combat WS messages
    const handleWsEvent = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as { type: string; payload?: Record<string, unknown> };
        if (msg.type === 'race:bark' && mode === 'coop') {
          const bx = Number(msg.payload?.x || 0);
          if (Math.abs(bx - localRacer.x) < 240 && !localRacer.dead) {
            const heal = Math.round(localRacer.maxHp * 0.14);
            localRacer.hp = Math.min(localRacer.maxHp, localRacer.hp + heal);
            localRacer.mudTimer = 0;
            floatingTexts.push({
              x: localRacer.x,
              y: localRacer.y - 68,
              vy: -35,
              text: `队友鼓舞 +${heal} HP`,
              color: '#10B981',
              life: 1.1,
              maxLife: 1.1,
            });
          }
        } else if (msg.type === 'race:revive' && mode === 'coop') {
          if (msg.payload?.targetPlayerId === profile.playerId && localRacer.dead) {
            localRacer.dead = false;
            localRacer.hp = Math.round(localRacer.maxHp * 0.45);
            localRacer.invincibleTimer = 2.0;
            localRacer.angle = 0;
            localRacer.vy = -180;
            floatingTexts.push({
              x: localRacer.x,
              y: localRacer.y - 75,
              vy: -40,
              text: '队友救援复活!',
              color: '#10B981',
              life: 1.5,
              maxLife: 1.5,
            });
          }
        } else if (msg.type === 'race:taunt' && mode === 'versus') {
          const senderId = String(msg.payload?.playerId || '');
          const senderName = String(msg.payload?.nickname || '对手');
          const tauntId = String(msg.payload?.tauntId || 'ahead');
          const text = String(msg.payload?.text || '😎 先走一步');
          if (senderId && senderId !== profile.playerId) {
            const nowTs = Date.now();
            soundEngine.playTaunt(tauntId);
            tauntBubblesRef.current[senderId] = {
              text,
              expiresAt: nowTs + 2600,
            };
            setTauntFeed((prev) => [
              ...prev.slice(-2),
              {
                playerId: senderId,
                nickname: senderName,
                tauntId,
                text,
                expiresAt: nowTs + 2800,
              },
            ]);
          }
        } else if (msg.type === 'race:fire') {
          const p = msg.payload as unknown as Projectile;
          if (p && p.ownerId !== profile.playerId) {
            projectilesRef.current.push(p);
          }
        } else if (msg.type === 'race:hit') {
          const targetId = String(msg.payload?.targetPlayerId || '');
          if (targetId === profile.playerId && !localRacer.dead) {
            const dmg = Math.max(1, Number(msg.payload?.damage || 25));
            const shooterName = String(msg.payload?.shooterName || '终结者');
            localRacer.hp = Math.max(0, localRacer.hp - dmg);
            localRacer.totalDamageTaken += dmg;
            if (localRacer.reachedNearDeath) {
              localRacer.damageTakenSinceNearDeath += dmg;
            }
            localRacer.headCrashTimer = 1.6;
            localRacer.lastCrashDamage = dmg;
            localRacer.screenShake = 0.7;
            floatingTexts.push({
              x: localRacer.x,
              y: localRacer.y - 78,
              vy: -42,
              text: `${shooterName} 击中 -${dmg} HP`,
              color: '#EF4444',
              life: 1.5,
              maxLife: 1.5,
            });
            if (localRacer.hp <= 0) {
              localRacer.dead = true;
              localRacer.deathTimeMs = elapsedMs;
              soundEngine.playHitConfirm(true);
            } else {
              soundEngine.playHitConfirm(false);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    const currentWs = wsRef.current;
    if (currentWs) {
      currentWs.addEventListener('message', handleWsEvent);
    }

    const frameLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(0.035, Math.max(0.004, rawDt));

      // Continuously sync any newly summoned AI bots in the room
      syncRoomBots();

      const isCountdown = isSoloLocal
        ? countdownRef.current > 0
        : roomStatusRef.current === 'countdown';

      // Calculate Silent Blackout darkness cycle
      let darknessAlpha = 0;
      if (difficulty === 'silent' && !isCountdown) {
        const cycleSec = (elapsedMs / 1000) % 13;
        if (cycleSec >= 4.0 && cycleSec <= 10.5) {
          if (cycleSec < 5.0) {
            darknessAlpha = (cycleSec - 4.0) * 0.985;
          } else if (cycleSec > 9.5) {
            darknessAlpha = (10.5 - cycleSec) * 0.985;
          } else {
            darknessAlpha = 0.985;
          }
        }
      }

      if (!isCountdown && !deathAlertActiveRef.current) {
        elapsedMs += dt * 1000;

        // Interactive Tutorial Step Progression (all modes: single, versus, coop)
        if (difficulty === 'tutorial') {
          const step = tutorialStepRef.current;
          if (step === 0 && inputsRef.current.throttle) setTutorialStep(1);
          else if (step === 1 && inputsRef.current.brake) setTutorialStep(2);
          else if (step === 2 && (inputsRef.current.leanLeft || inputsRef.current.leanRight)) setTutorialStep(3);
          else if (step === 3 && inputsRef.current.jump) setTutorialStep(4);
          else if (step === 4 && inputsRef.current.nitro) setTutorialStep(5);
          else if (step === 5 && inputsRef.current.bark) setTutorialStep(6);
        }

        // Single-player / solo terminator dynamic weather progression
        if (isSoloLocal && weatherMode === 'dynamic') {
          if (elapsedMs - lastWeatherSwitch > 16000) {
            lastWeatherSwitch = elapsedMs;
            const nextW = WEATHER_SEQ[Math.floor(Math.random() * WEATHER_SEQ.length)];
            setActiveWeather(nextW);
          }
        }

        const weatherNow = activeWeatherRef.current;
        encounteredWeathers.add(weatherNow);

        // Thunderstorm lightning logic
        let activeStrikeX: number | null = null;
        if (weatherNow === 'thunderstorm') {
          lightningState.cooldown -= dt;
          if (lightningState.cooldown <= 0 && lightningState.targetX === null) {
            lightningState.targetX = localRacer.x + 260 + Math.random() * 280;
            lightningState.warningTimer = 1.35;
          }
          if (lightningState.targetX !== null) {
            if (lightningState.warningTimer > 0) {
              lightningState.warningTimer -= dt;
              if (lightningState.warningTimer <= 0) {
                activeStrikeX = lightningState.targetX;
                lightningState.flashAlpha = 0.65;
                soundEngine.playThunder();
                lightningState.cooldown = 4.5 + Math.random() * 3;
                setTimeout(() => {
                  lightningState.targetX = null;
                }, 260);
              }
            }
          }
        } else {
          lightningState.targetX = null;
        }
        if (lightningState.flashAlpha > 0) {
          lightningState.flashAlpha = Math.max(0, lightningState.flashAlpha - dt * 2.4);
        }

        // Step Local Racer Physics
        const events = stepRacerPhysics(
          localRacer,
          inputsRef.current,
          dt,
          elapsedMs,
          trackId,
          seed,
          weatherNow,
          difficulty,
          traps,
          collectibles,
          activeStrikeX,
          particles,
          floatingTexts
        );
        // Consume single-press jump & bark
        inputsRef.current.jump = false;
        inputsRef.current.bark = false;

        if (events.jumped) soundEngine.playJump();
        if (events.flipped) soundEngine.playFlip();
        if (events.pickup) soundEngine.playPickup(events.pickup);
        if (events.headCrash) {
          soundEngine.playHeadCrash(
            events.headCrash.fatal,
            events.headCrash.intensity,
            events.headCrash.isHeadFirst
          );
          if (
            events.headCrash.fatal &&
            (mode === 'versus' || mode === 'terminator') &&
            !announcedDeadIdsRef.current.has(profile.playerId)
          ) {
            announcedDeadIdsRef.current.add(profile.playerId);
            setDeathAlertQueue((prev) => [
              ...prev,
              { playerId: profile.playerId, nickname: profile.nickname },
            ]);
          }
        }
        if (events.silentCue && now - lastSilentCueTime > 260) {
          lastSilentCueTime = now;
          if (events.silentCue.kind === 'slope') {
            soundEngine.playSilentSlopeCue(events.silentCue.slopeRad || 0);
          } else {
            soundEngine.playSilentTrapCue(
              events.silentCue.kind === 'spring' ? 'spring' : 'hazard',
              events.silentCue.urgency || 0.5
            );
          }
        }
        if (events.finished) soundEngine.playFinish(true);
        if (events.barked) {
          soundEngine.playBark();
          // Co-op Revive Check (both local bots & remote players)
          if (mode === 'coop') {
            const fallenBot = botStates.find(
              (b) => b.dead && Math.abs(b.x - localRacer.x) < 180
            );
            if (fallenBot) {
              fallenBot.dead = false;
              fallenBot.hp = Math.round(fallenBot.maxHp * 0.55);
              fallenBot.invincibleTimer = 2.0;
              fallenBot.angle = 0;
              fallenBot.vy = -160;
              floatingTexts.push({
                x: localRacer.x,
                y: localRacer.y - 75,
                vy: -40,
                text: `救援了 ${fallenBot.nickname}!`,
                color: '#10B981',
                life: 1.4,
                maxLife: 1.4,
              });
            }
          }
          if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(
              JSON.stringify({
                type: 'race:bark',
                payload: { playerId: profile.playerId, x: localRacer.x },
              })
            );
            if (mode === 'coop') {
              const fallen = remoteRacersRef.current.find(
                (r) => !spawnedBotIds.has(r.playerId) && r.dead && Math.abs(r.x - localRacer.x) < 180
              );
              if (fallen) {
                currentWs.send(
                  JSON.stringify({
                    type: 'race:revive',
                    payload: { targetPlayerId: fallen.playerId },
                  })
                );
                floatingTexts.push({
                  x: localRacer.x,
                  y: localRacer.y - 75,
                  vy: -40,
                  text: `救援了 ${fallen.nickname}!`,
                  color: '#10B981',
                  life: 1.4,
                  maxLife: 1.4,
                });
              }
            }
          }
        }

        // Step Host-Owned AI Bots
        for (const bot of botStates) {
          const botInputs = computeBotInputs(bot, trackId, seed, traps);
          const botEvents = stepRacerPhysics(
            bot,
            botInputs,
            dt,
            elapsedMs,
            trackId,
            seed,
            weatherNow,
            difficulty,
            traps,
            collectibles,
            null,
            particles,
            floatingTexts
          );
          if (
            botEvents.headCrash?.fatal &&
            (mode === 'versus' || mode === 'terminator') &&
            !announcedDeadIdsRef.current.has(bot.playerId)
          ) {
            announcedDeadIdsRef.current.add(bot.playerId);
            setDeathAlertQueue((prev) => [
              ...prev,
              { playerId: bot.playerId, nickname: bot.nickname },
            ]);
          }
        }

        // Step Projectiles & Hit Detection (Derek & Terminator Mode)
        const projs = projectilesRef.current;
        for (let i = projs.length - 1; i >= 0; i--) {
          const p = projs[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;

          const terrainY = getTerrainHeight(p.x, trackId, seed);
          if (p.life <= 0 || p.y > terrainY) {
            projs.splice(i, 1);
            continue;
          }

          if (p.ownerId === profile.playerId) {
            let hitConsumed = false;
            // Check AI bots first
            for (const bot of botStates) {
              if (bot.dead) continue;
              if (Math.hypot(p.x - bot.x, p.y - (bot.y - 26)) < 40) {
                const wSpec = WEAPONS[p.weaponId];
                const dmg = Math.max(1, Math.round(Math.max(p.damage, bot.maxHp * p.hpPctDamage)));
                bot.hp = Math.max(0, bot.hp - dmg);
                bot.headCrashTimer = 1.5;
                bot.lastCrashDamage = dmg;
                bot.vx *= 0.68;
                bot.vy = Math.min(bot.vy, -90);
                for (let k = 0; k < 10; k++) {
                  particles.push({
                    x: bot.x,
                    y: bot.y - 26,
                    vx: (Math.random() - 0.5) * 320,
                    vy: -Math.random() * 240,
                    life: 0.45,
                    maxLife: 0.45,
                    size: 3.5,
                    color: '#EF4444',
                  });
                }
                if (bot.hp <= 0) {
                  bot.dead = true;
                  bot.deathTimeMs = elapsedMs;
                  killsCountRef.current += 1;
                  localRacer.score += 150;
                  localRacer.coinsEarned += 15;
                  soundEngine.playHitConfirm(true);
                  floatingTexts.push({
                    x: bot.x,
                    y: bot.y - 82,
                    vy: -45,
                    text: `终结 ${bot.nickname}! +15 🦴`,
                    color: '#FBBF24',
                    life: 1.7,
                    maxLife: 1.7,
                  });
                } else {
                  soundEngine.playHitConfirm(false);
                  floatingTexts.push({
                    x: bot.x,
                    y: bot.y - 72,
                    vy: -36,
                    text: `-${dmg} HP (${wSpec.name})`,
                    color: '#F87171',
                    life: 1.1,
                    maxLife: 1.1,
                  });
                }
                hitConsumed = true;
                break;
              }
            }
            if (hitConsumed) {
              projs.splice(i, 1);
              continue;
            }

            // Check remote human/other racers
            for (const r of remoteRacersRef.current) {
              if (r.dead || spawnedBotIds.has(r.playerId)) continue;
              if (Math.hypot(p.x - r.x, p.y - (r.y - 26)) < 40) {
                const dmg = Math.max(1, Math.round(Math.max(p.damage, r.maxHp * p.hpPctDamage)));
                const fatal = r.hp - dmg <= 0;
                soundEngine.playHitConfirm(fatal);
                if (fatal) {
                  killsCountRef.current += 1;
                  localRacer.score += 200;
                  localRacer.coinsEarned += 20;
                }
                floatingTexts.push({
                  x: r.x,
                  y: r.y - 78,
                  vy: -42,
                  text: fatal ? `终结车友 ${r.nickname}! +20 🦴` : `命中 ${r.nickname} -${dmg}`,
                  color: fatal ? '#FBBF24' : '#F87171',
                  life: 1.4,
                  maxLife: 1.4,
                });
                if (currentWs && currentWs.readyState === WebSocket.OPEN) {
                  currentWs.send(
                    JSON.stringify({
                      type: 'race:hit',
                      payload: {
                        shooterId: profile.playerId,
                        shooterName: profile.nickname,
                        targetPlayerId: r.playerId,
                        damage: dmg,
                        weaponId: p.weaponId,
                      },
                    })
                  );
                }
                hitConsumed = true;
                break;
              }
            }
            if (hitConsumed) {
              projs.splice(i, 1);
              continue;
            }
          }
        }

        // Send WebSocket State at ~20Hz
        if (currentWs && currentWs.readyState === WebSocket.OPEN && now - lastSyncSend > 50) {
          lastSyncSend = now;
          currentWs.send(
            JSON.stringify({
              type: 'race:state',
              payload: toSyncState(localRacer),
            })
          );
          for (const bot of botStates) {
            currentWs.send(
              JSON.stringify({
                type: 'race:state',
                payload: toSyncState(bot),
              })
            );
          }
        }

        // Track Co-op Team Flawless Status (no one died, no one lost even 1 HP)
        if (mode === 'coop') {
          if (localRacer.dead || botStates.some((b) => b.dead) || remoteRacersRef.current.some((r) => r.dead)) {
            anyCoopDeath = true;
          }
          if (
            localRacer.totalDamageTaken > 0 ||
            botStates.some((b) => b.totalDamageTaken > 0) ||
            remoteRacersRef.current.some((r) => r.hp < r.maxHp || r.crashesCount > 0 || r.dead)
          ) {
            anyCoopDamage = true;
          }
        }

        // Check End Outcome (Wait 1.1s on death so player sees head crash + 0 HP!)
        if (!reportedOutcome && (localRacer.finished || (localRacer.dead && localRacer.deathAnimTimer > 1.15))) {
          reportedOutcome = true;
          const visibleOpponents: RacerSyncState[] = [
            ...botStates.map(toSyncState),
            ...remoteRacersRef.current.filter((r) => !spawnedBotIds.has(r.playerId)),
          ];
          const allRacers = [toSyncState(localRacer), ...visibleOpponents];
          allRacers.sort((a, b) => {
            if (a.finished && !b.finished) return -1;
            if (!a.finished && b.finished) return 1;
            if (a.finished && b.finished) return (a.finishTimeMs || 0) - (b.finishTimeMs || 0);
            return b.x - a.x;
          });
          const rank = Math.max(1, allRacers.findIndex((r) => r.playerId === profile.playerId) + 1);
          const distMeters = Math.round(localRacer.x / TRACK_SCALE);
          const outcome = {
            status: localRacer.finished ? ('finished' as const) : ('dead' as const),
            finishTimeMs: localRacer.finishTimeMs,
            score: localRacer.score,
            coinsEarned: localRacer.coinsEarned + (localRacer.finished ? 25 : 8),
            flips: localRacer.flips,
            crashesCount: localRacer.crashesCount,
            distanceMeters: distMeters,
            rank,
            terminatorKills: killsCountRef.current,
          };
          setRunOutcome(outcome);
          const lastTrap = traps.reduce<TrackTrap | null>(
            (best, t) => (!best || t.x > best.x ? t : best),
            null
          );
          const diedAtLastTrap =
            localRacer.dead &&
            ((lastTrap !== null && localRacer.lastTrapHitId === lastTrap.id) ||
              (finishX - localRacer.x) / TRACK_SCALE <= 45);
          const luckyNarrowEscape =
            localRacer.finished &&
            !localRacer.dead &&
            localRacer.reachedNearDeath &&
            localRacer.damageTakenSinceNearDeath === 0;

          onFinishRun({
            finished: localRacer.finished,
            dead: localRacer.dead,
            finishTimeMs: localRacer.finishTimeMs,
            score: localRacer.score,
            coinsEarned: outcome.coinsEarned,
            flips: localRacer.flips,
            crashesCount: localRacer.crashesCount,
            distanceMeters: distMeters,
            weather: weatherNow,
            rank,
            damageTaken: localRacer.totalDamageTaken,
            coopTeamFlawless: mode === 'coop' && !anyCoopDeath && !anyCoopDamage,
            encounteredWeathers: Array.from(encounteredWeathers),
            luckyNarrowEscape,
            diedAtLastTrap,
            deathTimeMs: localRacer.deathTimeMs,
            terminatorKills: killsCountRef.current,
          });
        }
      }

      // Update particles & floating texts
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }

      // Update Weather Screen Particles
      const weatherNow = activeWeatherRef.current;
      for (const wp of weatherParticles) {
        if (weatherNow === 'rain' || weatherNow === 'thunderstorm') {
          wp.x -= 220 * dt;
          wp.y += 760 * dt;
        } else if (weatherNow === 'blizzard') {
          wp.x -= 260 * dt;
          wp.y += 180 * dt;
        } else if (weatherNow === 'sandstorm') {
          wp.x -= 540 * dt;
          wp.y += 40 * dt;
        }
        if (wp.y > canvas.height) wp.y = -10;
        if (wp.x < -20) wp.x = canvas.width + 10;
      }

      // Smooth Camera Follow
      const targetCamX = localRacer.x - canvas.width * 0.28 + localRacer.vx * 0.16;
      const targetCamY = localRacer.y - canvas.height * 0.56;
      cameraX += (targetCamX - cameraX) * Math.min(1, dt * 8);
      cameraY += (targetCamY - cameraY) * Math.min(1, dt * 6);
      cameraPosRef.current = { x: cameraX, y: cameraY };

      // Collect active taunt bubbles
      const activeTauntMap: Record<string, string> = {};
      const nowEpoch = Date.now();
      for (const [pid, b] of Object.entries(tauntBubblesRef.current)) {
        if (b.expiresAt > nowEpoch) {
          activeTauntMap[pid] = b.text;
        } else {
          delete tauntBubblesRef.current[pid];
        }
      }

      // Combine local AI bots + remote players (fixes host not seeing bots!)
      const visibleOpponents: RacerSyncState[] = [
        ...botStates.map(toSyncState),
        ...remoteRacersRef.current.filter((r) => !spawnedBotIds.has(r.playerId)),
      ];

      // Render Frame
      renderGameCanvas(
        ctx,
        canvas.width,
        canvas.height,
        cameraX,
        cameraY,
        trackId,
        seed,
        weatherNow,
        mode,
        elapsedMs,
        localRacer,
        visibleOpponents,
        traps,
        collectibles,
        particles,
        floatingTexts,
        weatherParticles,
        lightningState,
        darknessAlpha,
        activeTauntMap,
        projectilesRef.current
      );

      // Update React HUD smoothly
      const canRevive =
        mode === 'coop' &&
        !localRacer.dead &&
        visibleOpponents.some((r) => r.dead && Math.abs(r.x - localRacer.x) < 180);

      setHudBots(botStates.map(toSyncState));
      setHudKills(killsCountRef.current);
      setHudState({
        hp: localRacer.hp,
        maxHp: localRacer.maxHp,
        nitro: Math.round(localRacer.nitro),
        speedKmh: Math.max(0, Math.round(localRacer.vx * 0.14)),
        progressPct: Math.min(100, Math.max(0, (localRacer.x / finishX) * 100)),
        score: localRacer.score,
        flips: localRacer.flips,
        crashes: localRacer.crashesCount,
        coins: localRacer.coinsEarned,
        elapsedMs: Math.round(elapsedMs),
        headCrashWarning: localRacer.headCrashTimer > 0,
        lastDamage: localRacer.lastCrashDamage,
        dead: localRacer.dead,
        finished: localRacer.finished,
        canReviveNearby: canRevive,
        silentBlackout: darknessAlpha > 0.35,
      });

      animId = requestAnimationFrame(frameLoop);
    };

    animId = requestAnimationFrame(frameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      if (currentWs) {
        currentWs.removeEventListener('message', handleWsEvent);
      }
    };
  }, [trackId, seed, mode, difficulty]);

  const weatherMeta = WEATHER_LABELS[activeWeather];
  const hpPercent = Math.max(0, (hudState.hp / hudState.maxHp) * 100);
  const finishX = getFinishX(trackId);

  const toggleMute = () => {
    soundEngine.muted = !soundEngine.muted;
    setMuted(soundEngine.muted);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.unlock();
    if (!canUseWeapons) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldX = e.clientX - rect.left + cameraPosRef.current.x;
    const worldY = e.clientY - rect.top + cameraPosRef.current.y;
    fireWeapon(worldX, worldY);
  };

  const progressBarOpponents: RacerSyncState[] = [
    ...hudBots,
    ...remoteRacers.filter((r) => !hudBots.some((b) => b.playerId === r.playerId)),
  ];

  return (
    <div
      onPointerDown={() => soundEngine.unlock()}
      className="relative w-full h-[calc(100vh-64px)] min-h-[540px] bg-[#111318] overflow-hidden select-none"
    >
      {/* Main 60Hz Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className={`block w-full h-full ${canUseWeapons ? 'cursor-crosshair' : ''}`}
      />

      {/* Impact Vignette Flash on Head-First Crash */}
      {hudState.headCrashWarning && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            background:
              'radial-gradient(circle at center, transparent 48%, rgba(220, 38, 38, 0.36) 100%)',
          }}
        />
      )}

      {/* Top HUD Strip */}
      <div className="absolute top-0 left-0 right-0 p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: HP, Rider Level, Nitro */}
        <div className="flex items-center gap-4 bg-[#111318]/85 backdrop-blur-md border border-slate-700/70 rounded-lg px-4 py-2.5 pointer-events-auto">
          <div className="min-w-[170px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Heart className={`w-3.5 h-3.5 ${hudState.headCrashWarning ? 'text-red-500 animate-bounce' : 'text-emerald-400'}`} />
                Lv.{profile.upgrades.riderLevel} 血量
              </span>
              <span className="font-mono-tabular text-xs font-bold text-slate-100">
                {hudState.hp} / {hudState.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          <div className="h-7 w-px bg-slate-700/80" />

          <div className="min-w-[100px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-sky-300 font-medium">
                <Zap className="w-3.5 h-3.5" /> 氮气
              </span>
              <span className="font-mono-tabular text-xs text-slate-200">{hudState.nitro}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-100"
                style={{ width: `${hudState.nitro}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Live Race Progress Bar + Weather */}
        <div className="hidden lg:flex flex-col items-center gap-1.5 bg-[#111318]/85 backdrop-blur-md border border-slate-700/70 rounded-lg px-4 py-2 min-w-[320px]">
          <div className="flex items-center justify-between w-full text-xs text-slate-300">
            <span className="font-medium">
              {TRACKS[trackId].name} ·{' '}
              <span style={{ color: DIFFICULTIES[difficulty].color }}>
                {DIFFICULTIES[difficulty].name}
              </span>
              {mode === 'terminator' && (
                <span className="ml-1.5 text-red-400 font-semibold">· 终结者模式</span>
              )}
            </span>
            <span className="flex items-center gap-1.5" style={{ color: weatherMeta.color }}>
              {activeWeather === 'clear' && <Sun className="w-3.5 h-3.5" />}
              {activeWeather === 'rain' && <CloudRain className="w-3.5 h-3.5" />}
              {activeWeather === 'blizzard' && <CloudSnow className="w-3.5 h-3.5" />}
              {activeWeather === 'sandstorm' && <Wind className="w-3.5 h-3.5" />}
              {activeWeather === 'thunderstorm' && <CloudLightning className="w-3.5 h-3.5" />}
              {weatherMeta.name}
            </span>
          </div>
          <div className="relative w-full h-2 bg-slate-800 rounded-sm">
            {/* Remote & AI Bot dots */}
            {progressBarOpponents.map((r) => {
              const pct = Math.min(100, Math.max(0, (r.x / finishX) * 100));
              return (
                <div
                  key={r.playerId}
                  title={`${r.nickname}${r.dead ? ' (已阵亡)' : ''}`}
                  className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                    r.dead ? 'bg-red-500/80' : r.isBot ? 'bg-cyan-400' : 'bg-sky-400'
                  }`}
                  style={{ left: `calc(${pct}% - 5px)` }}
                />
              );
            })}
            {/* Local dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-slate-950 z-10"
              style={{ left: `calc(${hudState.progressPct}% - 7px)` }}
            />
          </div>
        </div>

        {/* Right: Speed, Time, Score, Bones, Controls */}
        <div className="flex items-center gap-3 bg-[#111318]/85 backdrop-blur-md border border-slate-700/70 rounded-lg px-4 py-2 pointer-events-auto">
          <div className="text-right pr-2">
            <div className="font-mono-tabular text-lg font-bold text-amber-400 leading-none">
              {hudState.speedKmh} <span className="text-[11px] font-normal text-slate-400">KM/H</span>
            </div>
            <div className="font-mono-tabular text-xs text-slate-400 mt-1">
              {(hudState.elapsedMs / 1000).toFixed(1)}s · {hudState.score} 分 ·{' '}
              <span className="text-amber-300 font-semibold">+{hudState.coins} 🦴</span>
            </div>
          </div>

          {room && room.members.length < room.maxPlayers && (
            <button
              onClick={() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'room:add_bot' }));
                } else {
                  onAddBot?.();
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
              title="立即召唤一名 AI 机械犬进入当前赛局"
            >
              <Bot className="w-3.5 h-3.5" /> +人机
            </button>
          )}

          {mode === 'versus' && (
            <button
              onClick={() => setTauntWheelOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tauntWheelOpen
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
              }`}
              title="按 T 键开关轮盘，或直接按 1~6 发送嘲讽"
            >
              <Smile className="w-3.5 h-3.5" /> 嘲讽轮盘 [T]
            </button>
          )}

          <button
            onClick={toggleMute}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title={muted ? '开启音效' : '静音'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onExit}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            退出赛场
          </button>
        </div>
      </div>

      {/* Terminator / Derek Weapon Arsenal Bar */}
      {canUseWeapons && !runOutcome && (
        <div className="absolute top-20 left-3 md:left-4 z-20 flex flex-wrap items-center gap-2 bg-[#111318]/90 backdrop-blur-md border border-red-500/50 rounded-xl px-3.5 py-2 pointer-events-auto shadow-xl">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
            <Crosshair className="w-3.5 h-3.5" />
            终结武装 · ∞ 无限弹
          </span>
          <div className="flex items-center gap-1.5">
            {(['98k', 'm47', 'pistol'] as WeaponId[]).map((wId) => {
              const spec = WEAPONS[wId];
              const isSelected = activeWeapon === wId;
              const label = wId === 'pistol' ? PISTOL_VARIANTS[pistolVariantIdx] : spec.name;
              return (
                <button
                  key={wId}
                  type="button"
                  onClick={() => selectWeapon(wId)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-red-500 text-white shadow'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => fireWeapon()}
            className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            开火 [F/左键]
          </button>
          <span className="text-xs font-mono-tabular text-amber-300 font-semibold">
            已终结: {hudKills}
          </span>
        </div>
      )}

      {/* Tutorial Difficulty Interactive Guide (Single, Versus, Co-op) */}
      {difficulty === 'tutorial' && !tutorialDismissed && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-lg w-[92%] bg-[#1B1F27]/95 border border-sky-500/70 rounded-xl px-4 py-3 shadow-xl flex items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <div className="font-bold text-sky-400">
              教程指引 ({Math.min(tutorialStep + 1, 7)} / 7) · {DIFFICULTIES[difficulty].name}模式
            </div>
            <div className="text-sm text-white font-medium">
              {tutorialStep === 0 && '1. 按 W 或 ↑ 键踩踏板加速前进'}
              {tutorialStep === 1 && '2. 按 S 或 ↓ 键刹车减速，下陡坡时注意控速'}
              {tutorialStep === 2 && '3. 按 A / D 键控制抬头翘尾与空中前后翻滚'}
              {tutorialStep === 3 && '4. 按 Q 键跳跃避空，越过地刺陷阱与坑洼'}
              {tutorialStep === 4 && '5. 按 Shift 键释放氮气喷射加速'}
              {tutorialStep === 5 &&
                `6. 按 E 键汪汪叫${
                  mode === 'coop' ? '（合作模式可给队友回血与复活阵亡队友）' : '（震慑对手）'
                }`}
              {tutorialStep >= 6 &&
                '7. 头朝地摔车会弹出头顶血量条，血量归零即阵亡！现在全力冲向终点吧！'}
            </div>
          </div>
          {tutorialStep >= 6 && (
            <button
              onClick={() => setTutorialDismissed(true)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              知道了
            </button>
          )}
        </div>
      )}

      {/* Silent Blackout Audio Cue Banner */}
      {hudState.silentBlackout && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-slate-950/90 border border-slate-600 text-slate-100 text-xs font-semibold pointer-events-none">
          寂静黑夜降临 · 看不见路，请靠提示音判断坡度与陷阱（高音=前方陷阱 · 上升音=跳台 · 下降音=陡降）
        </div>
      )}

      {/* Head-First Crash Alert Banner */}
      {hudState.headCrashWarning && !hudState.dead && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-950/90 border border-red-500/70 text-red-100 text-sm font-semibold pointer-events-none">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          头朝地重摔! 伤害 -{hudState.lastDamage} HP (剩余 {hudState.hp})
        </div>
      )}

      {/* Co-op Teammate Rescue Prompt */}
      {hudState.canReviveNearby && (
        <div className="absolute top-48 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-emerald-950/90 border border-emerald-400 text-emerald-100 text-sm font-semibold animate-bounce">
          队友阵亡在附近! 按 E 键（或点击汪汪技能）救援复活!
        </div>
      )}

      {/* Countdown Overlay */}
      {countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 pointer-events-none">
          <div className="text-center">
            <div className="font-display text-8xl font-bold text-amber-400 drop-shadow-lg">{countdown}</div>
            <p className="text-sm text-slate-200 mt-2">
              W/↑ 加速 · A/D 空中翻滚 · Q 键跳跃避空 · 当前难度：{DIFFICULTIES[difficulty].name}
            </p>
          </div>
        </div>
      )}

      {/* Versus Live Taunt Feed */}
      {mode === 'versus' && tauntFeed.length > 0 && (
        <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-none">
          {tauntFeed.map((item, idx) => (
            <div
              key={`${item.playerId}_${item.expiresAt}_${idx}`}
              className="px-3 py-1.5 rounded-lg bg-[#111318]/90 border border-amber-500/50 text-xs text-white shadow-lg"
            >
              <span className="font-semibold text-amber-400">{item.nickname}:</span>{' '}
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Versus Quick Taunt Wheel Overlay (T key or HUD button, hotkeys 1-6) */}
      {mode === 'versus' && tauntWheelOpen && !runOutcome && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 bg-[#111318]/95 backdrop-blur-md border border-amber-500/60 rounded-2xl p-4 shadow-2xl w-[340px] max-w-[92vw]">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="font-semibold text-amber-400">多人对抗快捷嘲讽轮盘</span>
            <span>按键 1~6 直发 · T 关闭</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TAUNTS.map((t) => (
              <button
                key={t.id}
                onClick={() => sendTaunt(t)}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1B1F27] hover:bg-amber-500 hover:text-slate-950 border border-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <span className="truncate">
                  {t.emoji} {t.label}
                </span>
                <span className="font-mono-tabular text-[11px] opacity-70">[{t.keyNum}]</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Controls Hint (Bottom Left Desktop) */}
      <div className="hidden md:flex absolute bottom-4 left-4 items-center gap-4 bg-[#111318]/80 backdrop-blur border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-300 pointer-events-none">
        <span>W/↑ 加速</span>
        <span>·</span>
        <span>S/↓ 刹车</span>
        <span>·</span>
        <span>A/D 抬头/前倾翻滚</span>
        <span>·</span>
        <span className="text-amber-400 font-semibold">Q 跳跃避空</span>
        <span>·</span>
        <span>Shift 氮气</span>
        <span>·</span>
        <span>E {mode === 'coop' ? '汪汪救援/回血' : '犬吠震慑'}</span>
        {mode === 'versus' && (
          <>
            <span>·</span>
            <span className="text-amber-300">T / 1-6 嘲讽轮盘</span>
          </>
        )}
        {canUseWeapons && (
          <>
            <span>·</span>
            <span className="text-red-400 font-semibold">F/左键 开火 · R 切枪</span>
          </>
        )}
        <span>·</span>
        <span style={{ color: DIFFICULTIES[difficulty].color }}>
          难度: {DIFFICULTIES[difficulty].name}
        </span>
      </div>

      {/* Touch / On-Screen Controls Overlay */}
      <div className="md:hidden absolute bottom-4 left-3 right-3 flex items-end justify-between pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.leanLeft = true)}
            onPointerUp={() => (inputsRef.current.leanLeft = false)}
            onPointerLeave={() => (inputsRef.current.leanLeft = false)}
            onPointerCancel={() => (inputsRef.current.leanLeft = false)}
            className="w-14 h-14 rounded-lg bg-slate-900/85 border border-slate-700 text-white font-bold text-sm active:bg-amber-500 active:text-slate-950 touch-none"
          >
            后仰
          </button>
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.leanRight = true)}
            onPointerUp={() => (inputsRef.current.leanRight = false)}
            onPointerLeave={() => (inputsRef.current.leanRight = false)}
            onPointerCancel={() => (inputsRef.current.leanRight = false)}
            className="w-14 h-14 rounded-lg bg-slate-900/85 border border-slate-700 text-white font-bold text-sm active:bg-amber-500 active:text-slate-950 touch-none"
          >
            前倾
          </button>
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.bark = true)}
            className="w-12 h-14 rounded-lg bg-emerald-700/90 text-white font-bold text-xs touch-none"
          >
            汪汪
          </button>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.brake = true)}
            onPointerUp={() => (inputsRef.current.brake = false)}
            onPointerLeave={() => (inputsRef.current.brake = false)}
            onPointerCancel={() => (inputsRef.current.brake = false)}
            className="w-12 h-14 rounded-lg bg-slate-800/90 border border-slate-700 text-white font-bold text-xs touch-none"
          >
            刹车
          </button>
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.jump = true)}
            className="w-14 h-14 rounded-lg bg-sky-600/90 text-white font-bold text-sm touch-none"
          >
            跳
          </button>
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.nitro = true)}
            onPointerUp={() => (inputsRef.current.nitro = false)}
            onPointerLeave={() => (inputsRef.current.nitro = false)}
            onPointerCancel={() => (inputsRef.current.nitro = false)}
            className="w-14 h-14 rounded-lg bg-orange-600/90 text-white font-bold text-sm touch-none"
          >
            氮气
          </button>
          <button
            type="button"
            onPointerDown={() => (inputsRef.current.throttle = true)}
            onPointerUp={() => (inputsRef.current.throttle = false)}
            onPointerLeave={() => (inputsRef.current.throttle = false)}
            onPointerCancel={() => (inputsRef.current.throttle = false)}
            className="w-16 h-14 rounded-lg bg-amber-500 text-slate-950 font-bold text-sm touch-none"
          >
            加速
          </button>
        </div>
      </div>

      {/* End of Run / Death Modal */}
      {runOutcome && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-30">
          <div className="w-full max-w-md bg-[#1B1F27] border border-slate-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {runOutcome.status === 'finished' ? (
                <div className="w-11 h-11 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Trophy className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              )}
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {runOutcome.status === 'finished' ? '冲线完赛!' : '头朝地重摔 · 骑手阵亡'}
                </h2>
                <p className="text-xs text-slate-400">
                  {runOutcome.status === 'finished'
                    ? `成绩已实时上传全球排行榜 · 本场第 ${runOutcome.rank} 名`
                    : '血量条归零，无法继续骑行。升级骑手等级与头盔可提高生存率!'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-4 border-y border-slate-800 my-4 text-sm">
              <div>
                <div className="text-xs text-slate-400">完赛用时 / 里程</div>
                <div className="font-mono-tabular text-lg font-bold text-white">
                  {runOutcome.finishTimeMs
                    ? `${(runOutcome.finishTimeMs / 1000).toFixed(2)}s`
                    : `${runOutcome.distanceMeters} m`}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">总特技得分</div>
                <div className="font-mono-tabular text-lg font-bold text-amber-400">
                  {runOutcome.score}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">空中翻滚 / 摔车次数</div>
                <div className="font-mono-tabular text-base font-semibold text-slate-200">
                  {runOutcome.flips} 圈 · {runOutcome.crashesCount} 次摔伤
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">获得金骨头</div>
                <div className="font-mono-tabular text-base font-bold text-yellow-400">
                  +{runOutcome.coinsEarned} 🦴
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {(mode === 'single' || (mode === 'terminator' && !room)) && (
                <button
                  onClick={onReplay}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> 再来一局
                </button>
              )}
              <button
                onClick={onGoGarage}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <Wrench className="w-4 h-4" /> 车库升级
              </button>
              <button
                onClick={onExit}
                className="px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                返回大厅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiplayer Versus / Terminator Player Death Alert Dialog */}
      {(mode === 'versus' || mode === 'terminator') && deathAlertQueue.length > 0 && !runOutcome && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-40">
          <div className="w-full max-w-sm bg-[#1B1F27] border border-red-500/70 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">对抗赛淘汰消息</h3>
                <p className="text-xs text-slate-400">有车手在本场竞速中阵亡</p>
              </div>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              玩家 <strong className="text-red-400">【{deathAlertQueue[0].nickname}】</strong>{' '}
              头朝地摔车，血量归零阵亡，已退出本场竞速！
            </p>
            <button
              type="button"
              onClick={() => setDeathAlertQueue((prev) => prev.slice(1))}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
