import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, Bundle, BundleAsset, Asset, Rendition } from "@prisma/client";
import type { StorageProvider } from "@assetx/storage";
import type {
  AssetDTO,
  BundleAssetDTO,
  BundleDTO,
  BundleDetailDTO,
  BundleShareCreatedDTO,
  PublicBundleDTO,
  RenditionName,
} from "@assetx/shared-types";
import type { AuthUser } from "../authorization.js";
import { hasPermission, isSuperUser } from "../authorization.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class BundleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export interface CreateBundleInput {
  title: string;
  description?: string | null;
}

export interface UpdateBundleInput {
  title?: string;
  description?: string | null;
}

export interface AddAssetInput {
  assetId: string;
  position?: number;
}

export interface CreateShareInput {
  expiresInDays?: number;
}

type AssetWithRenditions = Asset & { renditions: Rendition[] };
type BundleItem = BundleAsset & { asset: AssetWithRenditions };

export class BundleService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageProvider,
    private readonly shareBaseUrl = "http://localhost:3000",
  ) {}

  async list(user: AuthUser): Promise<BundleDTO[]> {
    if (!hasPermission(user, "bundles:read")) {
      throw new BundleError("Forbidden", 403);
    }
    const where =
      isSuperUser(user) && !user.accountId
        ? {}
        : { accountId: this.requireAccount(user) };
    const bundles = await this.prisma.bundle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return bundles.map((b) => this.toDTO(b, b._count.items));
  }

  async create(user: AuthUser, input: CreateBundleInput): Promise<BundleDTO> {
    if (!hasPermission(user, "bundles:create")) {
      throw new BundleError("Forbidden", 403);
    }
    const accountId = this.requireAccount(user);
    const title = input.title.trim();
    if (title.length === 0) {
      throw new BundleError("Title is required", 400);
    }

    const bundle = await this.prisma.bundle.create({
      data: {
        accountId,
        ownerId: user.id,
        title,
        description: input.description ?? null,
      },
    });
    return this.toDTO(bundle, 0);
  }

  async getDetail(id: string, user: AuthUser): Promise<BundleDetailDTO> {
    const bundle = await this.loadAccessible(id, user, "bundles:read");
    const items = await this.prisma.bundleAsset.findMany({
      where: { bundleId: id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { asset: { include: { renditions: true } } },
    });
    return {
      ...this.toDTO(bundle, items.length),
      items: items.map((item) => this.itemToDTO(item)),
    };
  }

  async update(
    id: string,
    user: AuthUser,
    input: UpdateBundleInput,
  ): Promise<BundleDTO> {
    await this.loadAccessible(id, user, "bundles:update");

    const data: { title?: string; description?: string | null } = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length === 0) {
        throw new BundleError("Title is required", 400);
      }
      data.title = title;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }

    const updated = await this.prisma.bundle.update({
      where: { id },
      data,
      include: { _count: { select: { items: true } } },
    });
    return this.toDTO(updated, updated._count.items);
  }

  async delete(id: string, user: AuthUser): Promise<void> {
    await this.loadAccessible(id, user, "bundles:delete");
    await this.prisma.bundle.delete({ where: { id } });
  }

  async addAsset(
    id: string,
    user: AuthUser,
    input: AddAssetInput,
  ): Promise<BundleDTO> {
    const bundle = await this.loadAccessible(id, user, "bundles:update");

    const asset = await this.prisma.asset.findUnique({
      where: { id: input.assetId },
    });
    // Treat assets outside the bundle's account as not found to avoid leaking existence.
    if (!asset || asset.accountId !== bundle.accountId) {
      throw new BundleError("Asset not found", 404);
    }

    const existing = await this.prisma.bundleAsset.findUnique({
      where: { bundleId_assetId: { bundleId: id, assetId: input.assetId } },
    });
    if (existing) {
      throw new BundleError("Asset is already in this bundle", 409);
    }

    await this.prisma.bundleAsset.create({
      data: {
        bundleId: id,
        assetId: input.assetId,
        position: input.position ?? 0,
      },
    });

    const count = await this.prisma.bundleAsset.count({
      where: { bundleId: id },
    });
    return this.toDTO(bundle, count);
  }

  async removeAsset(
    id: string,
    user: AuthUser,
    assetId: string,
  ): Promise<void> {
    await this.loadAccessible(id, user, "bundles:update");
    const existing = await this.prisma.bundleAsset.findUnique({
      where: { bundleId_assetId: { bundleId: id, assetId } },
    });
    if (!existing) {
      throw new BundleError("Asset is not in this bundle", 404);
    }
    await this.prisma.bundleAsset.delete({
      where: { bundleId_assetId: { bundleId: id, assetId } },
    });
  }

  async createShare(
    id: string,
    user: AuthUser,
    input: CreateShareInput = {},
  ): Promise<BundleShareCreatedDTO> {
    await this.loadAccessible(id, user, "bundles:share");

    const token = randomBytes(32).toString("base64url");
    const expiresAt =
      input.expiresInDays !== undefined
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const share = await this.prisma.bundleShare.create({
      data: {
        bundleId: id,
        tokenHash: sha256(token),
        createdById: user.id,
        expiresAt,
      },
    });

    return {
      id: share.id,
      bundleId: share.bundleId,
      createdById: share.createdById,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      revokedAt: share.revokedAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
      token,
      url: `${this.shareBaseUrl}/shared/bundles/${token}`,
    };
  }

  async revokeShare(
    id: string,
    user: AuthUser,
    shareId: string,
  ): Promise<void> {
    await this.loadAccessible(id, user, "bundles:share");
    const share = await this.prisma.bundleShare.findUnique({
      where: { id: shareId },
    });
    if (!share || share.bundleId !== id) {
      throw new BundleError("Share not found", 404);
    }
    if (share.revokedAt) return;
    await this.prisma.bundleShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
  }

  /** Resolve a public share by its raw token. No authentication. */
  async getPublicByToken(token: string): Promise<PublicBundleDTO> {
    const share = await this.prisma.bundleShare.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (
      !share ||
      share.revokedAt !== null ||
      (share.expiresAt !== null && share.expiresAt.getTime() < Date.now())
    ) {
      throw new BundleError("Share not found", 404);
    }

    const bundle = await this.prisma.bundle.findUnique({
      where: { id: share.bundleId },
    });
    if (!bundle) throw new BundleError("Share not found", 404);

    const items = await this.prisma.bundleAsset.findMany({
      where: { bundleId: bundle.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { asset: { include: { renditions: true } } },
    });

    return {
      title: bundle.title,
      description: bundle.description,
      items: items.map((item) => this.itemToDTO(item)),
    };
  }

  private async loadAccessible(
    id: string,
    user: AuthUser,
    permission: Parameters<typeof hasPermission>[1],
  ): Promise<Bundle> {
    const bundle = await this.prisma.bundle.findUnique({ where: { id } });
    if (!bundle) throw new BundleError("Bundle not found", 404);
    if (!hasPermission(user, permission)) {
      throw new BundleError("Forbidden", 403);
    }
    if (!isSuperUser(user) && bundle.accountId !== user.accountId) {
      throw new BundleError("Forbidden", 403);
    }
    return bundle;
  }

  private requireAccount(user: AuthUser): string {
    if (!user.accountId) {
      throw new BundleError("Account context required", 400);
    }
    return user.accountId;
  }

  private toDTO(bundle: Bundle, assetCount: number): BundleDTO {
    return {
      id: bundle.id,
      accountId: bundle.accountId,
      ownerId: bundle.ownerId,
      title: bundle.title,
      description: bundle.description,
      assetCount,
      createdAt: bundle.createdAt.toISOString(),
      updatedAt: bundle.updatedAt.toISOString(),
    };
  }

  private itemToDTO(item: BundleItem): BundleAssetDTO {
    return {
      assetId: item.assetId,
      position: item.position,
      asset: this.assetToDTO(item.asset),
    };
  }

  private assetToDTO(asset: AssetWithRenditions): AssetDTO {
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
      renditions: asset.renditions.map((r) => ({
        id: r.id,
        name: r.name as RenditionName,
        width: r.width,
        height: r.height,
        format: r.format,
        sizeBytes: r.sizeBytes,
        url: this.storage.getUrl(r.storageKey),
      })),
      originalUrl: this.storage.getUrl(`assets/${asset.id}/original`),
      expiresAt: asset.expiresAt?.toISOString() ?? null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}
