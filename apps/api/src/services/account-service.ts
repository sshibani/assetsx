import type {
  Account,
  AccountMembership,
  PrismaClient,
  User,
} from "@prisma/client";
import type {
  AccountDTO,
  AccountMembershipDTO,
  AccountRole,
} from "@assetx/shared-types";
import type { AuthUser } from "../authorization.js";
import { hasPermission, isSuperUser } from "../authorization.js";
import { AssetError } from "./asset-service.js";

export class AccountService {
  constructor(private readonly prisma: PrismaClient) {}

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
    const member = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!member) throw new AssetError("User not found", 404);

    const membership = await this.prisma.accountMembership.upsert({
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
    const membership = await this.prisma.accountMembership.update({
      where: { id: membershipId },
      data: input,
      include: { user: true },
    });
    return this.toMembershipDTO(membership, membership.user);
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
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
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
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };
  }
}
