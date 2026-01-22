# Jamf Pro + Chrome Enterprise によるエンタープライズ導入ガイド

このドキュメントでは、Jamf Pro MDMを使用してPleno Audit拡張機能をChrome Enterprise環境にデプロイする方法を説明します。

## 前提条件

- Jamf Pro 10.x以上
- Chrome Enterprise（Chrome Browser Cloud Management）
- OneLogin、Okta、Azure AD等のSAML/OIDC対応IdP

## 1. Chrome拡張機能のエンタープライズ配布

### 1.1 Chrome Browser Cloud Managementでの拡張機能設定

1. [Google Admin Console](https://admin.google.com/)にログイン
2. **デバイス** > **Chrome** > **アプリと拡張機能** に移動
3. 組織部門を選択
4. **+** > **Chrome ウェブストアから追加** を選択
5. Pleno Audit拡張機能ID（`[Extension ID]`）を入力
6. **インストールを強制**を選択

### 1.2 Jamf ProでのConfiguration Profile設定

Jamf Proで新しいConfiguration Profileを作成します。

**Configuration Profile > 新規作成**

```
一般:
  名前: Pleno Audit Enterprise Configuration
  カテゴリ: Security
  配布方法: Install Automatically
```

## 2. Managed Storage ポリシー設定

### 2.1 Chrome Enterprise Policy JSON

以下のJSONをConfiguration Profileの「Custom Settings」に追加します。

#### OneLogin OIDC設定例

```json
{
  "sso": {
    "provider": "oidc",
    "required": true,
    "clientId": "YOUR_ONELOGIN_CLIENT_ID",
    "authority": "https://YOUR_COMPANY.onelogin.com/oidc/2",
    "scope": "openid profile email"
  },
  "settings": {
    "locked": true,
    "enableNRD": true,
    "enableTyposquat": true,
    "enableAI": true,
    "enablePrivacy": true,
    "enableTos": true,
    "enableLogin": true,
    "enableExtension": true,
    "enableBlocking": false,
    "enableNotifications": true
  },
  "reporting": {
    "enabled": true,
    "endpoint": "https://your-siem.example.com/api/v1/browser-events",
    "apiKey": "YOUR_SIEM_API_KEY",
    "batchSize": 10,
    "flushIntervalSeconds": 60
  },
  "policy": {
    "allowedDomains": ["*.example.com", "*.trusted-partner.com"],
    "blockedDomains": ["*.malicious-site.com"],
    "allowedAIProviders": ["openai", "anthropic"],
    "blockedAIProviders": ["unverified-ai"]
  }
}
```

#### Azure AD OIDC設定例

```json
{
  "sso": {
    "provider": "oidc",
    "required": true,
    "clientId": "YOUR_AZURE_APP_CLIENT_ID",
    "authority": "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0",
    "scope": "openid profile email"
  },
  "settings": {
    "locked": true,
    "enableNRD": true,
    "enableTyposquat": true,
    "enableAI": true
  }
}
```

#### Okta SAML設定例

```json
{
  "sso": {
    "provider": "saml",
    "required": true,
    "entityId": "https://your-company.okta.com/app/pleno-audit",
    "entryPoint": "https://your-company.okta.com/app/pleno-audit/sso/saml",
    "issuer": "http://www.okta.com/exk1234567890"
  },
  "settings": {
    "locked": true
  }
}
```

### 2.2 Jamf Pro Custom Schema plist

Jamf Proで上記JSONをplistとして配布する場合:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDisplayName</key>
            <string>Chrome Extension Managed Policy - Pleno Audit</string>
            <key>PayloadIdentifier</key>
            <string>com.google.Chrome.extensions.YOUR_EXTENSION_ID</string>
            <key>PayloadType</key>
            <string>com.google.Chrome.extensions.YOUR_EXTENSION_ID</string>
            <key>PayloadUUID</key>
            <string>GENERATE-NEW-UUID</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>sso</key>
            <dict>
                <key>provider</key>
                <string>oidc</string>
                <key>required</key>
                <true/>
                <key>clientId</key>
                <string>YOUR_CLIENT_ID</string>
                <key>authority</key>
                <string>https://YOUR_COMPANY.onelogin.com/oidc/2</string>
            </dict>
            <key>settings</key>
            <dict>
                <key>locked</key>
                <true/>
            </dict>
        </dict>
    </array>
</dict>
</plist>
```

## 3. OneLogin OIDC アプリケーション設定

### 3.1 OneLogin管理コンソールでの設定

1. **Administration** > **Applications** > **Add App** を選択
2. **OpenID Connect (OIDC)** テンプレートを選択
3. 以下の設定を適用:

```
Application Name: Pleno Audit Browser Extension
Login URL: chrome-extension://YOUR_EXTENSION_ID/dashboard.html
Redirect URI: https://YOUR_EXTENSION_ID.chromiumapp.org/
```

### 3.2 Token設定

```
Access Token Expiration: 3600 (1時間)
Refresh Token: 有効
ID Token Claims:
  - sub
  - email
  - name
```

## 4. 検証手順

### 4.1 ポリシー適用の確認

1. 管理対象端末でChromeを起動
2. `chrome://policy` にアクセス
3. 拡張機能ポリシーが適用されていることを確認
4. `chrome://extensions` でPleno Auditがインストールされていることを確認

### 4.2 SSO認証フローの確認

1. 拡張機能アイコンをクリック
2. 「認証が必要です」通知が表示されることを確認
3. OneLogin認証画面にリダイレクトされることを確認
4. 認証成功後、ダッシュボードにアクセスできることを確認

### 4.3 設定ロックの確認

1. ポップアップで設定画面を開く
2. 「この設定は組織によって管理されています」バナーが表示されることを確認
3. 設定項目がグレーアウトされていることを確認

## 5. トラブルシューティング

### 5.1 SSO認証が開始されない

**症状**: 拡張機能起動時に認証画面が表示されない

**確認事項**:
1. `chrome://policy` でmanaged storage設定を確認
2. `sso.required` が `true` になっているか確認
3. `sso.provider` と関連設定が正しいか確認

**解決策**:
- Configuration Profileを再配布
- Chrome拡張機能を再読み込み

### 5.2 「Invalid client_id」エラー

**症状**: OneLogin認証画面で「Invalid client_id」エラー

**確認事項**:
1. OneLoginアプリケーション設定の`clientId`を確認
2. managed storageの`sso.clientId`と一致しているか確認

### 5.3 設定がロックされない

**症状**: ユーザーが設定を変更できてしまう

**確認事項**:
1. `settings.locked` が `true` に設定されているか確認
2. managed storageが正しく読み込まれているか確認

**デバッグ方法**:
1. Chrome DevToolsを開く（拡張機能のService Worker）
2. Console で `chrome.storage.managed.get(null, console.log)` を実行
3. 設定が正しく返却されるか確認

### 5.4 SIEM連携が動作しない

**症状**: セキュリティイベントがSIEMに送信されない

**確認事項**:
1. `reporting.enabled` が `true` か確認
2. `reporting.endpoint` が正しいか確認
3. ネットワークコンソールでエンドポイントへのリクエストを確認
4. CORS設定を確認

## 6. セキュリティ考慮事項

### 6.1 API Key保護

SIEM APIキーはmanaged storageに保存されるため、端末上では暗号化されています。ただし、以下の点に注意してください:

- APIキーはログに出力しない
- DevToolsでの表示に注意
- キーローテーションポリシーを策定

### 6.2 SSO設定のセキュリティ

- `client_secret` はChrome拡張機能では使用しない（PKCEフローを使用）
- `state` と `nonce` パラメータによるCSRF/リプレイ攻撃防止が有効

### 6.3 設定の監査

管理者は以下を定期的に確認してください:

1. managed storage設定が正しく適用されているか
2. SSO認証が正常に機能しているか
3. SIEMにイベントが送信されているか

## 7. 更新・ロールバック手順

### 7.1 ポリシー更新

1. Jamf ProでConfiguration Profileを更新
2. 変更を保存・配布
3. 端末でChromeを再起動（または`chrome://extensions`で再読み込み）

### 7.2 緊急ロールバック

問題発生時は以下の手順でロールバック:

1. Jamf ProでConfiguration Profileを削除
2. 端末でプロファイルを再同期
3. 拡張機能は非管理モードにフォールバック
