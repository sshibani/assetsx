import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { PrismaClient, Asset, Rendition } from "@prisma/client";
import type { StorageProvider } from "@assetx/storage";
import type { JobQueue } from "@assetx/queue";
import {
  SUPPORTED_MIME_TYPES,
  type AssetDTO,
  type RenditionName,
} from "@assetx/shared-types";
import type { AuthUser } from "../auth-guard.js";

export class AssetError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export interface UploadInput {
  ownerId: string;
  originalName: string;
  buffer: Buffer;
}

export interface UpdateMetadataInput {
  title?: string | null;
  description?: string | null;
  expiresAt?: string | null;
}

export class AssetService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageProvider,
    private readonly queue: JobQueue,
  ) {}

  async upload(input: UploadInput): Promise<AssetDTO> {
    const detected = await fileTypeFromBuffer(input.buffer);
    if (
      !detected ||
      !SUPPORTED_MIME_TYPES.includes(detected.mime as (typeof SUPPORTED_MIME_TYPES)[number])
    ) {
      throw new AssetError("Unsupported or invalid image file", 400);
    }

    const checksum = createHash("sha256").update(input.buffer).digest("hex");

    const asset = await this.prisma.asset.create({
      data: {
        ownerId: input.ownerId,
        originalName: input.originalName,
        status: "pending",
        checksum,
        format: detected.ext,
        sizeBytes: input.buffer.byteLength,
      },
    });

    await this.storage.put(
      this.originalKey(asset.id),
      input.buffer,
      detected.mime,
    );

    await this.queue.enqueue("assets", {
      type: "process-asset",
      assetId: asset.id,
    });

    return this.toDTO(asset, []);
  }

  async list(user: AuthUser): Promise<AssetDTO[]> {
    const where = user.role === "admin" ? {} : { ownerId: user.id };
    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { renditions: true },
    });
    return assets.map((a) => this.toDTO(a, a.renditions));
  }

  async getForUser(id: string, user: AuthUser): Promise<AssetDTO> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { renditions: true },
    });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertOwner(asset, user);
    return this.toDTO(asset, asset.renditions);
  }

  async updateMetadata(
    id: string,
    user: AuthUser,
    input: UpdateMetadataInput,
  ): Promise<AssetDTO> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertOwner(asset, user);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: this.parseExpiryDate(input.expiresAt) }
          : {}),
      },
      include: { renditions: true },
    });
    return this.toDTO(updated, updated.renditions);
  }

  async delete(id: string, user: AuthUser): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { renditions: true },
    });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertOwner(asset, user);

    for (const rendition of asset.renditions) {
      await this.storage.delete(rendition.storageKey);
    }
    await this.storage.delete(this.originalKey(id));
    await this.prisma.asset.delete({ where: { id } });
  }

  private assertOwner(asset: { ownerId: string }, user: AuthUser): void {
    if (user.role !== "admin" && asset.ownerId !== user.id) {
      throw new AssetError("Forbidden", 403);
    }
  }

  private originalKey(assetId: string): string {
    return `assets/${assetId}/original`;
  }

  private parseExpiryDate(value: string | null): Date | null {
    if (value === null) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new AssetError("Expiry date must use YYYY-MM-DD format", 400);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const expiresAt = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    if (
      expiresAt.getUTCFullYear() !== year ||
      expiresAt.getUTCMonth() !== month - 1 ||
      expiresAt.getUTCDate() !== day
    ) {
      throw new AssetError("Expiry date must be a valid calendar date", 400);
    }

    return expiresAt;
  }

  private toDTO(asset: Asset, renditions: Rendition[]): AssetDTO {
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      originalName: asset.originalName,
      status: asset.status as AssetDTO["status"],
      checksum: asset.checksum,
      width: asset.width,
      height: asset.height,
      format: asset.format,
      sizeBytes: asset.sizeBytes,
      title: asset.title,
      description: asset.description,
      metadataSource: asset.metadataSource as AssetDTO["metadataSource"],
      renditions: renditions.map((r) => ({
        id: r.id,
        name: r.name as RenditionName,
        width: r.width,
        height: r.height,
        format: r.format,
        sizeBytes: r.sizeBytes,
        url: this.storage.getUrl(r.storageKey),
      })),
      originalUrl: this.storage.getUrl(this.originalKey(asset.id)),
      expiresAt: asset.expiresAt?.toISOString() ?? null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}
