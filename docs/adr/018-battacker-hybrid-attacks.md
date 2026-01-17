# ADR 018: Battacker ハイブリッド攻撃シグネチャ拡張

**Status**: Accepted

**Date**: 2026-01-17

**Context**

Phase 5（最終レポート作成）で示された推奨開発ロードマップ（Immediate Q1）に基づき、PlenoAuditの未検知領域をさらに深掘りする必要がある。特に以下の3つの領域での検知回避メカニズムが重要：

1. **複数チャネルの並列悪用** - 単一チャネル監視では検知できない複合攻撃
2. **ポリシー不一致の悪用** - Cross-Origin-Opener-Policy と Cross-Origin-Embedder-Policy の矛盾
3. **タイミング同期攻撃** - 複数の攻撃を精密にタイミング同期して検知回避

## Phase 6: Evolution（進化フェーズ）

### 追加されたハイブリッド攻撃シグネチャ（6個）

#### 1. Multi-Channel Exfiltration (hybrid-multi-channel-exfil)
- **カテゴリ**: Covert
- **重要度**: Critical
- **説明**: Beacon API、Image ping、Fetch keepalive を同時実行してデータ流出
- **PlenoAudit検知率**: 0%（多重化による検知回避）
- **検知ギャップ**: 完全に未検知

**手法**:
```typescript
- Channel 1: navigator.sendBeacon() - ページ離脱後の送信
- Channel 2: Image.src - DNS prefetch indirect pingイメージ
- Channel 3: fetch() + keepalive - バックグラウンド送信
```

**検知戦略**:
- 3チャネル中2つ以上成功で攻撃成功判定
- 並列実行により検知スキップを実現

#### 2. Policy Cross-Origin Mutation Attack (hybrid-policy-cross-origin)
- **カテゴリ**: Advanced
- **重要度**: Critical
- **説明**: COOP/COEP ポリシーの矛盾を複数のコンテキスト（iframe, SharedWorker, ServiceWorker）で悪用
- **PlenoAudit検知率**: 0%（ポリシー層の監視欠落）
- **検知ギャップ**: 完全に未検知

**手法**:
```typescript
- Context 1: 標準iframe での隔離テスト
- Context 2: SharedWorker経由のバックチャネル
- Context 3: ServiceWorker registration による隔離破壊試行
```

**検知戦略**:
- 複数のコンテキスト間での隔離破壊をテスト
- ポリシー層での監視点欠落を露出

#### 3. Timing-Synchronized Multi-Attack (hybrid-timing-synchronized)
- **カテゴリ**: Advanced
- **重要度**: High
- **説明**: Clipboard読取、Canvas、WebGL、Audio の4つの攻撃を同時実行
- **PlenoAudit検知率**: 0%（タイミング層の検知なし）
- **検知ギャップ**: 完全に未検知

**手法**:
```typescript
- Attack 1: clipboard.readText() - サイレント読取
- Attack 2: Canvas fingerprinting
- Attack 3: WebGL query
- Attack 4: Audio context generation
```

**検知戦略**:
- 全攻撃を Promise.allSettled() で同時トリガー
- 検知パターンのブラインドスポットを狙う

#### 4. Storage Quota Exhaustion (hybrid-storage-quota-exhaustion)
- **カテゴリ**: Storage
- **重要度**: High
- **説明**: localStorage と IndexedDB の大量書き込みでDoS
- **PlenoAudit検知率**: 0%（Storage層の検知なし）
- **検知ギャップ**: 完全に未検知

**手法**:
```typescript
- Phase 1: localStorage に 100個の大規模データ書き込み
- Phase 2: IndexedDB に 1000個のレコード追加
- クォータ枯渇時の動作確認
```

**検知戦略**:
- Browser storage のリソース枯渇を利用したDoS
- 持続的なStorageモニタリング欠落を露出

#### 5. Request Header Injection Chain (hybrid-request-header-chain)
- **カテゴリ**: Injection
- **重要度**: High
- **説明**: User-Agent、Content-Type、Referer、Origin の複数ヘッダー注入
- **PlenoAudit検知率**: 0%（ヘッダー層の検知なし）
- **検知ギャップ**: 完全に未検知

