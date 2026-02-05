# ADR 040: Extension Network Serviceのモジュール分離

## ステータス

Accepted

## コンテキスト

- `app/audit-extension/entrypoints/background.ts` に、拡張機能ネットワーク監視・バッファ flush・リスク分析・統計集計が集中し、責務境界が曖昧である
- Runtime message層から参照される関数群が密結合で、変更時に副作用範囲の見積もりが難しい
- 開発環境のプリレンダーでは `chrome.declarativeNetRequest.ResourceType` が未初期化になる場合があり、モジュール読込時に失敗する問題がある

## 決定

- 拡張機能ネットワーク監視責務を `app/audit-extension/lib/background/extension-network-service.ts` に分離する
- `background.ts` はサービス生成と公開関数の委譲に限定し、Runtime message契約を維持する
- `packages/extension-runtime/src/network-monitor.ts` で DNR ResourceType を遅延解決し、API未初期化時は文字列リテラルをフォールバックとして扱う

## 理由

- 可読性: ネットワーク監視とイベントルーティングの関心を分離できる
- 凝集度: 監視設定・バッファ管理・分析ロジックを単一モジュールに閉じ込められる
- 変更容易性: 将来の監視仕様変更で `background.ts` の改修範囲を局所化できる
- 実行安定性: 開発時プリレンダーの初期化順序差分で起きる読込失敗を回避できる

## リスクと対応

| リスク | 対応 |
|--------|------|
| 委譲時の型不整合 | サービスの公開インターフェースを `RuntimeHandlerDependencies` と同等の引数形に合わせる |
| 監視設定更新時の挙動差異 | 既存の `setNetworkMonitorConfig` の停止→再初期化順序を維持する |
| DNR型フォールバックの実行差異 | 拡張実行時はChrome enumを優先し、フォールバックはAPI未初期化時のみ使用する |
