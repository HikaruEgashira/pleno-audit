# ADR 010: Extension Runtime パッケージの分離

## ステータス

Accepted

## コンテキスト

`app/extension/utils/` ディレクトリには11のファイルが存在し、Chrome拡張機能のランタイムに関連する様々な責務が混在していた。

### 問題点

1. **責務の混在**: ストレージ、API クライアント、Cookie 監視、同期管理、メッセージハンドリングなど、複数の責務が同一ディレクトリに存在
2. **再利用性の欠如**: 拡張機能固有のインフラコードがアプリケーションコードと混在し、パッケージとして再利用できない
3. **テスト困難**: Chrome APIs に密結合したコードがパッケージ境界なく存在

### 分析結果

`utils/` 内のファイルを責務別に分類：

| カテゴリ | ファイル | 責務 |
|----------|----------|------|
| **ストレージ層** | storage.ts, storage-types.ts | chrome.storage.local アクセス |
| **API クライアント** | api-client.ts | Offscreen API + Remote API |
| **同期層** | sync-manager.ts, migration.ts | 定期同期、マイグレーション |
| **Cookie 監視** | cookie-monitor.ts | chrome.cookies.onChanged |
| **メッセージング** | message-handler.ts | chrome.runtime.onMessage ルーティング |
| **Offscreen** | indexeddb-storage.ts, db-schema.ts | Offscreen Document 専用 |
| **Adapter** | browser-adapter.ts | DOMAdapter の実装 |
| **Reporting** | csp-reporter.ts | CSP レポート送信 |

## 決定

`app/extension/utils/` を `packages/extension-runtime` パッケージとして分離する。

### パッケージ構造

```
packages/extension-runtime/
├── src/
│   ├── index.ts                 # メインエクスポート
│   ├── storage.ts               # chrome.storage.local アクセス
│   ├── storage-types.ts         # ストレージスキーマ
│   ├── api-client.ts            # Local/Remote API クライアント
│   ├── sync-manager.ts          # 同期管理
│   ├── migration.ts             # マイグレーション
│   ├── cookie-monitor.ts        # Cookie 監視
│   ├── message-handler.ts       # メッセージルーター
│   ├── browser-adapter.ts       # DOMAdapter 実装
│   └── offscreen/               # Offscreen Document 専用
│       ├── index.ts
│       ├── indexeddb-storage.ts
│       └── db-schema.ts
└── package.json
```

### CSP Reporter の移動

`csp-reporter.ts` は CSP ドメインの責務であるため、`packages/csp` に移動した。

### 依存関係

```
@pleno-audit/extension-runtime
├── @pleno-audit/detectors (CookieInfo, DOMAdapter)
└── @pleno-audit/csp (CSPReport, CSPConfig)
```

## 結果

### メリット

1. **明確なパッケージ境界**: Chrome 拡張ランタイムのインフラコードが独立したパッケージに
2. **再利用性**: 他のブラウザ拡張プロジェクトでも利用可能
3. **テスタビリティ**: パッケージ単位でのモック・テストが容易
4. **ADR 008 との整合性**: ドメイン分割の方針に従った構造

### Import パス変更

```typescript
// Before
import { getApiClient } from "@/utils/api-client";
import { browserAdapter } from "@/utils/browser-adapter";

// After
import { getApiClient, browserAdapter } from "@pleno-audit/extension-runtime";
import { IndexedDBStorage, isLocalApiRequest } from "@pleno-audit/extension-runtime/offscreen";
```

## 関連 ADR

- [ADR 008](./008-core-domain-model.md): Core パッケージの廃止とドメイン分割
