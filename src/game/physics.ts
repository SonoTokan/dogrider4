import {
  BikeFrameId,
  ControlInputs,
  DifficultyId,
  RacerSyncState,
  RiderId,
  TrackCollectible,
  TrackId,
  TrackTrap,
  UpgradeLevels,
  WeatherType,
} from '../types/game';
import {
  BIKE_FRAMES,
  DIFFICULTIES,
  DifficultySpec,
  RIDERS,
  computeHeadArmorReduction,
  computeMaxHp,
} from './catalog';
import { getFinishX, getTerrainHeight, getTerrainSlope } from './tracks';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LocalRacerState {
  playerId: string;
  nickname: string;
  isBot: boolean;
  riderId: RiderId;
  frameId: BikeFrameId;
  upgrades: UpgradeLevels;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  wheelSpin: number;
  grounded: boolean;
  hp: number;
  maxHp: number;
  nitro: number;
  maxNitro: number;
  nitroActive: boolean;
  headCrashTimer: number;
  lastCrashDamage: number;
  stunTimer: number;
  invincibleTimer: number;
  dead: boolean;
  deathAnimTimer: number;
  finished: boolean;
  finishTimeMs: number | null;
  score: number;
  coinsEarned: number;
  flips: number;
  crashesCount: number;
  airRotationAccum: number;
  airTime: number;
  wheelieTime: number;
  mudTimer: number;
  iceTimer: number;
  barkCooldown: number;
  barkPulseTimer: number;
  isBraking: boolean;
  screenShake: number;
  hpRegenAccum: number;
  totalDamageTaken: number;
  reachedNearDeath: boolean;
  damageTakenSinceNearDeath: number;
  lastTrapHitId: string | null;
  deathTimeMs: number | null;
}

export interface PhysicsEvents {
  jumped?: boolean;
  flipped?: boolean;
  headCrash?: {
    damage: number;
    fatal: boolean;
    isHeadFirst: boolean;
    intensity: number;
    x: number;
    y: number;
  };
  pickup?: 'bone' | 'green_bone' | 'nitro' | 'medkit';
  barked?: boolean;
  finished?: boolean;
  silentCue?: {
    kind: 'hazard' | 'spring' | 'slope';
    urgency?: number;
    slopeRad?: number;
  };
}

export function createInitialRacerState(params: {
  playerId: string;
  nickname: string;
  riderId: RiderId;
  frameId: BikeFrameId;
  upgrades: UpgradeLevels;
  isBot?: boolean;
  startOffset?: number;
}): LocalRacerState {
  const maxHp = computeMaxHp(params.riderId, params.frameId, params.upgrades);
  return {
    playerId: params.playerId,
    nickname: params.nickname,
    isBot: !!params.isBot,
    riderId: params.riderId,
    frameId: params.frameId,
    upgrades: params.upgrades,
    x: 180 + (params.startOffset || 0),
    y: 380,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVel: 0,
    wheelSpin: 0,
    grounded: true,
    hp: maxHp,
    maxHp,
    nitro: 100,
    maxNitro: 100,
    nitroActive: false,
    headCrashTimer: 0,
    lastCrashDamage: 0,
    stunTimer: 0,
    invincibleTimer: 0,
    dead: false,
    deathAnimTimer: 0,
    finished: false,
    finishTimeMs: null,
    score: 0,
    coinsEarned: 0,
    flips: 0,
    crashesCount: 0,
    airRotationAccum: 0,
    airTime: 0,
    wheelieTime: 0,
    mudTimer: 0,
    iceTimer: 0,
    barkCooldown: 0,
    barkPulseTimer: 0,
    isBraking: false,
    screenShake: 0,
    hpRegenAccum: 0,
    totalDamageTaken: 0,
    reachedNearDeath: false,
    damageTakenSinceNearDeath: 0,
    lastTrapHitId: null,
    deathTimeMs: null,
  };
}

function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function getHeadWorldPosition(racer: LocalRacerState): { hx: number; hy: number } {
  // Rider sits above bike frame; head is offset upward along bike local -Y
  const localX = 6;
  const localY = -44;
  const cos = Math.cos(racer.angle);
  const sin = Math.sin(racer.angle);
  return {
    hx: racer.x + localX * cos - localY * sin,
    hy: racer.y + localX * sin + localY * cos,
  };
}