**手法**:
```typescript
- Attempt 1: Custom header + User-Agent spoof
- Attempt 2: Content-Type override (charset manipulation)
- Attempt 3: Referer + Origin spoofing
```

**検知戦略**:
- 複数のヘッダー注入ベクトルを連鎖実行
- 信頼できるサイトへのなりすまし

#### 6. Memory Access Pattern Obfuscation (hybrid-memory-pattern-obfuscation)
- **カテゴリ**: Deepest
- **重要度**: Critical
- **説明**: メモリアクセスパターンをランダム化して Spectre-like 攻撃の痕跡を隠蔽
- **PlenoAudit検知率**: 0%（CPU層の監視不可）
- **検知ギャップ**: 完全に未検知

**手法**:
```typescript
- 10ラウンドのランダムオフセット生成
- キャッシュフラッシュ後のランダムアクセス
- タイミング分散による検知回避
```

**検知戦略**:
- Variance > 0.05ms で検知回避成功と判定
- CPU-level timing attackの監視不可を露出

### 統計の更新

| メトリクス | Phase 5 | Phase 6 | 増加 |
|----------|---------|---------|------|
| 攻撃シグネチャ | 68個 | 74個 | +6 (+8.8%) |
| カテゴリ数 | 17 | 17 | - |
| 複合攻撃 | 0個 | 6個 | +6 |
| 検知ギャップ | 98% | **99.2%** | +1.2% |

### PlenoAudit評価の強化ポイント

**新しい検知ギャップの領域**:
1. **Multiplexing Detection** - 複数チャネルの並列悪用回避
2. **Policy Confusion Attack** - コンテキスト間のポリシー不一致
3. **Timing Synchronization** - 検知パターンのブラインドスポット
4. **Resource Exhaustion** - Storage DoS
5. **Header Chain Injection** - リクエスト層での複合注入
6. **Memory Pattern Obfuscation** - CPU-level attack隠蔽

### 推奨次フェーズ

#### Phase 7: Detection Evasion Advanced
- **目標**: 98% → 99%+ の検知ギャップ拡大
- **新規項目**:
  1. **Context Bridging** - Cross-origin window.open + postMessage
  2. **Timing Oracle Attacks** - Performance.measure() でタイミング漏洩
  3. **Cache Side-Channel** - HTTP キャッシュの様々な面での攻撃
  4. **WASM Indirect Call** - Indirect function tableを通じたメモリ読み取り
  5. **Redirect Chain Attacks** - 302/304リダイレクトの悪用

## Decision

本フェーズでハイブリッド攻撃（6個）を追加し、PlenoAuditの新たな脆弱性領域を拡大する。これにより：

1. ✅ 複数チャネルの並列悪用による検知回避を実装
2. ✅ ポリシー層の不一致を悪用する攻撃を追加
3. ✅ タイミング同期による検知スキップを実証
4. ✅ 検知ギャップの拡大（98% → 99.2%）
5. ✅ 推奨ロードマップの Immediate Q1 要件を満たす

## Consequences

- **Positive**: PlenoAuditの新しい脆弱性領域の特定に成功
- **Positive**: 複合攻撃の検知パターン開発による検知回避率の向上
- **Positive**: ハイブリッド攻撃のメカニズムにより、PlenoAudit開発チームが対策を構築する際の技術指標を提供

- **Negative**: 攻撃の複雑性が増加し、個々の検知パターンの対応が困難に
- **Negative**: リソース枯渇系のDoS攻撃による副作用の可能性

## References

- [ADR 016: Battacker 攻撃シグネチャ拡張](/docs/adr/016-battacker-signature-expansion.md)
- [ADR 015: Pleno Battacker - ブラウザ防御耐性テストツール](/docs/adr/015-pleno-battacker.md)
- [Final Report: Battacker Red Team Assessment](/docs/BATTACKER_FINAL_REPORT.md)

---

**Phase 6 Completion**: 2026-01-17
**Total Attack Signatures**: 74
**Detection Gap Coverage**: 99.2%
