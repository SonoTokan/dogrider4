import React from 'react';
import { CloudLightning, Gauge, HeartPulse, ShieldAlert, Users, Wrench } from 'lucide-react';
import { DIFFICULTIES, DIFFICULTY_ORDER, WEATHER_LABELS } from '../game/catalog';
import { WeatherType } from '../types/game';

export const GuideView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-10">
      <div className="pb-6 border-b border-slate-800">
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">
          《大狗骑自行车4》车手手册与规则图鉴
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          掌握空中翻滚姿态、Q 键跳跃避坑、8 级难度体系、头朝地摔车生存机制及多人玩法。
        </p>
      </div>

      {/* Controls & Core Mechanics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-base">
            <ShieldAlert className="w-5 h-5" />
            核心机制：头朝地摔车与血量死亡
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            骑行过程中如果发生失误，导致骑手<strong>头朝地撞击地面或陷阱</strong>，自行车上方与顶部 HUD 会立即弹出高危<strong>血量条 (HP)</strong>并扣除撞击伤害。
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>• 骑手等级越高，最大血量上限 (Max HP) 越高，容错率越强。</li>
            <li>• 升级「防摔全盔护甲」或选用「铁牛斗牛犬」可大幅减免头朝地摔伤。</li>
            <li>• 若血量归零 (HP = 0)，大狗骑手将彻底阵亡，无法继续骑行！</li>
          </ul>
        </div>

        <div className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
            <Users className="w-5 h-5" />
            多人对抗与多人合作玩法
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            创建或加入 4 位房间号，与全网真实玩家实时同屏竞速：
          </p>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>• <strong>多人对抗赛 (主要玩法)</strong>：同场比拼谁先冲过终点；按 <code className="text-amber-400">T</code> 键或数字键 <code className="text-amber-400">1~6</code> 打开快捷嘲讽轮盘发送实时表情与音效嘲讽；若有玩家摔车阵亡，全员会收到阵亡播报弹窗提示（点击确定继续）。</li>
            <li>• <strong>多人合作护送赛</strong>：靠近队友按 <code className="text-emerald-400">E</code> 键释放「汪汪鼓舞」为队友回复血量并清除泥泞；若队友头摔阵亡，靠近按 <code className="text-emerald-400">E</code> 可将其紧急复活！</li>
            <li>• <strong>全模式支持教程难度</strong>：无论单人、多人对抗还是多人合作，均可开启「教程」难度实时指引每个按键用法。</li>
          </ul>
        </div>
      </div>

      {/* Keybindings */}
      <section className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-sky-400" />
          键盘与触控操作指南
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 text-sm">
          {[
            ['W / ↑', '踩踏板加速'],
            ['S / ↓', '紧急刹车'],
            ['A / ←', '抬头翘尾 / 后空翻'],
            ['D / →', '压车头 / 前空翻'],
            ['Q 键', '跳跃避空 / 躲避地刺'],
            ['Shift / E', '氮气爆发 / 汪汪技能'],
            ['T / 1~6', '对抗赛快捷嘲讽轮盘'],
          ].map(([key, desc]) => (
            <div key={key} className="bg-[#111318] border border-slate-800 rounded-lg p-3">
              <div className="font-mono-tabular font-bold text-amber-400 text-xs">{key}</div>
              <div className="text-xs text-slate-300 mt-1">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 8 Difficulty Levels */}
      <section className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Gauge className="w-5 h-5 text-amber-400" />
          八大难度等级体系（由低到高）
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DIFFICULTY_ORDER.map((dId, idx) => {
            const d = DIFFICULTIES[dId];
            return (
              <div
                key={dId}
                className="flex items-start justify-between gap-4 bg-[#111318] border border-slate-800 rounded-lg p-3.5 text-xs"
              >
                <div className="font-bold whitespace-nowrap" style={{ color: d.color }}>
                  {idx + 1}. {d.name}
                </div>
                <div className="text-slate-400 text-right">{d.shortDesc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dynamic Weather & Traps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CloudLightning className="w-5 h-5 text-yellow-400" />
            动态天气系统
          </h2>
          <div className="space-y-3">
            {(Object.keys(WEATHER_LABELS) as WeatherType[]).map((w) => (
              <div key={w} className="flex items-start justify-between gap-4 text-xs pb-2.5 border-b border-slate-800/80 last:border-0 last:pb-0">
                <span className="font-semibold whitespace-nowrap" style={{ color: WEATHER_LABELS[w].color }}>
                  {WEATHER_LABELS[w].name}
                </span>
                <span className="text-slate-400 text-right">{WEATHER_LABELS[w].effect}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#1B1F27] border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-red-400" />
            赛道陷阱与补给道具
          </h2>
          <div className="space-y-2.5 text-xs text-slate-300">
            <div>
              <strong className="text-red-400">捕兽钉刺带</strong> · 碾压会瞬间翘翻车头导致头朝地摔伤，请按 Q 键跳过去。
            </div>
            <div>
              <strong className="text-sky-400">摆锤旋转锯片 / 滚石</strong> · 定时摆动与滚落的高危致命陷阱，注意观察节奏或高速冲过。
            </div>
            <div>
              <strong className="text-amber-400">泥泞沼泽 / 极地黑冰</strong> · 泥潭会大幅减速，黑冰会降低抓地力；升级全地形钉胎可有效抵御。
            </div>
            <div>
              <strong className="text-emerald-400">金骨头 / +1000 绿色骨头 / 急救箱</strong> · 难度越高获得的金骨头越多！在「终极(极限)」「真实」「寂静」难度中还高概率出现发光<strong className="text-green-400">绿色骨头</strong>，拾取直接拥有 <strong>1000 个骨头</strong>！此外常规难度下血量会随时间自动上升恢复，但在终极(极限)、真实与寂静难度中禁止随时间回血。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
