import type { PrismaClient, Publication } from "@prisma/client";
import type { JobQueue } from "@assetx/queue";
import type { ChannelRegistry } from "@assetx/publishing";
import type { PublicationDTO } from "@assetx/shared-types";
import type { AuthUser } from "../auth-guard.js";
import { AssetError } from "./asset-service.js";

export class PublishService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: JobQueue,
    private readonly channels: ChannelRegistry,
  ) {}

  listChannels() {
    return this.channels.list();
  }

  async publish(
    assetId: string,
    user: AuthUser,
    channelIds: string[],
  ): Promise<void> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AssetError("Asset not found", 404);
    if (user.role !== "admin" && asset.ownerId !== user.id) {
      throw new AssetError("Forbidden", 403);
    }

    // Validate all channels up-front (throws on unknown).
    for (const id of channelIds) {
      this.channels.get(id);
    }

    for (const channelId of channelIds) {
      await this.queue.enqueue("publishing", {
        type: "publish-asset",
        assetId,
        channelId,
      });
    }
  }

  async listPublications(
    assetId: string,
    user: AuthUser,
  ): Promise<PublicationDTO[]> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AssetError("Asset not found", 404);
    if (user.role !== "admin" && asset.ownerId !== user.id) {
      throw new AssetError("Forbidden", 403);
    }
    const pubs = await this.prisma.publication.findMany({
      where: { assetId },
      orderBy: { createdAt: "desc" },
    });
    return pubs.map((p) => this.toDTO(p));
  }

  async unpublish(publicationId: string, user: AuthUser): Promise<void> {
    const pub = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      include: { asset: true },
    });
    if (!pub) throw new AssetError("Publication not found", 404);
    if (user.role !== "admin" && pub.asset.ownerId !== user.id) {
      throw new AssetError("Forbidden", 403);
    }
    try {
      const channel = this.channels.get(pub.channelId);
      if (pub.reference) await channel.unpublish(pub.reference);
    } catch {
      // channel may no longer exist; still remove the record
    }
    await this.prisma.publication.delete({ where: { id: publicationId } });
  }

  private toDTO(p: Publication): PublicationDTO {
    return {
      id: p.id,
      assetId: p.assetId,
      channelId: p.channelId,
      status: p.status as PublicationDTO["status"],
      reference: p.reference,
      error: p.error,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
