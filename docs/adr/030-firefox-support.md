# ADR 030: Firefox Support

## ステータス

Accepted

## コンテキスト

Pleno Auditは当初Chrome MV3のみをターゲットとしていたが（ADR-003）、WXTフレームワークの採用により、Firefox対応が技術的に可能になった。クロスブラウザ対応によりユーザーベースを拡大できる。

### 課題

1. **API差異**: Chrome MV3とFirefox MV2では利用可能なAPIが異なる
2. **SSO機能**: `chrome.identity` APIはFirefoxで限定的にしかサポートされていない
3. **Enterprise機能**: `chrome.storage.managed`はFirefoxで未サポート
4. **コンテンツスクリプト**: MV3の`world: "MAIN"`はFirefox MV2で未サポート

## 決定

### 1. Firefox MV2対応

WXTの`wxt build -b firefox`でFirefox MV2ビルドを生成する。

**理由**:
- WXTが既にMV2/MV3の変換をサポート
- Firefox MV3は2024年時点でまだ完全ではない
- MV2で十分な機能を提供可能

### 2. Browser API互換層

`@pleno-audit/extension-runtime`に`browser-adapter.ts`を拡張し、以下の互換層を提供:

```typescript
// ブラウザ検出
export const isFirefox: boolean;
export const isChrome: boolean;

// API取得（browser/chrome統一）
export function getBrowserAPI(): typeof chrome;

// 機能検出
export function hasSessionStorage(): boolean;  // Chrome MV3 only
export function hasManagedStorage(): boolean;  // Chrome only
export function hasIdentityAPI(): boolean;     // Chrome only
export function isManifestV3(): boolean;

// Session Storage fallback
export async function getSessionStorage<T>(key: string): Promise<T | undefined>;
export async function setSessionStorage<T>(key: string, value: T): Promise<void>;
export async function removeSessionStorage(key: string): Promise<void>;
```

### 3. 機能の段階的劣化（Graceful Degradation）

Firefoxで利用できないChrome固有機能は、適切なフォールバックまたは機能制限を行う:

| 機能 | Chrome MV3 | Firefox MV2 | 対応方針 |
|------|-----------|-------------|----------|
| SSO (OIDC/SAML) | `chrome.identity` | 未サポート | エラーメッセージ表示、Chrome使用を推奨 |
| Enterprise Managed Storage | `chrome.storage.managed` | 未サポート | 自動的に無効化 |
| Session Storage | `chrome.storage.session` | 未サポート | `sessionStorage` にフォールバック |
| content script `world: "MAIN"` | サポート | 未サポート | AI hooks が ISOLATED で動作（一部機能制限） |

### 4. ビルド・リリースフロー

CI/CDで両ブラウザ向けビルドを生成:

```yaml
# release.yml
- name: Build extensions
  run: |
    pnpm build              # Chrome MV3
    pnpm build:firefox      # Firefox MV2

- name: Create artifacts
  run: |
    cd dist/chrome-mv3 && zip pleno-audit-chrome.zip .
    cd dist/firefox-mv2 && zip pleno-audit-firefox.zip .
```

### 5. マニフェスト差異

WXTが自動的に処理する主な差異:

| 項目 | Chrome MV3 | Firefox MV2 |
|------|-----------|-------------|
| `manifest_version` | 3 | 2 |
| Background | Service Worker | Background Script |
| Action | `action` | `browser_action` |
| CSP | オブジェクト形式 | 文字列形式 |
| Host Permissions | `host_permissions` | `permissions`に含む |
| Web Resources | オブジェクト配列 | 文字列配列 |

## 代替案

### 代替案1: Firefox対応を行わない

現状維持でChrome専用とする。

**不採用理由**:
- WXTにより追加工数が最小限
- ユーザーベース拡大の機会損失

### 代替案2: Firefox MV3を待つ

Firefox MV3の完全サポートを待つ。

**不採用理由**:
- 時期が不明確
- MV2でも十分な機能を提供可能

## 影響

### ポジティブ
- ユーザーベースの拡大
- クロスブラウザ互換性の確保
- プライバシー重視ユーザーへのリーチ

### ネガティブ
- Firefox向けSSO/Enterprise機能は利用不可
- テストマトリクスの増加
- 一部AI監視機能が制限される可能性

### Firefox固有の制限事項

1. **SSO認証**: 利用不可（Chrome専用機能）
2. **Enterprise管理**: 利用不可（MDM/GPO経由の設定配信なし）
3. **AIプロンプト監視**: `world: "MAIN"`未サポートにより、一部サービスでの監視が制限される可能性

## 実装ファイル

| ファイル | 説明 |
|---------|------|
| `packages/extension-runtime/src/browser-adapter.ts` | ブラウザ互換層 |
| `packages/extension-runtime/src/storage.ts` | getBrowserAPI()使用に変更 |
| `packages/extension-runtime/src/sso-manager.ts` | hasIdentityAPI()による機能検出 |
| `packages/extension-runtime/src/enterprise-manager.ts` | hasManagedStorage()による機能検出 |
| `app/audit-extension/package.json` | `build:firefox`コマンド追加 |
| `app/audit-extension/wxt.config.ts` | MV2/MV3分岐ロジック |
| `.github/workflows/release.yml` | Firefoxビルド追加 |

## 関連ADR

- ADR 001: MVPはサーバーレスのブラウザ拡張機能として実装する
- ADR 003: Chrome Manifest V3 + WXT + Preactで実装する
- ADR 029: Enterprise Managed Storage（Chrome専用機能）
