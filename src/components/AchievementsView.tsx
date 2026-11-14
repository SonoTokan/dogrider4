import React, { useState } from 'react';
import { Award, CheckCircle2, Lock, Shield, Sparkles } from 'lucide-react';
import {
  ACHIEVEMENTS,
  MILITARY_RANKS,
  MODE_RANK_META,
  WEATHER_LABELS,
  getAchievementProgress,
  getBestAttireBreakdown,
  getModeRankInfo,
} from '../game/catalog';
import { GameMode, PlayerProfile, WeatherType } from '../types/game';

interface AchievementsViewProps {
  profile: PlayerProfile;
}

const RANK_MODES: GameMode[] = ['single', 'versus', 'coop', 'terminator'];

export const AchievementsView: React.FC<AchievementsViewProps> = ({ profile }) => {
  const [rankTab, setRankTab] = useState<GameMode>('versus');
  const unlockedSet = new Set(profile.unlockedAchievements || []);
  const wonWeatherSet = new Set(profile.stats.wonWeathers || []);
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length;
  const earnedAchievementBones = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).reduce(
    (sum, a) => sum + a.rewardTotal,
    0
  );
  const rankInfo = getModeRankInfo(profile, rankTab);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Award className="w-7 h-7 text-amber-400" />
            车手成就殿堂
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            达成各项传奇挑战目标，系统将在赛后结算时自动发放巨额骨头奖励。
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#1B1F27] border border-slate-800 rounded-xl px-5 py-3">
          <div>
            <div className="text-[11px] text-slate-400">已解锁成就</div>
            <div className="font-mono-tabular text-lg font-bold text-white">
              {unlockedCount} / {ACHIEVEMENTS.length}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-[11px] text-slate-400">成就已领骨头</div>
            <div className="font-mono-tabular text-lg font-bold text-amber-400">
              {earnedAchievementBones.toLocaleString()} 🦴
            </div>
          </div>
        </div>
      </div>

      {/* 12-Tier Independent Per-Mode Military Rank Ladder */}
      <section className="bg-[#1B1F27] border border-slate-800 rounded-2xl p-6 space-y-5">
        {/* 4 Independent Mode Rank Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {RANK_MODES.map((m) => {
            const meta = MODE_RANK_META[m];
            const mInfo = getModeRankInfo(profile, m);
            const active = rankTab === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setRankTab(m)}
                className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500/10 border-amber-400'
                    : 'bg-[#111318] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <div className="text-base font-bold text-white mt-1 flex items-center justify-between gap-2">
                  <span style={{ color: mInfo.current.color }}>
                    Lv.{mInfo.current.level} {mInfo.current.name}
                  </span>
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-400 mt-1">
                  {mInfo.xp.toLocaleString()} EXP
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="w-4 h-4 text-amber-400" />
              {MODE_RANK_META[rankTab].label}（1 骨头 = 1 经验 · 各模式独立计算，互不增加）
            </div>
            <div className="flex items-center gap-3">
              <span
                className="font-display text-2xl font-bold"
                style={{ color: rankInfo.current.color }}
              >
                Lv.{rankInfo.current.level} · {rankInfo.current.name}
              </span>
              <span className="text-xs font-mono-tabular text-slate-300 bg-[#111318] border border-slate-700 rounded-md px-2.5 py-1">
                本模式经验：{rankInfo.xp.toLocaleString()} EXP
              </span>
            </div>
          </div>

          <div className="min-w-[260px] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {rankInfo.next ? `距离下一级「${rankInfo.next.name}」` : '已达最高无极满级'}
              </span>
              <span className="font-mono-tabular font-semibold text-amber-300">
                {rankInfo.next
                  ? `${rankInfo.xpInLevel.toLocaleString()} / ${rankInfo.xpNeededForNext.toLocaleString()} EXP`
                  : 'MAX'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${rankInfo.progressPct}%`,
                  backgroundColor: rankInfo.current.color,
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {MILITARY_RANKS.map((rk) => {
            const reached = rankInfo.xp >= rk.minXp;
            const isCurrent = rankInfo.current.id === rk.id;
            return (
              <div
                key={rk.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isCurrent
                    ? 'bg-amber-500/15 border-amber-400'
                    : reached
                    ? 'bg-emerald-950/15 border-emerald-500/40'
                    : 'bg-[#111318] border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                  <span className="text-slate-400">LV.{rk.level}</span>
                  <span className={reached ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                    {isCurrent ? '当前' : reached ? '已达成' : '未解锁'}
                  </span>
                </div>
                <div className="text-sm font-bold mt-1" style={{ color: rk.color }}>
                  {rk.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
                  总经验 {rk.minXp.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono-tabular">
                  {rk.stepXp > 0 ? `晋级下一级需 +${rk.stepXp.toLocaleString()}` : '终极巅峰军衔'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Achievement List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ACHIEVEMENTS.map((ach) => {
          const current = getAchievementProgress(ach.id, profile.stats, profile);
          const unlocked = unlockedSet.has(ach.id) || current >= ach.target;
          const pct = Math.min(100, Math.round((current / ach.target) * 100));

          return (
            <div
              key={ach.id}
              className={`rounded-xl border p-6 flex flex-col justify-between space-y-5 transition-colors ${
                unlocked
                  ? 'bg-emerald-950/15 border-emerald-500/60'
                  : 'bg-[#1B1F27] border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {unlocked ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                    <h2
                      className="text-lg font-bold leading-snug"
                      style={{ color: unlocked ? '#4ADE80' : ach.tierColor }}
                    >
                      {ach.name}
                    </h2>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      unlocked ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {unlocked ? '已达成 · 已发放' : '挑战中'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{ach.description}</p>

                {ach.id === 'all_weather_wins' && (
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                    {(Object.keys(WEATHER_LABELS) as WeatherType[]).map((w) => {
                      const done = wonWeatherSet.has(w);
                      return (
                        <span
                          key={w}
                          className={`font-medium ${done ? 'text-emerald-400' : 'text-slate-500'}`}
                        >
                          {done ? '✓' : '○'} {WEATHER_LABELS[w].name}
                        </span>
                      );
                    })}
                  </div>
                )}

                {ach.id === 'best_attire' && (() => {
                  const b = getBestAttireBreakdown(profile);
                  const items = [
                    {
                      label: `全部人物 (${b.riderCount}/${b.riderTotal})`,
                      done: b.riderCount >= b.riderTotal,
                    },
                    {
                      label: `全部车架改装 (${b.frameCount}/${b.frameTotal})`,
                      done: b.frameCount >= b.frameTotal,
                    },
                    {
                      label: `等级与核心强化满级 (${b.upgradeCount}/${b.upgradeTotal})`,
                      done: b.upgradeCount >= b.upgradeTotal,
                    },
                  ];
                  return (
                    <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
                      {items.map((it) => (
                        <span
                          key={it.label}
                          className={`font-medium ${it.done ? 'text-emerald-400' : 'text-slate-500'}`}
                        >
                          {it.done ? '✓' : '○'} {it.label}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{ach.conditionLabel}</span>
                  <span className="font-mono-tabular font-semibold text-white">
                    {Math.min(current, ach.target).toLocaleString()} / {ach.target.toLocaleString()}
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: unlocked ? '#10B981' : ach.tierColor,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 成就奖励
                  </span>
                  <span className="font-mono-tabular font-bold text-amber-400">
                    {ach.rewardLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Progress Telemetry Summary */}
      <section className="bg-[#1B1F27] border border-slate-800 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
        <div>
          <div className="text-slate-500">教程难度胜场</div>
          <div className="font-mono-tabular text-base font-bold text-sky-400 mt-0.5">
            {(profile.stats.tutorialWins ?? 0).toLocaleString()} 胜
          </div>
        </div>
        <div>
          <div className="text-slate-500">多人对抗胜场</div>
          <div className="font-mono-tabular text-base font-bold text-emerald-400 mt-0.5">
            {(profile.stats.versusWins ?? 0).toLocaleString()} 胜
          </div>
        </div>
        <div>
          <div className="text-slate-500">真实难度胜场</div>
          <div className="font-mono-tabular text-base font-bold text-violet-400 mt-0.5">
            {(profile.stats.realisticWins ?? 0).toLocaleString()} 胜
          </div>
        </div>
        <div>
          <div className="text-slate-500">终极难度胜场</div>
          <div className="font-mono-tabular text-base font-bold text-rose-400 mt-0.5">
            {(profile.stats.ultimateWins ?? 0).toLocaleString()} 胜
          </div>
        </div>
        <div>
          <div className="text-slate-500">零死亡零伤合作</div>
          <div className="font-mono-tabular text-base font-bold text-teal-400 mt-0.5">
            {(profile.stats.flawlessCoopWins ?? 0).toLocaleString()} 次
          </div>
        </div>
        <div>
          <div className="text-slate-500">竞技零掉血胜场</div>
          <div className="font-mono-tabular text-base font-bold text-amber-400 mt-0.5">
            {(profile.stats.noDamageVersusWins ?? 0).toLocaleString()} 胜
          </div>
        </div>
      </section>
    </div>
  );
};
