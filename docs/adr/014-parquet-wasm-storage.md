# ADR-014: Arrow IPC によるストレージ最適化

## Status
Accepted (Modified)

## Context

### 現状の課題

ADR-007で導入したsql.js（SQLite WASM）は、クエリ機能を提供していたが、長期データ保存において以下の課題があった：

1. **ストレージ効率の問題**: 行指向のJSONベース保存では、2年間のデータ保持（推定3,600万レコード）で約18GBのストレージが必要
2. **スケーラビリティの限界**: IndexedDBのブラウザ制限（約2GB）に達する可能性
3. **クエリパフォーマンス**: 大量データの集計クエリで応答時間が増加

### 目標

- 列指向フォーマットによる**効率的なストレージ**
- 日別パーティションによる**効率的なクエリ**
- **2年間のデータ保持**の実現

## Decision

**Apache Arrow IPC形式**を採用し、列指向のストレージを実現する。

### 当初の計画からの変更

当初はparquet-wasm（WebAssembly版Apache Parquet）を採用予定だったが、以下の理由でArrow IPC形式に変更：

1. **WXTビルドの制約**: WXTはChrome拡張機能をIIFE形式でビルドするため、parquet-wasmが必要とするtop-level awaitをサポートしない
2. **WASM初期化の複雑性**: Chrome拡張機能環境でのWASM手動初期化が複雑
3. **開発体験**: 開発モードでのoffscreenドキュメントからのlocalhostスクリプト読み込み制限

Arrow IPC形式はParquetと比較して圧縮率は劣るが、以下の利点がある：
- 純粋なJavaScript（apache-arrow）で動作、WASMなし
- ビルド・実行時の制約なし
- 十分な列指向の効率性

### アーキテクチャ

```
ParquetStore
    ├── parquet-encoder.ts    # Arrow IPC変換
    ├── partition-manager.ts  # 日別パーティション管理
    ├── stats-cache.ts        # 統計情報キャッシュ
    └── IndexedDB             # Arrow IPCバイナリ永続化
```

### 主要コンポーネント

| コンポーネント | 役割 |
|---------------|------|
| `parquet-encoder` | Apache Arrowでレコードを Arrow IPC形式に変換 |
| `partition-manager` | 日別パーティションの管理とプルーニング |
| `stats-cache` | 列統計（min/max）を使った述語プッシュダウン |
| `ParquetStore` | 高レベルAPI |

### データフォーマット

```typescript
// 日別パーティション（例: csp-violations_2026_01_16）
interface ParquetFileRecord {
  key: string;           // パーティションキー
  type: ParquetLogType;  // データタイプ
  date: string;          // パーティション日付
  data: Uint8Array;      // Arrow IPCバイナリ
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
| エクスポート/インポート | Arrow IPCファイルの直接操作 |

## Alternatives Considered

### A. DuckDB WASM
- 利点: 高速な分析クエリ、ネイティブParquetサポート
- 欠点: バンドルサイズが大きい（約5MB）、初期化コスト高

### B. sql.js + BLOB圧縮
- 利点: 既存インフラの活用
- 欠点: 列指向の利点を活かせない、カスタム圧縮が必要

### C. parquet-wasm
- 利点: 高圧縮率、標準的なParquetフォーマット
- 欠点: WASM初期化が複雑、WXTのIIFEビルドと非互換

### D. Arrow IPC（採用）
- 利点: 純粋JS、ビルド制約なし、十分な効率性
- 欠点: Parquetほどの圧縮率は得られない

## Consequences

### Positive

1. **シンプルな実装**: WASMなしで動作、ビルド制約なし
2. **クエリ効率化**: 列プルーニングとパーティションプルーニングによる高速化
3. **安定性**: Chrome拡張機能環境での安定動作
4. **スケーラビリティ**: 2年間のデータ保持が現実的に

### Negative

1. **圧縮率**: Parquet（Snappy圧縮）より劣る
2. **相互運用性**: Parquetほど広くサポートされていない

### リスク軽減

| リスク | 対策 |
|-------|------|
| ストレージサイズ | 必要に応じてgzip圧縮を追加 |
| IndexedDB容量制限 | 容量監視・警告UI |

## Related

- ADR-007: sql.js によるクライアントサイドDB
- ADR-008: Coreパッケージの廃止とドメイン分割

## References

- [Apache Arrow JS](https://arrow.apache.org/docs/js/)
- [Arrow IPC Format](https://arrow.apache.org/docs/format/Columnar.html#ipc-file-format)
