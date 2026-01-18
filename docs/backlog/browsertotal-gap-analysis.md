# BrowserTotal vs Battacker ギャップ分析

## 概要

| 項目 | Battacker | BrowserTotal |
|------|-----------|--------------|
| テスト数 | 100+ | 131 |
| 最大スコア | 100 | 3258 |
| 実行形態 | Chrome拡張機能 | Web + 拡張機能 |
| プライバシー | 完全ローカル | 外部通信あり |
| B-ATT&CK対応 | 部分的 | フル対応 |

## Battackerの強み（BrowserTotalにない機能）

### 1. Cryptojacking Detection
- **説明**: CPU/WebWorkerマイニングシミュレーション
- **テスト**: `cryptojacking_cpu_mining`, `cryptojacking_webworker_mining`
- **優先度**: 高
- **理由**: クリプトジャッキングはブラウザ特有の脅威

### 2. Covert Channel
- **説明**: Beacon API、DNS Prefetch経由の隠蔽通信
- **テスト**: `covert_beacon_api`, `covert_dns_prefetch`
- **優先度**: 高
- **理由**: 検出が困難なC2通信チャネル

### 3. Media Capture
- **説明**: Screen/Audio Captureのテスト
- **テスト**: `media_screen_capture`, `media_audio_recording`
- **優先度**: 中
- **理由**: プライバシー侵害の一般的な手法

### 4. Context Bridge
- **説明**: postMessage経由のSOP回避テスト
- **テスト**: `context_bridge_postmessage`, `context_bridge_window_open`
- **優先度**: 中
- **理由**: Same-Origin Policy回避の高度な攻撃

### 5. 完全ローカル実行
- **説明**: プライバシー保護（外部通信なし）
- **優先度**: 高
- **理由**: エンタープライズ環境でのプライバシー要件

## BrowserTotalの強み（Battackerに追加すべき機能）

### 高優先度

#### AI Security カテゴリ
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| AI Browser Prompt Injection | AIブラウザへのプロンプトインジェクション | 高 |
| AI Agent Hijacking | AIエージェントの乗っ取り | 高 |
| LLM Analysis | LLM経由の攻撃ベクトル分析 | 中 |
| AI Tool Poisoning | AIツールへの悪意ある入力 | 高 |

**対応ADR**: 新規ADR作成が必要
**実装計画**: `packages/battacker/signatures/ai-security/`

#### Extension Analysis
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| Extension Enumeration | インストール済み拡張機能の列挙 | 低 |
| Extension Vulnerability Scan | 拡張機能の脆弱性スキャン | 中 |
| Extension Permission Abuse | 過剰な権限の検出 | 中 |

**既存実装**: `packages/extension-runtime/src/extension-risk-analyzer.ts` を拡張
**実装計画**: Battackerシグネチャとして統合

#### Emerging Threats
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| SocGholish | 社会工学的マルウェア配信 | 中 |
| ClickFix | クリックジャッキング変種 | 低 |
| V8 Zero-Day Simulation | JSエンジン脆弱性シミュレーション | 高 |
| Rowhammer.js | メモリ攻撃シミュレーション | 高 |
| Quantum Crypto Attack | 量子暗号攻撃シミュレーション | 高 |

**対応ADR**: ADR-023（Zero-Day & Quantum脅威層）を拡張
**実装計画**: `packages/battacker/signatures/emerging-threats/`

### 中優先度

#### WASM Analysis
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| WASM Code Execution | WASMコード実行のテスト | 中 |
| WASM Memory Access | WASMメモリアクセスパターン | 中 |
| WASM Crypto Mining | WASM経由のマイニング検出 | 低 |

**実装計画**: Cryptojacking検出を拡張

#### Browser Policy Analysis
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| Enterprise Policy Evaluation | エンタープライズポリシー評価 | 中 |
| Security Header Analysis | セキュリティヘッダー分析 | 低 |
| Permission Policy Check | Permission-Policy評価 | 低 |

**既存実装**: CSP監査を拡張
**実装計画**: `packages/csp/` に機能追加

#### Identity Attacks詳細
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| Consent Phishing | 同意画面フィッシング | 中 |
| OAuth Phishing | OAuth認証フィッシング | 中 |
| WebAuthn Phishing | WebAuthn認証フィッシング | 高 |
| Browser-in-Browser | ブラウザ偽装攻撃 | 中 |
| EvilProxy Simulation | MitM攻撃シミュレーション | 高 |

**既存実装**: Phishing Attacksカテゴリを拡張
**実装計画**: `packages/battacker/signatures/identity-attacks/`

### 低優先度

#### Analysis Tools
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| HAR Viewer | HARファイルビューア | 低 |
| PCAP Viewer | PCAPファイルビューア | 中 |
| Memory Dump Analyzer | メモリダンプ分析 | 高 |

**注意**: これらは分析ツールであり、Battackerのスコープ外
**代替案**: 別パッケージとして検討

#### CTF Mode
| テスト名 | 説明 | 実装難易度 |
|---------|------|-----------|
| Security Training Lab | セキュリティトレーニング | 中 |
| Challenge Mode | チャレンジモード | 中 |

**実装計画**: 将来検討

## 実装ロードマップ

### Phase 1: AI Security（最優先）
1. ADR作成: AI Security カテゴリの設計
2. シグネチャ実装: AI Prompt Injection, AI Agent Hijacking
3. 検出ロジック: AIブラウザコンテキストの監視

### Phase 2: Extension Security
1. Extension Enumeration シグネチャ追加
2. Extension Vulnerability Scan 統合
3. extension-risk-analyzerとの連携

### Phase 3: Emerging Threats
1. SocGholish パターン追加
2. ClickFix 検出追加
3. 既存ADR-023の実装完了

### Phase 4: Identity Attacks拡張
1. OAuth/WebAuthn Phishing追加
2. Browser-in-Browser検出
3. Consent Phishing検出

## 検証計画

### スキャン比較テスト
1. BrowserTotal: https://browsertotal.com/browser-posture-scan
2. Battacker: pleno-audit拡張機能ダッシュボード
3. 検出結果の差分分析

### 評価指標
| 指標 | 説明 |
|------|------|
| Detection Rate | 検出された脅威の割合 |
| False Positive Rate | 誤検知率 |
| Coverage | カバーされる攻撃カテゴリ |
| Performance | スキャン実行時間 |

## 参考資料
- [BrowserTotal](https://browsertotal.com/)
- [B-ATT&CK Framework](https://seraphicsecurity.com/b-attack)
- [MITRE ATT&CK for Enterprise](https://attack.mitre.org/matrices/enterprise/)
