# ADR 008: Core パッケージのドメインモデル明確化

## ステータス

Proposed

## コンテキスト

`@service-policy-auditor/core` パッケージは現在、以下の4つの責務を担っている：

1. **型定義（types.ts）**: データ構造の定義
2. **検出パターン（patterns.ts）**: URL/テキスト判定用正規表現
3. **CSP定数（csp-constants.ts）**: CSP関連の設定値
4. **URLユーティリティ（url-utils.ts）**: URL操作関数

ADR-007では「共通ユーティリティ層」として導入されたが、SASE/CASBドメインの観点からは、これらの責務はより明確なドメイン境界を持つべきである。

### SASE/CASBにおけるドメイン概念

**SASE (Secure Access Service Edge)** と **CASB (Cloud Access Security Broker)** の文脈では：

| 概念 | 説明 | 該当ファイル |
|------|------|------------|
| **サービス可視性** | SaaSサービスの検出・識別 | types.ts (DetectedService, CookieInfo) |
| **ポリシー検出** | Privacy Policy, ToS等の法的文書検出 | patterns.ts (PRIVACY_*, TOS_*) |
| **認証検出** | ログイン・セッション検出 | patterns.ts (LOGIN_*, SESSION_*) |
| **セキュリティ監査** | CSP違反・ネットワーク監視 | types.ts (CSP*), csp-constants.ts |
| **共通インフラ** | URL処理等の技術基盤 | url-utils.ts |

現状の問題点：
1. **ドメイン境界の曖昧さ**: 「共通ユーティリティ」という命名がドメイン概念を隠蔽
2. **責務の混在**: サービス可視性とセキュリティ監査が同一パッケージに存在
3. **型の肥大化**: types.tsが155行に達し、異なるドメイン概念が混在

## 決定

`core` パッケージの責務を以下のドメインモデルとして明確化する：

### ドメインモデル定義

```
core/
├── types.ts           # ドメインエンティティ（すべてのバウンデッドコンテキストで共有）
├── patterns.ts        # 検出ドメインの知識（Detection Domain Knowledge）
├── csp-constants.ts   # CSP監査ドメインの知識（Security Audit Domain Knowledge）
└── url-utils.ts       # 技術インフラ（Infrastructure）
```

### 責務の定義

#### 1. ドメインエンティティ層 (types.ts)
**責務**: すべてのバウンデッドコンテキストで共有されるデータ構造の定義

| カテゴリ | 型 | ドメイン |
|----------|-----|---------|
| サービス可視性 | `DetectedService`, `CookieInfo` | SaaS Discovery |
| イベント | `EventLog`, `EventLogBase` | Event Sourcing |
| ストレージ | `StorageData` | Persistence |
| CSP監査 | `CSPViolation`, `NetworkRequest`, `GeneratedCSPPolicy` | Security Audit |

#### 2. 検出ドメイン知識層 (patterns.ts)
**責務**: サービス・ポリシー検出のためのパターンマッチング知識

| サブドメイン | パターン | 目的 |
|-------------|---------|------|
| 認証検出 | `LOGIN_URL_PATTERNS` | Shadow IT検出 |
| プライバシーポリシー検出 | `PRIVACY_*_PATTERNS` | コンプライアンス監視 |
| 利用規約検出 | `TOS_*_PATTERNS` | リスク評価 |
| セッション検出 | `SESSION_COOKIE_PATTERNS` | アクセス追跡 |

#### 3. CSP監査ドメイン知識層 (csp-constants.ts)
**責務**: Content Security Policy監査のための設定・定数

| 定数 | 目的 |
|------|------|
| `INITIATOR_TO_DIRECTIVE` | リクエストタイプからCSPディレクティブへのマッピング |
| `STRICT_DIRECTIVES` | 厳格モード用ディレクティブ |
| `REQUIRED_DIRECTIVES` | 必須ディレクティブ |
| `DEFAULT_CSP_CONFIG` | デフォルト設定 |

#### 4. 技術インフラ層 (url-utils.ts)
**責務**: ドメインに依存しないURL処理ユーティリティ

### パッケージ境界の維持

現時点ではファイル分割は行わず、以下の原則で境界を維持する：

1. **単一責任**: 各ファイルは1つのドメイン概念のみを扱う
2. **依存方向**: `url-utils.ts` ← `patterns.ts` ← 他パッケージ
3. **型の分離**: 将来的にCSP関連型を別パッケージに移行する余地を残す

### 将来の分割指針

以下の条件を満たした場合、パッケージ分割を検討：

- CSP関連コードが200行を超える
- CSP専用のテストスイートが必要になる
- 他プロジェクトでCSP機能のみを再利用したい

分割案：
```
packages/
├── core/           # サービス可視性 + 検出パターン
├── csp-core/       # CSP監査ドメイン（将来）
└── infra/          # 共通インフラ（将来）
```

## 結果

### メリット
- **ドメイン境界の明確化**: SASE/CASBの概念がコードに反映される
- **コミュニケーション改善**: ドメインエキスパートとの会話が容易になる
- **拡張性**: 新しいドメイン概念の追加場所が明確

### トレードオフ
- **即時のリファクタリングなし**: 既存コードへの影響を最小化
- **ドキュメント依存**: コード構造だけでは境界が見えにくい

## 関連ADR

- ADR 004: プライバシーポリシー検出
- ADR 006: 利用規約検出機能
- ADR 007: 共通ユーティリティ層の導入