export function computeBotInputs(
  racer: LocalRacerState,
  trackId: TrackId,
  seed: number,
  traps: TrackTrap[]
): ControlInputs {
  if (racer.dead || racer.finished) {
    return { throttle: false, brake: false, leanLeft: false, leanRight: false, jump: false, nitro: false, bark: false };
  }
  const slope = getTerrainSlope(racer.x + 80, trackId, seed);
  const aheadTrap = traps.find((t) => t.x > racer.x + 20 && t.x < racer.x + 170);
  const shouldJump = !!aheadTrap && (aheadTrap.kind === 'spike' || aheadTrap.kind === 'boulder') && racer.grounded;
  const normAngle = normalizeAngle(racer.angle);

  return {
    throttle: racer.stunTimer <= 0,
    brake: false,
    leanLeft: !racer.grounded ? normAngle > 0.25 : slope < -0.25,
    leanRight: !racer.grounded ? normAngle < -0.25 : slope > 0.25,
    jump: shouldJump,
    nitro: racer.nitro > 60 && racer.grounded && Math.abs(normAngle) < 0.4,
    bark: false,
  };
}

export function stepRacerPhysics(
  racer: LocalRacerState,
  inputs: ControlInputs,
  dt: number,
  elapsedMs: number,
  trackId: TrackId,
  seed: number,
  weather: WeatherType,
  difficulty: DifficultyId,
  traps: TrackTrap[],
  collectibles: TrackCollectible[],
  activeLightningX: number | null,
  particles: Particle[],
  floatingTexts: FloatingText[]
): PhysicsEvents {
  const events: PhysicsEvents = {};
  const rider = RIDERS[racer.riderId];
  const frame = BIKE_FRAMES[racer.frameId];
  const diffSpec = DIFFICULTIES[difficulty];
  const finishX = getFinishX(trackId);

  // Decay timers
  if (racer.headCrashTimer > 0) racer.headCrashTimer = Math.max(0, racer.headCrashTimer - dt);
  if (racer.stunTimer > 0) racer.stunTimer = Math.max(0, racer.stunTimer - dt);
  if (racer.invincibleTimer > 0) racer.invincibleTimer = Math.max(0, racer.invincibleTimer - dt);
  if (racer.mudTimer > 0) racer.mudTimer = Math.max(0, racer.mudTimer - dt);
  if (racer.iceTimer > 0) racer.iceTimer = Math.max(0, racer.iceTimer - dt);
  if (racer.barkCooldown > 0) racer.barkCooldown = Math.max(0, racer.barkCooldown - dt);
  if (racer.barkPulseTimer > 0) racer.barkPulseTimer = Math.max(0, racer.barkPulseTimer - dt);
  if (racer.screenShake > 0) racer.screenShake = Math.max(0, racer.screenShake - dt * 2.5);

  if (racer.dead) {
    racer.deathAnimTimer += dt;
    racer.vx *= 0.94;
    racer.vy += 980 * dt;
    racer.x += racer.vx * dt;
    racer.y += racer.vy * dt;
    const gy = getTerrainHeight(racer.x, trackId, seed);
    if (racer.y > gy - 12) {
      racer.y = gy - 12;
      racer.vy = 0;
    }
    return events;
  }

  if (racer.finished) {
    racer.vx *= 0.96;
    racer.x += racer.vx * dt;
    racer.y = getTerrainHeight(racer.x, trackId, seed) - 18;
    racer.angle *= 0.9;
    racer.wheelSpin += racer.vx * dt * 0.08;
    return events;
  }

  // Passive HP regeneration over time (disabled in ultimate/realistic/silent)
  if (diffSpec.hpRegenPerSec > 0 && racer.hp < racer.maxHp) {
    racer.hpRegenAccum += diffSpec.hpRegenPerSec * dt;
    if (racer.hpRegenAccum >= 1) {
      const regenAmount = Math.floor(racer.hpRegenAccum);
      racer.hpRegenAccum -= regenAmount;
      racer.hp = Number(Math.min(racer.maxHp, racer.hp + regenAmount).toFixed(1));
    }
  } else {
    racer.hpRegenAccum = 0;
  }

  // Bark ability
  if (inputs.bark && racer.barkCooldown <= 0) {
    racer.barkCooldown = 4.5;
    racer.barkPulseTimer = 0.65;
    events.barked = true;
  }

  // Stats calculation
  const drivetrainMult = 1 + (racer.upgrades.drivetrain - 1) * 0.065;
  const tireGripBonus = 1 + (racer.upgrades.tires - 1) * 0.08;
  const balanceMult = 1 + (racer.upgrades.balance - 1) * 0.095;
  const staminaMult = 1 + (racer.upgrades.stamina - 1) * 0.075;
  const suspensionResist = 1 + (racer.upgrades.suspension - 1) * 0.08;

  // Weather physics modifiers
  let weatherGrip = 1.0;
  let windForce = 0;
  if (weather === 'rain') {
    weatherGrip = Math.min(1, 0.82 * tireGripBonus);
  } else if (weather === 'blizzard') {
    weatherGrip = Math.min(1, 0.78 * tireGripBonus);
    windForce = -55;
  } else if (weather === 'sandstorm') {
    windForce = -80 + Math.sin(elapsedMs * 0.0018) * 35;
  } else if (weather === 'thunderstorm') {
    weatherGrip = Math.min(1, 0.8 * tireGripBonus);
    windForce = -40;
  }

  if (racer.mudTimer > 0) weatherGrip *= 0.55;
  if (racer.iceTimer > 0) weatherGrip *= 0.45;

  const maxSpeed = 620 * rider.speedBonus * frame.speedMult * drivetrainMult * diffSpec.speedMult;
  const accel = 760 * rider.speedBonus * drivetrainMult * weatherGrip * diffSpec.speedMult * diffSpec.gripMult;

  // Nitro boost
  const canUseNitro = inputs.nitro && racer.nitro > 4 && racer.stunTimer <= 0;
  racer.nitroActive = canUseNitro;
  if (canUseNitro) {
    racer.nitro = Math.max(0, racer.nitro - 38 * dt);
  } else {
    racer.nitro = Math.min(racer.maxNitro, racer.nitro + 10 * staminaMult * dt);
  }

  // Gravity & air drag
  const gravity = 1040 * frame.weightMult * diffSpec.gravityMult;
  racer.vy += gravity * dt;
  racer.vx += windForce * dt;

  // Check ground contact (bike wheel baseline ~18px above terrain)
  const groundY = getTerrainHeight(racer.x, trackId, seed);
  const slope = getTerrainSlope(racer.x, trackId, seed);
  const bikeClearance = 18;
  const prevGrounded = racer.grounded;

  if (racer.y >= groundY - bikeClearance) {
    const impactVy = racer.vy;
    racer.y = groundY - bikeClearance;
    racer.grounded = true;

    // Landing check!
    if (!prevGrounded && impactVy > 180) {
      const relAngle = Math.abs(normalizeAngle(racer.angle - slope));
      // Check if landing head-first / upside-down!
      if (relAngle > 1.72) {
        racer.lastTrapHitId = null;
        triggerHeadCrash(racer, impactVy * 0.14, true, particles, floatingTexts, events, diffSpec, elapsedMs);
        return events;
      }

      // Ultra-Low difficulty: falling from high altitude deducts strictly 2 HP!
      if (diffSpec.fixedFallDamage !== undefined && impactVy > 340 && racer.invincibleTimer <= 0) {
        const dmg = diffSpec.fixedFallDamage;
        const wasNearDeath = racer.reachedNearDeath;
        racer.hp = Math.max(0, racer.hp - dmg);
        racer.totalDamageTaken += dmg;
        if (wasNearDeath) racer.damageTakenSinceNearDeath += dmg;
        if (racer.hp > 0 && racer.hp <= Math.max(20, Math.round(racer.maxHp * 0.25))) {
          racer.reachedNearDeath = true;
        }
        racer.lastCrashDamage = dmg;
        racer.headCrashTimer = 1.6;
        floatingTexts.push({
          x: racer.x,
          y: racer.y - 72,
          vy: -32,
          text: `高处摔落 -${dmg} 滴血`,
          color: '#4ADE80',
          life: 1.3,
          maxLife: 1.3,
        });
        if (racer.hp <= 0) {
          racer.dead = true;
          racer.deathTimeMs = Math.round(elapsedMs);
          events.headCrash = { damage: dmg, fatal: true, isHeadFirst: false, intensity: 0.75, x: racer.x, y: racer.y };
          return events;
        }
      }

      // Realistic difficulty: severe high-speed vertical impact hurts even upright!
      if (diffSpec.realisticPhysics && impactVy > 580 && racer.invincibleTimer <= 0) {
        racer.lastTrapHitId = null;
        triggerHeadCrash(racer, (impactVy - 460) * 0.12, false, particles, floatingTexts, events, diffSpec, elapsedMs);
        return events;
      }

      // Check completed flips on safe landing
      const completedFlips = Math.floor(Math.abs(racer.airRotationAccum) / (Math.PI * 1.72));
      if (completedFlips > 0) {
        racer.flips += completedFlips;
        const bonus = Math.round(completedFlips * 150 * racer.upgrades.riderLevel * diffSpec.rewardMult);
        const flipBones = Math.max(1, Math.round(completedFlips * 12 * diffSpec.rewardMult));
        racer.score += bonus;
        racer.coinsEarned += flipBones;
        racer.nitro = Math.min(racer.maxNitro, racer.nitro + completedFlips * 28);
        events.flipped = true;
        floatingTexts.push({
          x: racer.x,
          y: racer.y - 68,
          vy: -45,
          text: `${completedFlips}x 空中特技! +${flipBones}骨头`,
          color: '#FACC15',
          life: 1.3,
          maxLife: 1.3,
        });
      }
      racer.airRotationAccum = 0;
      racer.airTime = 0;

      // Suspension bounce dampening
      if (impactVy > 340) {
        racer.vy = -Math.min(110, (impactVy * 0.16) / suspensionResist);
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: racer.x + (Math.random() - 0.5) * 26,
            y: groundY,
            vx: (Math.random() - 0.5) * 140,
            vy: -Math.random() * 110,
            life: 0.4,
            maxLife: 0.4,
            size: 3 + Math.random() * 3,
            color: '#A88B68',
          });
        }
      } else {
        racer.vy = 0;
      }
    } else if (racer.vy > 0) {
      racer.vy = 0;
    }

    // Align smoothly toward terrain slope unless doing a wheelie
    const targetSlope = slope;
    const angleDiff = normalizeAngle(targetSlope - racer.angle);
    racer.angle += angleDiff * Math.min(1, 10 * dt);
    racer.angularVel *= 0.72;

    // Ground pedaling & braking
    racer.isBraking = inputs.brake;
    if (racer.stunTimer <= 0) {
      if (inputs.throttle) {
        const boostMult = racer.nitroActive ? 1.48 : 1.0;
        const mudCap = racer.mudTimer > 0 ? 0.52 : 1.0;
        const targetV = maxSpeed * boostMult * mudCap;
        if (racer.vx < targetV) {
          racer.vx += accel * boostMult * dt;
        }
        // Dust trail
        if (Math.random() < 0.45 && racer.vx > 180) {
          particles.push({
            x: racer.x - 22,
            y: groundY - 2,
            vx: -racer.vx * 0.25 + (Math.random() - 0.5) * 40,
            vy: -Math.random() * 65,
            life: 0.35,
            maxLife: 0.35,
            size: racer.mudTimer > 0 ? 5 : 3,
            color: racer.nitroActive ? '#F97316' : racer.mudTimer > 0 ? '#5C4033' : '#94A3B8',
          });
        }
      } else if (inputs.brake) {
        const brakePower = diffSpec.realisticPhysics ? 560 : 860;
        racer.vx -= brakePower * weatherGrip * diffSpec.gripMult * dt;
        if (racer.vx < -140) racer.vx = -140;
      } else {
        // Rolling resistance
        racer.vx *= Math.pow(diffSpec.realisticPhysics ? 0.92 : 0.84, dt * 6);
      }

      // Slope gravity assist along ground
      racer.vx += Math.sin(slope) * (diffSpec.realisticPhysics ? 580 : 460) * dt;

      // Wheelie / Lean on ground
      if (inputs.leanLeft) {
        racer.angle -= 2.4 * diffSpec.airControlMult * dt;
        racer.wheelieTime += dt;
        if (racer.wheelieTime > 0.6) {
          racer.score += Math.round(12 * dt * 10);
        }
      } else {
        racer.wheelieTime = 0;
      }
      if (inputs.leanRight) {
        racer.angle += 2.2 * diffSpec.airControlMult * dt;
      }

      // Bunny Hop / Jump (Q key!)
      if (inputs.jump) {
        const jumpPower = diffSpec.realisticPhysics ? 310 : 440;
        racer.vy = -jumpPower * staminaMult + Math.min(0, racer.vx * Math.sin(slope) * 0.35);
        racer.grounded = false;
        racer.y -= 6;
        events.jumped = true;
      }
    } else {
      racer.vx *= 0.92;
    }
  } else {
    // Airborne!
    racer.grounded = false;
    racer.airTime += dt;
    racer.isBraking = false;

    if (racer.nitroActive) {
      racer.vx += Math.cos(racer.angle) * 420 * dt;
      racer.vy += Math.sin(racer.angle) * 260 * dt;
    }

    const airSpinTorque = 5.4 * rider.airControlBonus * balanceMult * diffSpec.airControlMult;
    if (inputs.leanLeft) {
      racer.angularVel -= airSpinTorque * dt * 3.4;
    } else if (inputs.leanRight) {
      racer.angularVel += airSpinTorque * dt * 3.4;
    } else {
      racer.angularVel *= Math.pow(0.92, dt * 10);
    }

    racer.angularVel = Math.max(-6.8, Math.min(6.8, racer.angularVel));
    const deltaAngle = racer.angularVel * dt;
    racer.angle += deltaAngle;
    racer.airRotationAccum += deltaAngle;
  }

  // Integrate position
  racer.x += racer.vx * dt;
  racer.y += racer.vy * dt;
  if (racer.x < 80) {
    racer.x = 80;
    racer.vx = Math.max(0, racer.vx);
  }
  racer.wheelSpin += racer.vx * dt * 0.08;

  // Score from forward progress
  if (racer.vx > 20) {
    racer.score += Math.round(racer.vx * dt * 0.08);
  }

  // HEAD-FIRST CRASH CHECK ("头朝地的摔")
  // Check exact head world position against terrain!
  const { hx, hy } = getHeadWorldPosition(racer);
  const headGroundY = getTerrainHeight(hx, trackId, seed);
  if (hy >= headGroundY - 10) {
    const impactForce = Math.max(18, Math.abs(racer.vy) * 0.11 + Math.abs(racer.vx) * 0.055);
    racer.lastTrapHitId = null;
    triggerHeadCrash(racer, impactForce, true, particles, floatingTexts, events, diffSpec, elapsedMs);
    return events;
  }

  // Silent difficulty audio sonar cues for unseen terrain & traps
  if (diffSpec.silentDarkness) {
    const aheadTrap = traps.find((t) => t.x > racer.x + 25 && t.x < racer.x + 310);
    if (aheadTrap) {
      const dist = aheadTrap.x - racer.x;
      events.silentCue = {
        kind: aheadTrap.kind === 'spring' ? 'spring' : 'hazard',
        urgency: Math.max(0.1, Math.min(1, 1 - dist / 310)),
      };
    } else {
      const aheadSlope = getTerrainSlope(racer.x + 150, trackId, seed);
      if (Math.abs(aheadSlope) > 0.24) {
        events.silentCue = { kind: 'slope', slopeRad: aheadSlope };
      }
    }
  }

  // Check Trap Collisions
  for (const trap of traps) {
    const dx = Math.abs(racer.x - trap.x);
    if (dx > trap.width * 0.65) continue;

    if (trap.kind === 'mud' && racer.grounded) {
      racer.mudTimer = 0.55;
      racer.vx *= Math.pow(0.58, dt * 5);
    } else if (trap.kind === 'ice' && racer.grounded) {
      racer.iceTimer = 0.7;
    } else if (trap.kind === 'spring' && racer.y >= trap.y - 34) {
      racer.vy = -780;
      racer.vx = Math.max(racer.vx, 420);
      racer.grounded = false;
      racer.y = trap.y - 38;
      events.jumped = true;
      if (!trap.triggered) {
        trap.triggered = true;
        floatingTexts.push({
          x: trap.x,
          y: trap.y - 50,
          vy: -40,
          text: '弹射起飞!',
          color: '#38BDF8',
          life: 0.9,
          maxLife: 0.9,
        });
      }
    } else if (trap.kind === 'spike' && racer.y >= trap.y - 26 && racer.invincibleTimer <= 0) {
      // Hitting spikes flips the bike forward onto the rider's head!
      racer.vx *= 0.45;
      racer.vy = -260;
      racer.angularVel = 5.5;
      racer.lastTrapHitId = trap.id;
      triggerHeadCrash(racer, 26, false, particles, floatingTexts, events, diffSpec, elapsedMs);
    } else if (trap.kind === 'pendulum') {
      const swingX = trap.x + Math.sin(elapsedMs * 0.0032 + trap.phase) * 95;
      const swingY = trap.y - 115 + Math.cos(elapsedMs * 0.0032 + trap.phase) * 58;
      const dist = Math.hypot(racer.x - swingX, racer.y - 20 - swingY);
      if (dist < 42 && racer.invincibleTimer <= 0) {
        racer.vx *= 0.35;
        racer.lastTrapHitId = trap.id;
        triggerHeadCrash(racer, 38, true, particles, floatingTexts, events, diffSpec, elapsedMs);
      }
    } else if (trap.kind === 'boulder') {
      const cycle = ((elapsedMs * 0.001 + trap.phase) % 4) / 4;
      const bx = trap.x + 160 - cycle * 320;
      const by = getTerrainHeight(bx, trackId, seed) - 24;
      const dist = Math.hypot(racer.x - bx, racer.y - 14 - by);
      if (dist < 36 && racer.invincibleTimer <= 0) {
        racer.vx = -120;
        racer.lastTrapHitId = trap.id;
        triggerHeadCrash(racer, 34, true, particles, floatingTexts, events, diffSpec, elapsedMs);
      }
    }
  }

  // Thunderstorm dynamic lightning bolt hazard
  if (activeLightningX !== null && Math.abs(racer.x - activeLightningX) < 58 && racer.invincibleTimer <= 0) {
    racer.lastTrapHitId = null;
    triggerHeadCrash(racer, 42, true, particles, floatingTexts, events, diffSpec, elapsedMs);
  }

  // Check Collectibles
  for (const col of collectibles) {
    if (col.collected) continue;
    const dist = Math.hypot(racer.x - col.x, racer.y - 18 - col.y);
    if (dist < 44) {
      col.collected = true;
      events.pickup = col.kind;
      if (col.kind === 'green_bone') {
        racer.coinsEarned += 1000;
        racer.score += 1200;
        for (let i = 0; i < 14; i++) {
          particles.push({
            x: col.x,
            y: col.y,
            vx: (Math.random() - 0.5) * 240,
            vy: (Math.random() - 0.5) * 240,
            life: 0.65,
            maxLife: 0.65,
            size: 3 + Math.random() * 3,
            color: i % 2 === 0 ? '#4ADE80' : '#BBF7D0',
          });
        }
        floatingTexts.push({ x: col.x, y: col.y - 26, vy: -52, text: '+1000 绿色骨头!', color: '#4ADE80', life: 1.4, maxLife: 1.4 });
      } else if (col.kind === 'bone') {
        const boneValue = Math.max(5, Math.round(15 * diffSpec.rewardMult));
        racer.coinsEarned += boneValue;
        racer.score += Math.round(100 * diffSpec.rewardMult);
        floatingTexts.push({ x: col.x, y: col.y - 20, vy: -40, text: `+${boneValue} 金骨头`, color: '#FACC15', life: 0.9, maxLife: 0.9 });
      } else if (col.kind === 'nitro') {
        racer.nitro = Math.min(racer.maxNitro, racer.nitro + 55);
        floatingTexts.push({ x: col.x, y: col.y - 20, vy: -40, text: '氮气补满!', color: '#38BDF8', life: 0.9, maxLife: 0.9 });
      } else if (col.kind === 'medkit') {
        const heal = Math.round(racer.maxHp * 0.32);
        racer.hp = Math.min(racer.maxHp, racer.hp + heal);
        floatingTexts.push({ x: col.x, y: col.y - 20, vy: -40, text: `+${heal} HP`, color: '#10B981', life: 1.0, maxLife: 1.0 });
      }
    }
  }

  // Finish Line Check!
  if (racer.x >= finishX && !racer.finished) {
    racer.finished = true;
    racer.finishTimeMs = Math.round(elapsedMs);
    racer.score += 500 + racer.hp * 2;
    racer.coinsEarned += Math.round(60 * diffSpec.rewardMult);
    events.finished = true;
  }

  return events;
}

