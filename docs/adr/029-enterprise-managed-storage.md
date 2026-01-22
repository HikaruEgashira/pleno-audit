# ADR 029: Enterprise Managed Storage

## ステータス

Accepted

## コンテキスト

エンタープライズ環境でのChrome拡張機能導入において、以下の要件が存在する:

1. **MDM統合**: Jamf Pro等のMDMを通じた拡張機能の配布と設定管理
2. **SSO強制**: OneLogin、Azure AD、Okta等のIdPによる認証の必須化
3. **設定ロック**: 管理者が設定した値をユーザーが変更できないようにする
4. **SIEM連携**: セキュリティイベントを企業のSIEMに送信する

Chrome Extension APIには`chrome.storage.managed`というエンタープライズ向けのストレージAPIが存在し、これを活用することで上記要件を満たすことができる。

## 決定

### 1. chrome.storage.managedの採用

Chrome Enterprise PolicyまたはMDMを通じて設定される`chrome.storage.managed`を使用する。

**理由**:
- Chromeネイティブのエンタープライズ機能
- ポリシーベースで読み取り専用（ユーザーは変更不可）
- JSON Schemaによる設定値の検証

### 2. Managed Schemaの設計

`manifest.json`に`storage.managed_schema`を追加し、以下の構造を定義:

```json
{
  "sso": { "provider", "required", "clientId", "authority", ... },
  "settings": { "locked", "enableNRD", "enableTyposquat", ... },
  "reporting": { "endpoint", "apiKey", "enabled", ... },
  "policy": { "allowedDomains", "blockedDomains", ... }
}
```

### 3. EnterpriseManagerの実装

`@pleno-audit/extension-runtime`パッケージに`EnterpriseManager`クラスを追加:

- `chrome.storage.managed`からの設定読み込み
- 設定変更の監視
- SSO設定の`SSOManager`への適用
- 有効設定値の取得（managed優先のマージロジック）

### 4. SSO強制フロー

エンタープライズ設定で`sso.required: true`の場合:

1. 拡張機能起動時に`EnterpriseManager`が初期化
2. SSO必須かつ未認証の場合、通知を表示しダッシュボード認証画面を開く
3. 認証完了までは一部機能が制限される

### 5. 設定ロックの実装

`settings.locked: true`の場合:

- UIコンポーネントにロックバナーを表示
- input要素を`disabled`に設定
- 設定変更APIを無効化

## 外部通信ポリシーとの整合性

### SSO認証

SSO認証フローは外部通信禁止ポリシーの**例外**とする。

**理由**:
1. エンタープライズ要件として必須機能
2. 管理者による明示的な設定が必要（ユーザー同意相当）
3. 認証完了後は外部通信不要（トークンはローカル保存）

### SIEM連携

SIEM連携も外部通信禁止ポリシーの**例外**とする。

**理由**:
1. エンタープライズ要件として必須機能
2. 管理者が明示的にエンドポイントを設定
3. 送信データはセキュリティイベントのみ（個人データは含まない）

## 代替案

### 代替案1: カスタムサーバーによる設定配信

独自サーバーから設定を取得する方式。

**不採用理由**:
- 外部通信禁止ポリシーに抵触
- Chromeネイティブの管理機能より劣る

### 代替案2: 設定ファイルのバンドル

ビルド時に設定を埋め込む方式。

**不採用理由**:
- 組織ごとの設定カスタマイズが困難
- 設定変更にビルド・配布が必要

## 影響

### ポジティブ
- エンタープライズ環境での導入が可能に
- MDMネイティブの管理機能を活用
- ユーザー体験を損なわず設定を強制

### ネガティブ
- 実装の複雑さが増加
- テストが困難（managed storageはポリシー設定が必要）

## 実装ファイル

| ファイル | 説明 |
|---------|------|
| `app/audit-extension/public/managed-schema.json` | Managed Storage JSON Schema |
| `app/audit-extension/wxt.config.ts` | manifest.jsonへのschema追加 |
| `packages/extension-runtime/src/enterprise-manager.ts` | EnterpriseManager実装 |
| `packages/extension-runtime/src/storage-types.ts` | 型定義追加 |
| `app/audit-extension/entrypoints/background.ts` | 起動時SSO強制、メッセージハンドラ |
| `app/audit-extension/entrypoints/popup/components/Settings.tsx` | 設定ロックUI |
| `app/audit-extension/entrypoints/popup/components/DetectionSettings.tsx` | 検出設定ロックUI |
| `docs/enterprise/jamf-deployment.md` | Jamfデプロイメントガイド |

## 関連ADR

- ADR 001: MVPはサーバーレスのブラウザ拡張機能として実装する
- ADR 003: Chrome Manifest V3 + WXT + Preactで実装する
