import { ParquetStore } from "@pleno-audit/parquet-storage";

let parquetStore: ParquetStore | null = null;
let parquetStoreInit: Promise<ParquetStore> | null = null;

export async function getParquetStore(): Promise<ParquetStore> {
  if (parquetStore) {
    return parquetStore;
  }
  if (parquetStoreInit) {
    return parquetStoreInit;
  }
  const store = new ParquetStore();
  parquetStoreInit = store
    .init()
    .then(() => {
      parquetStore = store;
      return store;
    })
    .catch((err) => {
      parquetStore = null;
      parquetStoreInit = null;
      throw err;
    });
  return parquetStoreInit;
}
