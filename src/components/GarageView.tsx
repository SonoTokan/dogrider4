import React from 'react';
import { Check, Lock, Shield, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import {
  BikeFrameId,
  PlayerProfile,
  RiderId,
  UpgradeLevels,
} from '../types/game';
import {
  BIKE_FRAMES,
  RIDERS,
  UPGRADE_META,
  computeHeadArmorReduction,
  computeMaxHp,
  getUpgradeCost,
} from '../game/catalog';
import { RIDER_AVATARS } from '../assets/riderImages';

interface GarageViewProps {
  profile: PlayerProfile;
  onSelectRider: (riderId: RiderId) => void;
  onUnlockRider: (riderId: RiderId) => void;
  onSelectFrame: (frameId: BikeFrameId) => void;
  onUnlockFrame: (frameId: BikeFrameId) => void;
  onUpgradeStat: (key: keyof UpgradeLevels) => void;
}

export const GarageView: React.FC<GarageViewProps> = ({
  profile,
  onSelectRider,
  onUnlockRider,
  onSelectFrame,
  onUnlockFrame,
  onUpgradeStat,
}) => {
  const currentMaxHp = computeMaxHp(
    profile.selectedRider,
    profile.selectedFrame,
    profile.upgrades
  );
  const currentArmorPct = Math.round(
    computeHeadArmorReduction(profile.selectedRider, profile.upgrades) * 100
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-10">
      {/* Garage Summary Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            骑手训练营 & 单车改装车库
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            提升骑手等级可直接增加最大血量；升级头盔护甲能大幅降低头朝地摔车伤害。
          </p>
        </div>
        <div className="flex items-center gap-6 bg-[#1B1F27] border border-slate-800 rounded-lg px-5 py-3">
          <div>
            <div className="text-xs text-slate-400">当前最大血量</div>
            <div className="font-mono-tabular text-xl font-bold text-emerald-400">
              {currentMaxHp} HP
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-xs text-slate-400">头摔减伤</div>
            <div className="font-mono-tabular text-xl font-bold text-sky-400">
              -{currentArmorPct}%
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-xs text-slate-400">可用金骨头</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-400">
              {profile.goldBones} 🦴
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Big Dog Riders */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">01. 选择猛犬骑手</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(Object.keys(RIDERS) as RiderId[]).map((rId) => {
            const rider = RIDERS[rId];
            const unlocked = profile.unlockedRiders.includes(rId);
            const selected = profile.selectedRider === rId;
            const previewHp = computeMaxHp(rId, profile.selectedFrame, profile.upgrades);

            return (
              <div
                key={rId}
                className={`rounded-xl bg-[#1B1F27] border transition-colors overflow-hidden flex flex-col ${
                  selected ? 'border-amber-500' : 'border-slate-800'
                }`}
              >
                <div className="aspect-square w-full bg-slate-900 relative overflow-hidden">
                  {rider.avatarPath === 'question' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0B0D14] via-[#171226] to-[#0A0C12] relative select-none">
                      <div className="w-36 h-36 rounded-full bg-purple-500/10 border-2 border-purple-500/40 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.28)]">
                        <span className="font-display text-7xl font-black text-purple-300 drop-shadow-[0_0_16px_rgba(192,132,252,0.8)]">
                          ?
                        </span>
                      </div>
                      <span className="mt-3 text-xs font-mono-tabular tracking-[0.25em] text-purple-300/70">
                        UNKNOWN RIDER
                      </span>
                    </div>
                  ) : (
                    <img
                      src={RIDER_AVATARS[rId] ?? rider.avatarPath}
                      alt={rider.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#1B1F27] to-transparent" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold text-white">{rider.name}</h3>
                      <span className="text-xs text-amber-400 font-medium">{rider.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {rider.description}
                    </p>
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
                      <div>
                        <div className="text-slate-500">当前血量</div>
                        <div className="font-mono-tabular font-semibold text-emerald-400">
                          {previewHp}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">速度倍率</div>
                        <div className="font-mono-tabular font-semibold text-slate-200">
                          {Number((rider.speedBonus * 100).toFixed(2))}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">天生防摔</div>
                        <div className="font-mono-tabular font-semibold text-sky-400">
                          -{Math.round(rider.headArmorBase * 100)}%
                        </div>
                      </div>
                    </div>
                    {(rider.damageBonus !== undefined || (rider.weapons && rider.weapons.length > 0)) && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        {rider.damageBonus !== undefined && (
                          <span className="font-mono-tabular font-semibold text-red-400">
                            伤害倍率: {Math.round(rider.damageBonus * 100)}%
                          </span>
                        )}
                        {rider.weapons && rider.weapons.length > 0 && (
                          <span className="font-semibold text-amber-300">
                            专属武装: 98K / M47 / 任意手枪 (∞ 无限弹)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {unlocked ? (
                    <button
                      onClick={() => onSelectRider(rId)}
                      className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      {selected ? (
                        <>
                          <Check className="w-4 h-4" /> 已出战
                        </>
                      ) : (
                        '选择此骑手'
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnlockRider(rId)}
                      disabled={profile.goldBones < rider.unlockCost}
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed text-amber-400 transition-colors cursor-pointer"
                    >
                      <Lock className="w-4 h-4" /> 解锁 ({rider.unlockCost.toLocaleString()} 🦴)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Bicycle Frames */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">02. 改装自行车车架</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(BIKE_FRAMES) as BikeFrameId[]).map((fId) => {
            const frame = BIKE_FRAMES[fId];
            const unlocked = profile.unlockedFrames.includes(fId);
            const selected = profile.selectedFrame === fId;
            return (
              <div
                key={fId}
                className={`rounded-xl bg-[#1B1F27] border p-5 flex flex-col justify-between space-y-4 ${
                  selected ? 'border-amber-500' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="w-8 h-2 rounded-full"
                      style={{ backgroundColor: frame.frameColor }}
                    />
                    <span className="font-mono-tabular text-xs text-emerald-400">
                      +{frame.durabilityBonus} HP
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{frame.name}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {frame.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-300 mt-3 font-mono-tabular">
                    <span>极速 {Math.round(frame.speedMult * 100)}%</span>
                    <span>·</span>
                    <span>车重 {Math.round(frame.weightMult * 100)}%</span>
                  </div>
                </div>

                {unlocked ? (
                  <button
                    onClick={() => onSelectFrame(fId)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {selected ? '当前装配' : '装配车架'}
                  </button>
                ) : (
                  <button
                    onClick={() => onUnlockFrame(fId)}
                    disabled={profile.goldBones < frame.unlockCost}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-45 disabled:cursor-not-allowed text-amber-400 transition-colors cursor-pointer"
                  >
                    购买 ({frame.unlockCost} 🦴)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Rider & Bike Part Upgrades */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">03. 骑手等级与核心装备强化</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UPGRADE_META.map((u) => {
            const lvl = profile.upgrades[u.key];
            const isMax = lvl >= u.maxLevel;
            const cost = getUpgradeCost(u.key, lvl);
            const canAfford = profile.goldBones >= cost && !isMax;

            return (
              <div
                key={u.key}
                className="rounded-xl bg-[#1B1F27] border border-slate-800 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {u.category === 'rider' ? (
                      u.key === 'riderLevel' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                      )
                    ) : (
                      <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className="text-sm font-bold text-white truncate">{u.name}</span>
                    <span className="font-mono-tabular text-xs text-amber-400 shrink-0">
                      Lv.{lvl}/{u.maxLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{u.effectDesc(lvl)}</p>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        u.key === 'riderLevel' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${(lvl / u.maxLevel) * 100}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => onUpgradeStat(u.key)}
                  disabled={!canAfford}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isMax ? '已满级' : `升级 (${cost} 🦴)`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
