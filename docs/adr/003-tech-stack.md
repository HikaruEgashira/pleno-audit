# ADR-003: Chrome Manifest V3 + WXT + Preactで実装する

## Status
Accepted (Updated: CRXJSからWXTへ移行)

## Context
ブラウザ拡張機能の開発には複数の選択肢がある：

### ブラウザ選択
- Chrome: シェア65%、Manifest V3が必須（2024年〜）
- Firefox: シェア3%、Manifest V2/V3両対応
- Safari: シェア18%、Web Extensions API対応だが制限あり

### ビルドツール
- webpack: 実績豊富だが設定が複雑
- Vite + CRXJS: HMR対応だがメンテナンス停滞気味
- WXT: Viteベース、マルチブラウザ対応、活発なメンテナンス
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
| ビルド | WXT | HMR対応、ファイルベースルーティング、マルチブラウザ対応 |
| UI | Preact | 軽量（3KB）、React互換、hooks対応 |
| 言語 | TypeScript | 型安全、Chrome API型定義あり |
| パッケージ管理 | pnpm | 高速、ディスク効率、モノレポ対応 |

### CRXJSからWXTへの移行理由
- CRXJSはメンテナンスが停滞（issueの対応遅延）
- WXTは活発に開発されており、ドキュメントも充実
- ファイルベースのエントリーポイント（popup/, background/, content/）で構成が明確
- WXTの`wxt build -b firefox`でFirefox対応可能（未実装）

### モノレポ構成
```
/
├── app/extension/           # ブラウザ拡張機能
│   ├── entrypoints/         # WXTエントリーポイント（popup, background等）
│   └── wxt.config.ts        # WXT設定
├── packages/
│   ├── detectors/           # CASBドメイン（サービス検出）
│   ├── csp/                 # CSP監査
│   ├── api/                 # Isomorphic Hono API
│   └── extension-runtime/   # 拡張機能ランタイム
├── pnpm-workspace.yaml
```

## Consequences

### Positive
- Manifest V3で将来のChrome更新に対応
- WXTでビルド設定がシンプルかつ標準的
- ファイルベースルーティングで構成が直感的
- Preactで拡張機能のサイズを最小化
- モノレポでパッケージ間のコード共有が可能
- WXTの`wxt build -b firefox`でFirefox対応可能

### Negative
- Firefox/Safariは未対応（WXTの機能で対応可能だが未実装）
- Manifest V3のService Workerは5分でアンロードされる制限あり
- Preactの一部React機能（Suspense等）は未サポート

### Technical Notes
- Service Workerの5分制限は、chrome.alarms APIで定期的にwake upすることで回避可能
- PreactのReact互換は`preact/compat`で提供されるが、本プロジェクトでは不要
- WXTは`wxt.config.ts`で一元的に設定管理
