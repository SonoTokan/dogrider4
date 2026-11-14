import type {
  AchievementId,
  AchievementSpec,
  BikeFrameId,
  BikeFrameSpec,
  DifficultyId,
  GameMode,
  MilitaryRankSpec,
  PlayerProfile,
  RiderId,
  RiderSpec,
  TauntSpec,
  TrackId,
  TrackSpec,
  UpgradeLevels,
  WeaponId,
  WeaponSpec,
  WeatherType,
} from '../types/game.ts';

export const MODE_RANK_META: Record<
  GameMode,
  { label: string; shortLabel: string; color: string }
> = {
  single: { label: '单人越野试炼军阶', shortLabel: '单人越野试炼', color: '#38BDF8' },
  versus: { label: '多人对抗赛军阶', shortLabel: '多人对抗赛', color: '#F59E0B' },
  coop: { label: '多人合作护送/伏击军阶', shortLabel: '多人合作护送', color: '#10B981' },
  terminator: { label: '终结者模式军阶', shortLabel: '终结者模式', color: '#EF4444' },
};

export const MILITARY_RANKS: MilitaryRankSpec[] = [
  { id: 'novice', level: 1, name: '新手', minXp: 0, stepXp: 200, color: '#94A3B8' },
  { id: 'contacter', level: 2, name: '接触者', minXp: 200, stepXp: 350, color: '#38BDF8' },
  { id: 'tech_military', level: 3, name: '技术军事', minXp: 550, stepXp: 600, color: '#34D399' },
  { id: 'super_tech_military', level: 4, name: '超级技术军事', minXp: 1150, stepXp: 1000, color: '#A78BFA' },
  { id: 'major', level: 5, name: '少校', minXp: 2150, stepXp: 1600, color: '#FBBF24' },
  { id: 'lt_colonel', level: 6, name: '中校', minXp: 3750, stepXp: 2500, color: '#FB923C' },
  { id: 'colonel', level: 7, name: '上校', minXp: 6250, stepXp: 3800, color: '#F87171' },
  { id: 'major_alt', level: 8, name: '少佐', minXp: 10050, stepXp: 5600, color: '#E879F9' },
  { id: 'shadow_elite', level: 9, name: '暗影精英', minXp: 15650, stepXp: 8500, color: '#818CF8' },
  { id: 'wuji_elite', level: 10, name: '无极精英', minXp: 24150, stepXp: 975850, color: '#FACC15' },
  { id: 'super_veteran', level: 11, name: '超级熟手', minXp: 1000000, stepXp: 99000000, color: '#F97316' },
  { id: 'wuji', level: 12, name: '无极', minXp: 100000000, stepXp: 0, color: '#EF4444' },
];

export function getMilitaryRankInfo(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  let current = MILITARY_RANKS[0];
  let next: MilitaryRankSpec | null = MILITARY_RANKS[1] ?? null;

  for (let i = 0; i < MILITARY_RANKS.length; i++) {
    if (safeXp >= MILITARY_RANKS[i].minXp) {
      current = MILITARY_RANKS[i];
      next = MILITARY_RANKS[i + 1] ?? null;
    } else {
      break;
    }
  }

  const xpInLevel = safeXp - current.minXp;
  const xpNeededForNext = next ? next.minXp - current.minXp : 0;
  const progressPct = next
    ? Math.min(100, Math.max(0, Math.round((xpInLevel / Math.max(1, xpNeededForNext)) * 100)))
    : 100;

  return {
    xp: safeXp,
    current,
    next,
    xpInLevel,
    xpNeededForNext,
    xpRemaining: next ? Math.max(0, next.minXp - safeXp) : 0,
    progressPct,
  };
}

export function getModeXp(profile: PlayerProfile | undefined, mode: GameMode): number {
  if (!profile) return 0;
  return Math.max(0, Math.floor(profile.modeXp?.[mode] ?? 0));
}

export function getModeRankInfo(profile: PlayerProfile | undefined, mode: GameMode) {
  return getMilitaryRankInfo(getModeXp(profile, mode));
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  '98k': {
    id: '98k',
    name: '98K',
    subtitle: '栓动精准狙击 · 高穿甲无限弹',
    cooldownMs: 720,
    bulletSpeed: 1950,
    baseDamage: 100,
    hpPctDamage: 0.6,
    rangePx: 1450,
    color: '#FBBF24',
    infiniteAmmo: true,
  },
  m47: {
    id: 'm47',
    name: 'M47',
    subtitle: '突击步枪 · 高射速压制无限弹',
    cooldownMs: 140,
    bulletSpeed: 1500,
    baseDamage: 42,
    hpPctDamage: 0.25,
    rangePx: 1050,
    color: '#F87171',
    infiniteAmmo: true,
  },
  pistol: {
    id: 'pistol',
    name: '任意手枪',
    subtitle: '沙鹰/格洛克/M1911 · 无限手枪弹',
    cooldownMs: 250,
    bulletSpeed: 1300,
    baseDamage: 55,
    hpPctDamage: 0.34,
    rangePx: 820,
    color: '#38BDF8',
    infiniteAmmo: true,
  },
};

export const PISTOL_VARIANTS = ['沙漠之鹰', '格洛克18', 'M1911', 'P226', '左轮手枪'] as const;

export const TAUNTS: TauntSpec[] = [
  { id: 'ahead', keyNum: '1', emoji: '😎', label: '先走一步' },
  { id: 'bark_taunt', keyNum: '2', emoji: '🐶', label: '汪汪挑衅' },
  { id: 'nitro_laugh', keyNum: '3', emoji: '💨', label: '吃我尾气' },
  { id: 'head_warn', keyNum: '4', emoji: '⚠️', label: '小心狗头' },
  { id: 'catch_me', keyNum: '5', emoji: '🔥', label: '追得上吗' },
  { id: 'nice_flip', keyNum: '6', emoji: '👏', label: '漂亮空翻' },
];

