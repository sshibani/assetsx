import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type {
  PrismaClient,
  Asset,
  AssetActivity,
  AssetComment,
  Rendition,
  User,
} from "@prisma/client";
import type { StorageProvider } from "@assetx/storage";
import type { JobQueue } from "@assetx/queue";
import {
  SUPPORTED_MIME_TYPES,
  type AssetActivityDTO,
  type AssetCommentDTO,
  type AssetDTO,
  type AssetTimelineItemDTO,
  type AssetActivityType,
  type RenditionName,
} from "@assetx/shared-types";
import type { AuthUser } from "../authorization.js";
import { hasPermission, isSuperUser } from "../authorization.js";

export class AssetError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export interface UploadInput {
  accountId: string;
  ownerId: string;
  originalName: string;
  buffer: Buffer;
}

export interface UpdateMetadataInput {
  title?: string | null;
  description?: string | null;
  expiresAt?: string | null;
}

export interface CreateCommentInput {
  body: string;
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
        accountId: input.accountId,
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

    await this.prisma.assetActivity.create({
      data: {
        accountId: asset.accountId,
        assetId: asset.id,
        actorId: input.ownerId,
        type: "asset.created",
        summary: "Asset created",
        detailsJson: JSON.stringify({
          originalName: asset.originalName,
          format: asset.format,
          sizeBytes: asset.sizeBytes,
        }),
        createdAt: asset.createdAt,
      },
    });

