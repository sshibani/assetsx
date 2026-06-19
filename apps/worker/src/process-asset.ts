import { Readable } from "node:stream";
import { DEFAULT_RENDITIONS } from "@assetx/image-processing";
import type { WorkerDependencies } from "./dependencies.js";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Process an asset's original into all default renditions, persist them, and
 * mark the asset ready. Idempotent: re-running upserts renditions in place.
 * On failure, the asset is marked `failed` and the error re-thrown so the
 * queue can retry.
 */
export async function processAsset(
  deps: WorkerDependencies,
  assetId: string,
): Promise<void> {
  const asset = await deps.prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  await deps.prisma.asset.update({
    where: { id: assetId },
    data: { status: "processing" },
  });

  try {
    const originalKey = `assets/${assetId}/original`;
    const original = await streamToBuffer(await deps.storage.get(originalKey));

    if (asset.format === "pdf") {
      await deps.prisma.asset.update({
        where: { id: assetId },
        data: { status: "ready", width: null, height: null, format: "pdf" },
      });
      return;
    }

    const info = await deps.processor.inspect(original);
    const renditions = await deps.processor.process(original, DEFAULT_RENDITIONS);

    for (const rendition of renditions) {
      const ext = rendition.format === "jpeg" ? "jpg" : rendition.format;
      const key =
        rendition.name === "original"
          ? originalKey
          : `assets/${assetId}/${rendition.name}.${ext}`;

      if (rendition.name !== "original") {
        await deps.storage.put(key, rendition.data, `image/${rendition.format}`);
      }

      await deps.prisma.rendition.upsert({
        where: { assetId_name: { assetId, name: rendition.name } },
        create: {
          assetId,
          name: rendition.name,
          storageKey: key,
          width: rendition.width,
          height: rendition.height,
          format: rendition.format,
          sizeBytes: rendition.sizeBytes,
        },
        update: {
          storageKey: key,
          width: rendition.width,
          height: rendition.height,
          format: rendition.format,
          sizeBytes: rendition.sizeBytes,
        },
      });
    }

    await deps.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: "ready",
        width: info.width,
        height: info.height,
        format: info.format,
      },
    });
  } catch (err) {
    await deps.prisma.asset.update({
      where: { id: assetId },
      data: { status: "failed" },
    });
    throw err;
  }
}