export const RIDERS: Record<RiderId, RiderSpec> = {
  shiba: {
    id: 'shiba',
    name: '阿柴 · 疾风爪',
    title: '空中特技专家',
    description: '身手极其矫健的柴犬车手，空中前后空翻转速极快，适合连续特技连击。',
    avatarPath: '/src/assets/images/rider_shiba_avatar_1794577256144.jpg',
    unlockCost: 0,
    baseHp: 110,
    hpPerLevel: 32,
    speedBonus: 1.03,
    airControlBonus: 1.25,
    headArmorBase: 0.05,
    furPrimary: '#E68A2E',
    furSecondary: '#FFF4E0',
    accentColor: '#EF4444',
  },
  husky: {
    id: 'husky',
    name: '二哈 · 极地冲锋',
    title: '极速狂飙猎手',
    description: '天生雪地狂奔的西伯利亚雪橇犬，极速与氮气推进力出众，抗冰滑能力强。',
    avatarPath: '/src/assets/images/rider_husky_avatar_1794577254857.jpg',
    unlockCost: 220,
    baseHp: 125,
    hpPerLevel: 35,
    speedBonus: 1.12,
    airControlBonus: 1.05,
    headArmorBase: 0.1,
    furPrimary: '#64748B',
    furSecondary: '#F8FAFC',
    accentColor: '#38BDF8',
  },
  bulldog: {
    id: 'bulldog',
    name: '铁牛 · 装甲斗牛',
    title: '重装防摔堡垒',
    description: '配备黄铜全盔的肌肉斗牛犬，拥有最高基础血量与超强头朝地防摔减伤。',
    avatarPath: '/src/assets/images/rider_bulldog_avatar_1794577254901.jpg',
    unlockCost: 380,
    baseHp: 160,
    hpPerLevel: 44,
    speedBonus: 0.98,
    airControlBonus: 0.95,
    headArmorBase: 0.24,
    furPrimary: '#8B5E3C',
    furSecondary: '#D6B89C',
    accentColor: '#F59E0B',
  },
  got_virtue: {
    id: 'got_virtue',
    name: '葛特的优点',
    title: '世界赛第三 · 斜坡弯道专家',
    description:
      '专业顶级车手之一，极其擅长斜坡上的任何弯道与高难度赛季！据说他在世界赛中获得了第三名。血量 632.5、倍速 69.64%、天生防摔 36%，但操控表现已经非常出色。',
    avatarPath: '/src/assets/images/rider_got_virtue_1794582806952.jpg',
    unlockCost: 3600,
    baseHp: 632.5,
    hpPerLevel: 48,
    speedBonus: 0.6964,
    airControlBonus: 1.38,
    headArmorBase: 0.36,
    furPrimary: '#1E293B',
    furSecondary: '#F8FAFC',
    accentColor: '#06B6D4',
  },
  got_66: {
    id: 'got_66',
    name: '葛特66葛特',
    title: '66号传奇职业手',
    description:
      '葛特车队 66 号专业弯道赛手，擅长各种斜坡急弯与高难度赛季，曾在世界赛拿下季军！拥有 632.5 血量、69.64% 倍速与 36% 天生防摔减伤，坡道稳定性出类拔萃。',
    avatarPath: '/src/assets/images/rider_got_66_1794582807646.jpg',
    unlockCost: 3600,
    baseHp: 632.5,
    hpPerLevel: 52,
    speedBonus: 0.6964,
    airControlBonus: 1.42,
    headArmorBase: 0.36,
    furPrimary: '#7C2D12',
    furSecondary: '#FDE68A',
    accentColor: '#EF4444',
  },
  oreo: {
    id: 'oreo',
    name: '奥利奥',
    title: '锻炼赛第一 · 每日骑行狂人',
    description:
      '他很喜欢骑自行车，每天的生活就是在骑自行车，并在锻炼比赛中获得了第一名！虽然整体比未知人物菜一点点，但拥有 2600 血量、66% 速度倍率以及高达 1200% 的超强天生防摔护甲。',
    avatarPath: '/src/assets/images/rider_oreo_1794618581178.jpg',
    unlockCost: 6700,
    baseHp: 2600,
    hpPerLevel: 100,
    speedBonus: 0.66,
    airControlBonus: 1.32,
    headArmorBase: 12.0,
    furPrimary: '#18181B',
    furSecondary: '#F8FAFC',
    accentColor: '#E2E8F0',
  },
  unknown: {
    id: 'unknown',
    name: '未知人物',
    title: '??? · 神秘隐藏传说',
    description:
      '身份成谜的终极未知车手，头像只留下一个神秘问号。拥有高达 3000 血量、99.6% 均衡倍速以及惊人的 120% 天生防摔护甲！',
    avatarPath: 'question',
    unlockCost: 16000,
    baseHp: 3000,
    hpPerLevel: 120,
    speedBonus: 0.996,
    airControlBonus: 1.5,
    headArmorBase: 1.2,
    furPrimary: '#0F172A',
    furSecondary: '#334155',
    accentColor: '#A855F7',
  },
  aode: {
    id: 'aode',
    name: '奥德',
    title: '智力型英雄 · 超级弯道教练',
    description:
      '智力型英雄，斜坡弯道超级专家，更是葛特（诸葛的优点）的专属导师与教练！拥有 6300 超高血量、1600% 速度倍率以及 1320% 天生防摔减伤。',
    avatarPath: '/src/assets/images/rider_aode_1794618747351.jpg',
    unlockCost: 22000,
    baseHp: 6300,
    hpPerLevel: 150,
    speedBonus: 16.0,
    airControlBonus: 1.85,
    headArmorBase: 13.2,
    furPrimary: '#B45309',
    furSecondary: '#FEF3C7',
    accentColor: '#0EA5E9',
  },
  delsas: {
    id: 'delsas',
    name: '德尔萨斯',
    title: '少校传奇 · 世界赛第六名',
    description:
      '生于美国的少校传奇车手，曾夺得世界赛第六名，遗憾于 1963 年 6 月 4 日坠崖离世。拥有 6600 基础血量、7000% 超极限速度倍率与 6000% 天生防摔护甲。',
    avatarPath: '/src/assets/images/rider_delsas_1794618946686.jpg',
    unlockCost: 28000,
    baseHp: 6600,
    hpPerLevel: 160,
    speedBonus: 70.0,
    airControlBonus: 1.65,
    headArmorBase: 60.0,
    furPrimary: '#78350F',
    furSecondary: '#FDE68A',
    accentColor: '#4D7C0F',
  },
  drusas: {
    id: 'drusas',
    name: '德鲁萨斯',
    title: '苏联少校传奇 · 世界第二争夺者',
    description:
      '生于苏联的少校传奇对手，拥有众多狂热粉丝，全力争夺世界第二名！即便曾遭德尔萨斯嘲笑，依然不负初心每日刻苦练车。拥有 5000 基础血量、1300% 速度倍率与 5900% 天生防摔护甲。',
    avatarPath: '/src/assets/images/rider_drusas_1794619108046.jpg',
    unlockCost: 24000,
    baseHp: 5000,
    hpPerLevel: 140,
    speedBonus: 13.0,
    airControlBonus: 1.7,
    headArmorBase: 59.0,
    furPrimary: '#475569',
    furSecondary: '#F1F5F9',
    accentColor: '#DC2626',
  },
  derek: {
    id: 'derek',
    name: '德里克',
    title: '终结者 · 67,000 淘汰记录',
    description:
      '他虽然不擅长骑自行车，但是是一位冷酷的终结者！常攻击其他车手使其无法完赛，目前已终结 67,000 个车手。配备无限子弹的 98K、M47 与任意手枪（血量 30、伤害倍率 60%）。',
    avatarPath: '/src/assets/images/rider_derek_1794620200098.jpg',
    unlockCost: 3200,
    baseHp: 30,
    hpPerLevel: 3,
    speedBonus: 0.85,
    airControlBonus: 0.78,
    headArmorBase: 0.1,
    damageBonus: 0.6,
    weapons: ['98k', 'm47', 'pistol'],
    furPrimary: '#18181B',
    furSecondary: '#78350F',
    accentColor: '#DC2626',
  },
};

