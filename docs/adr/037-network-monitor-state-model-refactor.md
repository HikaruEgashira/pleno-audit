# ADR 037: Network Monitorの状態管理を集約する

## ステータス

Accepted

## コンテキスト

- `packages/extension-runtime/src/network-monitor.ts` はグローバル変数が分散し、状態遷移の把握が難しい
- DNRルール生成・コールバック通知・ExtensionRecord変換の重複があり、変更時の確認範囲が広い
- `excludedDomains` / `excludedExtensions` の判定がリクエストごとに線形探索となり、監視負荷が増える

## 決定

- Network Monitorの可変状態を `state` に集約し、関連処理を同一モジュール内で管理する
- DNRルール生成、DNRチェック可否判定、コールバック通知、ExtensionRecord変換を共通関数に抽出する
- 除外対象は `Set` キャッシュを保持し、判定コストを O(1) にする
- 外部API（`createExtensionMonitor` などの後方互換エイリアス）は維持する

## 理由

- 可読性: 状態の入口を1つにすると、挙動追跡が容易になる
- 凝集度: DNR関連ロジックを近接配置すると、仕様変更時の局所性が高まる
- パフォーマンス: 高頻度パスである除外判定の探索コストを削減できる
- 変更容易性: 共通化により同種変更の漏れを抑制できる

## リスクと対応

| リスク | 対応 |
|--------|------|
| 状態集約で初期化順序の不整合が発生する | 既存の起動順（listener登録→拡張一覧更新→DNR復元）を維持する |
| DNRルール操作の挙動差分が混入する | ルールID範囲・resourceTypes・quotaバックオフ条件を変更しない |
| 後方互換APIの破壊 | 既存export名と `createExtensionMonitor` の変換仕様を維持する |
