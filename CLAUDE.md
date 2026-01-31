CASB/Browser Security

## 構造

### ZTAパッケージ構造（NIST SP 800-207準拠）

```
packages/
├── control-plane/
│   ├── policy-engine/    - PolicyManager, TrustAlgorithm
│   └── policy-admin/     - EnterpriseManager
├── data-plane/
│   └── pep/              - BlockingEngine, AlertManager, CooldownManager
├── data-sources/
│   ├── cdm/              - ExtensionRiskAnalyzer, DoHMonitor, CookieMonitor
│   ├── id-management/    - SSOManager
│   └── activity-logs/    - Storage, ApiClient（将来移行予定）
├── siem/                 - ExtensionStatsAnalyzer
└── runtime-platform/     - Logger, BrowserAdapter, MessageHandler
```

### 独立ライブラリ

- `packages/detectors/` - CASBドメイン（サービス検出、認証検出）
- `packages/csp/` - CSP監査（違反検出、ポリシー生成、レポーター）
- `packages/nrd/` - NRDアルゴリズム
- `packages/typosquat/` - typosquattingアルゴリズム
- `packages/ai-detector/` - AI検出アルゴリズム
- `packages/api/` - REST API（Hono + parquet-storage）
- `packages/battacker/` - 防御テストツール

### レガシー（後方互換）

- `packages/extension-runtime/` - 新パッケージへのre-export shim
- `packages/alerts/` - pepへのre-export shim

### アプリケーション

- `app/audit-extension/` - Chrome拡張（WXT + Preact）

詳細: [ADR-034: ZTAパッケージ構造](./docs/adr/034-zta-package-structure.md)

## ロギング

`console.*`の代わりに`createLogger`を使用する

```typescript
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("module-name");

logger.debug("開発時のみ出力");
logger.info("情報ログ");
logger.warn("警告");
logger.error("エラー", error);
```

開発モードでは`pleno-debug logs`でリアルタイム監視可能。
dashboard.html, popup.htmlはbrowser操作不可。

## 動作確認

```bash
# Backgroundで開発環境を起動
pnpm dev

# 別プロセスでブラウザ操作
pnpm --filter @pleno-audit/debugger start browser open example.com
pnpm --filter @pleno-audit/debugger start status
```

## Product Policy

### 外部通信制御

**原則（Principle）**: デフォルトで外部通信を禁止する

これはpleno-auditの根幹をなすプライバシー保護の原則である。

#### OSS版（pleno-audit）

- **デフォルト**: 全ての外部通信を禁止
- **制御方式**: ユーザーのオプトイン（明示的な有効化）
- **対象機能**:
  - RDAP問い合わせ（NRD検出の精度向上）
  - リモートAPI同期
  - CSP違反レポート送信
- **実装**: oxlintで外部通信を静的検出し、`.oxlintrc.json`で明示的に除外された機能のみ実装可能

#### Enterprise版（pleno-audit-internal）

- **デフォルト**: 全ての外部通信を禁止（OSS版と同じ原則）
- **制御方式**: 管理者のポリシー設定による制御
- **対象機能**:
  - SIEM連携（Splunk、Wiz等）
  - Webhook通知
  - SSO認証（OIDC/SAML）
  - 外部統合（Slack、Jira、GitHub）
- **要件**: ユーザー同意とプライバシーポリシーの更新が必要

### ゼロトラスト実装方針

pleno-auditは**ローカル型ゼロトラスト**を実装する。

#### ローカル型ゼロトラスト（OSS版）

- **継続的な脅威検証**: ブラウザ内でCSP違反、ネットワークリクエスト、AIプロンプト等を監視
- **セッション単位のアクセス制御**: ブラウザセッションごとの脅威評価
- **デバイス整合性監視**: 拡張機能の権限、DoH設定等を監視
- **外部通信なし**: 全てローカルで完結

#### ネットワーク型ゼロトラスト（Enterprise版）

- **ローカル型の機能を継承**: 上記の全機能を保持
- **組織全体への拡張**: 管理者がポリシーで有効化した場合、SIEM連携により組織レベルの可視性を追加
- **明示的な制御**: ポリシー未設定時はローカル型として動作

#### NIST SP 800-207との整合性

NIST原則7「可能な限り多くの情報を収集」は、**外部送信を要求していない**。
- pleno-auditはローカルで情報を収集・分析し、セキュリティを高める
- Enterprise版では、管理者の判断で外部SIEMへの送信も選択可能
- これにより、個人のプライバシーと組織のセキュリティを両立

詳細: [ADR-033: 外部通信制御ポリシー](./docs/adr/033-external-communication-policy.md)

### 外部DB禁止
- GETではあるが、通信しないというポリシーに従って外部DB（脆弱性DB、Blacklist）へのアクセスは禁止する
- ローカルで完結するアルゴリズムを考案すること。（例：typosquattingはヒューリスティックアルゴリズムのみ適用されています）
- ローカルであろうと、特定のサービスのみに適用可能なパターン検出も基本禁止です。
- 未知のサービスへの柔軟性を高める意味があります。
- 新しいサービスが生まれた場合の継続的なアップデート負荷軽減を考えた上での軽量DB導入はユーザーの同意を得た上でバンドル可能です。

## ブランチ運用

- `main` - 開発ブランチ（pushごとにcanary release作成）

### 開発フロー

1. mainからfeatureブランチを作成
2. featureブランチで開発・テスト
3. mainにPR作成 → マージ → canary release自動作成

### リリースフロー

1. canary releaseを人間がレビュー
2. create-release-prワークフローを実行
3. バージョンバンプ+CHANGELOG更新がmainにpush
4. stable release自動作成

## ADR

@docs/adr/README.md
