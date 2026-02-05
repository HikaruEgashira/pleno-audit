# ADR 044: Background Servicesの機能別モジュール分割

## ステータス

Accepted

## コンテキスト

- `app/audit-extension/lib/background/background-services.ts` が単一ファイルに集約され、責務の切り分けが難しい
- 変更時に関連機能の範囲が広くなり、レビュー・修正の負担が高い
- 既存の外部API（呼び出し側の関数シグネチャ）は維持する必要がある

## 決定

1. `background-services` を機能別モジュールに分割する
2. エントリの `createBackgroundServices` は状態保持と依存結線のみに責務を限定する
3. public API は既存の関数名・戻り値・動作を維持する

### 分割対象

- state: 内部状態の管理
- client: API client / sync manager の初期化
- events: ParquetStore と event 追加
- alerts: alert/policy 管理と通知
- storage: local storage の更新とキュー
- config: 各種設定とデータクリーンアップ
- analysis: ページ解析結果の処理
- utils: ドメイン抽出ユーティリティ

## 理由

- 可読性: 機能単位でファイルが分かれるため探索コストを下げられる
- 凝集度: 各モジュールの責務が明確になり、変更範囲を局所化できる
- 変更容易性: 依存関係が整理されるため将来の拡張が容易になる
- パフォーマンス: 既存の処理フローは維持しつつ、初期化の責務を明示できる

## リスクと対応

| リスク | 対応 |
|--------|------|
| モジュール分割で既存の振る舞いが変わる | public API を維持し、実機デバッグで動作確認する |
| 依存関係が循環する | entrypoint で依存を結線し、各モジュールは state 経由で参照する |
| 追加ファイルで探索が煩雑化する | ADR と分割方針を記録し、命名を統一する |