function triggerHeadCrash(
  racer: LocalRacerState,
  rawDamage: number,
  isHeadFirst: boolean,
  particles: Particle[],
  floatingTexts: FloatingText[],
  events: PhysicsEvents,
  diffSpec: DifficultySpec,
  elapsedMs: number
) {
  if (racer.invincibleTimer > 0 || racer.dead) return;

  const armor = computeHeadArmorReduction(racer.riderId, racer.upgrades);
  const multiplier = isHeadFirst ? 1.35 : 1.0;
  const computedDamage =
    armor >= 1
      ? 0
      : Math.max(
          4,
          Math.round(rawDamage * multiplier * diffSpec.damageMult * Math.max(0, 1 - armor))
        );
  const finalDamage =
    armor >= 1
      ? 0
      : diffSpec.fixedFallDamage !== undefined
      ? diffSpec.fixedFallDamage
      : computedDamage;

  const wasNearDeath = racer.reachedNearDeath;
  racer.hp = Number(Math.max(0, racer.hp - finalDamage).toFixed(1));
  racer.totalDamageTaken += finalDamage;
  if (wasNearDeath) {
    racer.damageTakenSinceNearDeath += finalDamage;
  }
  if (racer.hp > 0 && racer.hp <= Math.max(20, Math.round(racer.maxHp * 0.25))) {
    racer.reachedNearDeath = true;
  }
  racer.lastCrashDamage = finalDamage;
  racer.headCrashTimer = 2.6; // Shows floating HP bar right above rider!
  racer.crashesCount += 1;
  racer.screenShake = 1.0;

  // Impact sparks & dirt burst
  for (let i = 0; i < 16; i++) {
    particles.push({
      x: racer.x,
      y: racer.y - 10,
      vx: (Math.random() - 0.5) * 320,
      vy: -Math.random() * 280,
      life: 0.65,
      maxLife: 0.65,
      size: 3 + Math.random() * 4,
      color: i % 2 === 0 ? '#EF4444' : '#F59E0B',
    });
  }

  const impactIntensity = Math.min(1.45, Math.max(0.7, rawDamage / 26));

  if (racer.hp <= 0) {
    racer.dead = true;
    racer.deathTimeMs = Math.round(elapsedMs);
    racer.vy = -240;
    racer.vx = racer.vx * 0.3;
    floatingTexts.push({
      x: racer.x,
      y: racer.y - 78,
      vy: -25,
      text: `头朝地重摔阵亡! HP 归零`,
      color: '#EF4444',
      life: 2.2,
      maxLife: 2.2,
    });
    events.headCrash = {
      damage: finalDamage,
      fatal: true,
      isHeadFirst,
      intensity: Math.max(1.15, impactIntensity),
      x: racer.x,
      y: racer.y,
    };
  } else {
    // Bounce back upright with brief invulnerability
    racer.stunTimer = 0.72;
    racer.invincibleTimer = 1.65;
    racer.vy = -210;
    racer.vx = Math.max(40, racer.vx * 0.32);
    racer.angle = 0;
    racer.angularVel = 0;
    racer.airRotationAccum = 0;
    floatingTexts.push({
      x: racer.x,
      y: racer.y - 78,
      vy: -36,
      text:
        finalDamage === 0
          ? `天生防摔 ${Math.round(RIDERS[racer.riderId].headArmorBase * 100)}% 免疫!`
          : `头朝地摔伤 -${finalDamage} HP`,
      color: finalDamage === 0 ? '#C084FC' : '#F87171',
      life: 1.5,
      maxLife: 1.5,
    });
    events.headCrash = {
      damage: finalDamage,
      fatal: false,
      isHeadFirst,
      intensity: impactIntensity,
      x: racer.x,
      y: racer.y,
    };
  }
}

export function toSyncState(racer: LocalRacerState): RacerSyncState {
  return {
    playerId: racer.playerId,
    nickname: racer.nickname,
    isBot: racer.isBot,
    riderId: racer.riderId,
    frameId: racer.frameId,
    riderLevel: racer.upgrades.riderLevel,
    x: Math.round(racer.x),
    y: Math.round(racer.y),
    vx: Math.round(racer.vx),
    vy: Math.round(racer.vy),
    angle: Number(racer.angle.toFixed(3)),
    wheelSpin: Number(racer.wheelSpin.toFixed(2)),
    hp: racer.hp,
    maxHp: racer.maxHp,
    headCrashTimer: Number(racer.headCrashTimer.toFixed(2)),
    lastCrashDamage: racer.lastCrashDamage,
    dead: racer.dead,
    finished: racer.finished,
    finishTimeMs: racer.finishTimeMs,
    score: racer.score,
    flips: racer.flips,
    crashesCount: racer.crashesCount,
    isBraking: racer.isBraking,
    nitroActive: racer.nitroActive,
    barkPulseTimer: Number(racer.barkPulseTimer.toFixed(2)),
  };
}
