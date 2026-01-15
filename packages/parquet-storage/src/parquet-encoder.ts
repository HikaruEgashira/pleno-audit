import * as arrow from "apache-arrow";
import type { ParquetLogType } from "./types";

// parquet-wasmの初期化状態
let parquetWasm: typeof import("parquet-wasm") | null = null;
let initPromise: Promise<typeof import("parquet-wasm")> | null = null;

// 遅延ロードでparquet-wasmを初期化
async function initParquetWasm(): Promise<typeof import("parquet-wasm")> {
  if (parquetWasm) return parquetWasm;

  if (!initPromise) {
    initPromise = (async () => {
      // Node.js環境かブラウザ環境かを判定
      const isNode = typeof window === "undefined";

      if (isNode) {
        // Node.js環境ではnode版を使用
        const module = await import("parquet-wasm/node");
        parquetWasm = module;
        return module;
      } else {
        // ブラウザ環境ではbundler版を使用
        const module = await import("parquet-wasm/bundler");
        await module.default();
        parquetWasm = module;
        return module;
      }
    })();
  }

  return initPromise;
}

// Arrow Field定義
interface ArrowFieldDef {
  name: string;
  type: arrow.DataType;
  nullable: boolean;
}

// 各タイプのArrowスキーマ定義
const ARROW_SCHEMAS: Record<ParquetLogType, ArrowFieldDef[]> = {
  "csp-violations": [
    { name: "timestamp", type: new arrow.Utf8(), nullable: false },
    { name: "pageUrl", type: new arrow.Utf8(), nullable: false },
    { name: "directive", type: new arrow.Utf8(), nullable: false },
    { name: "blockedURL", type: new arrow.Utf8(), nullable: false },
    { name: "domain", type: new arrow.Utf8(), nullable: false },
    { name: "disposition", type: new arrow.Utf8(), nullable: true },
    { name: "originalPolicy", type: new arrow.Utf8(), nullable: true },
    { name: "sourceFile", type: new arrow.Utf8(), nullable: true },
    { name: "lineNumber", type: new arrow.Int32(), nullable: true },
    { name: "columnNumber", type: new arrow.Int32(), nullable: true },
    { name: "statusCode", type: new arrow.Int32(), nullable: true },
  ],
  "network-requests": [
    { name: "timestamp", type: new arrow.Utf8(), nullable: false },
    { name: "pageUrl", type: new arrow.Utf8(), nullable: false },
    { name: "url", type: new arrow.Utf8(), nullable: false },
    { name: "method", type: new arrow.Utf8(), nullable: false },
    { name: "initiator", type: new arrow.Utf8(), nullable: false },
    { name: "domain", type: new arrow.Utf8(), nullable: false },
    { name: "resourceType", type: new arrow.Utf8(), nullable: true },
  ],
  events: [
    { name: "id", type: new arrow.Utf8(), nullable: false },
    { name: "type", type: new arrow.Utf8(), nullable: false },
    { name: "domain", type: new arrow.Utf8(), nullable: false },
    { name: "timestamp", type: new arrow.Int64(), nullable: false },
    { name: "details", type: new arrow.Utf8(), nullable: false },
  ],
  "ai-prompts": [
    { name: "id", type: new arrow.Utf8(), nullable: false },
    { name: "timestamp", type: new arrow.Int64(), nullable: false },
    { name: "url", type: new arrow.Utf8(), nullable: false },
    { name: "prompt", type: new arrow.Utf8(), nullable: false },
    { name: "service", type: new arrow.Utf8(), nullable: true },
  ],
};

// レコードをArrow Tableに変換
function recordsToArrowTable(
  type: ParquetLogType,
  records: Record<string, unknown>[]
): arrow.Table {
  const fieldDefs = ARROW_SCHEMAS[type];

  // 列ごとのデータを収集
  const columnData: Record<string, unknown[]> = {};
  for (const field of fieldDefs) {
    columnData[field.name] = [];
  }

  for (const record of records) {
    for (const field of fieldDefs) {
      let value = record[field.name];

      // nullの場合
      if (value === null || value === undefined) {
        columnData[field.name].push(null);
        continue;
      }

      // 型変換
      if (field.type instanceof arrow.Int64) {
        value = BigInt(value as number);
      } else if (field.type instanceof arrow.Int32) {
        value = Number(value);
      }

      columnData[field.name].push(value);
    }
  }

  // arrow.tableFromArraysを使用してテーブルを作成
  const tableData: Record<string, unknown[]> = {};
  for (const field of fieldDefs) {
    tableData[field.name] = columnData[field.name];
  }

  return arrow.tableFromArrays(tableData);
}

// Arrow Tableからレコード配列に変換
function arrowTableToRecords(table: arrow.Table): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const schema = table.schema;

  for (let i = 0; i < table.numRows; i++) {
    const record: Record<string, unknown> = {};

    for (const field of schema.fields) {
      const column = table.getChild(field.name);
      if (column) {
        let value = column.get(i);

        // BigIntをnumberに変換
        if (typeof value === "bigint") {
          value = Number(value);
        }

        record[field.name] = value;
      }
    }

    records.push(record);
  }

  return records;
}

// レコードをParquetにエンコード
export async function encodeToParquet(
  type: ParquetLogType,
  records: Record<string, unknown>[]
): Promise<Uint8Array> {
  if (records.length === 0) {
    return new Uint8Array(0);
  }

  const wasm = await initParquetWasm();

  // レコードをArrow Tableに変換
  const arrowTable = recordsToArrowTable(type, records);

  // Arrow TableをIPC Stream形式に変換
  const ipcStream = arrow.tableToIPC(arrowTable, "stream");

  // IPC StreamからparquetのTableに変換
  const wasmTable = wasm.Table.fromIPCStream(ipcStream);

  // Parquetに変換（Snappy圧縮）
  const writerProperties = new wasm.WriterPropertiesBuilder()
    .setCompression(wasm.Compression.SNAPPY)
    .build();

  return wasm.writeParquet(wasmTable, writerProperties);
}

// Parquetデータをデコード
export async function decodeFromParquet(
  data: Uint8Array
): Promise<Record<string, unknown>[]> {
  if (data.length === 0) {
    return [];
  }

  const wasm = await initParquetWasm();

  // ParquetをArrow Tableに変換
  const wasmTable = wasm.readParquet(data);

  // Arrow TableをIPC Stream形式に変換
  const ipcStream = wasmTable.intoIPCStream();

  // IPC StreamからJSのArrow Tableに変換
  const arrowTable = arrow.tableFromIPC(ipcStream);

  // Arrow Tableからレコード配列に変換
  return arrowTableToRecords(arrowTable);
}

// parquet-wasmが利用可能かチェック
export async function isParquetWasmAvailable(): Promise<boolean> {
  try {
    await initParquetWasm();
    return true;
  } catch {
    return false;
  }
}

// Arrowスキーマを取得
export function getArrowSchema(type: ParquetLogType): ArrowFieldDef[] | undefined {
  return ARROW_SCHEMAS[type];
}

// 列プルーニング用: 特定の列のみを読み込む
export async function decodeFromParquetWithColumns(
  data: Uint8Array,
  columns: string[]
): Promise<Record<string, unknown>[]> {
  if (data.length === 0 || columns.length === 0) {
    return [];
  }

  const wasm = await initParquetWasm();

  // 列プルーニングオプション付きで読み込み
  const wasmTable = wasm.readParquet(data, { columns });
  const ipcStream = wasmTable.intoIPCStream();
  const arrowTable = arrow.tableFromIPC(ipcStream);

  return arrowTableToRecords(arrowTable);
}
