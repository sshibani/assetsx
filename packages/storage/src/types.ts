import type { Readable } from "node:stream";

export interface StoredObject {
  key: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageProvider {
  /** Persist data under the given key. Overwrites if it already exists. */
  put(
    key: string,
    data: Buffer | Readable,
    contentType: string,
  ): Promise<StoredObject>;

  /** Read an object as a stream. Rejects if the key does not exist. */
  get(key: string): Promise<Readable>;

  /** Whether an object exists for the given key. */
  exists(key: string): Promise<boolean>;

  /** A retrievable URL/path for the object (provider-specific). */
  getUrl(key: string): string;

  /** Remove an object. No-op if it does not exist. */
  delete(key: string): Promise<void>;
}
