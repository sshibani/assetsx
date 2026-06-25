import type {
  Account,
  AccountMembership,
  AccountSettings,
  PrismaClient,
  User,
} from "@prisma/client";
import type {
  AccountDTO,
  AccountMembershipDTO,
  AccountPlan,
  AccountRole,
  AccountSettingsDTO,
  AccountUsageDTO,
  AdminAccountDTO,
  DateTimeFormat,
} from "@assetx/shared-types";
import { isValidHexColor, PLAN_STORAGE_QUOTA_BYTES } from "@assetx/shared-types";
import { fileTypeFromBuffer } from "file-type";
import type { StorageProvider } from "@assetx/storage";
import type { AuthUser } from "../authorization.js";
import { hasPermission, isSuperUser } from "../authorization.js";
import { AssetError } from "./asset-service.js";

/** Image MIME types accepted for a workspace logo (incl. SVG). */
const LOGO_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export class AccountService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage?: StorageProvider,
  ) {}

  async list(user: AuthUser): Promise<AccountDTO[]> {
    if (isSuperUser(user)) {
      const accounts = await this.prisma.account.findMany({
        orderBy: { name: "asc" },
      });
      return accounts.map((a) => this.toAccountDTO(a));
    }

    const memberships = await this.prisma.accountMembership.findMany({
      where: { userId: user.id, status: "active", account: { status: "active" } },
      include: { account: true },
      orderBy: { account: { name: "asc" } },
    });
    return memberships.map((m) => this.toAccountDTO(m.account));
  }

  /** Platform admin: list every account (incl. disabled) with member counts. Super user only. */
  async adminList(
    user: AuthUser,
    query: { q?: string } = {},
  ): Promise<AdminAccountDTO[]> {
    if (!isSuperUser(user)) throw new AssetError("Forbidden", 403);
    const q = query.q?.trim().toLowerCase();
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { slug: { contains: q } },
          ],
        }
      : undefined;
    const accounts = await this.prisma.account.findMany({
      where,
      include: { _count: { select: { memberships: true } } },
      orderBy: { name: "asc" },
    });
    return accounts.map((a) => ({
      ...this.toAccountDTO(a),
      memberCount: a._count.memberships,
    }));
  }

  async create(
    user: AuthUser,
    input: { name: string; slug: string },
  ): Promise<AccountDTO> {
    if (!isSuperUser(user)) throw new AssetError("Forbidden", 403);
    const account = await this.prisma.account.create({
      data: {
        name: input.name,
        slug: input.slug,
        memberships: {
          create: {
            userId: user.id,
            role: "account_owner",
          },
        },
      },
    });
    return this.toAccountDTO(account);
  }

  async get(id: string, user: AuthUser): Promise<AccountDTO> {
    await this.assertAccountPermission(id, user, "account:read");
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new AssetError("Account not found", 404);
    return this.toAccountDTO(account);
  }

  async update(
    id: string,
    user: AuthUser,
    input: { name?: string; slug?: string; status?: string },
  ): Promise<AccountDTO> {
    await this.assertAccountPermission(id, user, "account:update");
    const account = await this.prisma.account.update({
      where: { id },
      data: input,
    });
    return this.toAccountDTO(account);
  }

  async listMembers(id: string, user: AuthUser): Promise<AccountMembershipDTO[]> {
    await this.assertAccountPermission(id, user, "members:read");
    const memberships = await this.prisma.accountMembership.findMany({
      where: { accountId: id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => this.toMembershipDTO(m, m.user));
  }

  async addMember(
    id: string,
    user: AuthUser,
    input: { email: string; role: AccountRole },
  ): Promise<AccountMembershipDTO> {
    await this.assertAccountPermission(id, user, "members:manage");
    if (input.role === "account_owner") {
      await this.assertAccountPermission(id, user, "members:manage_admins");
    }

    const email = input.email.trim().toLowerCase();
    const membership = await this.prisma.$transaction(async (tx) => {
      const member =
        (await tx.user.findFirst({
          where: {
            OR: [
              { email },
              {
                identities: {
                  some: { provider: "local", providerSubject: email },
                },
              },
            ],
          },
        })) ??
        (await tx.user.create({
          data: {
            email,
            globalRole: "user",
            identities: {
              create: {
                provider: "local",
                providerSubject: email,
                email,
              },
            },
          },
        }));

      return tx.accountMembership.upsert({
        where: { accountId_userId: { accountId: id, userId: member.id } },
        create: {
          accountId: id,
          userId: member.id,
          role: input.role,
          status: "active",
        },
        update: { role: input.role, status: "active" },
        include: { user: true },
      });
    });
    return this.toMembershipDTO(membership, membership.user);
  }

  async updateMember(
    accountId: string,
    membershipId: string,
    user: AuthUser,
    input: { role?: AccountRole; status?: string },
  ): Promise<AccountMembershipDTO> {
    await this.assertAccountPermission(accountId, user, "members:manage");
    const current = await this.prisma.accountMembership.findUnique({
      where: { id: membershipId },
    });
    if (!current || current.accountId !== accountId) {
      throw new AssetError("Membership not found", 404);
    }

    // Assigning or modifying an account_owner requires owner-level rights.
    if (input.role === "account_owner" || current.role === "account_owner") {
      await this.assertAccountPermission(accountId, user, "members:manage_admins");
    }

    // Last-owner protection: a change that removes the final active owner is blocked.
    const losesOwnerRole =
      current.role === "account_owner" &&
      ((input.role && input.role !== "account_owner") ||
        input.status === "disabled");
    if (losesOwnerRole) {
      await this.assertNotLastOwner(accountId, membershipId);
    }

    const membership = await this.prisma.accountMembership.update({
      where: { id: membershipId },
      data: input,
      include: { user: true },
    });
    return this.toMembershipDTO(membership, membership.user);
  }

  async deleteMember(
    accountId: string,
    membershipId: string,
    user: AuthUser,
  ): Promise<void> {
    await this.assertAccountPermission(accountId, user, "members:manage");
    const current = await this.prisma.accountMembership.findUnique({
      where: { id: membershipId },
    });
    if (!current || current.accountId !== accountId) {
      throw new AssetError("Membership not found", 404);
    }
    if (current.role === "account_owner") {
      await this.assertAccountPermission(accountId, user, "members:manage_admins");
      await this.assertNotLastOwner(accountId, membershipId);
    }
    await this.prisma.accountMembership.delete({ where: { id: membershipId } });
  }

  async getUsage(accountId: string, user: AuthUser): Promise<AccountUsageDTO> {
    await this.assertAccountPermission(accountId, user, "account:read");
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true, storageQuotaBytes: true },
    });
    if (!account) throw new AssetError("Account not found", 404);

    const [assetAgg, renditionAgg] = await Promise.all([
      this.prisma.asset.aggregate({
        where: { accountId },
        _sum: { sizeBytes: true },
      }),
      this.prisma.rendition.aggregate({
        where: { asset: { accountId } },
        _sum: { sizeBytes: true },
      }),
    ]);

    const usedBytes =
      (assetAgg._sum.sizeBytes ?? 0) + (renditionAgg._sum.sizeBytes ?? 0);
    // Explicit per-account quota wins; otherwise fall back to the plan default.
    const quotaBytes =
      account.storageQuotaBytes != null
        ? Number(account.storageQuotaBytes)
        : PLAN_STORAGE_QUOTA_BYTES[account.plan as AccountPlan] ??
          PLAN_STORAGE_QUOTA_BYTES.trial;

    return { accountId, usedBytes, quotaBytes };
  }

  /**
   * Set (or clear) an account's explicit storage quota. Platform action —
   * super user only. Passing null restores the plan-based default.
   */
  async setStorageQuota(
    accountId: string,
    user: AuthUser,
    quotaBytes: number | null,
  ): Promise<AccountUsageDTO> {
    if (!isSuperUser(user)) throw new AssetError("Forbidden", 403);
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new AssetError("Account not found", 404);
    if (quotaBytes != null && (!Number.isFinite(quotaBytes) || quotaBytes < 0)) {
      throw new AssetError("quotaBytes must be a non-negative number", 400);
    }
    await this.prisma.account.update({
      where: { id: accountId },
      data: { storageQuotaBytes: quotaBytes == null ? null : BigInt(Math.floor(quotaBytes)) },
    });
    return this.getUsage(accountId, user);
  }

  async getSettings(
    accountId: string,
    user: AuthUser,
  ): Promise<AccountSettingsDTO> {
    await this.assertAccountPermission(accountId, user, "account:read");
    const settings = await this.prisma.accountSettings.upsert({
      where: { accountId },
      create: { accountId },
      update: {},
    });
    return this.toSettingsDTO(settings);
  }

  async updateSettings(
    accountId: string,
    user: AuthUser,
    input: {
      dateTimeFormat?: DateTimeFormat;
      timezone?: string;
      brandColor?: string;
      typeface?: string | null;
    },
  ): Promise<AccountSettingsDTO> {
    await this.assertAccountPermission(accountId, user, "account:update");

    const data: {
      dateTimeFormat?: DateTimeFormat;
      timezone?: string;
      brandColor?: string;
      typeface?: string | null;
    } = {};
    if (input.dateTimeFormat !== undefined) data.dateTimeFormat = input.dateTimeFormat;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.brandColor !== undefined) {
      if (!isValidHexColor(input.brandColor)) {
        throw new AssetError("brandColor must be a hex color (e.g. #343ced)", 400);
      }
      data.brandColor = input.brandColor.toLowerCase();
    }
    if (input.typeface !== undefined) {
      data.typeface = input.typeface?.trim() ? input.typeface.trim() : null;
    }

    const settings = await this.prisma.accountSettings.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
    return this.toSettingsDTO(settings);
  }

  async uploadLogo(
    accountId: string,
    user: AuthUser,
    file: { buffer: Buffer },
  ): Promise<AccountSettingsDTO> {
    await this.assertAccountPermission(accountId, user, "account:update");
    const storage = this.requireStorage();

    const detected = await fileTypeFromBuffer(file.buffer);
    // SVG often isn't detected by magic bytes; fall back to a lightweight sniff.
    const mime =
      detected?.mime ?? (this.looksLikeSvg(file.buffer) ? "image/svg+xml" : undefined);
    if (!mime || !(mime in LOGO_MIME_EXT)) {
      throw new AssetError("Logo must be a PNG, JPEG, WebP or SVG image", 400);
    }

    const ext = LOGO_MIME_EXT[mime]!;
    const key = this.logoKey(accountId, ext);

    // Remove any previously stored logo with a different extension.
    const existing = await this.prisma.accountSettings.findUnique({
      where: { accountId },
      select: { logoStorageKey: true },
    });
    if (existing?.logoStorageKey && existing.logoStorageKey !== key) {
      await storage.delete(existing.logoStorageKey);
    }

    await storage.put(key, file.buffer, mime);

    const settings = await this.prisma.accountSettings.upsert({
      where: { accountId },
      create: { accountId, logoStorageKey: key },
      update: { logoStorageKey: key },
    });
    return this.toSettingsDTO(settings);
  }

  async removeLogo(
    accountId: string,
    user: AuthUser,
  ): Promise<AccountSettingsDTO> {
    await this.assertAccountPermission(accountId, user, "account:update");
    const storage = this.requireStorage();
    const existing = await this.prisma.accountSettings.findUnique({
      where: { accountId },
      select: { logoStorageKey: true },
    });
    if (existing?.logoStorageKey) {
      await storage.delete(existing.logoStorageKey);
    }
    const settings = await this.prisma.accountSettings.upsert({
      where: { accountId },
      create: { accountId, logoStorageKey: null },
      update: { logoStorageKey: null },
    });
    return this.toSettingsDTO(settings);
  }

  private requireStorage(): StorageProvider {
    if (!this.storage) {
      throw new AssetError("Storage is not configured", 500);
    }
    return this.storage;
  }

  private logoKey(accountId: string, ext: string): string {
    return `accounts/${accountId}/branding/logo.${ext}`;
  }

  private looksLikeSvg(buffer: Buffer): boolean {
    const head = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
    return head.startsWith("<?xml") ? head.includes("<svg") : head.startsWith("<svg");
  }

  private async assertNotLastOwner(
    accountId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const remainingOwners = await this.prisma.accountMembership.count({
      where: {
        accountId,
        role: "account_owner",
        status: "active",
        id: { not: excludingMembershipId },
      },
    });
    if (remainingOwners === 0) {
      throw new AssetError(
        "Cannot remove the last active account owner",
        409,
      );
    }
  }

  private async assertAccountPermission(
    accountId: string,
    user: AuthUser,
    permission: Parameters<typeof hasPermission>[1],
  ): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AssetError("Account not found", 404);
    if (isSuperUser(user)) return;
    if (user.accountId !== accountId || !hasPermission(user, permission)) {
      throw new AssetError("Forbidden", 403);
    }
  }

  private toAccountDTO(account: Account): AccountDTO {
    return {
      id: account.id,
      name: account.name,
      slug: account.slug,
      status: account.status as AccountDTO["status"],
      plan: account.plan as AccountDTO["plan"],
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private toSettingsDTO(settings: AccountSettings): AccountSettingsDTO {
    return {
      accountId: settings.accountId,
      dateTimeFormat: settings.dateTimeFormat as DateTimeFormat,
      timezone: settings.timezone,
      brandColor: settings.brandColor,
      logoUrl:
        settings.logoStorageKey && this.storage
          ? this.storage.getUrl(settings.logoStorageKey)
          : null,
      typeface: settings.typeface,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private toMembershipDTO(
    membership: AccountMembership,
    user: User,
  ): AccountMembershipDTO {
    return {
      id: membership.id,
      accountId: membership.accountId,
      userId: membership.userId,
      email: user.email,
      role: membership.role as AccountRole,
      status: membership.status as AccountMembershipDTO["status"],
      lastActiveAt: membership.lastActiveAt?.toISOString() ?? null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };
  }
}
