Chrome Extensionとして動作するCASBです。
サービスを特定しそのプライバシーポリシーなどの情報を整理して提供します。

## ドメインアーキテクチャ

このプロジェクトは2つのドメインで構成されています（ADR 008参照）:

### 1. CASBドメイン (`@service-policy-auditor/detectors`)

Cloud Access Security Brokerの機能を担う。

| 機能 | ファイル | 説明 |
|------|---------|------|
| サービス可視性 | `casb-types.ts` | DetectedService, CookieInfo |
| 認証検出 | `patterns.ts` | LOGIN_URL_PATTERNS（Shadow IT検出） |
| ポリシー検出 | `patterns.ts` | PRIVACY_*, TOS_*（コンプライアンス監視） |
| イベントログ | `casb-types.ts` | EventLog（監査ログ） |

### 2. ブラウザセキュリティドメイン (`@service-policy-auditor/csp`)

CSP（Content Security Policy）監査機能を担う。**SASEやCASBの概念には含まれない**独立したドメイン。

| 機能 | ファイル | 説明 |
|------|---------|------|
| CSP違反検出 | `types.ts` | CSPViolation, NetworkRequest |
| ポリシー生成 | `analyzer.ts` | CSPAnalyzer |
| 設定 | `constants.ts` | INITIATOR_TO_DIRECTIVE |

## ADR

必要に応じて、[ADR](./docs/adr/) を参照してください。
@docs/adr/README.md

プラン完了後、意思決定事項をADRとして記録もしくは更新してください。