    return this.toDTO(asset, []);
  }

  async list(user: AuthUser): Promise<AssetDTO[]> {
    if (!hasPermission(user, "assets:read")) {
      throw new AssetError("Forbidden", 403);
    }
    const where =
      isSuperUser(user) && !user.accountId
        ? {}
        : { accountId: this.requireAccount(user) };
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
    this.assertCanAccessAsset(asset, user, "assets:read");
    return this.toDTO(asset, asset.renditions);
  }

  async updateMetadata(
    id: string,
    user: AuthUser,
    input: UpdateMetadataInput,
  ): Promise<AssetDTO> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertCanAccessAsset(asset, user, "assets:update");

    const expiresAt =
      input.expiresAt !== undefined
        ? this.parseExpiryDate(input.expiresAt)
        : undefined;
    const data = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    };
    const changes = this.changedMetadata(asset, data);

    const updated = await this.prisma.asset.update({
      where: { id },
      data,
      include: { renditions: true },
    });
    if (changes.length > 0) {
      await this.prisma.assetActivity.create({
        data: {
          accountId: asset.accountId,
          assetId: asset.id,
          actorId: user.id,
          type: "asset.updated",
          summary: "Asset metadata updated",
          detailsJson: JSON.stringify({
            changedFields: changes.map((change) => change.field),
            before: Object.fromEntries(
              changes.map((change) => [change.field, change.before]),
            ),
            after: Object.fromEntries(
              changes.map((change) => [change.field, change.after]),
            ),
          }),
        },
      });
    }
    return this.toDTO(updated, updated.renditions);
  }

  async listTimeline(
    id: string,
    user: AuthUser,
  ): Promise<AssetTimelineItemDTO[]> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertCanAccessAsset(asset, user, "comments:read");

    const [comments, activities] = await Promise.all([
      this.prisma.assetComment.findMany({
        where: { assetId: id, accountId: asset.accountId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: true },
      }),
      this.prisma.assetActivity.findMany({
        where: { assetId: id, accountId: asset.accountId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: true },
      }),
    ]);

    return [
      ...comments.map(
        (comment): AssetTimelineItemDTO => ({
          kind: "comment",
          id: comment.id,
          createdAt: comment.createdAt.toISOString(),
          comment: this.commentToDTO(comment, comment.author),
        }),
      ),
      ...activities.map(
        (activity): AssetTimelineItemDTO => ({
          kind: "activity",
          id: activity.id,
          createdAt: activity.createdAt.toISOString(),
          activity: this.activityToDTO(activity, activity.actor),
        }),
      ),
    ]
      .sort((a, b) => {
        const byDate =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return byDate || b.id.localeCompare(a.id);
      })
      .slice(0, 50);
  }

  async createComment(
    id: string,
    user: AuthUser,
    input: CreateCommentInput,
  ): Promise<AssetTimelineItemDTO> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertCanAccessAsset(asset, user, "comments:create");

    const body = input.body.trim();
    if (body.length === 0) {
      throw new AssetError("Comment body is required", 400);
    }
    if (body.length > 2000) {
      throw new AssetError("Comment body must be 2000 characters or less", 400);
    }

    const comment = await this.prisma.assetComment.create({
      data: {
        accountId: asset.accountId,
        assetId: asset.id,
        authorId: user.id,
        body,
      },
      include: { author: true },
    });

    return {
      kind: "comment",
      id: comment.id,
      createdAt: comment.createdAt.toISOString(),
      comment: this.commentToDTO(comment, comment.author),
    };
  }

  async delete(id: string, user: AuthUser): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { renditions: true },
    });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertCanAccessAsset(asset, user, "assets:delete");

    for (const rendition of asset.renditions) {
      await this.storage.delete(rendition.storageKey);
    }
    await this.storage.delete(this.originalKey(id));
    await this.prisma.asset.delete({ where: { id } });
  }

  private requireAccount(user: AuthUser): string {
    if (!user.accountId) {
      throw new AssetError("Account context required", 400);
    }
    return user.accountId;
  }

  private assertCanAccessAsset(
    asset: { accountId: string },
    user: AuthUser,
    permission: Parameters<typeof hasPermission>[1],
  ): void {
    if (!hasPermission(user, permission)) {
      throw new AssetError("Forbidden", 403);
    }
    if (!isSuperUser(user) && asset.accountId !== user.accountId) {
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

  private changedMetadata(
    asset: Asset,
    data: {
      title?: string | null;
      description?: string | null;
      expiresAt?: Date | null;
    },
  ): Array<{ field: string; before: string | null; after: string | null }> {
    const changes: Array<{
      field: string;
      before: string | null;
      after: string | null;
    }> = [];
    if (data.title !== undefined && asset.title !== data.title) {
      changes.push({ field: "title", before: asset.title, after: data.title });
    }
    if (
      data.description !== undefined &&
      asset.description !== data.description
    ) {
      changes.push({
        field: "description",
        before: asset.description,
        after: data.description,
      });
    }
    if (
      data.expiresAt !== undefined &&
      (asset.expiresAt?.toISOString() ?? null) !==
        (data.expiresAt?.toISOString() ?? null)
    ) {
      changes.push({
        field: "expiresAt",
        before: asset.expiresAt?.toISOString() ?? null,
        after: data.expiresAt?.toISOString() ?? null,
      });
    }
    return changes;
  }

  private commentToDTO(
    comment: AssetComment,
    author: Pick<User, "email">,
  ): AssetCommentDTO {
    return {
      id: comment.id,
      accountId: comment.accountId,
      assetId: comment.assetId,
      authorId: comment.authorId,
      authorEmail: author.email,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  private activityToDTO(
    activity: AssetActivity,
    actor: Pick<User, "email"> | null,
  ): AssetActivityDTO {
    return {
      id: activity.id,
      accountId: activity.accountId,
      assetId: activity.assetId,
      actorId: activity.actorId,
      actorEmail: actor?.email ?? null,
      type: activity.type as AssetActivityType,
      summary: activity.summary,
      details: this.parseDetails(activity.detailsJson),
      createdAt: activity.createdAt.toISOString(),
    };
  }

  private parseDetails(value: string | null): Record<string, unknown> | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private toDTO(asset: Asset, renditions: Rendition[]): AssetDTO {
    return {
      id: asset.id,
      accountId: asset.accountId,
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
