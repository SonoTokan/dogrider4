import {
  GameMode,
  Projectile,
  RacerSyncState,
  TrackCollectible,
  TrackId,
  TrackTrap,
  WeatherType,
} from '../types/game';
import { BIKE_FRAMES, RIDERS, TRACKS } from './catalog';
import { FloatingText, LocalRacerState, Particle } from './physics';
import { getFinishX, getTerrainHeight } from './tracks';

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  trackId: TrackId,
  seed: number,
  weather: WeatherType,
  mode: GameMode,
  elapsedMs: number,
  localRacer: LocalRacerState,
  remoteRacers: RacerSyncState[],
  traps: TrackTrap[],
  collectibles: TrackCollectible[],
  particles: Particle[],
  floatingTexts: FloatingText[],
  weatherParticles: WeatherParticle[],
  lightningState: { targetX: number | null; warningTimer: number; flashAlpha: number },
  darknessAlpha = 0,
  tauntBubbles: Record<string, string> = {},
  projectiles: Projectile[] = []
) {
  const track = TRACKS[trackId];
  const finishX = getFinishX(trackId);

  // Screen shake on head-first crash
  const shakeMag = localRacer.screenShake * 10;
  const shakeX = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  const shakeY = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag : 0;

  ctx.save();

  // 1. Sky Background
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, track.skyTop);
  skyGrad.addColorStop(1, track.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Weather atmospheric tint
  if (weather === 'rain' || weather === 'thunderstorm') {
    ctx.fillStyle = 'rgba(10, 18, 32, 0.35)';
    ctx.fillRect(0, 0, width, height);
  } else if (weather === 'sandstorm') {
    ctx.fillStyle = 'rgba(180, 105, 40, 0.22)';
    ctx.fillRect(0, 0, width, height);
  } else if (weather === 'blizzard') {
    ctx.fillStyle = 'rgba(203, 213, 225, 0.14)';
    ctx.fillRect(0, 0, width, height);
  }

  // Sun or Storm Moon
  ctx.save();
  ctx.fillStyle = weather === 'clear' ? 'rgba(251, 191, 36, 0.85)' : 'rgba(226, 232, 240, 0.25)';
  ctx.beginPath();
  ctx.arc(width * 0.82 - (cameraX * 0.01) % 200, height * 0.2, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Parallax Mountains
  drawParallaxMountains(ctx, width, height, cameraX, track.mountainColor, 0.16, 120);
  drawParallaxMountains(ctx, width, height, cameraX, track.mountainColor, 0.32, 65, 0.7);

  // Apply World Camera Transform
  ctx.translate(-cameraX + shakeX, -cameraY + shakeY);

  const viewLeft = cameraX - 180;
  const viewRight = cameraX + width + 220;

  // 3. Terrain Body
  ctx.beginPath();
  const step = 14;
  const startDrawX = Math.floor(viewLeft / step) * step;
  ctx.moveTo(startDrawX, cameraY + height + 200);
  for (let wx = startDrawX; wx <= viewRight; wx += step) {
    ctx.lineTo(wx, getTerrainHeight(wx, trackId, seed));
  }
  ctx.lineTo(viewRight, cameraY + height + 200);
  ctx.closePath();

  const groundGrad = ctx.createLinearGradient(0, cameraY, 0, cameraY + height);
  groundGrad.addColorStop(0, track.groundFill);
  groundGrad.addColorStop(1, '#0C0E12');
  ctx.fillStyle = groundGrad;
  ctx.fill();

  // Top surface turf/crust line
  ctx.beginPath();
  for (let wx = startDrawX; wx <= viewRight; wx += step) {
    const wy = getTerrainHeight(wx, trackId, seed);
    if (wx === startDrawX) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  }
  ctx.lineWidth = 10;
  ctx.strokeStyle = track.groundTop;
  ctx.stroke();

  // Start Gate & Finish Arch
  drawGate(ctx, 180, getTerrainHeight(180, trackId, seed), 'START 起跑线', '#F59E0B');
  if (finishX >= viewLeft - 200 && finishX <= viewRight + 200) {
    drawGate(ctx, finishX, getTerrainHeight(finishX, trackId, seed), 'FINISH 终点', '#10B981');
  }

  // 4. Traps
  for (const trap of traps) {
    if (trap.x < viewLeft - 140 || trap.x > viewRight + 140) continue;
    drawTrap(ctx, trap, trackId, seed, elapsedMs);
  }

  // Active Lightning Warning & Bolt (Thunderstorm)
  if (lightningState.targetX !== null) {
    const lx = lightningState.targetX;
    const ly = getTerrainHeight(lx, trackId, seed);
    if (lightningState.warningTimer > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(250, 204, 21, ${0.18 + Math.sin(elapsedMs * 0.03) * 0.1})`;
      ctx.fillRect(lx - 45, ly - 500, 90, 500);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(lx, ly - 10, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ 落雷预警', lx, ly - 65);
      ctx.restore();
    } else if (lightningState.flashAlpha > 0.1) {
      ctx.save();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(lx - 20, ly - 520);
      ctx.lineTo(lx + 18, ly - 320);
      ctx.lineTo(lx - 14, ly - 160);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 5. Collectibles
  for (const col of collectibles) {
    if (col.collected || col.x < viewLeft || col.x > viewRight) continue;
    drawCollectible(ctx, col, elapsedMs);
  }

  // 6. Remote Racers (Opponents / Co-op Teammates)
  for (const remote of remoteRacers) {
    if (remote.x < viewLeft - 120 || remote.x > viewRight + 120) continue;
    drawDogRider(ctx, {
      ...remote,
      isLocal: false,
      isCoop: mode === 'coop',
      isTerminator: mode === 'terminator',
      invincible: false,
      elapsedMs,
      tauntText: tauntBubbles[remote.playerId],
    });
  }

  // 7. Local Player Dog Rider
  drawDogRider(ctx, {
    playerId: localRacer.playerId,
    nickname: localRacer.nickname,
    riderId: localRacer.riderId,
    frameId: localRacer.frameId,
    riderLevel: localRacer.upgrades.riderLevel,
    x: localRacer.x,
    y: localRacer.y,
    vx: localRacer.vx,
    vy: localRacer.vy,
    angle: localRacer.angle,
    wheelSpin: localRacer.wheelSpin,
    hp: localRacer.hp,
    maxHp: localRacer.maxHp,
    headCrashTimer: localRacer.headCrashTimer,
    lastCrashDamage: localRacer.lastCrashDamage,
    dead: localRacer.dead,
    finished: localRacer.finished,
    finishTimeMs: localRacer.finishTimeMs,
    score: localRacer.score,
    flips: localRacer.flips,
    crashesCount: localRacer.crashesCount,
    isBraking: localRacer.isBraking,
    nitroActive: localRacer.nitroActive,
    barkPulseTimer: localRacer.barkPulseTimer,
    isLocal: true,
    isCoop: mode === 'coop',
    isTerminator: mode === 'terminator',
    invincible: localRacer.invincibleTimer > 0,
    elapsedMs,
    tauntText: tauntBubbles[localRacer.playerId],
  });

  // 7.5 Projectiles (98K / M47 / Pistol)
  for (const proj of projectiles) {
    ctx.save();
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);
    const len = proj.weaponId === '98k' ? 28 : proj.weaponId === 'm47' ? 16 : 11;
    const thick = proj.weaponId === '98k' ? 4 : 3;
    ctx.strokeStyle = proj.color;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(4, 0, thick * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 8. World Particles & Floating Combat/Stunt Texts
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const ft of floatingTexts) {
    const alpha = Math.max(0, ft.life / ft.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore(); // Back to Screen Coordinates

  // 9. Weather Screen Particles Overlay
  drawWeatherOverlay(ctx, width, height, weather, weatherParticles, lightningState.flashAlpha);

  // 10. Silent Darkness Blackout Overlay
  if (darknessAlpha > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(3, 5, 9, ${Math.min(0.995, darknessAlpha)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function drawParallaxMountains(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  color: string,
  factor: number,
  peakHeight: number,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);
  const seg = 90;
  const offset = cameraX * factor;
  for (let sx = 0; sx <= width + seg; sx += seg) {
    const wx = sx + offset;
    const h =
      height * 0.58 -
      Math.abs(Math.sin(wx * 0.0025)) * peakHeight -
      Math.cos(wx * 0.0061) * (peakHeight * 0.4);
    ctx.lineTo(sx, h);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.fillRect(x - 6, y - 140, 12, 140);
  ctx.fillStyle = color;
  ctx.fillRect(x - 52, y - 152, 104, 28);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px "Oswald", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 134);
  ctx.restore();
}

function drawTrap(
  ctx: CanvasRenderingContext2D,
  trap: TrackTrap,
  trackId: TrackId,
  seed: number,
  elapsedMs: number
) {
  ctx.save();
  if (trap.kind === 'mud') {
    ctx.fillStyle = '#4A3525';
    ctx.beginPath();
    ctx.ellipse(trap.x, trap.y + 2, trap.width * 0.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6B4F37';
    ctx.beginPath();
    ctx.ellipse(trap.x - 18, trap.y + 1, trap.width * 0.25, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (trap.kind === 'ice') {
    ctx.fillStyle = '#7DD3FC';
    ctx.beginPath();
    ctx.ellipse(trap.x, trap.y + 1, trap.width * 0.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trap.x - trap.width * 0.35, trap.y);
    ctx.lineTo(trap.x + trap.width * 0.35, trap.y);
    ctx.stroke();
  } else if (trap.kind === 'spike') {
    const count = 5;
    const step = trap.width / count;
    ctx.fillStyle = '#CBD5E1';
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const sx = trap.x - trap.width / 2 + i * step;
      const sy = getTerrainHeight(sx + step / 2, trackId, seed);
      ctx.beginPath();
      ctx.moveTo(sx, sy + 2);
      ctx.lineTo(sx + step / 2, sy - 20);
      ctx.lineTo(sx + step, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (trap.kind === 'spring') {
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(trap.x - 28, trap.y - 10, 56, 10);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(trap.x - 32, trap.y - 16, 64, 6);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ 弹跳', trap.x, trap.y - 22);
  } else if (trap.kind === 'pendulum') {
    const swingX = trap.x + Math.sin(elapsedMs * 0.0032 + trap.phase) * 95;
    const swingY = trap.y - 115 + Math.cos(elapsedMs * 0.0032 + trap.phase) * 58;
    const pivotY = trap.y - 220;
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(trap.x, pivotY);
    ctx.lineTo(swingX, swingY);
    ctx.stroke();

    // Spinning sawblade
    ctx.translate(swingX, swingY);
    ctx.rotate(elapsedMs * 0.015);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? 30 : 21;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (trap.kind === 'boulder') {
    const cycle = ((elapsedMs * 0.001 + trap.phase) % 4) / 4;
    const bx = trap.x + 160 - cycle * 320;
    const by = getTerrainHeight(bx, trackId, seed) - 24;
    ctx.translate(bx, by);
    ctx.rotate(-cycle * Math.PI * 8);
    ctx.fillStyle = '#57534E';
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#A8A29E';
    ctx.beginPath();
    ctx.arc(-7, -6, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCollectible(ctx: CanvasRenderingContext2D, col: TrackCollectible, elapsedMs: number) {
  const bob = Math.sin(elapsedMs * 0.005 + col.x * 0.01) * 5;
  ctx.save();
  ctx.translate(col.x, col.y + bob);

  if (col.kind === 'bone' || col.kind === 'green_bone') {
    const isGreen = col.kind === 'green_bone';
    if (isGreen) {
      const pulse = 18 + Math.sin(elapsedMs * 0.008) * 3;
      ctx.fillStyle = 'rgba(74, 222, 128, 0.24)';
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(Math.sin(elapsedMs * 0.003) * 0.2);
    ctx.fillStyle = isGreen ? '#4ADE80' : '#FACC15';
    ctx.strokeStyle = isGreen ? '#052E16' : '#713F12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-12, -4, 24, 8, 3);
    ctx.fill();
    ctx.stroke();
    [
      [-12, -5],
      [-12, 5],
      [12, -5],
      [12, 5],
    ].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    if (isGreen) {
      ctx.rotate(-Math.sin(elapsedMs * 0.003) * 0.2);
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#86EFAC';
      ctx.fillText('1000', 0, -14);
    }
  } else if (col.kind === 'nitro') {
    ctx.fillStyle = '#0EA5E9';
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-9, -13, 18, 26, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F97316';
    ctx.fillRect(-5, -4, 10, 8);
  } else {
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#ECFDF5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-12, -11, 24, 22, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-2, -7, 4, 14);
    ctx.fillRect(-7, -2, 14, 4);
  }
  ctx.restore();
}

function drawDogRider(
  ctx: CanvasRenderingContext2D,
  r: RacerSyncState & {
    isLocal: boolean;
    isCoop: boolean;
    isTerminator: boolean;
    invincible: boolean;
    elapsedMs: number;
    tauntText?: string;
  }
) {
  const rider = RIDERS[r.riderId];
  const frame = BIKE_FRAMES[r.frameId];

  ctx.save();
  ctx.translate(r.x, r.y);

  // Blink during invulnerability recovery
  if (r.invincible && Math.floor(r.elapsedMs / 80) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  }
  if (!r.isLocal && !r.isCoop) {
    ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.88);
  }

  // Bark shockwave pulse ring
  if (r.barkPulseTimer > 0) {
    const progress = 1 - r.barkPulseTimer / 0.65;
    ctx.save();
    ctx.strokeStyle = r.isCoop ? '#10B981' : '#F59E0B';
    ctx.lineWidth = 3;
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.beginPath();
    ctx.arc(0, -18, 30 + progress * 115, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Rotate bike + rider assembly
  ctx.save();
  ctx.rotate(r.dead ? r.angle + 2.4 : r.angle);

  // Nitro flame jet
  if (r.nitroActive && !r.dead) {
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(-28, -4);
    ctx.lineTo(-56 - Math.random() * 18, 0);
    ctx.lineTo(-28, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(-28, -2);
    ctx.lineTo(-42 - Math.random() * 10, 0);
    ctx.lineTo(-28, 3);
    ctx.closePath();
    ctx.fill();
  }

  // Rear & Front Wheels
  drawWheel(ctx, -24, 6, 15, r.wheelSpin);
  drawWheel(ctx, 25, 6, 15, r.wheelSpin);

  // Bicycle Frame
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = frame.frameColor;
  ctx.beginPath();
  ctx.moveTo(-24, 6);
  ctx.lineTo(-4, -12);
  ctx.lineTo(15, -13);
  ctx.lineTo(-2, 4);
  ctx.closePath();
  ctx.stroke();

  // Front Suspension Fork + Handlebar
  ctx.strokeStyle = frame.forkColor;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(25, 6);
  ctx.lineTo(13, -20);
  ctx.lineTo(19, -22);
  ctx.stroke();

  // Big Dog Rider Body!
  const pedalOffset = Math.sin(r.wheelSpin * 2) * 5;
  // Back Leg pedaling
  ctx.strokeStyle = rider.furPrimary;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-6, -14);
  ctx.lineTo(-2 + pedalOffset, 4);
  ctx.stroke();

  // Tail wagging behind
  const tailWag = Math.sin(r.elapsedMs * 0.015) * 6;
  ctx.strokeStyle = rider.furPrimary;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-12, -20);
  ctx.quadraticCurveTo(-24, -28 + tailWag, -27, -34 + tailWag);
  ctx.stroke();

  // Torso (Jersey)
  ctx.fillStyle = rider.accentColor;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-12, -33, 20, 19, 6);
  ctx.fill();
  ctx.stroke();

  // Front Paw reaching handlebar
  ctx.strokeStyle = rider.furSecondary;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, -27);
  ctx.lineTo(17, -21);
  ctx.stroke();

  // Dog Head & Snout
  ctx.save();
  ctx.translate(6, -42);

  // Head circle
  ctx.fillStyle = rider.furPrimary;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.fillStyle = rider.furSecondary;
  ctx.beginPath();
  ctx.ellipse(9, 2, 7.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Nose
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(15, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Pointy Dog Ears
  ctx.fillStyle = rider.furPrimary;
  ctx.beginPath();
  ctx.moveTo(-7, -7);
  ctx.lineTo(-10, -17);
  ctx.lineTo(-2, -10);
  ctx.closePath();
  ctx.fill();

  // Racing Helmet & Goggles!
  ctx.fillStyle =
    r.riderId === 'unknown'
      ? '#1E1B4B'
      : r.riderId === 'oreo'
      ? '#18181B'
      : r.riderId === 'aode'
      ? '#CBD5E1'
      : r.riderId === 'delsas'
      ? '#475569'
      : r.riderId === 'drusas'
      ? '#7F1D1D'
      : r.riderId === 'derek'
      ? '#09090B'
      : r.isLocal
      ? frame.frameColor
      : '#94A3B8';
  ctx.beginPath();
  ctx.arc(0, -2, 12, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Goggles
  ctx.fillStyle =
    r.riderId === 'unknown'
      ? '#A855F7'
      : r.riderId === 'oreo'
      ? '#F8FAFC'
      : r.riderId === 'aode'
      ? '#22D3EE'
      : r.riderId === 'delsas'
      ? '#D97706'
      : r.riderId === 'drusas'
      ? '#93C5FD'
      : r.riderId === 'derek'
      ? '#EF4444'
      : '#38BDF8';
  ctx.fillRect(3, -6, 8, 4.5);

  if (r.riderId === 'unknown') {
    ctx.fillStyle = '#E9D5FF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', -2, -5);
  } else if (r.riderId === 'got_66') {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('66', -3, -6);
  } else if (r.riderId === 'oreo') {
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('#1', -3, -6);
  } else if (r.riderId === 'aode') {
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-5, -13, 10, 2.5);
  } else if (r.riderId === 'delsas') {
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('#6', -3, -6);
  } else if (r.riderId === 'drusas') {
    ctx.fillStyle = '#FEF2F2';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('#2', -3, -6);
  } else if (r.riderId === 'derek') {
    // Glowing red terminator scanner eye
    ctx.fillStyle = '#FCA5A5';
    ctx.beginPath();
    ctx.arc(9, -4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // End head

  // Mounted weapon barrel silhouette for Terminator / Derek
  if ((r.riderId === 'derek' || r.isTerminator) && !r.dead) {
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.fillRect(10, -29, 22, 4.5);
    ctx.strokeRect(10, -29, 22, 4.5);
  }

  ctx.restore(); // End bike rotation

  // Floating Nameplate & HEAD-CRASH HP BAR ("摔车头朝地显示血量")
  const showHpBar = r.headCrashTimer > 0 || r.hp < r.maxHp || r.dead;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';

  // Name + Level tag
  const label = `${r.nickname} Lv.${r.riderLevel}${r.isBot ? ' [AI]' : ''}`;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 3;
  const labelY = showHpBar ? -88 : -68;
  ctx.strokeText(label, 0, labelY);
  ctx.fillStyle = r.dead ? '#EF4444' : r.isLocal ? '#FDE047' : '#E2E8F0';
  ctx.fillText(label, 0, labelY);

  if (showHpBar) {
    const barW = 74;
    const barH = 9;
    const barX = -barW / 2;
    const barY = -80;
    const ratio = Math.max(0, r.hp / r.maxHp);

    // Background track
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = r.headCrashTimer > 0 ? '#EF4444' : '#475569';
    ctx.lineWidth = r.headCrashTimer > 0 ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
    ctx.fill();
    ctx.stroke();

    // Fill bar
    ctx.fillStyle = ratio > 0.5 ? '#10B981' : ratio > 0.25 ? '#F59E0B' : '#EF4444';
    if (ratio > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * ratio, barH, 2.5);
      ctx.fill();
    }

    // Numeric HP label
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(r.dead ? 'HP 0 · 阵亡' : `HP ${r.hp}/${r.maxHp}`, 0, barY + 21);
  }

  // Taunt speech bubble above rider
  if (r.tauntText) {
    const bubbleY = showHpBar ? -118 : -96;
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(r.tauntText).width;
    const bw = Math.max(76, textWidth + 20);
    const bh = 26;
    ctx.fillStyle = r.isLocal ? 'rgba(245, 158, 11, 0.96)' : 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = r.isLocal ? '#FEF3C7' : '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, bubbleY - bh / 2, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = r.isLocal ? '#0F172A' : '#F8FAFC';
    ctx.fillText(r.tauntText, 0, bubbleY + 4);
  }
  ctx.restore();

  ctx.restore();
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);

  // Tire
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Rim
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
  ctx.stroke();

  // Spokes
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
    ctx.lineTo(-Math.cos(a) * (r - 3), -Math.sin(a) * (r - 3));
    ctx.stroke();
  }
  ctx.restore();
}

function drawWeatherOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: WeatherType,
  weatherParticles: WeatherParticle[],
  flashAlpha: number
) {
  if (weather === 'clear' && flashAlpha <= 0) return;

  ctx.save();
  if (weather === 'rain' || weather === 'thunderstorm') {
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.52)';
    ctx.lineWidth = 1.5;
    for (const p of weatherParticles) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 5, p.y + 14);
      ctx.stroke();
    }
  } else if (weather === 'blizzard') {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.8)';
    for (const p of weatherParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather === 'sandstorm') {
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
    for (const p of weatherParticles) {
      ctx.fillRect(p.x, p.y, p.size * 5, 1.8);
    }
  }

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
