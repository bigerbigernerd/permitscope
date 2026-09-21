# AI 使用记录

## 2026-09-21 — 研究与策划

- 工具：OpenAI Codex；web 公开网页检索；本地非官方 Devpost CLI 的只读 capabilities / hackathons info；公开页面与 GitHub 源码读取。
- AI 完成：赛事资料核查、时区转换、竞品能力和局限分析、候选方案比较、文档撰写与目录初始化。
- 人类输入：奖金优先的目标；按竞品证据选题；既有个人资格档案及视频默认无字幕偏好。
- 使用技能：hackathon-ops、devpost，以及工作区 race-selection、hackathon-ideation、golden-path-scoping。未调用其他代理。
- 本轮未开发产品、未创建演示数据或真实用户指标、未执行钱包操作、未报名或提交、未发邮件。
- 竞品观察来自公开文档与固定源码，尚无已安装钱包端到端实测。方案可行性与获奖表现仍是待验证假设。
- 后续开发需继续记录所用模型、代码/设计/素材贡献及第三方依赖；真实安全结论不能由语言模型凭空生成。


## 2026-09-21 — 第一版实现

- 用户选择 PermitScope 并授权开发。Codex 完成 React/TypeScript 界面、记录 SDK、状态分类、IndexedDB 元数据保存、隔离 EVM 演示、测试与 README。
- 使用 Sites building/hosting 技能完成私有网页发布流程；工作区 rapid-stack / frontend-design 用于技术和界面指导。
- OpenZeppelin 提供 ERC20Permit 实现；EthereumJS 提供真实 EVM 执行；ethers 用于签名、验签和 ABI。原始代币逻辑并非声称由我们发明。
- 自动生成的临时测试钱包和 tUSD 没有实际经济价值，初始签名由演示账户生成。代码和 UI 均明确标注隔离演示。
- 7 项自动测试覆盖真实合约生命周期、拒签/切账户、未知状态和超过 100 条记录保留；通过浏览器操作核查主流程及手机布局。
- 没有接入生成式 AI 进行风险判定，没有向服务器上传用户钱包、私钥或可执行签名。
- 尚未公共测试网部署、公开 GitHub 发布、报名或提交。此次 Site 发布保留默认私有访问。

## 2026-09-21 — VPS 部署与单屏改版

- 按用户明确指示改用 VPS：hackathon.pocketplay.win/permitscope/；新增根目录项目入口卡片。
- Codex 重构为单屏三栏工作台，保留真实 EVM 主流程；详情、历史、备份、边界实验移入弹窗。
- 使用现有 Nginx 与通配接入，向 VPS dashboard 的 sites.json 增加站点；没有改动 Cloudflare DNS、通道或凭据。
- 自动测试 7 项通过；对 1440×900、1280×720、1280×640、390×844 核查主页面及面板无溢出；完成公网取消/重放端到端验证。
- 首次切换因 Nginx reload 后立即探测旧 worker 而回退；补充有界重试后发布成功。旧站和回退文件均保留。

## 2026-09-21 — English hacker-theme demo release

OpenAI Codex implemented the black/green/white palette, lightweight CSS transitions, compact desktop layouts, English demo copy and navigation, and the shared VPS demo hub. It added visitor-isolated local EVM hosting for InvoiceFence and Monad, updated the public-route handling, and verified builds, existing tests, browser flows and session isolation. Existing contract/payment behavior and demo disclosures were retained. No new generative model is used by the demo features; no real funds were moved.

## Submission materials and videos — 2026-09-21

OpenAI Codex prepared the submission draft, primary-source competitor summaries and video scripts. Remotion 4.0.526 composes actual Playwright recordings, diagrams and chapter cards. Microsoft Edge TTS en-US-AndrewNeural provides synthetic narration. No subtitles are burned in. Local-EVM, simulated-payment and recorded-devnet segments retain their disclosed boundaries. No user/customer metrics were invented.
