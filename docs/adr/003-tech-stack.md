# ADR-003: Chrome Manifest V3 + Vite + Preactで実装する

## Status
Accepted

## Context
ブラウザ拡張機能の開発には複数の選択肢がある：

### ブラウザ選択
- Chrome: シェア65%、Manifest V3が必須（2024年〜）
- Firefox: シェア3%、Manifest V2/V3両対応
- Safari: シェア18%、Web Extensions API対応だが制限あり

### ビルドツール
- webpack: 実績豊富だが設定が複雑
- Vite: 高速、設定シンプル、CRXJSプラグインあり
- Parcel: ゼロコンフィグだが拡張機能サポートが弱い

### UIフレームワーク
- React: 汎用的だが40KB+と重い
- Preact: React互換で3KB、拡張機能に最適
- Vanilla: 最軽量だが開発効率が下がる
- Svelte: 軽量だがエコシステムが小さい

## Decision

| 項目 | 選択 | 理由 |
|------|------|------|
| ブラウザ | Chrome | シェア最大、Manifest V3が標準に |
| Manifest | V3 | Chromeで必須、Service Worker対応 |
| ビルド | Vite + CRXJS | HMR対応、manifest.jsonからの自動生成 |
| UI | Preact | 軽量（3KB）、React互換、hooks対応 |
| 言語 | TypeScript | 型安全、Chrome API型定義あり |
| パッケージ管理 | pnpm | 高速、ディスク効率、モノレポ対応 |

### モノレポ構成
```
/
├── app/extension/    # ブラウザ拡張機能
├── packages/core/    # 共通ロジック
├── pnpm-workspace.yaml
```

## Consequences

### Positive
- Manifest V3で将来のChrome更新に対応
- Vite + CRXJSでビルド設定がシンプル
- Preactで拡張機能のサイズを最小化（popup.js: 17KB）
- モノレポで将来のサーバー連携時にコード共有可能

### Negative
- Firefox/Safariユーザーは対象外（将来対応可能）
- Manifest V3のService Workerは5分でアンロードされる制限あり
- Preactの一部React機能（Suspense等）は未サポート

### Technical Notes
- Service Workerの5分制限は、chrome.alarms APIで定期的にwake upすることで回避可能
- PreactのReact互換は`preact/compat`で提供されるが、本プロジェクトでは不要