export const BIKE_FRAMES: Record<BikeFrameId, BikeFrameSpec> = {
  trail: {
    id: 'trail',
    name: '林道钢架号',
    description: '结实耐用的基础越野单车，平衡性良好。',
    unlockCost: 0,
    speedMult: 1.0,
    weightMult: 1.0,
    durabilityBonus: 0,
    frameColor: '#F59E0B',
    forkColor: '#94A3B8',
  },
  enduro: {
    id: 'enduro',
    name: '山地速降王',
    description: '加长双肩前叉与高强度铝合金车架，高速下坡稳如磐石。',
    unlockCost: 180,
    speedMult: 1.08,
    weightMult: 0.95,
    durabilityBonus: 20,
    frameColor: '#EF4444',
    forkColor: '#E2E8F0',
  },
  titanium: {
    id: 'titanium',
    name: '钛金特技兽',
    description: '超轻量化钛合金管材，腾空高度与空中姿态控制大幅提升。',
    unlockCost: 340,
    speedMult: 1.14,
    weightMult: 0.84,
    durabilityBonus: 35,
    frameColor: '#10B981',
    forkColor: '#FDE047',
  },
  cyber: {
    id: 'cyber',
    name: '荒原战犬 Mk.IV',
    description: '四代终极改装碳纤维战车，融合氮气增压与重型头盔护盾。',
    unlockCost: 600,
    speedMult: 1.22,
    weightMult: 0.8,
    durabilityBonus: 65,
    frameColor: '#38BDF8',
    forkColor: '#F97316',
  },
};

export interface DifficultySpec {
  id: DifficultyId;
  name: string;
  shortDesc: string;
  color: string;
  damageMult: number;
  gravityMult: number;
  speedMult: number;
  airControlMult: number;
  gripMult: number;
  rewardMult: number;
  hpRegenPerSec: number;
  greenBoneChance: number;
  fixedFallDamage?: number;
  realisticPhysics?: boolean;
  silentDarkness?: boolean;
  isTutorial?: boolean;
}

export const DIFFICULTY_ORDER: DifficultyId[] = [
  'tutorial',
  'novice',
  'ultra_low',
  'beginner',
  'contacter',
  'ultimate',
  'realistic',
  'silent',
];

export const DIFFICULTIES: Record<DifficultyId, DifficultySpec> = {
  tutorial: {
    id: 'tutorial',
    name: '教程',
    shortDesc: '全模式分步讲解按键与机制，血量随时间恢复',
    color: '#38BDF8',
    damageMult: 0.35,
    gravityMult: 0.9,
    speedMult: 0.92,
    airControlMult: 1.15,
    gripMult: 1.15,
    rewardMult: 0.8,
    hpRegenPerSec: 4.0,
    greenBoneChance: 0,
    isTutorial: true,
  },
  novice: {
    id: 'novice',
    name: '新手者',
    shortDesc: '比初级更轻松，撞击伤害低且血量随时间恢复',
    color: '#34D399',
    damageMult: 0.6,
    gravityMult: 0.94,
    speedMult: 0.96,
    airControlMult: 1.1,
    gripMult: 1.1,
    rewardMult: 0.9,
    hpRegenPerSec: 3.5,
    greenBoneChance: 0,
  },
  ultra_low: {
    id: 'ultra_low',
    name: '超级低难度',
    shortDesc: '高处重摔或撞击固定仅扣 2 滴血量，血量随时间恢复',
    color: '#4ADE80',
    damageMult: 0.2,
    gravityMult: 0.95,
    speedMult: 1.0,
    airControlMult: 1.08,
    gripMult: 1.08,
    rewardMult: 0.85,
    hpRegenPerSec: 4.0,
    greenBoneChance: 0,
    fixedFallDamage: 2,
  },
  beginner: {
    id: 'beginner',
    name: '初级',
    shortDesc: '标准平衡手感，血量随时间缓慢回升',
    color: '#FACC15',
    damageMult: 1.0,
    gravityMult: 1.0,
    speedMult: 1.0,
    airControlMult: 1.0,
    gripMult: 1.0,
    rewardMult: 1.0,
    hpRegenPerSec: 2.5,
    greenBoneChance: 0,
  },
  contacter: {
    id: 'contacter',
    name: '接触者',
    shortDesc: '初级进阶，骨头收益×1.5，血量随时间少量恢复',
    color: '#FB923C',
    damageMult: 1.25,
    gravityMult: 1.06,
    speedMult: 1.08,
    airControlMult: 0.96,
    gripMult: 0.96,
    rewardMult: 1.5,
    hpRegenPerSec: 2.0,
    greenBoneChance: 0,
  },
  ultimate: {
    id: 'ultimate',
    name: '终极',
    shortDesc: '极限难度！禁止随时间回血，高概率出现 +1000 绿色骨头，骨头收益×2.4',
    color: '#F43F5E',
    damageMult: 1.5,
    gravityMult: 1.12,
    speedMult: 1.16,
    airControlMult: 0.94,
    gripMult: 0.92,
    rewardMult: 2.4,
    hpRegenPerSec: 0,
    greenBoneChance: 0.38,
  },
  realistic: {
    id: 'realistic',
    name: '真实',
    shortDesc: '近乎现实物理、禁止随时间回血，超高概率出现 +1000 绿色骨头，骨头收益×3.2',
    color: '#A78BFA',
    damageMult: 2.0,
    gravityMult: 1.34,
    speedMult: 1.05,
    airControlMult: 0.45,
    gripMult: 0.82,
    rewardMult: 3.2,
    hpRegenPerSec: 0,
    greenBoneChance: 0.45,
    realisticPhysics: true,
  },
  silent: {
    id: 'silent',
    name: '寂静',
    shortDesc: '最高难度！周期性全黑靠声音辨路，禁止回血，最高骨头×4.2与+1000绿色骨头',
    color: '#E2E8F0',
    damageMult: 1.75,
    gravityMult: 1.16,
    speedMult: 1.14,
    airControlMult: 0.9,
    gripMult: 0.9,
    rewardMult: 4.2,
    hpRegenPerSec: 0,
    greenBoneChance: 0.5,
    silentDarkness: true,
  },
};

export const TRACKS: Record<TrackId, TrackSpec> = {
  pine_canyon: {
    id: 'pine_canyon',
    name: '咆哮松林峡谷',
    subtitle: '起伏林道 · 木桥跳台 · 经典试炼',
    difficulty: '初级',
    length: 4200,
    defaultWeather: 'clear',
    dynamicWeather: true,
    skyTop: '#1E293B',
    skyBottom: '#3B526B',
    groundTop: '#3F7D47',
    groundFill: '#29221C',
    mountainColor: '#253344',
    trapDensity: 0.7,
    rewardMult: 1.0,
  },
  lava_mine: {
    id: 'lava_mine',
    name: '熔岩铁轨矿山',
    subtitle: '陡坡矿道 · 摆锤锯片 · 滚石袭击',
    difficulty: '接触者',
    length: 5200,
    defaultWeather: 'sandstorm',
    dynamicWeather: true,
    skyTop: '#231312',
    skyBottom: '#61281B',
    groundTop: '#8C4327',
    groundFill: '#1D1412',
    mountainColor: '#3A1C16',
    trapDensity: 1.05,
    rewardMult: 1.35,
  },
  frost_ridge: {
    id: 'frost_ridge',
    name: '冰封断崖雪山',
    subtitle: '高空飞跃 · 极地黑冰 · 暴雪强风',
    difficulty: '终极',
    length: 5800,
    defaultWeather: 'blizzard',
    dynamicWeather: true,
    skyTop: '#0F172A',
    skyBottom: '#334E68',
    groundTop: '#DCEBF7',
    groundFill: '#1E2A38',
    mountainColor: '#1B2A3A',
    trapDensity: 1.25,
    rewardMult: 1.65,
  },
  wasteland: {
    id: 'wasteland',
    name: '雷暴废土斗兽场',
    subtitle: '极限特技 · 密集陷阱 · 天雷滚滚',
    difficulty: '真实',
    length: 6600,
    defaultWeather: 'thunderstorm',
    dynamicWeather: true,
    skyTop: '#111019',
    skyBottom: '#362D47',
    groundTop: '#786B53',
    groundFill: '#1A1816',
    mountainColor: '#24202D',
    trapDensity: 1.55,
    rewardMult: 2.1,
  },
};

