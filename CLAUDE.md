CASB/Browser Security

## 構造

- `packages/detectors/` - CASBドメイン（サービス検出、認証検出）
- `packages/csp/` - CSP監査（違反検出、ポリシー生成、レポーター）
- `packages/nrd/` - NRDアルゴリズム
- `packages/typosquat` - typosquattingアルゴリズム
- `packages/ai-detector` - AI検出アルゴリズム
- `packages/api/` - REST API（Hono + parquet-storage）
- `packages/extension-runtime/` - 拡張機能ランタイム（ストレージ、API クライアント、同期）
- `app/audit-extension/` - Chrome拡張（WXT + Preact）

詳細は各パッケージの`index.ts`を参照。

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

### 外部DB禁止
- GETではあるが、通信しないというポリシーに従って外部DB（脆弱性DB、Blacklist）へのアクセスは禁止する
- ローカルで完結するアルゴリズムを考案すること。（例：typosquattingはヒューリスティックアルゴリズムのみ適用されています）
- ローカルであろうと、特定のサービスのみに適用可能なパターン検出も基本禁止です。
- 未知のサービスへの柔軟性を高める意味があります。
- 新しいサービスが生まれた場合の継続的なアップデート負荷軽減を考えた上での軽量DB導入はユーザーの同意を得た上でバンドル可能です。

## ブランチ運用

- `main` - 安定版リリース（PR必須、障害対応時はforce push可）
- `canary` - 開発版リリース（pushごとにcanaryリリース作成）

### 開発フロー

1. canaryからworktreeを作成
2. worktreeで開発・テスト
3. canaryにマージ → canaryリリース自動作成
4. 安定版リリース時はcanary→mainへPR作成

## ADR

@docs/adr/README.md
