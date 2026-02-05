# ADR 039: Security Event Handlerのモジュール分離

## ステータス

Accepted

## コンテキスト

- `app/audit-extension/entrypoints/background.ts` にセキュリティイベント検知のハンドラが集中し、1ファイルの認知負荷が高い
- `data_exfiltration` / `credential_theft` / `xss` など複数イベントで、イベント記録・アラート通知・ログ出力の共通処理が繰り返される
- 既存のメッセージルーティング分離（ADR 035/037/038）に対して、セキュリティイベント処理だけが依然として密結合である

## 決定

- セキュリティイベント処理を `app/audit-extension/lib/background/security-event-handlers.ts` に分離する
- `createSecurityEventHandlers` に `addEvent` / `getAlertManager` / `checkDataTransferPolicy` / `extractDomainFromUrl` / `logger` を注入し、処理ロジックを純粋化する
- `background.ts` は依存配線とルーティングに責務を限定する

## 理由

- 可読性: セキュリティイベント処理の関心領域を単一モジュールで追跡できる
- 凝集度: イベントごとの記録・通知・ログ方針を同じ抽象で扱える
- 変更容易性: 新規イベント追加時に `background.ts` の巨大化を防げる
- 機能互換性: 既存のRuntime messageハンドラ契約を維持したまま内部実装のみ改善できる

## リスクと対応

| リスク | 対応 |
|--------|------|
| 依存注入の型不整合 | 既存ハンドラ署名に合わせたデータ型をモジュール側で公開する |
| イベントpayloadの差異混入 | 既存フィールド名・値の生成式を変更せず移送する |
| 監視ログの粒度変化 | 既存ログレベル（warn/debug）とメッセージ文言を維持する |