export const WEATHER_LABELS: Record<WeatherType, { name: string; effect: string; color: string }> = {
  clear: {
    name: '晴朗微风',
    effect: '抓地力最佳，视野清晰',
    color: '#F59E0B',
  },
  rain: {
    name: '暴雨泥泞',
    effect: '路面湿滑 (-18% 抓地力)，泥潭减速加剧',
    color: '#38BDF8',
  },
  blizzard: {
    name: '极地暴雪',
    effect: '逆风阻力 + 局部结冰打滑',
    color: '#E2E8F0',
  },
  sandstorm: {
    name: '狂沙强风',
    effect: '阵风影响滞空轨迹与极速',
    color: '#FB923C',
  },
  thunderstorm: {
    name: '雷暴闪电',
    effect: '强暴雨 + 地面随机落雷陷阱',
    color: '#FACC15',
  },
};

export const UPGRADE_META: Array<{
  key: keyof UpgradeLevels;
  category: 'rider' | 'bike';
  name: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  effectDesc: (lvl: number) => string;
}> = [
  {
    key: 'riderLevel',
    category: 'rider',
    name: '骑手等级 (HP核心)',
    maxLevel: 15,
    baseCost: 50,
    costStep: 45,
    effectDesc: (lvl) => `等级 Lv.${lvl} · 每次升级大幅提升最大血量`,
  },
  {
    key: 'helmet',
    category: 'rider',
    name: '防摔全盔护甲',
    maxLevel: 10,
    baseCost: 40,
    costStep: 35,
    effectDesc: (lvl) => `头朝地摔伤减免 -${Math.min(60, lvl * 6)}%`,
  },
  {
    key: 'balance',
    category: 'rider',
    name: '核心平衡姿态',
    maxLevel: 10,
    baseCost: 35,
    costStep: 30,
    effectDesc: (lvl) => `空中翻滚转速 +${lvl * 10}%`,
  },
  {
    key: 'stamina',
    category: 'rider',
    name: '爆发狗爪耐力',
    maxLevel: 10,
    baseCost: 35,
    costStep: 30,
    effectDesc: (lvl) => `跳跃高度 +${lvl * 6}% · 氮气恢复 +${lvl * 10}%`,
  },
  {
    key: 'drivetrain',
    category: 'bike',
    name: '飞轮动力传动',
    maxLevel: 10,
    baseCost: 45,
    costStep: 38,
    effectDesc: (lvl) => `极速与爬坡扭矩 +${lvl * 7}%`,
  },
  {
    key: 'suspension',
    category: 'bike',
    name: '液压倒置避震',
    maxLevel: 10,
    baseCost: 40,
    costStep: 35,
    effectDesc: (lvl) => `落地吸震与防翻车稳定 +${lvl * 9}%`,
  },
  {
    key: 'tires',
    category: 'bike',
    name: '全地形钉胎',
    maxLevel: 10,
    baseCost: 38,
    costStep: 32,
    effectDesc: (lvl) => `雨雪泥地抓地力补偿 +${lvl * 9}%`,
  },
];

export function computeMaxHp(riderId: RiderId, frameId: BikeFrameId, upgrades: UpgradeLevels): number {
  const rider = RIDERS[riderId];
  const frame = BIKE_FRAMES[frameId];
  const total = rider.baseHp + (upgrades.riderLevel - 1) * rider.hpPerLevel + frame.durabilityBonus;
  return Number(total.toFixed(1));
}

export function computeHeadArmorReduction(riderId: RiderId, upgrades: UpgradeLevels): number {
  const rider = RIDERS[riderId];
  const raw = rider.headArmorBase + upgrades.helmet * 0.055;
  if (rider.headArmorBase >= 1) {
    return Number(raw.toFixed(3));
  }
  return Math.min(0.85, raw);
}

export function getUpgradeCost(key: keyof UpgradeLevels, currentLevel: number): number {
  const meta = UPGRADE_META.find((u) => u.key === key);
  if (!meta) return 9999;
  return meta.baseCost + (currentLevel - 1) * meta.costStep;
}

export function createDefaultProfile(playerId: string, nickname = '狂野大狗'): PlayerProfile {
  return {
    playerId,
    nickname,
    goldBones: 120,
    xp: 0,
    modeXp: {
      single: 0,
      versus: 0,
      coop: 0,
      terminator: 0,
    },
    selectedRider: 'shiba',
    selectedFrame: 'trail',
    unlockedRiders: ['shiba'],
    unlockedFrames: ['trail'],
    upgrades: {
      riderLevel: 1,
      helmet: 1,
      balance: 1,
      stamina: 1,
      suspension: 1,
      drivetrain: 1,
      tires: 1,
    },
    stats: {
      racesPlayed: 0,
      wins: 0,
      coopWins: 0,
      noDamageVersusWins: 0,
      realisticWins: 0,
      ultimateWins: 0,
      tutorialWins: 0,
      contacterWins: 0,
      silentWins: 0,
      realisticSpeedrunWins: 0,
      ultimateSingle2mWins: 0,
      versusWins: 0,
      flawlessCoopWins: 0,
      novice40sWins: 0,
      ultraLow31sWins: 0,
      beginnerWins: 0,
      wonWeathers: [],
      luckyEscapeWins: 0,
      oneStepShortCount: 0,
      ultimate20sDeathCount: 0,
      terminatorKills: 0,
      terminatorWins: 0,
      multiplayerMajorAchieved: 0,
      superChaosWins: 0,
      versus5sWins: 0,
      coop5sWins: 0,
      terminator5sWins: 0,
      totalFlips: 0,
      headCrashes: 0,
      deaths: 0,
      bestDistance: 0,
    },
    unlockedAchievements: [],
    updatedAt: 0,
  };
}

