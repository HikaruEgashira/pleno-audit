# Service Policy Auditor

Browserを通してアクセスするWebサービスの利用状況を可視化し、プライバシーリスクを管理するChrome拡張機能（CASB）です。

## Features

- Local First: すべてのデータ処理はブラウザ内で完結します。外部DBも用いません。
- Service Detection: ドメイン・Cookie・ネットワークリクエストからサービスを特定
- Privacy Policy Detection: 独自アルゴリズムでプライバシーポリシーを特定
- CSP Auditor: Content Security Policy違反の検出・レポート
- Policy Generator: 検出された通信先から推奨CSPを生成

## Documentation

詳細な設計判断については [ADR (Architecture Decision Records)](./docs/adr/README.md) を参照してください。

## License

AGPL 3.0
