# ADR-014: Parquet-WASM によるストレージ最適化

## Status
Accepted

## Context

### 現状の課題

ADR-007で導入したsql.js（SQLite WASM）は、クエリ機能を提供していたが、長期データ保存において以下の課題があった：

1. **ストレージ効率の問題**: 行指向のJSONベース保存では、2年間のデータ保持（推定3,600万レコード）で約18GBのストレージが必要
2. **スケーラビリティの限界**: IndexedDBのブラウザ制限（約2GB）に達する可能性
3. **クエリパフォーマンス**: 大量データの集計クエリで応答時間が増加

### 目標

- 列指向圧縮による**5〜10倍のストレージ削減**（18GB → 2〜4GB）
- 日別パーティションによる**効率的なクエリ**
- **2年間のデータ保持**の実現

## Decision

**parquet-wasm**（WebAssembly版Apache Parquet）を採用し、列指向の圧縮ストレージを実現する。

### アーキテクチャ

```
ParquetStore
    ├── parquet-encoder.ts    # Arrow ↔ Parquet変換
    ├── partition-manager.ts  # 日別パーティション管理
    ├── stats-cache.ts        # 統計情報キャッシュ
    └── IndexedDB             # Parquetバイナリ永続化
```

### 主要コンポーネント

| コンポーネント | 役割 |
|---------------|------|
| `parquet-encoder` | Apache Arrow経由でレコードをParquet形式に変換 |
| `partition-manager` | 日別パーティションの管理とプルーニング |
| `stats-cache` | 列統計（min/max）を使った述語プッシュダウン |
| `ParquetStore` | 高レベルAPIとマイグレーション機能 |

### データフォーマット

```typescript
// 日別パーティション（例: csp-violations_2026_01_16）
interface ParquetFileRecord {
  key: string;           // パーティションキー
  type: ParquetLogType;  // データタイプ
  date: string;          // パーティション日付
  data: Uint8Array;      // Parquetバイナリ（Snappy圧縮）
  recordCount: number;   // レコード数
  sizeBytes: number;     // サイズ
}
```

### 運用機能

| 機能 | 説明 |
|------|------|
| 保持ポリシー | 2年以上古いデータの自動削除 |
| 自動コンパクション | 小さなパーティションの結合 |
| 容量監視 | IndexedDB使用量のモニタリング |
| エクスポート/インポート | Parquetファイルの直接操作 |

## Alternatives Considered

### A. DuckDB WASM
- 利点: 高速な分析クエリ、ネイティブParquetサポート
- 欠点: バンドルサイズが大きい（約5MB）、初期化コスト高

### B. sql.js + BLOB圧縮
- 利点: 既存インフラの活用
- 欠点: 列指向の利点を活かせない、カスタム圧縮が必要

### C. parquet-wasm（採用）
- 利点: 軽量（約1MB）、標準的なParquetフォーマット、列プルーニングサポート
- 欠点: 複雑なSQLクエリは別途実装が必要

## Consequences

### Positive

1. **ストレージ削減**: Snappy圧縮により5〜10倍のサイズ削減
2. **クエリ効率化**: 列プルーニングとパーティションプルーニングによる高速化
3. **相互運用性**: 標準Parquetフォーマットで外部ツールとの連携が可能
4. **スケーラビリティ**: 2年間のデータ保持が現実的に

### Negative

1. **初期化コスト**: WASM初期化に約100msのオーバーヘッド
2. **複雑性の増加**: パーティション管理が必要

### リスク軽減

| リスク | 対策 |
|-------|------|
| WASMバンドルサイズ | 遅延ロード |
| ブラウザ互換性 | Feature detection |
| IndexedDB容量制限 | 容量監視・警告UI |

## Related

- ADR-007: sql.js によるクライアントサイドDB
- ADR-008: Coreパッケージの廃止とドメイン分割

## References

- [parquet-wasm](https://github.com/kylebarron/parquet-wasm)
- [Apache Arrow JS](https://arrow.apache.org/docs/js/)
- [Apache Parquet Format](https://parquet.apache.org/docs/file-format/)
