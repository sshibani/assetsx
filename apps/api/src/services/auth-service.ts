import { createHash, randomUUID } from "node:crypto";
import type {
  Account,
  AccountMembership,
  PrismaClient,
  User,
} from "@prisma/client";
import { hashPassword, verifyPassword, type TokenService } from "@assetx/auth";
import type {
  AccountDTO,
  AccountMembershipDTO,
  AccountRole,
  AuthAccountContext,
  AuthTokens,
  GlobalRole,
  UserDTO,
} from "@assetx/shared-types";
import { permissionsForAccountRole } from "@assetx/shared-types";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokens: TokenService,
  ) {}

  async register(
    email: string,
    password: string,
    globalRole: GlobalRole = "user",
  ): Promise<UserDTO> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AuthError("Email already registered", 409);
    }
    const slug = this.slugFromEmail(email);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          globalRole,
          identities: {
            create: {
              provider: "local",
              providerSubject: email.toLowerCase(),
              email,
            },
          },
        },
      });
      const account = await tx.account.create({
        data: { name: `${email}'s Account`, slug },
      });
      await tx.accountMembership.create({
        data: {
          accountId: account.id,
          userId: created.id,
          role: "account_owner",
        },
      });
      return created;
    });
    return this.toUserDTO(user);
  }

  async signup(
    accountName: string,
    email: string,
    password: string,
  ): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AuthError("Email already registered", 409);
    }
    const slug = await this.uniqueSlug(this.slugFromName(accountName));
    const userId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          globalRole: "user",
          identities: {
            create: {
              provider: "local",
              providerSubject: email.toLowerCase(),
              email,
            },
          },
        },
      });
      const account = await tx.account.create({
        data: {
          name: accountName,
          slug,
          settings: { create: {} },
        },
      });
      await tx.accountMembership.create({
        data: {
          accountId: account.id,
          userId: created.id,
          role: "account_owner",
        },
      });
      return created.id;
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { account: true } } },
    });
    return this.issueTokens(user, this.defaultAccountId(user));
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { account: true } } },
    });
    if (
      !user ||
      !user.passwordHash ||
      !(await verifyPassword(user.passwordHash, password))
    ) {
      throw new AuthError("Invalid credentials", 401);
    }
    return this.issueTokens(user, this.defaultAccountId(user));
  }

  async switchAccount(userId: string, accountId: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { account: true } } },
    });
    if (!user) throw new AuthError("User not found", 404);
    const membership = user.memberships.find(
      (m) =>
        m.accountId === accountId &&
        m.status === "active" &&
        m.account.status === "active",
    );
    if (!membership && user.globalRole !== "super_user") {
      throw new AuthError("Forbidden", 403);
    }
    return this.issueTokens(user, accountId);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let claims;
    try {
      claims = this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthError("Invalid refresh token", 401);
    }

    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AuthError("Refresh token is no longer valid", 401);
    }

    // Rotate: revoke the used token, then issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: { memberships: { include: { account: true } } },
    });
    if (!user) throw new AuthError("User not found", 404);
    if (claims.accountId && user.globalRole !== "super_user") {
      const membership = user.memberships.find(
        (m) =>
          m.accountId === claims.accountId &&
          m.status === "active" &&
          m.account.status === "active",
      );
      if (!membership) throw new AuthError("Refresh token is no longer valid", 401);
    }

    return this.issueTokens(user, claims.accountId);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: User & { memberships: (AccountMembership & { account: Account })[] },
    accountId: string | null,
  ): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const accountContext = this.toAccountContext(user, accountId);
    const baseClaims = {
      sub: user.id,
      globalRole: user.globalRole as GlobalRole,
      accountId: accountContext?.account.id ?? accountId,
      accountRole: accountContext?.membership.role ?? null,
      permissions:
        user.globalRole === "super_user"
          ? ["platform:manage" as const]
          : accountContext?.permissions ?? [],
      identityProvider: "local",
      sessionId,
      authTime: Math.floor(Date.now() / 1000),
    };
    const accessToken = this.tokens.signAccessToken(baseClaims);
    const refreshToken = this.tokens.signRefreshToken(baseClaims);

    await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        accountId: accountContext?.account.id ?? accountId,
        sessionId,
        identityProvider: "local",
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toUserDTO(user),
      activeAccount: accountContext,
      accounts: this.toAccountContexts(user),
    };
  }

  private defaultAccountId(
    user: User & { memberships: (AccountMembership & { account: Account })[] },
  ): string | null {
    const membership = user.memberships.find(
      (m) => m.status === "active" && m.account.status === "active",
    );
    return membership?.accountId ?? null;
  }

  private toAccountContexts(
    user: User & { memberships: (AccountMembership & { account: Account })[] },
  ): AuthAccountContext[] {
    return user.memberships
      .filter((m) => m.status === "active" && m.account.status === "active")
      .map((m) => this.toAccountContextFromMembership(m, user.email));
  }

  private toAccountContext(
    user: User & { memberships: (AccountMembership & { account: Account })[] },
    accountId: string | null,
  ): AuthAccountContext | null {
    if (!accountId) return null;
    const membership = user.memberships.find((m) => m.accountId === accountId);
    if (!membership) {
      if (user.globalRole === "super_user") return null;
      return null;
    }
    return this.toAccountContextFromMembership(membership, user.email);
  }

  private toAccountContextFromMembership(
    membership: AccountMembership & { account: Account },
    email: string,
  ): AuthAccountContext {
    const role = membership.role as AccountRole;
    return {
      account: this.toAccountDTO(membership.account),
      membership: this.toMembershipDTO(membership, email),
      permissions: permissionsForAccountRole(role),
    };
  }

  private toUserDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      globalRole: user.globalRole as GlobalRole,
      createdAt: user.createdAt.toISOString(),
    };
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
    email: string,
  ): AccountMembershipDTO {
    return {
      id: membership.id,
      accountId: membership.accountId,
      userId: membership.userId,
      email,
      role: membership.role as AccountRole,
      status: membership.status as AccountMembershipDTO["status"],
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    };
  }

  private slugFromEmail(email: string): string {
    return email
      .toLowerCase()
      .replace(/@.*$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || randomUUID();
  }

  private slugFromName(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || randomUUID()
    );
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    for (let attempt = 0; attempt < 50; attempt++) {
      const existing = await this.prisma.account.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      candidate = `${base}-${randomUUID().slice(0, 6)}`.slice(0, 47);
    }
    return `${base}-${randomUUID()}`.slice(0, 60);
  }
}
