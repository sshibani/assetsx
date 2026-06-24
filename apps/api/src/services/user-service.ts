import type { PrismaClient } from "@prisma/client";
import type {
  AccountMembershipDTO,
  AccountRole,
  AdminUserDetailDTO,
  AdminUserDTO,
  GlobalRole,
} from "@assetx/shared-types";
import type { AuthUser } from "../authorization.js";
import { isSuperUser } from "../authorization.js";
import { AssetError } from "./asset-service.js";

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

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
      id: u.id,
      email: u.email,
      globalRole: u.globalRole as GlobalRole,
      createdAt: u.createdAt.toISOString(),
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
      id: found.id,
      email: found.email,
      globalRole: found.globalRole as GlobalRole,
      createdAt: found.createdAt.toISOString(),
      memberships: found.memberships.map(
        (m): AccountMembershipDTO => ({
          id: m.id,
          accountId: m.accountId,
          userId: m.userId,
          email: found.email,
          role: m.role as AccountRole,
          status: m.status as AccountMembershipDTO["status"],
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

  private assertSuperUser(user: AuthUser): void {
    if (!isSuperUser(user)) throw new AssetError("Forbidden", 403);
  }
}
