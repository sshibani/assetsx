import type { PrismaClient, User } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";
import { hashPassword, verifyPassword } from "@assetx/auth";
import type { StorageProvider } from "@assetx/storage";
import type {
  AccountMembershipDTO,
  AccountRole,
  AdminUserDetailDTO,
  AdminUserDTO,
  GlobalRole,
  Locale,
  UserDTO,
} from "@assetx/shared-types";
import type { AuthUser } from "../authorization.js";
import { isSuperUser } from "../authorization.js";
import { AssetError } from "./asset-service.js";

/** Image MIME types accepted for a user avatar. */
const AVATAR_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage?: StorageProvider,
  ) {}

  async listUsers(user: AuthUser, query: { q?: string } = {}): Promise<AdminUserDTO[]> {
    this.assertSuperUser(user);
    const where = query.q
      ? { email: { contains: query.q.toLowerCase() } }
      : undefined;
    const users = await this.prisma.user.findMany({
      where,
      include: { _count: { select: { memberships: true } } },
      orderBy: { email: "asc" },
    });
    return users.map((u) => ({
      ...this.toUserDTO(u),
      accountCount: u._count.memberships,
    }));
  }

  async getUser(user: AuthUser, userId: string): Promise<AdminUserDetailDTO> {
    this.assertSuperUser(user);
    const found = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { account: true } } },
    });
    if (!found) throw new AssetError("User not found", 404);
    return {
      ...this.toUserDTO(found),
      memberships: found.memberships.map(
        (m): AccountMembershipDTO => ({
          id: m.id,
          accountId: m.accountId,
          userId: m.userId,
          email: found.email,
          role: m.role as AccountRole,
          status: m.status as AccountMembershipDTO["status"],
          lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }),
      ),
    };
  }

  async setGlobalRole(
    user: AuthUser,
    userId: string,
    globalRole: GlobalRole,
  ): Promise<AdminUserDetailDTO> {
    this.assertSuperUser(user);
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new AssetError("User not found", 404);

    // Last-super-user protection: cannot demote the final active super user.
    if (target.globalRole === "super_user" && globalRole !== "super_user") {
      const remaining = await this.prisma.user.count({
        where: { globalRole: "super_user", id: { not: userId } },
      });
      if (remaining === 0) {
        throw new AssetError("Cannot demote the last super user", 409);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { globalRole },
    });
    return this.getUser(user, userId);
  }

  // --- Self-service (the authenticated user manages their own profile) ---

  async getMe(user: AuthUser): Promise<UserDTO> {
    const found = await this.requireUser(user.id);
    return this.toUserDTO(found);
  }

  async updateLocale(user: AuthUser, locale: Locale): Promise<UserDTO> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { locale },
    });
    return this.toUserDTO(updated);
  }

  async uploadAvatar(user: AuthUser, file: { buffer: Buffer }): Promise<UserDTO> {
    const storage = this.requireStorage();
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !(detected.mime in AVATAR_MIME_EXT)) {
      throw new AssetError("Avatar must be a PNG, JPEG, WebP or GIF image", 400);
    }
    const ext = AVATAR_MIME_EXT[detected.mime]!;
    const key = `users/${user.id}/avatar.${ext}`;

    const current = await this.requireUser(user.id);
    if (current.avatarStorageKey && current.avatarStorageKey !== key) {
      await storage.delete(current.avatarStorageKey);
    }
    await storage.put(key, file.buffer, detected.mime);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarStorageKey: key },
    });
    return this.toUserDTO(updated);
  }

  async removeAvatar(user: AuthUser): Promise<UserDTO> {
    const storage = this.requireStorage();
    const current = await this.requireUser(user.id);
    if (current.avatarStorageKey) {
      await storage.delete(current.avatarStorageKey);
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarStorageKey: null },
    });
    return this.toUserDTO(updated);
  }

  async changePassword(
    user: AuthUser,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const found = await this.requireUser(user.id);
    if (!found.passwordHash) {
      throw new AssetError(
        "Password change is unavailable for SSO-only accounts",
        400,
      );
    }
    const ok = await verifyPassword(found.passwordHash, input.currentPassword);
    if (!ok) throw new AssetError("Current password is incorrect", 400);
    if (input.newPassword.length < 8) {
      throw new AssetError("New password must be at least 8 characters", 400);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
  }

  private async requireUser(id: string): Promise<User> {
    const found = await this.prisma.user.findUnique({ where: { id } });
    if (!found) throw new AssetError("User not found", 404);
    return found;
  }

  private requireStorage(): StorageProvider {
    if (!this.storage) throw new AssetError("Storage is not configured", 500);
    return this.storage;
  }

  private toUserDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      globalRole: user.globalRole as GlobalRole,
      locale: user.locale as Locale,
      avatarUrl:
        user.avatarStorageKey && this.storage
          ? this.storage.getUrl(user.avatarStorageKey)
          : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private assertSuperUser(user: AuthUser): void {
    if (!isSuperUser(user)) throw new AssetError("Forbidden", 403);
  }
}
