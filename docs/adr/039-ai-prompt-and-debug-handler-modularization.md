# ADR 039: AI Prompt処理とDebug Bridge処理のモジュール分離

## ステータス

Accepted

## コンテキスト

- `app/audit-extension/entrypoints/background.ts` は2,700行超の単一ファイルであり、AI Prompt処理とDebug Bridge処理が混在している
- AI Prompt処理は検出・分類・イベント記録・アラート・サービス更新を1関数で担い、変更時の副作用範囲が読み取りにくい
- Debug Bridge処理はswitch文に集約され、メッセージ追加時に条件分岐の肥大化が継続する

## 決定

- AI Prompt処理を `app/audit-extension/lib/background/ai-prompt-monitor.ts` に分離し、依存を注入して処理パイプライン化する
- Debug Bridge処理を `app/audit-extension/lib/background/debug-bridge-handler.ts` に分離し、Mapベースのテーブル駆動でメッセージを解決する
- `background.ts` はオーケストレーションと依存配線に責務を限定する

## 理由

- 可読性: 目的別にファイルを分離することで、変更点と影響範囲を追跡しやすくなる
- 凝集度: AI Promptのドメイン知識とDebug操作ロジックを分離し、責務の境界を明確にできる
- 変更容易性: 新規Debugメッセージ追加時にswitchを編集せずエントリ追加で対応できる
- 安全性: 既存の外部契約（runtime message typeとレスポンス形）を維持したまま内部構造のみを改善できる

## リスクと対応

| リスク | 対応 |
|--------|------|
| 依存注入時の型不整合 | 依存インターフェースを明示し、呼び出し側で既存関数をそのまま注入する |
| JSON detailsの復元差異 | Debug eventsのdetails復元ロジックを専用関数化して既存挙動を維持する |
| AIイベント詳細の欠落 | 既存フィールド名を維持し、イベント発行順序を変えない |
