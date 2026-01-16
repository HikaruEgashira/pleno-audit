import * as arrow from "apache-arrow";
import type { ParquetLogType } from "./types";

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

// レコードをArrow IPC形式にエンコード（Parquet-WASMの代わり）
export async function encodeToParquet(
  type: ParquetLogType,
  records: Record<string, unknown>[]
): Promise<Uint8Array> {
  if (records.length === 0) {
    return new Uint8Array(0);
  }

  // レコードをArrow Tableに変換
  const arrowTable = recordsToArrowTable(type, records);

  // Arrow TableをIPC Stream形式に変換
  return arrow.tableToIPC(arrowTable, "stream");
}

// Arrow IPCデータをデコード
export async function decodeFromParquet(
  data: Uint8Array
): Promise<Record<string, unknown>[]> {
  if (data.length === 0) {
    return [];
  }

  // IPC StreamからJSのArrow Tableに変換
  const arrowTable = arrow.tableFromIPC(data);

  // Arrow Tableからレコード配列に変換
  return arrowTableToRecords(arrowTable);
}

// Arrow IPCは常に利用可能
export async function isParquetWasmAvailable(): Promise<boolean> {
  return true;
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

  // IPC StreamからJSのArrow Tableに変換
  const arrowTable = arrow.tableFromIPC(data);

  // 指定された列のみを含むレコードを返す
  const records: Record<string, unknown>[] = [];
  const schema = arrowTable.schema;

  for (let i = 0; i < arrowTable.numRows; i++) {
    const record: Record<string, unknown> = {};

    for (const colName of columns) {
      const field = schema.fields.find(f => f.name === colName);
      if (field) {
        const column = arrowTable.getChild(colName);
        if (column) {
          let value = column.get(i);
          if (typeof value === "bigint") {
            value = Number(value);
          }
          record[colName] = value;
        }
      }
    }

    records.push(record);
  }

  return records;
}
