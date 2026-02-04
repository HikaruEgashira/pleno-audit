# Architecture Decision Records

| ADR | タイトル | ステータス |
|-----|---------|-----------|
| [001](./001-browser-only-mvp.md) | MVPはサーバーレスのブラウザ拡張機能として実装する | Accepted |
| [002](./002-detection-only.md) | MVPではブロック機能を実装せず検出・可視化のみとする | Accepted |
| [003](./003-tech-stack.md) | Chrome Manifest V3 + WXT + Preactで実装する | Accepted |
| [004](./004-privacy-policy-detection.md) | プライバシーポリシーはURLパターンとリンクテキストで特定する | Accepted |
| [005](./005-design-system.md) | Vercel風ミニマルデザインシステム | Accepted |
| [006](./006-tos-detection.md) | 利用規約検出機能 | Accepted |
| [007](./007-isomorphic-hono-api.md) | sql.js (SQLite WASM) によるクライアントサイドDB | Superseded |
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
| [020](./020-battacker-sandbox-escape.md) | Battacker サンドボックス脱出攻撃 (Phase 8) | Accepted |
| [021](./021-battacker-future-api.md) | Battacker 次世代API脆弱性 (Phase 9) | Accepted |
| [023](./023-battacker-zero-day-quantum-threats.md) | Battacker Zero-Day & Quantum脅威層 (Phase 11) | Accepted |
| [024](./024-battacker-meta-ecosystem-attacks.md) | Battacker メタレベル & エコシステム層 (Phase 12) | Accepted |
| [025](./025-battacker-protocol-standards.md) | Battacker プロトコル & スタンダード層 (Phase 14) | Accepted |
| [026](./026-battacker-rendering-engine.md) | Battacker レンダリングエンジン層 (Phase 15) | Accepted |
| [027](./027-battacker-ipc-layer.md) | Battacker IPC層 (Phase 16) | Accepted |
| [028](./028-battacker-extension-sandbox.md) | Battacker 拡張機能サンドボックス層 (Phase 17) | Accepted |
| [030](./030-firefox-support.md) | Firefox Support | Accepted |
| [031](./031-parquet-storage-migration.md) | parquet-storageへの完全移行 | Accepted |
| [032](./032-extensions-analysis-tab.md) | 拡張機能分析タブのOSS移行 | Accepted |
| [033](./033-unlimited-storage-for-zta.md) | ZTA監査証跡のためのunlimitedStorage採用 | Accepted |
| [034](./034-network-monitor.md) | Network Monitor - 全ネットワークリクエスト監視 | Accepted |
| [035](./035-background-message-routing-refactor.md) | Backgroundメッセージルーティングのテーブル駆動化 | Accepted |
| [036](./036-alert-manager-responsibility-split.md) | Alert Managerの責務分離 | Accepted |
