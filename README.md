# Service Policy Auditor

Browserを通してアクセスするWebサービスの利用状況を可視化し、プライバシーリスクを管理するChrome拡張機能（CASB/Browser Security）です。

## Features

- Local First: すべてのデータ処理はブラウザ内で完結します。外部DBも用いません
- Shadow IT
    - Service Detection: ドメイン・Cookie・ネットワークリクエストからサービスを特定
    - Service Policy Detection: 独自アルゴリズムでプライバシーポリシー／利用規約を特定
    - AIプロンプト検出
- Phishing
    - NRD(Newly Registered Domain)検出
- Malware
    - CSP Auditor: Content Security Policy違反の検出・レポート・ポリシー生成

## Screenshots

### Dashboard

![Dashboard](./docs/assets/dashboard.png)

### Popup

| Sessions | Domains | Requests |
|----------|---------|----------|
| ![Sessions](./docs/assets/popup-sessions.png) | ![Domains](./docs/assets/popup-domains.png) | ![Requests](./docs/assets/popup-requests.png) |

## Documentation

詳細な設計判断については [ADR (Architecture Decision Records)](./docs/adr/README.md) を参照してください。

## License

AGPL 3.0
