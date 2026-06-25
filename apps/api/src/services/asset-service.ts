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
  type AssetType,
} from "@assetx/shared-types";
import type { AuthUser } from "../authorization.js";
import { hasPermission, isSuperUser } from "../authorization.js";
import { assetToDTO, originalKey } from "../mappers/asset-mapper.js";
import { parseJsonObject } from "../lib/json.js";

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
  tags?: string[];
}

/** Bound tag input so a crafted request can't create unbounded tag rows. */
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 64;

/**
 * Raster image formats as stored in `Asset.format` (the `file-type` ext, so
 * jpeg is stored as "jpg"). Kept in sync with classifyAssetType's notion of
 * "image" for DB-level filtering.
 */
const IMAGE_FORMATS_DB = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

/** Normalize, trim, lowercase, dedupe and sort a tag list. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag.length > 0) seen.add(tag);
  }
  return [...seen].sort();
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

    return this.toDTO(asset, [], []);
  }

  async list(
    user: AuthUser,
    filters: { tag?: string; type?: AssetType } = {},
  ): Promise<AssetDTO[]> {
    if (!hasPermission(user, "assets:read")) {
      throw new AssetError("Forbidden", 403);
    }
    const scope =
      isSuperUser(user) && !user.accountId
        ? {}
        : { accountId: this.requireAccount(user) };
    const tag = filters.tag?.trim().toLowerCase();
    const where = {
      ...scope,
      ...(tag ? { tags: { some: { tag } } } : {}),
      ...this.typeWhere(filters.type),
    };
    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { renditions: true, tags: true },
    });
    return assets.map((a) =>
      this.toDTO(a, a.renditions, a.tags.map((t) => t.tag)),
    );
  }

  /** Translate an AssetType filter into a Prisma where-fragment. */
  private typeWhere(type?: AssetType): object {
    if (!type) return {};
    if (type === "logo") {
      return { OR: [{ format: "svg" }, { tags: { some: { tag: "logo" } } }] };
    }
    if (type === "image") {
      return {
        format: { in: IMAGE_FORMATS_DB },
        NOT: { tags: { some: { tag: "logo" } } },
      };
    }
    // document: everything that isn't an image or a logo
    return {
      format: { notIn: [...IMAGE_FORMATS_DB, "svg"] },
      NOT: { tags: { some: { tag: "logo" } } },
    };
  }

  async getForUser(id: string, user: AuthUser): Promise<AssetDTO> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { renditions: true, tags: true, owner: { select: { email: true } } },
    });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertCanAccessAsset(asset, user, "assets:read");
    return this.toDTO(
      asset,
      asset.renditions,
      asset.tags.map((t) => t.tag),
      asset.owner?.email ?? null,
    );
  }

  async updateMetadata(
    id: string,
    user: AuthUser,
    input: UpdateMetadataInput,
  ): Promise<AssetDTO> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!asset) throw new AssetError("Asset not found", 404);
    this.assertCanAccessAsset(asset, user, "assets:update");

    if (input.tags !== undefined) {
      if (input.tags.length > MAX_TAGS) {
        throw new AssetError(`A maximum of ${MAX_TAGS} tags is allowed`, 400);
      }
      if (input.tags.some((t) => t.trim().length > MAX_TAG_LENGTH)) {
        throw new AssetError(
          `Tags must be ${MAX_TAG_LENGTH} characters or less`,
          400,
        );
      }
    }

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

    const currentTags = asset.tags.map((t) => t.tag).sort();
    const nextTags =
      input.tags !== undefined ? normalizeTags(input.tags) : currentTags;
    const tagsChanged =
      input.tags !== undefined &&
      JSON.stringify(currentTags) !== JSON.stringify(nextTags);
    if (tagsChanged) {
      changes.push({
        field: "tags",
        before: currentTags.join(", ") || null,
        after: nextTags.join(", ") || null,
      });
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...data,
        ...(tagsChanged
          ? {
              tags: {
                deleteMany: {},
                create: nextTags.map((tag) => ({ tag })),
              },
            }
          : {}),
      },
      include: { renditions: true, tags: true },
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
    return this.toDTO(updated, updated.renditions, updated.tags.map((t) => t.tag));
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
    return originalKey(assetId);
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
      details: parseJsonObject(activity.detailsJson),
      createdAt: activity.createdAt.toISOString(),
    };
  }

  private toDTO(
    asset: Asset,
    renditions: Rendition[],
    tags: string[],
    ownerEmail: string | null = null,
  ): AssetDTO {
    return assetToDTO(asset, renditions, this.storage, tags, ownerEmail);
  }
}
