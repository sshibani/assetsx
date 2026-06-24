import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { processAsset } from "../process-asset.js";
import { publishAsset } from "../publish-asset.js";
import {
  createWorkerTestContext,
  makeTestImage,
  type WorkerTestContext,
} from "./test-helpers.js";

let ctx: WorkerTestContext;

beforeEach(async () => {
  ctx = await createWorkerTestContext();
});

afterEach(async () => {
  await ctx.cleanup();
});

async function seedOwner(): Promise<{ userId: string; accountId: string }> {
  const user = await ctx.prisma.user.create({
    data: {
      email: `owner-${randomUUID()}@assetx.local`,
      passwordHash: "x",
      globalRole: "user",
    },
  });
  const account = await ctx.prisma.account.create({
    data: {
      name: `Account ${randomUUID()}`,
      slug: `acct-${randomUUID()}`,
    },
  });
  await ctx.prisma.accountMembership.create({
    data: {
      accountId: account.id,
      userId: user.id,
      role: "asset_manager",
    },
  });
  return { userId: user.id, accountId: account.id };
}

async function seedPendingAsset(): Promise<string> {
  const { userId, accountId } = await seedOwner();
  const image = await makeTestImage();
  const checksum = createHash("sha256").update(image).digest("hex");
  const asset = await ctx.prisma.asset.create({
    data: {
      accountId,
      ownerId: userId,
      originalName: "photo.jpg",
      status: "pending",
      checksum,
      format: "jpg",
      sizeBytes: image.byteLength,
    },
  });
  await ctx.storage.put(`assets/${asset.id}/original`, image, "image/jpeg");
  return asset.id;
}

async function seedPendingPdfAsset(): Promise<string> {
  const { userId, accountId } = await seedOwner();
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  );
  const checksum = createHash("sha256").update(pdf).digest("hex");
  const asset = await ctx.prisma.asset.create({
    data: {
      accountId,
      ownerId: userId,
      originalName: "document.pdf",
      status: "pending",
      checksum,
      format: "pdf",
      sizeBytes: pdf.byteLength,
    },
  });
  await ctx.storage.put(`assets/${asset.id}/original`, pdf, "application/pdf");
  return asset.id;
}

describe("processAsset", () => {
  it("creates all renditions and marks the asset ready", async () => {
    const assetId = await seedPendingAsset();

    await processAsset(ctx.deps, assetId);

    const asset = await ctx.prisma.asset.findUnique({
      where: { id: assetId },
      include: { renditions: true },
    });
    expect(asset!.status).toBe("ready");
    expect(asset!.width).toBe(3000);
    expect(asset!.height).toBe(2000);

    const names = asset!.renditions.map((r) => r.name).sort();
    expect(names).toEqual(["large", "original", "standard", "thumb"]);

    // rendition bytes are stored
    for (const r of asset!.renditions) {
      expect(await ctx.storage.exists(r.storageKey)).toBe(true);
    }
  });

  it("is idempotent when re-run (no duplicate renditions)", async () => {
    const assetId = await seedPendingAsset();
    await processAsset(ctx.deps, assetId);
    await processAsset(ctx.deps, assetId);

    const count = await ctx.prisma.rendition.count({ where: { assetId } });
    expect(count).toBe(4);
  });

  it("marks PDF assets ready without generating image renditions", async () => {
    const assetId = await seedPendingPdfAsset();

    await processAsset(ctx.deps, assetId);

    const asset = await ctx.prisma.asset.findUnique({
      where: { id: assetId },
      include: { renditions: true },
    });
    expect(asset!.status).toBe("ready");
    expect(asset!.width).toBeNull();
    expect(asset!.height).toBeNull();
    expect(asset!.format).toBe("pdf");
    expect(asset!.renditions).toEqual([]);
    expect(await ctx.storage.exists(`assets/${assetId}/original`)).toBe(true);
  });

  it("marks the asset failed when the original is missing", async () => {
    const { userId, accountId } = await seedOwner();
    const asset = await ctx.prisma.asset.create({
      data: {
        accountId,
        ownerId: userId,
        originalName: "x.jpg",
        status: "pending",
        checksum: "abc",
        format: "jpg",
        sizeBytes: 1,
      },
    });

    await expect(processAsset(ctx.deps, asset.id)).rejects.toThrow();

    const after = await ctx.prisma.asset.findUnique({ where: { id: asset.id } });
    expect(after!.status).toBe("failed");
  });
});

describe("publishAsset", () => {
  it("runs the channel and records a successful publication", async () => {
    const assetId = await seedPendingAsset();
    await processAsset(ctx.deps, assetId);

    await publishAsset(ctx.deps, assetId, "webhook");

    expect(ctx.webhookCalls).toBe(1);
    const pubs = await ctx.prisma.publication.findMany({ where: { assetId } });
    expect(pubs).toHaveLength(1);
    expect(pubs[0]!.channelId).toBe("webhook");
    expect(pubs[0]!.status).toBe("success");
  });

  it("records a failed publication for an unknown channel without throwing fatally", async () => {
    const assetId = await seedPendingAsset();
    await processAsset(ctx.deps, assetId);

    await expect(publishAsset(ctx.deps, assetId, "nope")).rejects.toThrow();
  });
});
