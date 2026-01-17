# Architecture Decision Records

| ADR | タイトル | ステータス |
|-----|---------|-----------|
| [001](./001-browser-only-mvp.md) | MVPはサーバーレスのブラウザ拡張機能として実装する | Accepted |
| [002](./002-detection-only.md) | MVPではブロック機能を実装せず検出・可視化のみとする | Accepted |
| [003](./003-tech-stack.md) | Chrome Manifest V3 + WXT + Preactで実装する | Accepted |
| [004](./004-privacy-policy-detection.md) | プライバシーポリシーはURLパターンとリンクテキストで特定する | Accepted |
| [005](./005-design-system.md) | Vercel風ミニマルデザインシステム | Accepted |
| [006](./006-tos-detection.md) | 利用規約検出機能 | Accepted |
| [007](./007-isomorphic-hono-api.md) | sql.js (SQLite WASM) によるクライアントサイドDB | Accepted |
| [008](./008-core-domain-model.md) | Coreパッケージの廃止とドメイン分割 | Accepted |
| [009](./009-explore-agent-optimization.md) | Claude Code Explore Agent最適化 | Accepted |
| [010](./010-extension-runtime-package.md) | Extension Runtimeパッケージの分離 | Accepted |
| [011](./011-ai-prompt-monitoring.md) | AIプロンプト監視機能 | Accepted |
| [012](./012-dashboard-data-fetching.md) | Dashboardデータ取得の設計原則 | Accepted |
| [013](./013-debug-cli.md) | デバッグCLI (pleno-debug) | Accepted |
| [014](./014-doh-monitoring.md) | DoH（DNS over HTTPS）監視機能 | Accepted |
| [015](./015-pleno-battacker.md) | Pleno Battacker - ブラウザ防御耐性テストツール | Accepted |
| [016](./016-battacker-signature-expansion.md) | Battacker攻撃シグネチャ拡張 | Accepted |
| [017](./017-battacker-advanced-signatures.md) | Battacker高度攻撃シグネチャ拡張 (Phase 1-2) | Accepted |
| [018](./018-battacker-hybrid-attacks.md) | Battacker ハイブリッド攻撃シグネチャ (Phase 6) | Accepted |
| [019](./019-battacker-context-bridge.md) | Battacker コンテキストブリッジ攻撃 (Phase 7) | Accepted |
