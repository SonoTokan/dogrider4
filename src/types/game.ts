export type GameMode = 'single' | 'versus' | 'coop' | 'terminator';

export type RiderId = 'shiba' | 'husky' | 'bulldog' | 'got_virtue' | 'got_66' | 'unknown' | 'oreo' | 'aode' | 'delsas' | 'drusas' | 'derek';

export type WeaponId = '98k' | 'm47' | 'pistol';

export type MilitaryRankId =
  | 'novice'
  | 'contacter'
  | 'tech_military'
  | 'super_tech_military'
  | 'major'
  | 'lt_colonel'
  | 'colonel'
  | 'major_alt'
  | 'shadow_elite'
  | 'wuji_elite'
  | 'super_veteran'
  | 'wuji';

export interface MilitaryRankSpec {
  id: MilitaryRankId;
  level: number;
  name: string;
  minXp: number;
  stepXp: number;
  color: string;
}

export type BikeFrameId = 'trail' | 'enduro' | 'titanium' | 'cyber';

export type WeatherType = 'clear' | 'rain' | 'blizzard' | 'sandstorm' | 'thunderstorm';

export type TrackId = 'pine_canyon' | 'lava_mine' | 'frost_ridge' | 'wasteland';

export type DifficultyId =
  | 'tutorial'
  | 'novice'
  | 'ultra_low'
  | 'beginner'
  | 'contacter'
  | 'ultimate'
  | 'realistic'
  | 'silent';

export interface UpgradeLevels {
  riderLevel: number;   // Directly increases Max HP & score multiplier
  helmet: number;       // Reduces head-first crash damage
  balance: number;      // Air rotation & wheelie stability
  stamina: number;      // Nitro recharge & bunny hop power
  suspension: number;   // Landing shock absorption
  drivetrain: number;   // Top speed & hill torque
  tires: number;        // Grip in rain/mud/ice
}

export interface PlayerProfile {
  playerId: string;
  nickname: string;
  goldBones: number;
  xp: number;
  modeXp?: Record<GameMode, number>;
  selectedRider: RiderId;
  selectedFrame: BikeFrameId;
  unlockedRiders: RiderId[];
  unlockedFrames: BikeFrameId[];
  upgrades: UpgradeLevels;
  stats: {
    racesPlayed: number;
    wins: number;
    coopWins: number;
    noDamageVersusWins?: number;
    realisticWins?: number;
    ultimateWins?: number;
    tutorialWins?: number;
    contacterWins?: number;
    silentWins?: number;
    realisticSpeedrunWins?: number;
    ultimateSingle2mWins?: number;
    versusWins?: number;
    flawlessCoopWins?: number;
    novice40sWins?: number;
    ultraLow31sWins?: number;
    beginnerWins?: number;
    wonWeathers?: WeatherType[];
    luckyEscapeWins?: number;
    oneStepShortCount?: number;
    ultimate20sDeathCount?: number;
    terminatorKills?: number;
    terminatorWins?: number;
    multiplayerMajorAchieved?: number;
    superChaosWins?: number;
    versus5sWins?: number;
    coop5sWins?: number;
    terminator5sWins?: number;
    totalFlips: number;
    headCrashes: number;
    deaths: number;
    bestDistance: number;
  };
  unlockedAchievements?: string[];
  updatedAt?: number;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  subtitle: string;
  cooldownMs: number;
  bulletSpeed: number;
  baseDamage: number;
  hpPctDamage: number;
  rangePx: number;
  color: string;
  infiniteAmmo: boolean;
}

export interface Projectile {
  id: string;
  ownerId: string;
  ownerName: string;
  weaponId: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  hpPctDamage: number;
  color: string;
  life: number;
}

export interface RiderSpec {
  id: RiderId;
  name: string;
  title: string;
  description: string;
  avatarPath: string;
  unlockCost: number;
  baseHp: number;
  hpPerLevel: number;
  speedBonus: number;
  airControlBonus: number;
  headArmorBase: number; // 0 to 0.35 base reduction
  damageBonus?: number; // Weapon damage multiplier (e.g. 0.6 = 60%)
  weapons?: WeaponId[];
  furPrimary: string;
  furSecondary: string;
  accentColor: string;
}

export interface BikeFrameSpec {
  id: BikeFrameId;
  name: string;
  description: string;
  unlockCost: number;
  speedMult: number;
  weightMult: number;
  durabilityBonus: number;
  frameColor: string;
  forkColor: string;
}

