# ADR 043: Extension Monitor互換レイヤでNetwork Monitor実装へ一本化する

## ステータス

Accepted

## コンテキスト

- `packages/extension-runtime/src/extension-monitor.ts` と `packages/extension-runtime/src/network-monitor.ts` が同種の監視ロジックを個別実装している
- 機能追加やバグ修正時に2系統へ同時反映が必要となり、仕様乖離と修正漏れのリスクがある
- `extension-monitor` のdeep import利用を即時に廃止すると、既存呼び出し側の互換性を損なう可能性がある
- `app/audit-extension/lib/background/extension-network-service.ts` は変換・集計・副作用が混在し、変更時の影響範囲が読みにくい

## 決定

1. 監視機能の実装ソースは `network-monitor` に統一する
2. `extension-monitor` は互換ファサードとして維持し、旧APIシグネチャを保ったまま `network-monitor` を委譲呼び出しする
3. `extension-network-service` の純粋ロジック（集計・フィルタ・変換）はヘルパーモジュールへ分離し、サービス本体は副作用オーケストレーションに限定する

## 理由

- 単一実装化により、監視仕様の変更点を1箇所で管理できる
- 互換ファサードで移行コストを抑え、既存利用者への破壊的変更を回避できる
- 純粋ロジックを分離すると、機能追加時の編集範囲が局所化され、レビュー容易性と保守性が向上する

## リスクと対応

| リスク | 対応 |
|--------|------|
| 旧APIと新APIの型差異によりデータ欠落が起こる | 互換ファサードでレコード変換を明示し、extension起点レコードのみを旧形式へ変換する |
| deep import利用者が実装差分に依存している | エクスポート名とメソッド契約を維持し、委譲方式で互換動作を継続する |
| サービス分割でロジック経路が増え追跡が難しくなる | ヘルパーを純粋関数に限定し、副作用をサービス本体に集約する |
