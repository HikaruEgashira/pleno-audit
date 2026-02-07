import { ParquetStore } from "@pleno-audit/parquet-storage";

let parquetStore: ParquetStore | null = null;

export async function getParquetStore(): Promise<ParquetStore> {
  if (!parquetStore) {
    parquetStore = new ParquetStore();
    await parquetStore.init();
  }
  return parquetStore;
}
