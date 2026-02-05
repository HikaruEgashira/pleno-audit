# ADR-041: ドメインリスク検知（NRD/Typosquat）をサービスへ分離する

## ステータス
採用

## コンテキスト
`app/audit-extension/entrypoints/background.ts` が NRD 検知と Typosquat 検知の
キャッシュ管理、設定更新、イベント記録、アラート通知まで一括で持っていた。
この構造は以下を招く。

- 検知ロジック変更時に message routing 層までレビュー対象が広がる
- NRD/Typosquat の共通フロー（設定読込→検知→記録→通知）の見通しが悪い
- 背景処理の責務境界が曖昧で `background.ts` の肥大化を促進する

## 決定
NRD/Typosquat の業務ロジックを
`app/audit-extension/lib/background/domain-risk-service.ts` に分離する。

- `createDomainRiskService` で依存注入を受け、検知処理の状態を内部に閉じ込める
- `background.ts` はサービス生成と Runtime handler への配線のみ担当する
- 既存の message 契約（`CHECK_NRD` / `CHECK_TYPOSQUAT` / 各設定 API）は維持する

## 理由
- 可読性: 検知パイプラインを単一モジュールで追跡できる
- 凝集度: キャッシュ・検知器初期化・記録処理が同じ文脈で管理できる
- 変更容易性: 検知ロジック変更の影響範囲を `domain-risk-service.ts` に局所化できる
- 機能維持: 既存の保存先（Parquet/Storage）と通知条件を変更しない

## リスクと対応
- リスク: 依存注入の型境界が曖昧だと実行時エラーが潜む
- 対応: サービス依存を最小 API に限定し、build と実動デバッグで message 経路を確認する
