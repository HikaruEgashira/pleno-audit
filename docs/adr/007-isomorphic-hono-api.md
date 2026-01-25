# ADR-007: sql.js (SQLite WASM) によるクライアントサイドデータベース

## Status
Superseded by [ADR 031](./031-parquet-storage-migration.md)

## Context
CSP違反やネットワークリクエストのデータは、当初`chrome.storage.local`に保存していたが、以下の課題があった

1. **クエリ機能の限界**: 単純なキーバリューストアでは複雑な集計やフィルタリングが困難
2. **データ量の増加**: 長期使用でデータが増えると、全データの読み込みが必要になりパフォーマンスが低下
3. **サーバー依存**: 高度な分析にはサーバー（sql.js）が必要だった

## Decision
**sql.js (SQLite WASM)** をChrome拡張機能内で使用し、クライアントサイドでSQLクエリを実行可能にする。

### アーキテクチャ

```
Service Worker (background.ts)
        ↓ chrome.runtime.sendMessage
Offscreen Document (main.ts)
        ↓
sql.js (SQLite WASM インメモリDB)
```

- **Offscreen Document**: Service WorkerからWASMを直接実行できないため、Offscreen Documentを中間レイヤーとして使用
- **IndexedDB永続化**: sql.jsのDBはIndexedDBに永続化される
- **ローカルWASM**: Chrome拡張機能のCSP制約のため、WASMファイルはextension内にバンドル

### データモデル

既存のサーバー側スキーマを踏襲

| テーブル | 用途 |
|---------|------|
| `csp_violations` | CSP違反レコード |
| `network_requests` | ネットワークリクエストレコード |

### サーバー互換性

- `reportEndpoint`設定時は従来通りサーバーにもレポートを送信
- `app/server/`は削除せず、オプショナルなコンポーネントとして維持

## Alternatives Considered

### A. DuckDB WASM
- 利点: 高速な分析クエリ、将来的にParquet等への対応
- 欠点: バンドルサイズが大きい（約5MB）、Chrome拡張機能のCSP制約でCDNロード不可

### B. IndexedDB直接利用
- 利点: ブラウザネイティブ、追加ライブラリ不要
- 欠点: SQLクエリ不可、複雑な集計が困難

### C. sql.js（採用）
- 利点: 軽量（約1MB）、サーバー側と同じ技術、Chrome拡張機能での実績あり
- 欠点: 分析クエリのパフォーマンスでDuckDBに劣るが、本ユースケースでは十分

## Consequences

### Positive
- サーバーなしで高度な分析クエリが実行可能
- ADR-001のサーバーレス方針に完全に沿った実装
- サーバー側と同じsql.jsを使用するため、コードの一貫性が高い
- SQLクエリによるデータエクスポートが可能

### Negative
- 拡張機能のサイズが約1MB増加
- Offscreen Documentの管理が必要

### 永続化
- IndexedDBにDBファイルを永続化
- 既存の`chrome.storage.local.cspReports`データは自動的にsql.jsへ移行済み
