import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiskStorageProvider } from "./disk-storage-provider.js";
import { runStorageProviderContract } from "./contract.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "assetx-storage-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

runStorageProviderContract(
  "DiskStorageProvider",
  () => new DiskStorageProvider({ root, baseUrl: "http://localhost:3000/files" }),
);

describe("DiskStorageProvider specifics", () => {
  it("builds a url from the configured baseUrl", () => {
    const provider = new DiskStorageProvider({
      root,
      baseUrl: "http://localhost:3000/files",
    });
    expect(provider.getUrl("assets/x/thumb.webp")).toBe(
      "http://localhost:3000/files/assets/x/thumb.webp",
    );
  });
});
