export type { StorageProvider, StoredObject } from "./types.js";
export { DiskStorageProvider } from "./disk-storage-provider.js";
export type { DiskStorageOptions } from "./disk-storage-provider.js";
// NOTE: the reusable contract test suite lives in "./contract.js" and imports
// vitest. It is intentionally NOT re-exported here so production code can import
// this package without pulling vitest into the runtime. Tests should import it
// directly: import { runStorageProviderContract } from "@assetx/storage/contract".
