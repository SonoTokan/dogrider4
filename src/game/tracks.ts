import { DifficultyId, TrackCollectible, TrackId, TrackTrap, TrapKind } from '../types/game';
import { DIFFICULTIES, TRACKS } from './catalog';

export const TRACK_SCALE = 5.5; // pixels per meter

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getFinishX(trackId: TrackId): number {
  return TRACKS[trackId].length * TRACK_SCALE;
}

export function getTerrainHeight(x: number, trackId: TrackId, seed: number): number {
  // Flat starting pad
  if (x < 420) return 420;

  const finishX = getFinishX(trackId);
  const dx = x - 420;
  const s = (seed % 997) * 0.017;

  let base = 420;
  let amplitude = 1;
  if (trackId === 'pine_canyon') {
    amplitude = 0.85;
  } else if (trackId === 'lava_mine') {
    amplitude = 1.15;
  } else if (trackId === 'frost_ridge') {
    amplitude = 1.3;
  } else {
    amplitude = 1.45;
  }

  // Rolling multi-octave terrain + thrilling stunt ramps
  const gentleSlope = dx * (trackId === 'frost_ridge' ? 0.045 : 0.025);
  const wave1 = Math.sin(dx * 0.0022 + s) * 125 * amplitude;
  const wave2 = Math.sin(dx * 0.0057 + s * 1.9) * 58 * amplitude;
  const wave3 = Math.cos(dx * 0.0135 + s * 3.1) * 24 * amplitude;

  // Periodic launch ramps every ~1500px
  const rampCycle = (dx + (seed % 300)) % 1550;
  let rampBoost = 0;
  if (rampCycle > 900 && rampCycle < 1180) {
    const t = (rampCycle - 900) / 280;
    rampBoost = -Math.pow(t, 1.7) * 115 * amplitude;
  } else if (rampCycle >= 1180 && rampCycle < 1320) {
    // Sharp drop after lip for big air!
    const t = (rampCycle - 1180) / 140;
    rampBoost = -115 * amplitude + t * 145 * amplitude;
  }

  // Smooth fade-in after start gate
  const startBlend = Math.min(1, dx / 400);
  // Smooth flatten near finish line
  const distToFinish = finishX - x;
  const finishBlend = distToFinish < 500 ? Math.max(0, distToFinish / 500) : 1;

  base = 420 + (gentleSlope + wave1 + wave2 + wave3 + rampBoost) * startBlend * finishBlend;
  return base;
}

export function getTerrainSlope(x: number, trackId: TrackId, seed: number): number {
  const eps = 4;
  const y1 = getTerrainHeight(x - eps, trackId, seed);
  const y2 = getTerrainHeight(x + eps, trackId, seed);
  return Math.atan2(y2 - y1, eps * 2);
}

export function generateTrackObjects(
  trackId: TrackId,
  seed: number,
  difficulty: DifficultyId = 'beginner'
): { traps: TrackTrap[]; collectibles: TrackCollectible[] } {
  const rand = mulberry32(seed + trackId.length * 131);
  const spec = TRACKS[trackId];
  const diffSpec = DIFFICULTIES[difficulty];
  const finishX = getFinishX(trackId);
  const traps: TrackTrap[] = [];
  const collectibles: TrackCollectible[] = [];

  const trapPool: TrapKind[] =
    trackId === 'pine_canyon'
      ? ['mud', 'spike', 'spring', 'boulder']
      : trackId === 'lava_mine'
      ? ['spike', 'pendulum', 'boulder', 'spring', 'mud']
      : trackId === 'frost_ridge'
      ? ['ice', 'spike', 'pendulum', 'spring', 'boulder']
      : ['spike', 'pendulum', 'boulder', 'spring', 'ice', 'mud'];

  let cursorX = 1150;
  let trapIdx = 0;
  while (cursorX < finishX - 700) {
    const kind = trapPool[Math.floor(rand() * trapPool.length)];
    const y = getTerrainHeight(cursorX, trackId, seed);
    const width =
      kind === 'mud' || kind === 'ice'
        ? 170 + rand() * 110
        : kind === 'spike'
        ? 68
        : kind === 'spring'
        ? 64
        : 54;

    traps.push({
      id: `trap_${trapIdx++}`,
      kind,
      x: cursorX,
      y,
      width,
      phase: rand() * Math.PI * 2,
      triggered: false,
      activeTimer: 0,
    });

    // Place reward bones in the air above springs or traps to tempt stunts!
    if (kind === 'spring' || rand() > 0.45) {
      const arcHeight = kind === 'spring' ? 175 : 95;
      for (let b = 0; b < 3; b++) {
        const bx = cursorX + 70 + b * 46;
        const by = getTerrainHeight(bx, trackId, seed) - arcHeight - Math.sin((b / 2) * Math.PI) * 45;
        const isGreenBone = diffSpec.greenBoneChance > 0 && rand() < diffSpec.greenBoneChance;
        collectibles.push({
          id: `col_${trapIdx}_${b}`,
          kind: isGreenBone ? 'green_bone' : 'bone',
          x: bx,
          y: by,
          collected: false,
        });
      }
    }

    const spacing = (540 + rand() * 440) / spec.trapDensity;
    cursorX += spacing;
  }

  // Final hazard trap just meters before the finish gate!
  const finalTrapX = finishX - 175;
  traps.push({
    id: `trap_final_${trapIdx++}`,
    kind: 'spike',
    x: finalTrapX,
    y: getTerrainHeight(finalTrapX, trackId, seed),
    width: 72,
    phase: 0,
    triggered: false,
    activeTimer: 0,
  });

  // Distribute nitro cans & medkits (and extra green bones on extreme difficulties) along the course
  let itemX = 1500;
  let colIdx = 0;
  while (itemX < finishX - 500) {
    const roll = rand();
    let kind: TrackCollectible['kind'] = roll < 0.42 ? 'medkit' : roll < 0.72 ? 'nitro' : 'bone';
    if (kind === 'bone' && diffSpec.greenBoneChance > 0 && rand() < diffSpec.greenBoneChance) {
      kind = 'green_bone';
    } else if (diffSpec.greenBoneChance > 0 && rand() < diffSpec.greenBoneChance * 0.45) {
      kind = 'green_bone';
    }
    const y = getTerrainHeight(itemX, trackId, seed) - (42 + rand() * 50);
    collectibles.push({
      id: `item_${colIdx++}`,
      kind,
      x: itemX,
      y,
      collected: false,
    });
    itemX += 920 + rand() * 550;
  }

  return { traps, collectibles };
}
