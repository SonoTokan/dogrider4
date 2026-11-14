import React, { useMemo, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { GameMode, LeaderboardEntry, TrackId } from '../types/game';
import { DIFFICULTIES, RIDERS, TRACKS, WEATHER_LABELS } from '../game/catalog';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
  onRefresh: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  entries,
  currentPlayerId,
  onRefresh,
}) => {
  const [trackFilter, setTrackFilter] = useState<'all' | TrackId>('all');
  const [modeFilter, setModeFilter] = useState<'all' | GameMode>('all');

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (trackFilter === 'all' ? true : e.trackId === trackFilter))
      .filter((e) => (modeFilter === 'all' ? true : e.mode === modeFilter))
      .sort((a, b) => a.finishTimeMs - b.finishTimeMs || b.score - a.score);
  }, [entries, trackFilter, modeFilter]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            全球实时竞速排行榜
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            通过 WebSocket 实时同步所有完赛记录。任何车手冲线后榜单将在毫秒级自动刷新。
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 同步最新榜单
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#1B1F27] border border-slate-800 rounded-lg">
          <button
            onClick={() => setTrackFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              trackFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            全部赛道
          </button>
          {(Object.keys(TRACKS) as TrackId[]).map((tid) => (
            <button
              key={tid}
              onClick={() => setTrackFilter(tid)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                trackFilter === tid ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {TRACKS[tid].name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#1B1F27] border border-slate-800 rounded-lg">
          {(
            [
              ['all', '全部模式'],
              ['versus', '多人对抗'],
              ['coop', '多人合作'],
              ['terminator', '终结者'],
              ['single', '单人竞速'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setModeFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                modeFilter === val ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#1B1F27] border border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-base font-semibold text-slate-300">当前筛选条件下暂无完赛记录</p>
            <p className="text-xs text-slate-500">
              快去完成一场单人或多人竞速赛，成为第一位登上全球实时榜的猛犬车手！
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#161A21]">
                  <th className="py-3.5 px-4 font-medium">排名</th>
                  <th className="py-3.5 px-4 font-medium">车手与等级</th>
                  <th className="py-3.5 px-4 font-medium">赛道 / 天气</th>
                  <th className="py-3.5 px-4 font-medium">模式</th>
                  <th className="py-3.5 px-4 font-medium text-right">完赛用时</th>
                  <th className="py-3.5 px-4 font-medium text-right">特技得分</th>
                  <th className="py-3.5 px-4 font-medium text-right">头摔次数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {filtered.map((entry, idx) => {
                  const isMe = entry.playerId === currentPlayerId;
                  const rider = RIDERS[entry.riderId];
                  const track = TRACKS[entry.trackId];
                  const weather = WEATHER_LABELS[entry.weather];

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isMe ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono-tabular font-bold">
                        <span
                          className={
                            idx === 0
                              ? 'text-amber-400'
                              : idx === 1
                              ? 'text-slate-200'
                              : idx === 2
                              ? 'text-orange-400'
                              : 'text-slate-500'
                          }
                        >
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {entry.nickname} {isMe && <span className="text-xs text-amber-400">(你)</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {rider?.name || entry.riderId} · Lv.{entry.riderLevel}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200">{track?.name || entry.trackId}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {weather?.name || entry.weather}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        <div>
                          {entry.mode === 'versus'
                            ? '多人对抗'
                            : entry.mode === 'coop'
                            ? '多人合作'
                            : entry.mode === 'terminator'
                            ? '终结者模式'
                            : '单人竞速'}
                        </div>
                        {entry.difficulty && DIFFICULTIES[entry.difficulty] && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: DIFFICULTIES[entry.difficulty].color }}
                          >
                            {DIFFICULTIES[entry.difficulty].name}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-emerald-400">
                        {(entry.finishTimeMs / 1000).toFixed(2)}s
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold text-amber-400">
                        {entry.score}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-300">
                        {entry.crashesCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