export function mergeProfiles(local: PlayerProfile, remote: PlayerProfile): PlayerProfile {
  const base = createDefaultProfile(local.playerId || remote.playerId);
  const localTs = local.updatedAt ?? 0;
  const remoteTs = remote.updatedAt ?? 0;
  const localHasProgress =
    (local.stats?.racesPlayed ?? 0) > 0 ||
    (local.unlockedAchievements?.length ?? 0) > 0 ||
    (local.unlockedRiders?.length ?? 1) > 1 ||
    (local.unlockedFrames?.length ?? 1) > 1 ||
    local.goldBones !== base.goldBones;
  const remoteHasProgress =
    (remote.stats?.racesPlayed ?? 0) > 0 ||
    (remote.unlockedAchievements?.length ?? 0) > 0 ||
    (remote.unlockedRiders?.length ?? 1) > 1 ||
    (remote.unlockedFrames?.length ?? 1) > 1 ||
    remote.goldBones !== base.goldBones;

  const preferRemote =
    remoteTs > localTs || (!localHasProgress && remoteHasProgress && remoteTs === localTs);
  const primary = preferRemote ? remote : local;

  const ls = { ...base.stats, ...(local.stats || {}) };
  const rs = { ...base.stats, ...(remote.stats || {}) };
  const lu = { ...base.upgrades, ...(local.upgrades || {}) };
  const ru = { ...base.upgrades, ...(remote.upgrades || {}) };

  const mergedGoldBones =
    typeof primary.goldBones === 'number' ? primary.goldBones : base.goldBones;

  return {
    playerId: primary.playerId || base.playerId,
    nickname: primary.nickname || base.nickname,
    goldBones: mergedGoldBones,
    xp: Math.max(local.xp ?? 0, remote.xp ?? 0),
    modeXp: {
      single: Math.max(local.modeXp?.single ?? 0, remote.modeXp?.single ?? 0),
      versus: Math.max(local.modeXp?.versus ?? 0, remote.modeXp?.versus ?? 0),
      coop: Math.max(local.modeXp?.coop ?? 0, remote.modeXp?.coop ?? 0),
      terminator: Math.max(local.modeXp?.terminator ?? 0, remote.modeXp?.terminator ?? 0),
    },
    selectedRider: primary.selectedRider || base.selectedRider,
    selectedFrame: primary.selectedFrame || base.selectedFrame,
    unlockedRiders: Array.from(
      new Set([...(local.unlockedRiders || ['shiba']), ...(remote.unlockedRiders || ['shiba'])])
    ),
    unlockedFrames: Array.from(
      new Set([...(local.unlockedFrames || ['trail']), ...(remote.unlockedFrames || ['trail'])])
    ),
    upgrades: {
      riderLevel: Math.max(lu.riderLevel, ru.riderLevel),
      helmet: Math.max(lu.helmet, ru.helmet),
      balance: Math.max(lu.balance, ru.balance),
      stamina: Math.max(lu.stamina, ru.stamina),
      suspension: Math.max(lu.suspension, ru.suspension),
      drivetrain: Math.max(lu.drivetrain, ru.drivetrain),
      tires: Math.max(lu.tires, ru.tires),
    },
    stats: {
      racesPlayed: Math.max(ls.racesPlayed, rs.racesPlayed),
      wins: Math.max(ls.wins, rs.wins),
      coopWins: Math.max(ls.coopWins, rs.coopWins),
      noDamageVersusWins: Math.max(ls.noDamageVersusWins ?? 0, rs.noDamageVersusWins ?? 0),
      realisticWins: Math.max(ls.realisticWins ?? 0, rs.realisticWins ?? 0),
      ultimateWins: Math.max(ls.ultimateWins ?? 0, rs.ultimateWins ?? 0),
      tutorialWins: Math.max(ls.tutorialWins ?? 0, rs.tutorialWins ?? 0),
      contacterWins: Math.max(ls.contacterWins ?? 0, rs.contacterWins ?? 0),
      silentWins: Math.max(ls.silentWins ?? 0, rs.silentWins ?? 0),
      realisticSpeedrunWins: Math.max(ls.realisticSpeedrunWins ?? 0, rs.realisticSpeedrunWins ?? 0),
      ultimateSingle2mWins: Math.max(ls.ultimateSingle2mWins ?? 0, rs.ultimateSingle2mWins ?? 0),
      versusWins: Math.max(ls.versusWins ?? 0, rs.versusWins ?? 0),
      flawlessCoopWins: Math.max(ls.flawlessCoopWins ?? 0, rs.flawlessCoopWins ?? 0),
      novice40sWins: Math.max(ls.novice40sWins ?? 0, rs.novice40sWins ?? 0),
      ultraLow31sWins: Math.max(ls.ultraLow31sWins ?? 0, rs.ultraLow31sWins ?? 0),
      beginnerWins: Math.max(ls.beginnerWins ?? 0, rs.beginnerWins ?? 0),
      wonWeathers: Array.from(new Set([...(ls.wonWeathers || []), ...(rs.wonWeathers || [])])),
      luckyEscapeWins: Math.max(ls.luckyEscapeWins ?? 0, rs.luckyEscapeWins ?? 0),
      oneStepShortCount: Math.max(ls.oneStepShortCount ?? 0, rs.oneStepShortCount ?? 0),
      ultimate20sDeathCount: Math.max(ls.ultimate20sDeathCount ?? 0, rs.ultimate20sDeathCount ?? 0),
      terminatorKills: Math.max(ls.terminatorKills ?? 0, rs.terminatorKills ?? 0),
      terminatorWins: Math.max(ls.terminatorWins ?? 0, rs.terminatorWins ?? 0),
      multiplayerMajorAchieved: Math.max(
        ls.multiplayerMajorAchieved ?? 0,
        rs.multiplayerMajorAchieved ?? 0
      ),
      superChaosWins: Math.max(ls.superChaosWins ?? 0, rs.superChaosWins ?? 0),
      versus5sWins: Math.max(ls.versus5sWins ?? 0, rs.versus5sWins ?? 0),
      coop5sWins: Math.max(ls.coop5sWins ?? 0, rs.coop5sWins ?? 0),
      terminator5sWins: Math.max(ls.terminator5sWins ?? 0, rs.terminator5sWins ?? 0),
      totalFlips: Math.max(ls.totalFlips, rs.totalFlips),
      headCrashes: Math.max(ls.headCrashes, rs.headCrashes),
      deaths: Math.max(ls.deaths, rs.deaths),
      bestDistance: Math.max(ls.bestDistance, rs.bestDistance),
    },
    unlockedAchievements: Array.from(
      new Set([...(local.unlockedAchievements || []), ...(remote.unlockedAchievements || [])])
    ),
    updatedAt: Math.max(localTs, remoteTs),
  };
}

