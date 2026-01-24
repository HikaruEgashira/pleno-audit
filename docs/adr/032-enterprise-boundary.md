# ADR-032: Enterprise境界の設定とリポジトリ分離

## ステータス
Accepted

## コンテキスト

ADR-031のGrafana戦略に基づき、OSS/Enterprise機能を明確に分離する必要がある。
Grafanaと同様のオープンコアモデルを採用し、コア検出機能をOSSとして公開し、
エンタープライズ向け高度機能を別リポジトリで管理する。

## 決定

### リポジトリ構成

```
pleno-audit (Public OSS)
├── packages/
│   ├── ai-detector      # AI検出アルゴリズム
│   ├── csp              # CSP監査
│   ├── nrd              # NRD検出
│   ├── typosquat        # タイポスクワッティング
│   ├── detectors        # 検出統合
│   ├── storage          # ローカルストレージ
│   ├── api              # REST API
│   ├── data-export      # 基本エクスポート (JSON/CSV)
│   ├── extension-runtime # ランタイム基盤
│   └── battacker        # テストツール
└── app/
    ├── audit-extension  # Chrome/Firefox拡張 (OSS版)
    └── battacker-extension

pleno-audit-internal (Private Enterprise)
├── packages/
│   ├── enterprise-runtime  # SSO Manager, Enterprise Manager
│   ├── integrations        # SIEM連携 (Webhook/Slack/Jira/Wiz)
│   ├── policy-engine       # 高度ポリシーエンジン
│   ├── compliance          # コンプライアンスレポート
│   ├── risk-prioritization # リスク優先度付け
│   ├── runtime-protection  # ランタイム脅威検出
│   ├── permission-analyzer # CIEM風パーミッション分析
│   ├── alerts              # アラートシステム
│   ├── security-graph      # セキュリティグラフ
│   ├── predictive-analysis # 予測分析
│   ├── threat-intel        # 脅威インテリジェンス
│   ├── identity-security   # ID/パスワード分析
│   └── parquet-storage     # 高度ストレージ
└── app/
    └── audit-extension-enterprise  # Enterprise版拡張
```

### 機能境界

| 機能カテゴリ | OSS | Enterprise |
|-------------|-----|------------|
| **検出** | CASB, CSP, NRD, Typosquat, AI基本 | - |
| **ストレージ** | IndexedDB, sql.js | Parquet |
| **エクスポート** | JSON, CSV | Markdown, HTML レポート |
| **認証** | - | SSO (OIDC/SAML), MDM統合 |
| **ポリシー** | - | カスタムルール無制限 |
| **コンプライアンス** | - | SOC2, GDPR, ISO27001 |
| **統合** | - | SIEM, Slack, Jira, Wiz |
| **分析** | 基本ダッシュボード | セキュリティグラフ, 予測分析 |
| **アラート** | - | 高度ルール, クーリングダウン |

### 依存関係

```
pleno-audit-internal
  └── depends on → pleno-audit (npm package)
```

Enterprise版はOSS版をnpm依存として参照し、拡張する形式。

### extension-runtime の分離

現在のextension-runtimeから以下をenterprise-runtimeに移動:

**移動対象:**
- `sso-manager.ts` - OIDC/SAML認証
- `enterprise-manager.ts` - 管理ポリシー適用
- `cooldown-manager.ts` - アラートクーリング (Enterpriseのみ使用)

**OSS版に残す:**
- `storage.ts` - 基本ストレージ
- `api-client.ts` - APIクライアント
- `sync-manager.ts` - 同期管理
- `browser-adapter.ts` - ブラウザ抽象化
- `message-router.ts` - メッセージング
- `logger.ts` - ロギング
- `cookie-monitor.ts` - Cookie監視
- `extension-monitor.ts` - 拡張機能監視
- `blocking-engine.ts` - ブロッキング (OSS版は基本機能のみ)
- `doh-monitor.ts` - DoH監視

### パッケージ名

| 種別 | スコープ |
|------|---------|
| OSS | `@pleno-audit/*` |
| Enterprise | `@pleno-audit-internal/*` |

### ライセンス

| リポジトリ | ライセンス |
|-----------|----------|
| pleno-audit | AGPL-3.0 (Grafana同様) |
| pleno-audit-internal | Proprietary |

## 理由

1. **Grafanaモデルの踏襲**: 検出機能はOSSで広く普及させ、Enterprise機能で収益化
2. **明確な価値分離**: 個人/小規模チームはOSSで十分、大規模組織はEnterprise
3. **依存関係の単純化**: Enterprise → OSS の一方向依存
4. **コミュニティ貢献**: コア検出アルゴリズムへの貢献を促進

## 結果

### 期待される効果
- OSSコミュニティからの検出アルゴリズム改善
- Enterprise版の明確な価値提案
- 導入企業のセキュリティ要件（SSO/SIEM）への対応

### 移行作業
1. pleno-audit-internal リポジトリ作成 (Private)
2. Enterpriseパッケージの移動
3. extension-runtime の分離
4. 依存関係の再構築
5. CI/CD の設定

## 関連ADR

- ADR-029: Enterprise Managed Storage
- ADR-031: Grafana戦略を参考にしたビジネスモデル設計
