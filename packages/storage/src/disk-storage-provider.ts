import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, isAbsolute, sep } from "node:path";
import { Readable } from "node:stream";
import type { StorageProvider, StoredObject } from "./types.js";

export interface DiskStorageOptions {
  /** Absolute filesystem directory used as the storage root. */
  root: string;
  /** Base URL prefix used to build public/retrievable URLs. */
  baseUrl: string;
}

async function toBuffer(data: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  const chunks: Buffer[] = [];
  for await (const chunk of data) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class DiskStorageProvider implements StorageProvider {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(options: DiskStorageOptions) {
    this.root = options.root;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  /** Resolve a storage key to an absolute path, refusing any traversal. */
  private resolve(key: string): string {
    const cleaned = key.replace(/^\/+/, "");
    const full = normalize(join(this.root, cleaned));
    const rel = relative(this.root, full);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Invalid storage key (path traversal): ${key}`);
    }
    return full;
  }

  async put(
    key: string,
    data: Buffer | Readable,
    contentType: string,
  ): Promise<StoredObject> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    const buffer = await toBuffer(data);
    await writeFile(path, buffer);
    return { key, sizeBytes: buffer.byteLength, contentType };
  }

  async get(key: string): Promise<Readable> {
    const path = this.resolve(key);
    await stat(path); // throws if missing
    return createReadStream(path);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    const cleaned = key.replace(/^\/+/, "").split(sep).join("/");
    return `${this.baseUrl}/${cleaned}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