export const ACHIEVEMENTS: AchievementSpec[] = [
  {
    id: 'tutorial_first_win',
    name: '第一次接触者',
    description: '在教程模式下完成 1 次胜利，迈出狂野大狗车手传奇的第一步。',
    conditionLabel: '教程难度完成胜利',
    rewardBase: 3,
    rewardBonus: 0,
    rewardTotal: 3,
    rewardLabel: '3 骨头',
    target: 1,
    tierColor: '#38BDF8',
  },
  {
    id: 'novice_speedrun_40s',
    name: '新手疾行者',
    description: '在新手者难度下，于 40 秒内不死亡并成功获胜。',
    conditionLabel: '新手者 40 秒内无死亡胜利',
    rewardBase: 35,
    rewardBonus: 0,
    rewardTotal: 35,
    rewardLabel: '35 骨头',
    target: 1,
    tierColor: '#34D399',
  },
  {
    id: 'ultra_low_speedrun_31s',
    name: '超低极速冲刺',
    description: '在超级低难度下，于 31 秒内不死亡并成功完成比赛。',
    conditionLabel: '超级低难度 31 秒内无死亡胜利',
    rewardBase: 35,
    rewardBonus: 0,
    rewardTotal: 35,
    rewardLabel: '35 骨头',
    target: 1,
    tierColor: '#4ADE80',
  },
  {
    id: 'beginner_first_win',
    name: '初级赛道征服者',
    description: '在初级难度阶段下顺利跑完全程取得胜利。',
    conditionLabel: '初级难度完成胜利',
    rewardBase: 56,
    rewardBonus: 0,
    rewardTotal: 56,
    rewardLabel: '56 骨头',
    target: 1,
    tierColor: '#FACC15',
  },
  {
    id: 'versus_first_win',
    name: '初次赢对手',
    description: '在多人对抗赛中首次击败对手，夺得第 1 名胜利。',
    conditionLabel: '多人对抗赛首次胜利',
    rewardBase: 50,
    rewardBonus: 0,
    rewardTotal: 50,
    rewardLabel: '50 骨头',
    target: 1,
    tierColor: '#34D399',
  },
  {
    id: 'all_weather_wins',
    name: '皮外伤',
    description: '在任意难度下集齐全部 5 种天气动态设置（晴朗微风、瓢泼大雨、极寒暴雪、狂风沙尘、雷暴闪电）且全部取得胜利！',
    conditionLabel: '全 5 种天气获胜进度',
    rewardBase: 888,
    rewardBonus: 0,
    rewardTotal: 888,
    rewardLabel: '888 骨头',
    target: 5,
    tierColor: '#38BDF8',
  },
  {
    id: 'realistic_speedrun_1m',
    name: '速通者',
    description: '在真实难度下，于 1 分钟（60 秒）内完成一次胜利。',
    conditionLabel: '真实难度 1 分钟内胜利',
    rewardBase: 120,
    rewardBonus: 0,
    rewardTotal: 120,
    rewardLabel: '120 骨头',
    target: 1,
    tierColor: '#FB923C',
  },
  {
    id: 'ultimate_single_2m',
    name: '单人模式进阶者',
    description: '在单人模式极致（终极）难度下，于 2 分钟（120 秒）内完成整场赛道。',
    conditionLabel: '单人极致模式 2 分钟内完赛',
    rewardBase: 1000,
    rewardBonus: 0,
    rewardTotal: 1000,
    rewardLabel: '1,000 骨头',
    target: 1,
    tierColor: '#F43F5E',
  },
  {
    id: 'coop_flawless_kind',
    name: '好有心',
    description: '【大成就】在多人合作模式下，全员无一人死亡且不扣一滴血的情况下完成整场难度胜利！',
    conditionLabel: '合作全员零死亡零掉血胜利',
    rewardBase: 5000,
    rewardBonus: 0,
    rewardTotal: 5000,
    rewardLabel: '5,000 骨头（大成就）',
    target: 1,
    tierColor: '#10B981',
  },
  {
    id: 'realistic_100_wins',
    name: '硬核拟真宗师',
    description: '在真实难度模式下累计取得 100 次胜利，彻底征服拟真物理与重度伤害考验。',
    conditionLabel: '真实难度累计胜利',
    rewardBase: 20,
    rewardBonus: 13660,
    rewardTotal: 13680,
    rewardLabel: '20 骨头 + 13,660 骨头（共 13,680 骨头）',
    target: 100,
    tierColor: '#A78BFA',
  },
  {
    id: 'ultimate_100_wins',
    name: '终极极速主宰',
    description: '在终极难度模式下累计完成 100 次胜利，驾驭极速与致命陷阱的极限巅峰。',
    conditionLabel: '终极难度累计胜利',
    rewardBase: 678,
    rewardBonus: 14600,
    rewardTotal: 15278,
    rewardLabel: '678 骨头 + 14,600 骨头（共 15,278 骨头）',
    target: 100,
    tierColor: '#F43F5E',
  },
  {
    id: 'go_play_tutorial',
    name: '去玩个教程再来吧',
    description: '在极致（终极）难度下，开局 20 秒内直接摔车阵亡。',
    conditionLabel: '极致难度 20 秒内阵亡',
    rewardBase: 10,
    rewardBonus: 0,
    rewardTotal: 10,
    rewardLabel: '10 骨头',
    target: 1,
    tierColor: '#94A3B8',
  },
  {
    id: 'one_step_short',
    name: '就差一步',
    description: '在距离终点最后几米处，踩中离终点最近的陷阱并摔车阵亡。',
    conditionLabel: '踩中终点前最近陷阱阵亡',
    rewardBase: 88,
    rewardBonus: 0,
    rewardTotal: 88,
    rewardLabel: '88 骨头',
    target: 1,
    tierColor: '#F97316',
  },
  {
    id: 'lucky_narrow_escape',
    name: '幸好幸好',
    description: '在任意难度与任意地图中跌入残血濒死状态（≤25% HP）后一滴血都没有再扣，最终成功赢下比赛！',
    conditionLabel: '残血濒死零受击逆转获胜',
    rewardBase: 666,
    rewardBonus: 0,
    rewardTotal: 666,
    rewardLabel: '666 骨头',
    target: 1,
    tierColor: '#22C55E',
  },
  {
    id: 'flawless_versus_10000',
    name: '终于达到这个时候了',
    description: '在竞技模式（多人对抗赛）中完成 10,000 次胜利，且获胜对局一滴血都没有扣！',
    conditionLabel: '竞技模式零掉血胜利',
    rewardBase: 100000,
    rewardBonus: 0,
    rewardTotal: 100000,
    rewardLabel: '100,000 骨头',
    target: 10000,
    tierColor: '#FACC15',
  },
  {
    id: 'nice_pretty_good',
    name: '不错挺好',
    description: '在任意难度中累计完成 20 次比赛胜利，实力与手感已渐入佳境！',
    conditionLabel: '任意难度累计完成胜利',
    rewardBase: 520,
    rewardBonus: 0,
    rewardTotal: 520,
    rewardLabel: '520 骨头',
    target: 20,
    tierColor: '#34D399',
  },
  {
    id: 'flip_master_50',
    name: '空中旋风狗',
    description: '在飞跃坡道期间累计完成 50 次空中前后空翻并稳稳落地。',
    conditionLabel: '累计空中空翻次数',
    rewardBase: 360,
    rewardBonus: 0,
    rewardTotal: 360,
    rewardLabel: '360 骨头',
    target: 50,
    tierColor: '#38BDF8',
  },
  {
    id: 'contacter_10_wins',
    name: '接触者征服者',
    description: '在接触者难度下累计赢得 10 次比赛胜利，完美适应高强度陷阱节奏。',
    conditionLabel: '接触者难度累计胜利',
    rewardBase: 800,
    rewardBonus: 0,
    rewardTotal: 800,
    rewardLabel: '800 骨头',
    target: 10,
    tierColor: '#FB923C',
  },
  {
    id: 'silent_first_win',
    name: '暗夜听风行者',
    description: '在伸手不见五指的寂静难度下凭借声呐提示冲破黑暗取得 1 次胜利！',
    conditionLabel: '寂静难度完成胜利',
    rewardBase: 1500,
    rewardBonus: 0,
    rewardTotal: 1500,
    rewardLabel: '1,500 骨头',
    target: 1,
    tierColor: '#C084FC',
  },
  {
    id: 'veteran_50_races',
    name: '赛道百战猛犬',
    description: '无论胜负，在任意模式与难度下累计完赛或出战 50 场。',
    conditionLabel: '累计参赛场次',
    rewardBase: 600,
    rewardBonus: 0,
    rewardTotal: 600,
    rewardLabel: '600 骨头',
    target: 50,
    tierColor: '#FBBF24',
  },
  {
    id: 'best_attire',
    name: '最好服装',
    description:
      '车库终极全满贯！解锁所有骑手人物、所有改装车架，并将骑手等级与全部核心装备强化升至满级。',
    conditionLabel: '全人物 + 全车架 + 全等级与核心装备满级',
    rewardBase: 18888,
    rewardBonus: 0,
    rewardTotal: 18888,
    rewardLabel: '18,888 骨头',
    target: Object.keys(RIDERS).length + Object.keys(BIKE_FRAMES).length + UPGRADE_META.length,
    tierColor: '#F59E0B',
  },
  {
    id: 'crime_suspect',
    name: '犯罪嫌疑人',
    description:
      '成功获得终结者皮肤「德里克」！手持无限子弹的 98K、M47 与任意手枪，背负 67,000 名车手的终结传说。',
    conditionLabel: '获得皮肤「德里克」',
    rewardBase: 670,
    rewardBonus: 0,
    rewardTotal: 670,
    rewardLabel: '670 骨头',
    target: 1,
    tierColor: '#EF4444',
  },
  {
    id: 'major_multiplayer',
    name: '少校',
    description:
      '在多人游戏中晋升并获得「少校」军衔等级（累计 2,150 经验；1 骨头 = 1 经验，升级不消耗骨头）。',
    conditionLabel: '在多人游戏中获得少校等级',
    rewardBase: 1000,
    rewardBonus: 0,
    rewardTotal: 1000,
    rewardLabel: '1,000 骨头',
    target: 1,
    tierColor: '#FBBF24',
  },
  {
    id: 'super_chaos',
    name: '超级混乱',
    description:
      '在多人终结者模式中获得第一名，并在该局中至少杀死一名车手（车友或 AI 人机均可）。',
    conditionLabel: '多人终结者第 1 名且杀死至少 1 名车手',
    rewardBase: 1666,
    rewardBonus: 0,
    rewardTotal: 1666,
    rewardLabel: '1,666 骨头',
    target: 1,
    tierColor: '#F43F5E',
  },
  {
    id: 'rank_contacter',
    name: '接触者',
    description: '在任意模式中晋升至「接触者」军衔等级（累计 200 经验；1 骨头 = 1 经验，升级不消耗骨头）。',
    conditionLabel: '达到任意模式的接触者等级',
    rewardBase: 13800,
    rewardBonus: 0,
    rewardTotal: 13800,
    rewardLabel: '13,800 骨头',
    target: 200,
    tierColor: '#38BDF8',
  },
  {
    id: 'rank_tech_military',
    name: '技术军事',
    description: '在任意模式中晋升至「技术军事」军衔等级（累计 550 经验）。',
    conditionLabel: '达到任意模式的技术军事等级',
    rewardBase: 1200,
    rewardBonus: 0,
    rewardTotal: 1200,
    rewardLabel: '1,200 骨头',
    target: 550,
    tierColor: '#34D399',
  },
  {
    id: 'rank_super_tech_military',
    name: '超级技术军事',
    description: '在任意模式中晋升至「超级技术军事」军衔等级（累计 1,150 经验）。',
    conditionLabel: '达到任意模式的超级技术军事等级',
    rewardBase: 2400,
    rewardBonus: 0,
    rewardTotal: 2400,
    rewardLabel: '2,400 骨头',
    target: 1150,
    tierColor: '#A78BFA',
  },
  {
    id: 'rank_lt_colonel',
    name: '中校',
    description: '在任意模式中晋升至「中校」军衔等级（累计 3,750 经验）。',
    conditionLabel: '达到任意模式的中校等级',
    rewardBase: 5200,
    rewardBonus: 0,
    rewardTotal: 5200,
    rewardLabel: '5,200 骨头',
    target: 3750,
    tierColor: '#FB923C',
  },
  {
    id: 'rank_colonel',
    name: '上校',
    description: '在任意模式中晋升至「上校」军衔等级（累计 6,250 经验）。',
    conditionLabel: '达到任意模式的上校等级',
    rewardBase: 8000,
    rewardBonus: 0,
    rewardTotal: 8000,
    rewardLabel: '8,000 骨头',
    target: 6250,
    tierColor: '#F87171',
  },
  {
    id: 'rank_major_alt',
    name: '少佐',
    description: '在任意模式中晋升至「少佐」军衔等级（累计 10,050 经验）。',
    conditionLabel: '达到任意模式的少佐等级',
    rewardBase: 12000,
    rewardBonus: 0,
    rewardTotal: 12000,
    rewardLabel: '12,000 骨头',
    target: 10050,
    tierColor: '#E879F9',
  },
  {
    id: 'rank_shadow_elite',
    name: '暗影精英',
    description: '在任意模式中晋升至「暗影精英」军衔等级（累计 15,650 经验）。',
    conditionLabel: '达到任意模式的暗影精英等级',
    rewardBase: 20000,
    rewardBonus: 0,
    rewardTotal: 20000,
    rewardLabel: '20,000 骨头',
    target: 15650,
    tierColor: '#818CF8',
  },
  {
    id: 'rank_wuji_elite',
    name: '无极精英',
    description: '在任意模式中晋升至「无极精英」军衔等级（累计 24,150 经验）。',
    conditionLabel: '达到任意模式的无极精英等级',
    rewardBase: 36000,
    rewardBonus: 0,
    rewardTotal: 36000,
    rewardLabel: '36,000 骨头',
    target: 24150,
    tierColor: '#FACC15',
  },
  {
    id: 'rank_super_veteran',
    name: '超级熟手',
    description: '在任意模式中晋升至「超级熟手」军衔等级（累计 1,000,000 经验）。',
    conditionLabel: '达到任意模式的超级熟手等级',
    rewardBase: 180000,
    rewardBonus: 0,
    rewardTotal: 180000,
    rewardLabel: '180,000 骨头',
    target: 1000000,
    tierColor: '#F97316',
  },
  {
    id: 'max_rank_wuji',
    name: '最高等级',
    description:
      '登上军衔巅峰！累计获得 1 亿（100,000,000）经验，晋升为最高「无极（无敌）」军衔等级！',
    conditionLabel: '获得无极（无敌）最高等级 (1亿经验)',
    rewardBase: 1000000,
    rewardBonus: 0,
    rewardTotal: 1000000,
    rewardLabel: '1,000,000 骨头',
    target: 100000000,
    tierColor: '#EF4444',
  },
  {
    id: 'versus_speedrun_5s',
    name: '超级快速者',
    description: '在多人对抗赛开始后 5 秒之内（≤5.00s）冲过终点并拿下第一名！',
    conditionLabel: '多人对抗赛 5 秒内夺得第 1 名',
    rewardBase: 3600,
    rewardBonus: 0,
    rewardTotal: 3600,
    rewardLabel: '3,600 骨头',
    target: 1,
    tierColor: '#F59E0B',
  },
  {
    id: 'coop_speedrun_5s',
    name: '震惊队友',
    description: '在多人合作护送模式下，开始后 5 秒之内（≤5.00s）极速冲线完成比赛，直接震惊全体队友！',
    conditionLabel: '多人合作护送 5 秒内完赛',
    rewardBase: 3200,
    rewardBonus: 0,
    rewardTotal: 3200,
    rewardLabel: '3,200 骨头',
    target: 1,
    tierColor: '#10B981',
  },
  {
    id: 'terminator_speedrun_5s',
    name: '来不及杀人',
    description: '在终结者模式开始后 5 秒之内（≤5.00s）直接冲线完赛，快到连开枪淘汰对手都来不及！',
    conditionLabel: '终结者模式 5 秒内完赛',
    rewardBase: 3800,
    rewardBonus: 0,
    rewardTotal: 3800,
    rewardLabel: '3,800 骨头',
    target: 1,
    tierColor: '#EF4444',
  },
];

