# ADR 008: Core パッケージの廃止とドメイン分割

## ステータス

Accepted

## コンテキスト

`@pleno-audit/core` パッケージは現在、以下の4つの責務を担っている

1. **型定義（types.ts）**: データ構造の定義
2. **検出パターン（patterns.ts）**: URL/テキスト判定用正規表現
3. **CSP定数（csp-constants.ts）**: CSP関連の設定値
4. **URLユーティリティ（url-utils.ts）**: URL操作関数

### 問題点

1. **「core」という曖昧な命名**: ドメイン概念を反映していない
2. **責務の混在**: 2つの異なるドメインが同一パッケージに存在
   - CASBドメイン（サービス可視性、ポリシー検出）
   - ブラウザセキュリティドメイン（CSP監査）
3. **依存の集中**: すべてのパッケージがcoreに依存する構造

### ドメイン分析

このプロジェクトには**2つの異なるドメイン**が存在する

#### 1. CASBドメイン（Cloud Access Security Broker）

SaaSサービスの可視化とリスク評価を担う。

| 概念 | 説明 | 現在の場所 |
|------|------|------------|
| **サービス可視性** | SaaSサービスの検出・識別 | types.ts (DetectedService, CookieInfo) |
| **ポリシー検出** | Privacy Policy, ToS等の法的文書検出 | patterns.ts (PRIVACY_*, TOS_*) |
| **認証検出** | ログイン・セッション検出 | patterns.ts (LOGIN_*, SESSION_*) |

#### 2. ブラウザセキュリティドメイン

CSP（Content Security Policy）はブラウザのセキュリティ機構であり、**SASEやCASBの概念には含まれない**。

| 概念 | 説明 | 現在の場所 |
|------|------|------------|
| **CSP監査** | CSP違反の検出・分析 | types.ts (CSPViolation, CSPReport) |
| **ポリシー生成** | ネットワークリクエストからのCSP自動生成 | csp-constants.ts |

## 決定

`@pleno-audit/core` パッケージを廃止し、ドメインごとに分割する。

### 分割後の構造

```
packages/
├── detectors/          # CASBドメイン: サービス検出
│   ├── src/
│   │   ├── types.ts           # DetectedService, CookieInfo, EventLog等
│   │   ├── patterns.ts        # LOGIN_*, PRIVACY_*, TOS_*, SESSION_*
│   │   ├── url-utils.ts       # URL処理ユーティリティ
│   │   └── ...
│   └── package.json
│
└── csp/                # ブラウザセキュリティドメイン: CSP監査
    ├── src/
    │   ├── types.ts           # CSPViolation, NetworkRequest, CSPReport等
    │   ├── constants.ts       # INITIATOR_TO_DIRECTIVE, STRICT_DIRECTIVES等
    │   └── ...
    └── package.json
```

### マイグレーション計画

#### Phase 1: 型の移動
- `DetectedService`, `CookieInfo`, `EventLog`等 → `@detectors/types.ts`
- `CSPViolation`, `NetworkRequest`, `CSPReport`等 → `@csp/types.ts`

#### Phase 2: ユーティリティの移動
- `patterns.ts` → `@detectors/patterns.ts`（既存のimportパスを維持）
- `url-utils.ts` → `@detectors/url-utils.ts`
- `csp-constants.ts` → `@csp/constants.ts`

#### Phase 3: coreパッケージの削除
- 依存パッケージのimportを更新
- `@pleno-audit/core` を削除

### 依存関係の変更

**Before:**
```
extension → core
         → detectors → core
         → csp → core
```

**After:**
```
extension → detectors (CASB機能)
         → csp (CSP機能)
```

## 結果

### メリット
- **ドメイン境界の明確化**: パッケージ名がドメインを反映
- **依存関係の簡素化**: 「core」という抽象的な依存がなくなる
- **独立性の向上**: 各ドメインが独立して進化可能

### トレードオフ
- **マイグレーションコスト**: import文の更新が必要
- **型の重複リスク**: 共通型（EventLog等）の扱いに注意が必要

### 共通型の扱い

`EventLog`のようにCSPとCASB両方で使用される型は、以下のいずれかで対応

1. **detectors側に配置**: CASBがメインドメインのため
2. **interface拡張**: CSP側で独自のイベント型を定義し、detectors側のEventLogBaseを拡張

## 関連ADR

- ADR 004: プライバシーポリシー検出
- ADR 006: 利用規約検出機能
- ADR 007: 共通ユーティリティ層の導入（本ADRにより superseded）
