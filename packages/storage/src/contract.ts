import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type { StorageProvider } from "./types.js";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Reusable contract test suite that every StorageProvider implementation
 * must satisfy. DiskStorageProvider (v1) and S3StorageProvider (v2) both run this.
 */
export function runStorageProviderContract(
  name: string,
  factory: () => StorageProvider | Promise<StorageProvider>,
): void {
  describe(`StorageProvider contract: ${name}`, () => {
    it("round-trips bytes via put then get", async () => {
      const provider = await factory();
      const payload = Buffer.from("hello assetx");

      const stored = await provider.put("a/b/file.txt", payload, "text/plain");

      expect(stored.key).toBe("a/b/file.txt");
      expect(stored.sizeBytes).toBe(payload.byteLength);

      const read = await streamToBuffer(await provider.get("a/b/file.txt"));
      expect(read.equals(payload)).toBe(true);
    });

    it("accepts a readable stream as input", async () => {
      const provider = await factory();
      const payload = Buffer.from("streamed-content");

      await provider.put("streamed.bin", Readable.from(payload), "application/octet-stream");

      const read = await streamToBuffer(await provider.get("streamed.bin"));
      expect(read.equals(payload)).toBe(true);
    });

    it("reports existence correctly", async () => {
      const provider = await factory();
      expect(await provider.exists("missing")).toBe(false);

      await provider.put("present.txt", Buffer.from("x"), "text/plain");
      expect(await provider.exists("present.txt")).toBe(true);
    });

    it("overwrites an existing key", async () => {
      const provider = await factory();
      await provider.put("k", Buffer.from("first"), "text/plain");
      await provider.put("k", Buffer.from("second"), "text/plain");

      const read = await streamToBuffer(await provider.get("k"));
      expect(read.toString()).toBe("second");
    });

    it("rejects get for a missing key", async () => {
      const provider = await factory();
      await expect(provider.get("does/not/exist")).rejects.toThrow();
    });

    it("deletes an object and is a no-op when missing", async () => {
      const provider = await factory();
      await provider.put("to-delete", Buffer.from("bye"), "text/plain");

      await provider.delete("to-delete");
      expect(await provider.exists("to-delete")).toBe(false);

      // no-op, should not throw
      await expect(provider.delete("to-delete")).resolves.toBeUndefined();
    });

    it("returns a non-empty url for a key", async () => {
      const provider = await factory();
      expect(provider.getUrl("some/key.webp")).toBeTruthy();
    });

    it("prevents path traversal outside its namespace", async () => {
      const provider = await factory();
      await expect(
        provider.put("../escape.txt", Buffer.from("x"), "text/plain"),
      ).rejects.toThrow();
    });
  });
}