export function getBestAttireBreakdown(profile?: PlayerProfile) {
  const riderTotal = Object.keys(RIDERS).length;
  const frameTotal = Object.keys(BIKE_FRAMES).length;
  const upgradeTotal = UPGRADE_META.length;
  if (!profile) {
    return {
      riderCount: 0,
      riderTotal,
      frameCount: 0,
      frameTotal,
      upgradeCount: 0,
      upgradeTotal,
    };
  }
  const riderCount = (Object.keys(RIDERS) as RiderId[]).filter((r) =>
    profile.unlockedRiders?.includes(r)
  ).length;
  const frameCount = (Object.keys(BIKE_FRAMES) as BikeFrameId[]).filter((f) =>
    profile.unlockedFrames?.includes(f)
  ).length;
  const upgradeCount = UPGRADE_META.filter(
    (u) => (profile.upgrades?.[u.key] ?? 1) >= u.maxLevel
  ).length;
  return {
    riderCount,
    riderTotal,
    frameCount,
    frameTotal,
    upgradeCount,
    upgradeTotal,
  };
}

export function getAchievementProgress(
  id: AchievementId,
  stats: PlayerProfile['stats'],
  profile?: PlayerProfile
): number {
  switch (id) {
    case 'tutorial_first_win':
      return stats.tutorialWins ?? 0;
    case 'novice_speedrun_40s':
      return stats.novice40sWins ?? 0;
    case 'ultra_low_speedrun_31s':
      return stats.ultraLow31sWins ?? 0;
    case 'beginner_first_win':
      return stats.beginnerWins ?? 0;
    case 'versus_first_win':
      return stats.versusWins ?? 0;
    case 'all_weather_wins':
      return Array.isArray(stats.wonWeathers) ? stats.wonWeathers.length : 0;
    case 'realistic_speedrun_1m':
      return stats.realisticSpeedrunWins ?? 0;
    case 'ultimate_single_2m':
      return stats.ultimateSingle2mWins ?? 0;
    case 'coop_flawless_kind':
      return stats.flawlessCoopWins ?? 0;
    case 'realistic_100_wins':
      return stats.realisticWins ?? 0;
    case 'ultimate_100_wins':
      return stats.ultimateWins ?? 0;
    case 'go_play_tutorial':
      return stats.ultimate20sDeathCount ?? 0;
    case 'one_step_short':
      return stats.oneStepShortCount ?? 0;
    case 'lucky_narrow_escape':
      return stats.luckyEscapeWins ?? 0;
    case 'flawless_versus_10000':
      return stats.noDamageVersusWins ?? 0;
    case 'nice_pretty_good':
      return stats.wins ?? 0;
    case 'flip_master_50':
      return stats.totalFlips ?? 0;
    case 'contacter_10_wins':
      return stats.contacterWins ?? 0;
    case 'silent_first_win':
      return stats.silentWins ?? 0;
    case 'veteran_50_races':
      return stats.racesPlayed ?? 0;
    case 'best_attire': {
      const b = getBestAttireBreakdown(profile);
      return b.riderCount + b.frameCount + b.upgradeCount;
    }
    case 'crime_suspect':
      return profile?.unlockedRiders?.includes('derek') ? 1 : 0;
    case 'major_multiplayer':
      return stats.multiplayerMajorAchieved ?? 0;
    case 'super_chaos':
      return stats.superChaosWins ?? 0;
    case 'rank_contacter':
    case 'rank_tech_military':
    case 'rank_super_tech_military':
    case 'rank_lt_colonel':
    case 'rank_colonel':
    case 'rank_major_alt':
    case 'rank_shadow_elite':
    case 'rank_wuji_elite':
    case 'rank_super_veteran':
    case 'max_rank_wuji': {
      const mx = profile?.modeXp;
      return Math.max(
        mx?.single ?? 0,
        mx?.versus ?? 0,
        mx?.coop ?? 0,
        mx?.terminator ?? 0
      );
    }
    case 'versus_speedrun_5s':
      return stats.versus5sWins ?? 0;
    case 'coop_speedrun_5s':
      return stats.coop5sWins ?? 0;
    case 'terminator_speedrun_5s':
      return stats.terminator5sWins ?? 0;
  }
}

