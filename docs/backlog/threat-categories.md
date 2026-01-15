# 脅威カテゴリ

## 実装済み

### 1. Shadow IT（未承認サービス）
- 検出されたサービス一覧
- AIプロンプト監視
- 関連イベント（login_detected, cookie_set, privacy_policy_found, terms_of_service_found）
- **ドメイン**: 企業承認外のサービス（SaaS等）
- **ユースケース**: シャドウITの可視化、未承認ツール検出

### 2. Phishing（フィッシング）
- Newly Registered Domain (NRD) 検出
- NRD関連イベント
- NRD検出設定（ageThreshold、heuristicThreshold）
- **ドメイン**: 新規登録ドメインでのフィッシング攻撃
- **ユースケース**: フィッシング詐欺検出、ドメイン年齢確認

### 3. Malware（マルウェア）
- CSP (Content Security Policy) 違反検出
- ネットワークリクエスト監視
- CSPポリシー生成・推奨事項
- CSP監査設定
- **ドメイン**: CSP違反を利用したマルウェア配信の検出
- **ユースケース**: 不正コンテンツ検出、ポリシー強化

### 4. Data Exfiltration（データ漏洩）✅ 完了
- 大量データ転送検出（100KB以上）
- fetch/XHR/beacon APIの監視
- DATA_EXFILTRATION_DETECTED イベント
- **PR**: #62

### 5. Credential Theft（認証情報窃取）✅ 完了
- フォーム送信監視（password, email, credit-card等）
- 非HTTPS送信検出、クロスオリジン検出
- CREDENTIAL_THEFT_DETECTED イベント
- **PR**: #63

### 6. Compliance（コンプライアンス違反）✅ 完了
- クッキーポリシー検出（多言語対応）
- クッキーバナー検出（Cookiebot, OneTrust等対応）
- GDPR準拠チェック（Accept/Reject/Settingsボタン）
- cookie_policy_found, cookie_banner_detected イベント
- **PR**: #65

### 7. Supply Chain（サプライチェーン攻撃）✅ 完了
- 外部スクリプト/スタイルシート監視
- SRI (Subresource Integrity) 検証
- 主要CDN検出（cdnjs, jsdelivr, unpkg等）
- SUPPLY_CHAIN_RISK_DETECTED イベント
- **PR**: #64

### 8. Policy Enforcement（ポリシー適用）✅ 完了
- ドメインポリシールール（exact/suffix/prefix/contains/regex）
- ツール/サービスポリシールール
- AIサービスポリシールール
- データ転送ポリシールール
- allow/block/warn アクション
- **PR**: #66

## 設計方針

1. **段階的実装**: 各脅威カテゴリは独立したタブとして実装
2. **フィルタリング**: EventLogはfilterTypesで各タブに関連するイベントのみ表示
3. **設定の分離**: 各脅威に固有の設定をタブ内に配置
4. **OWASP Top 10マッピング**:
   - Shadow IT → A06:2021 Vulnerable and Outdated Components
   - Phishing → A04:2021 Insecure Design
   - Malware → A03:2021 Injection + A05:2021 Security Misconfiguration
   - Data Exfiltration → A01:2021 Broken Access Control
   - Credential Theft → A07:2021 Identification and Authentication Failures
   - Compliance → A09:2021 Software and Data Integrity Failures
   - Supply Chain → A08:2021 Software and Data Integrity Failures
   - Policy Enforcement → Custom Implementation

## ファイル構造

```
app/extension/entrypoints/popup/
├── components/
│   ├── ShadowITTab.tsx         # Shadow ITタブ
│   ├── PhishingTab.tsx          # Phishingタブ
│   ├── MalwareTab.tsx           # Malwareタブ
│   ├── ServiceList.tsx          # サービス一覧
│   ├── NRDList.tsx              # NRD一覧（Phishing専用）
│   ├── AIPromptList.tsx         # AIプロンプト一覧
│   ├── EventLog.tsx             # イベントログ（フィルタ機能付き）
│   ├── ViolationList.tsx        # CSP違反一覧
│   ├── NetworkList.tsx          # ネットワークリクエスト一覧
│   ├── PolicyGenerator.tsx      # CSPポリシー生成
│   ├── CSPSettings.tsx          # CSP設定（Malware専用）
│   └── NRDSettings.tsx          # NRD設定（Phishing専用）
└── App.tsx                      # メインアプリ（3タブ構造）
```
