# Service Policy Controller

AIサービスの利用状況を可視化し、プライバシーリスクを管理するChrome拡張機能（CASB）です。

## Features

### Local First

すべてのデータ処理はブラウザ内で完結します。

- サーバーへのデータ送信なし
- ブラウジング履歴は端末に留まる
- インストールするだけで即利用可能

### Privacy Policy Detection

プライバシーポリシーURLを自動検出します。

- URLパターンマッチング: `/privacy`, `/privacy-policy` などの標準パスを検出
- リンクテキスト検索: フッターの「プライバシーポリシー」リンクを特定
- 多言語対応: 英語・日本語のパターンに対応

### その他の機能

- Service Detection: ドメイン・Cookie・ネットワークリクエストからサービスを特定
- CSP Auditor: Content Security Policy違反の検出・レポート
- Policy Generator: 検出された通信先から推奨CSPを生成

## Architecture

```
├── packages/core/     # 共通ロジック（型定義、パターンマッチング）
├── app/extension/     # Chrome拡張機能（WXT + Preact）
├── app/server/        # レポート収集サーバー（将来拡張用）
└── docs/adr/          # Architecture Decision Records
```

## Getting Started

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm dev

# ビルド
pnpm build
```

## Documentation

詳細な設計判断については [ADR (Architecture Decision Records)](./docs/adr/README.md) を参照してください。

## License

AGPL 3.0