export function evaluateProfileAchievements(
  profile: PlayerProfile,
  activeMode?: GameMode
): {
  updated: PlayerProfile;
  newlyUnlocked: AchievementSpec[];
} {
  const existingUnlocked = new Set(profile.unlockedAchievements || []);
  const newlyUnlocked: AchievementSpec[] = [];
  let working: PlayerProfile = {
    ...profile,
    modeXp: {
      single: profile.modeXp?.single ?? 0,
      versus: profile.modeXp?.versus ?? 0,
      coop: profile.modeXp?.coop ?? 0,
      terminator: profile.modeXp?.terminator ?? 0,
    },
  };

  let unlockedInPass = true;
  while (unlockedInPass) {
    unlockedInPass = false;
    let passBonus = 0;

    for (const ach of ACHIEVEMENTS) {
      if (
        !existingUnlocked.has(ach.id) &&
        getAchievementProgress(ach.id, working.stats, working) >= ach.target
      ) {
        existingUnlocked.add(ach.id);
        newlyUnlocked.push(ach);
        passBonus += ach.rewardTotal;
        unlockedInPass = true;
      }
    }

    if (unlockedInPass) {
      const baseModeXp = working.modeXp ?? { single: 0, versus: 0, coop: 0, terminator: 0 };
      const nextModeXp = activeMode
        ? {
            ...baseModeXp,
            [activeMode]: (baseModeXp[activeMode] ?? 0) + passBonus,
          }
        : baseModeXp;

      working = {
        ...working,
        goldBones: working.goldBones + passBonus,
        xp: (working.xp ?? 0) + passBonus,
        modeXp: nextModeXp,
        unlockedAchievements: Array.from(existingUnlocked),
      };
    }
  }

  if (newlyUnlocked.length === 0) {
    return { updated: profile, newlyUnlocked: [] };
  }

  return {
    updated: working,
    newlyUnlocked,
  };
}