export interface TrackSpec {
  id: TrackId;
  name: string;
  subtitle: string;
  difficulty: '初级' | '接触者' | '终极' | '真实';
  length: number; // world meters (pixels / 20)
  defaultWeather: WeatherType;
  dynamicWeather: boolean;
  skyTop: string;
  skyBottom: string;
  groundTop: string;
  groundFill: string;
  mountainColor: string;
  trapDensity: number;
  rewardMult: number;
}

export type TrapKind = 'spike' | 'mud' | 'ice' | 'spring' | 'pendulum' | 'boulder' | 'lightning_zone';

export interface TrackTrap {
  id: string;
  kind: TrapKind;
  x: number;
  y: number;
  width: number;
  phase: number;
  triggered?: boolean;
  activeTimer?: number;
}

export type CollectibleKind = 'bone' | 'green_bone' | 'nitro' | 'medkit';

export interface TrackCollectible {
  id: string;
  kind: CollectibleKind;
  x: number;
  y: number;
  collected: boolean;
}

export interface RacerSyncState {
  playerId: string;
  nickname: string;
  isBot?: boolean;
  riderId: RiderId;
  frameId: BikeFrameId;
  riderLevel: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  wheelSpin: number;
  hp: number;
  maxHp: number;
  headCrashTimer: number;
  lastCrashDamage: number;
  dead: boolean;
  finished: boolean;
  finishTimeMs: number | null;
  score: number;
  flips: number;
  crashesCount: number;
  isBraking: boolean;
  nitroActive: boolean;
  barkPulseTimer: number;
}

export interface RoomMember {
  playerId: string;
  nickname: string;
  riderId: RiderId;
  frameId: BikeFrameId;
  riderLevel: number;
  upgrades: UpgradeLevels;
  ready: boolean;
  isHost: boolean;
  isBot?: boolean;
}

export interface RoomInfo {
  roomId: string;
  name: string;
  mode: 'versus' | 'coop' | 'terminator';
  trackId: TrackId;
  difficulty: DifficultyId;
  weatherMode: 'dynamic' | WeatherType;
  seed: number;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  countdown: number;
  currentWeather: WeatherType;
  members: RoomMember[];
  maxPlayers: number;
}

export interface LeaderboardEntry {
  id: string;
  playerId: string;
  nickname: string;
  riderId: RiderId;
  riderLevel: number;
  frameId: BikeFrameId;
  mode: GameMode;
  trackId: TrackId;
  difficulty?: DifficultyId;
  finishTimeMs: number;
  score: number;
  crashesCount: number;
  weather: WeatherType;
  createdAt: number;
}

export interface ControlInputs {
  throttle: boolean;
  brake: boolean;
  leanLeft: boolean;
  leanRight: boolean;
  jump: boolean;
  nitro: boolean;
  bark: boolean;
}

export type AchievementId =
  | 'flawless_versus_10000'
  | 'realistic_100_wins'
  | 'ultimate_100_wins'
  | 'tutorial_first_win'
  | 'realistic_speedrun_1m'
  | 'ultimate_single_2m'
  | 'versus_first_win'
  | 'coop_flawless_kind'
  | 'novice_speedrun_40s'
  | 'ultra_low_speedrun_31s'
  | 'beginner_first_win'
  | 'all_weather_wins'
  | 'lucky_narrow_escape'
  | 'one_step_short'
  | 'go_play_tutorial'
  | 'nice_pretty_good'
  | 'flip_master_50'
  | 'contacter_10_wins'
  | 'silent_first_win'
  | 'veteran_50_races'
  | 'best_attire'
  | 'crime_suspect'
  | 'major_multiplayer'
  | 'super_chaos'
  | 'max_rank_wuji'
  | 'rank_contacter'
  | 'rank_tech_military'
  | 'rank_super_tech_military'
  | 'rank_lt_colonel'
  | 'rank_colonel'
  | 'rank_major_alt'
  | 'rank_shadow_elite'
  | 'rank_wuji_elite'
  | 'rank_super_veteran'
  | 'versus_speedrun_5s'
  | 'coop_speedrun_5s'
  | 'terminator_speedrun_5s';

export interface TauntSpec {
  id: string;
  keyNum: string;
  emoji: string;
  label: string;
}

export interface ActiveTauntBubble {
  playerId: string;
  nickname: string;
  tauntId: string;
  text: string;
  expiresAt: number;
}

export interface AchievementSpec {
  id: AchievementId;
  name: string;
  description: string;
  conditionLabel: string;
  rewardBase: number;
  rewardBonus: number;
  rewardTotal: number;
  rewardLabel: string;
  target: number;
  tierColor: string;
}

