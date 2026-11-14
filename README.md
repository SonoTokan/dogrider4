# 大狗骑自行车4 (Big Dog Bike 4)

《大狗骑自行车4》是一款结合 **2D 物理越野特技竞速、头朝地摔车血量系统、武器终结者混战、分模式 12 级军阶晋升与实时联机/AI 对战** 的网页游戏，已全面适配 **GitHub Pages 静态托管** 与 **Node.js 全栈联机服务端**。

## 核心玩法与特色

- **四大竞技模式**（均拥有独立的 12 级军阶经验体系，最高等级「无极 / 无敌」）：
  - **多人对抗赛**：同场竞速抢第一，内置嘲讽轮盘、冲刺道具与头朝地重摔伤害机制。
  - **多人合作护送**：队友并肩冲关，支持救援倒地队友与无伤合作挑战。
  - **终结者模式**：全员配备无限弹药 **98K / M47 / 任意手枪**，攻击其他车手与 AI 机械犬即可额外赢取骨头。
  - **单人越野试炼**：8 级难度递进（新手 / 超低 / 初级 / 接触者 / 真实 / 极限 / 无声），动态天气实时轮换。
- **11 位传奇车手 & 车库改装**：包含阿柴、二哈、铁牛、葛特的优点、葛特66葛特、奥利奥、未知人物、奥德、德尔萨斯、德鲁萨斯与终结者德里克，支持车架解锁与属性升级。
- **成就殿堂 & 排行榜**：包含 5 秒速通成就（超级快速者、震惊队友、来不及杀人）、最好服装、最高等级等数十项成就与本地/全球排行榜。
- **GitHub Pages 离线/静态支持**：在无后端的 GitHub Pages 上自动启用本地存档、本地排行榜与本地 AI 人机房间（可随时召唤 AI 机械犬同场竞技）。

## 操作方式

- `W` / `↑`：加速前进
- `S` / `↓`：刹车 / 倒车
- `A` / `D` 或 `←` / `→`：空中抬头 / 压车头（前/后空翻）
- `Space`：跳跃 · `Shift`：氮气冲刺 · `B`：狗叫 · `F` / 鼠标左键：射击（终结者模式）

## 发布到 GitHub Pages（推荐流程）

1. 将本仓库代码推送到你的 GitHub 仓库（`main` 或 `master` 分支）：
   ```bash
   git init
   git add .
   git commit -m "chore: prepare Big Dog Bike 4 for GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<你的仓库名>.git
   git push -u origin main
   ```
2. 打开 GitHub 仓库页面 → **Settings** → **Pages** → **Build and deployment** → **Source** 选择 **GitHub Actions**。
3. `.github/workflows/deploy-pages.yml` 会自动执行类型检查（`npm run lint`）、构建相对路径静态产物（`dist/`）并部署至 `https://<你的用户名>.github.io/<你的仓库名>/`。

> 如需在 GitHub Pages 上连接独立部署的联机后端，可在仓库 **Settings → Secrets and variables → Actions → Variables** 中配置 `VITE_API_ORIGIN`（`https://...`）与 `VITE_WS_ORIGIN`（`wss://...`）。

## 本地开发与全栈运行

```bash
# 安装依赖
npm install

# 启动完整全栈服务（Express + WebSocket 联机大厅 + Vite 开发中间件，端口 3000）
npm run dev

# 类型检查与静态构建
npm run lint
npm run build
```

## 开源协议

基于 [MIT License](./LICENSE) 开源。
