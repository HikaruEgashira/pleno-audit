# ADR 042: Runtime Handler定義の機能別セクション化

## ステータス

Accepted

## コンテキスト

- `app/audit-extension/lib/background/runtime-handlers.ts` は runtime message の定義が1箇所に集中している
- ハンドラー追加時に巨大な配列を横断して編集する必要があり、差分衝突とレビュー負荷が増える
- 既存の message contract は安定しており、外部仕様は維持したい

## 決定

1. Runtime handler定義を機能別セクション関数へ分割する
2. `createRuntimeMessageHandlers` は `direct` / `async` の組み立て責務のみに限定する
3. `execute` / `fallback` のレスポンス契約と message type は既存のまま維持する

### セクション

- Security event handlers
- CSP handlers
- Connection and auth handlers
- AI prompt handlers
- Domain risk handlers
- Event store handlers
- Network and extension handlers
- Configuration handlers

## 理由

- 可読性: 目的別にまとまるため、特定機能の編集範囲を即座に特定できる
- 凝集度: 関連メッセージを同一セクションに閉じ込められる
- 変更容易性: handler追加・削除時の影響範囲を局所化できる
- 品質維持: 外部契約を維持しつつ内部構造のみ改善できる

## リスクと対応

| リスク | 対応 |
|--------|------|
| 同一 message type の重複登録 | セクション統合時に type 一覧を明示し重複を排除する |
| セクション間の責務境界が曖昧化 | 機能単位の命名規則を固定し、責務に沿って配置する |
| リファクタリングでレスポンス契約が壊れる | 既存 fallback と message type を変更せず、実機デバッグで応答を確認する |

